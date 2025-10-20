# backend/trainer_ml.py

from __future__ import annotations

# ── 표준 라이브러리
import argparse
import gc
import random
import threading
import warnings
from pathlib import Path
from typing import Any, Callable, List, Tuple, Dict, Optional, Union
import sys
import io
import pickle
import joblib
from joblib import Parallel, delayed
import multiprocessing
import time
import json
from importlib import metadata as importlib_metadata

# 패키지 루트 경로를 sys.path에 추가하여 `python backend/trainer_ml.py` 직접 실행을 지원
project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# ── 서드-파티
import numpy as np
import pandas as pd
import psutil
import yaml
from sklearn.preprocessing import LabelEncoder, OrdinalEncoder, StandardScaler, normalize
from sklearn.decomposition import PCA
from sklearn.feature_selection import VarianceThreshold

# ── 사내 모듈
from backend.constants import NUMERIC_FEATURES
from common.config_store import TrainerRuntimeConfig, workflow_config_store
from common.file_lock import FileLock, FileLockTimeout
from backend.index_hnsw import HNSWSearch
from backend.feature_weights import FeatureWeightManager  # 추가
from common.logger import get_logger
from common.time_aggregator import TimeAggregationConfig, generate_time_profiles

from models.manifest import write_manifest

logger = get_logger("trainer_ml")


class _LegacyDummyPickleModule:
    """joblib 호환을 위한 레거시 더미 피클 로더."""

    @staticmethod
    def loads(data: bytes):
        buffer = io.BytesIO(data)

        class _LegacyUnpickler(pickle.Unpickler):
            def find_class(self, module, name):  # noqa: D401
                if module == "__main__" and name == "DummySimilarityEngine":
                    from backend.dummy_models import DummySimilarityEngine  # pylint: disable=import-outside-toplevel

                    return DummySimilarityEngine
                if module == "__main__" and name == "DummyEncoder":
                    from backend.dummy_models import DummyEncoder  # pylint: disable=import-outside-toplevel

                    return DummyEncoder
                if module == "__main__" and name == "DummyScaler":
                    from backend.dummy_models import DummyScaler  # pylint: disable=import-outside-toplevel

                    return DummyScaler
                return super().find_class(module, name)

        return _LegacyUnpickler(buffer).load()

    @staticmethod
    def dumps(obj, protocol=None):
        return pickle.dumps(obj, protocol=protocol)

warnings.filterwarnings(
    "ignore",
    message=".*Downcasting behavior in `replace` is deprecated.*",
    category=FutureWarning,
    module="backend.trainer_ml",
)

# 런타임 설정 기본값 (워크플로우 그래프 SAVE 즉시 반영용)
TRAINER_RUNTIME_SETTINGS: Dict[str, float | bool | int | None] = {
    "similarity_threshold": 0.8,
    "trim_std_enabled": True,
    "trim_lower_percent": 0.05,
    "trim_upper_percent": 0.95,
    "time_profiles_enabled": False,
    "time_profile_strategy": "sigma_profile",
    "time_profile_optimal_sigma": 0.67,
    "time_profile_safe_sigma": 1.28,
    "hnsw_M": 32,
    "hnsw_ef_construction": 200,
    "hnsw_ef_search": None,
}


def _collect_training_runtime_versions() -> Dict[str, Optional[str]]:
    """Gather runtime version information for training metadata."""

    versions: Dict[str, Optional[str]] = {
        "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "joblib": getattr(joblib, "__version__", None),
    }

    try:
        versions["scikit_learn"] = importlib_metadata.version("scikit-learn")
    except importlib_metadata.PackageNotFoundError:
        versions["scikit_learn"] = None

    return versions


def _get_hnsw_params() -> Dict[str, Optional[int]]:
    """Return HNSW parameter overrides from the runtime settings."""

    def _coerce_int(value: Any) -> Optional[int]:
        if value in (None, "", "null"):
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    return {
        "M": _coerce_int(TRAINER_RUNTIME_SETTINGS.get("hnsw_M", 32)) or 32,
        "ef_construction": _coerce_int(TRAINER_RUNTIME_SETTINGS.get("hnsw_ef_construction", 200))
        or 200,
        "ef_search": _coerce_int(TRAINER_RUNTIME_SETTINGS.get("hnsw_ef_search")),
    }


def _export_projector_fallback(
    tb_dir: Path,
    *,
    vectors: np.ndarray,
    item_codes: List[str],
    metadata_df: pd.DataFrame,
    metadata_cols: Optional[List[str]],
) -> None:
    """Create minimal TensorBoard projector assets without TensorFlow."""

    tb_dir.mkdir(parents=True, exist_ok=True)

    vectors_path = tb_dir / "vectors.tsv"
    metadata_path = tb_dir / "metadata.tsv"
    config_path = tb_dir / "projector_config.json"

    np.savetxt(vectors_path, vectors.astype(np.float32, copy=False), delimiter="\t", fmt="%.6f")

    columns: List[str] = ["ITEM_CD"]
    if metadata_cols:
        for col in metadata_cols:
            if col not in columns:
                columns.append(col)

    metadata = metadata_df.loc[:, [c for c in metadata_df.columns if c in columns]].copy()
    for col in columns:
        if col not in metadata.columns:
            metadata[col] = ""

    metadata = metadata.reindex(columns=columns)
    # Reorder rows to match the embedding order using ITEM_CD values
    metadata = metadata.set_index("ITEM_CD").reindex(item_codes).reset_index()
    metadata.to_csv(metadata_path, sep="\t", index=False)

    projector_config = {
        "embeddings": [
            {
                "tensorName": "routing_ml_embeddings",
                "tensorShape": [len(item_codes), int(vectors.shape[1])],
                "tensorPath": vectors_path.name,
                "metadataPath": metadata_path.name,
            }
        ]
    }
    config_path.write_text(json.dumps(projector_config, indent=2, ensure_ascii=False), encoding="utf-8")

    logger.info("TensorBoard Projector fallback assets created at: %s", tb_dir)


def apply_trainer_runtime_config(config: TrainerRuntimeConfig) -> None:
    """워크플로우 저장소 런타임 설정을 트레이너에 반영한다."""

    TRAINER_RUNTIME_SETTINGS["similarity_threshold"] = config.similarity_threshold
    TRAINER_RUNTIME_SETTINGS["trim_std_enabled"] = config.trim_std_enabled
    TRAINER_RUNTIME_SETTINGS["trim_lower_percent"] = config.trim_lower_percent
    TRAINER_RUNTIME_SETTINGS["trim_upper_percent"] = config.trim_upper_percent
    TRAINER_RUNTIME_SETTINGS["time_profiles_enabled"] = config.time_profiles_enabled
    TRAINER_RUNTIME_SETTINGS["time_profile_strategy"] = config.time_profile_strategy
    TRAINER_RUNTIME_SETTINGS["time_profile_optimal_sigma"] = config.time_profile_optimal_sigma
    TRAINER_RUNTIME_SETTINGS["time_profile_safe_sigma"] = config.time_profile_safe_sigma

    logger.info(
        "트레이너 런타임 설정 갱신: threshold=%.2f, trim_std=%s (%.2f~%.2f), time_profiles=%s",
        TRAINER_RUNTIME_SETTINGS["similarity_threshold"],
        TRAINER_RUNTIME_SETTINGS["trim_std_enabled"],
        TRAINER_RUNTIME_SETTINGS["trim_lower_percent"],
        TRAINER_RUNTIME_SETTINGS["trim_upper_percent"],
        TRAINER_RUNTIME_SETTINGS["time_profiles_enabled"],
    )


try:
    apply_trainer_runtime_config(workflow_config_store.get_trainer_runtime())
except Exception as exc:  # pragma: no cover - 설정 파일 미존재 등
    logger.debug("트레이너 런타임 기본값 사용: %s", exc)

# ════════════════════════════════════════════════
# 하이퍼 파라미터
# ════════════════════════════════════════════════
MEM_THRESHOLD = 75  # RAM 사용률 75% 초과 시 GC 실행
DEFAULT_N_JOBS = min(12, multiprocessing.cpu_count())
CHUNK_SIZE = 8000  # 배치 처리 크기

# 개선된 기본 파라미터
DEFAULT_STD_THRESHOLD = 0.01  # Dead dimension 제거 임계값
DEFAULT_VARIANCE_THRESHOLD = 0.001  # 분산 기반 feature 선택 임계값
DEFAULT_MAX_FEATURES = 50  # PCA 적용 전 최대 feature 수

# ════════════════════════════════════════════════
# Feature Importance 계산기 (FeatureWeightManager로 대체)
# ════════════════════════════════════════════════
class FeatureImportanceCalculator:
    """Feature importance를 계산하여 가중치 결정 - FeatureWeightManager 활용"""
    
    def __init__(self, model_dir: Optional[Path] = None):
        self.weight_manager = FeatureWeightManager(model_dir)
    
    @staticmethod
    def calculate_variance_importance(df: pd.DataFrame, features: List[str]) -> Dict[str, float]:
        """분산 기반 중요도 계산"""
        importance = {}
        
        for feature in features:
            if feature in NUMERIC_FEATURES:
                # 숫자형: 표준편차 / 평균
                col_data = pd.to_numeric(df[feature], errors='coerce').fillna(0)
                mean_val = col_data.mean()
                std_val = col_data.std()
                cv = std_val / (abs(mean_val) + 1e-8)  # 변동계수
                importance[feature] = min(cv, 2.0)  # 최대 2.0으로 제한
            else:
                # 범주형: 엔트로피 기반
                value_counts = df[feature].value_counts()
                probabilities = value_counts / len(df)
                entropy = -sum(p * np.log2(p + 1e-8) for p in probabilities)
                max_entropy = np.log2(len(value_counts))
                importance[feature] = entropy / (max_entropy + 1e-8) if max_entropy > 0 else 0.5
        
        # 정규화 (합이 feature 수가 되도록)
        total = sum(importance.values())
        if total > 0:
            factor = len(features) / total
            importance = {k: v * factor for k, v in importance.items()}
        
        return importance
    
    @staticmethod
    def calculate_correlation_penalty(df: pd.DataFrame, features: List[str], 
                                    importance: Dict[str, float]) -> Dict[str, float]:
        """높은 상관관계를 가진 feature들의 가중치 감소"""
        numeric_features = [f for f in features if f in NUMERIC_FEATURES]
        
        if len(numeric_features) > 1:
            # 상관관계 매트릭스 계산
            numeric_df = df[numeric_features].apply(pd.to_numeric, errors='coerce').fillna(0)
            corr_matrix = numeric_df.corr().abs()
            
            # 각 feature에 대해 다른 feature들과의 평균 상관관계 계산
            for i, feat1 in enumerate(numeric_features):
                high_corr_count = 0
                for j, feat2 in enumerate(numeric_features):
                    if i != j and corr_matrix.loc[feat1, feat2] > 0.8:
                        high_corr_count += 1
                
                # 높은 상관관계를 가진 feature가 많을수록 가중치 감소
                if high_corr_count > 0:
                    penalty = 1.0 / (1 + high_corr_count * 0.2)
                    importance[feat1] *= penalty
        
        return importance

# ════════════════════════════════════════════════
# 개선된 전처리기
# ════════════════════════════════════════════════
class ImprovedPreprocessor:
    """개선된 전처리 파이프라인 - FeatureWeightManager 통합"""
    
    def __init__(
        self,
        feature_weights: Optional[Dict[str, float]] = None,
        *,
        normalize_output: bool = True,
        std_prune_threshold: float = DEFAULT_STD_THRESHOLD,
        variance_threshold: float = DEFAULT_VARIANCE_THRESHOLD,
        use_pca: bool = False,
        pca_components: Optional[int] = None,
        auto_feature_weights: bool = True,
        balance_dimensions: bool = True,
        optimize_for_seal: bool = True,  # 씰 제조 최적화 추가
        model_dir: Optional[Path] = None,  # 모델 디렉토리 추가
    ) -> None:
        self.feature_columns: List[str] = []
        self.encoder: Optional[OrdinalEncoder] = None
        self.scaler: Optional[StandardScaler] = None
        self.feature_weights = feature_weights
        self.normalize_output = normalize_output
        self.std_prune_threshold = std_prune_threshold
        self.variance_threshold = variance_threshold
        self.use_pca = use_pca
        self.pca_components = pca_components
        self.pca: Optional[PCA] = None
        self.variance_selector: Optional[VarianceThreshold] = None
        self.auto_feature_weights = auto_feature_weights
        self.balance_dimensions = balance_dimensions
        self.optimize_for_seal = optimize_for_seal
        self.active_features: Optional[np.ndarray] = None
        self.feature_metadata: Dict[str, any] = {}
        
        # FeatureWeightManager 초기화
        self.weight_manager = FeatureWeightManager(model_dir)
        
        logger.debug(
            "ImprovedPreprocessor 초기화 – normalize: %s, std_threshold: %.4f, "
            "variance_threshold: %.4f, use_pca: %s, auto_weights: %s, seal_optimized: %s",
            normalize_output, std_prune_threshold, variance_threshold, 
            use_pca, auto_feature_weights, optimize_for_seal
        )

    @staticmethod
    def _safe_numeric(col: pd.Series) -> pd.Series:
        """안전한 숫자 변환"""
        col = col.replace(["", " ", "-", "--", "nan", "NaN", "null", "NULL", "None"], np.nan)
        num = pd.to_numeric(col, errors="coerce")
        return num.fillna(0).replace([np.inf, -np.inf], 0).infer_objects(copy=False).astype(np.float32)

    @staticmethod
    def _safe_string(col: pd.Series) -> pd.Series:
        """안전한 문자열 변환"""
        return (
            col.astype(str)
               .str.strip()
               .str.strip("'\"")
               .replace(
                   {r"^\s*$": "missing", r"^(nan|NaN|null|NULL|None|-{1,2})$": "missing"},
                   regex=True,
               )
        )

    def _check_memory(self) -> None:
        """메모리 사용량 체크"""
        mem_usage = psutil.virtual_memory().percent
        if mem_usage > MEM_THRESHOLD:
            logger.warning("RAM 사용률 %.1f%% -- GC 실행", mem_usage)
            gc.collect()

    def fit(self, df: pd.DataFrame, feature_columns: List[str], sample_frac: float = 0.1) -> None:
        """개선된 fit 메서드 - FeatureWeightManager 활용 (중복 임베딩 제거)"""
        self.feature_columns = feature_columns
        logger.info("Improved fit 시작, 데이터 행 수: %d", len(df))
        start_time = time.time()

        self._check_memory()

        # Feature 타입 분리
        cat_cols = [c for c in feature_columns if c not in NUMERIC_FEATURES]
        num_cols = [c for c in feature_columns if c in NUMERIC_FEATURES]
        
        # 씰 제조 최적화 가중치 적용
        if self.optimize_for_seal and self.feature_weights is None:
            logger.info("씰 제조 도메인 최적화 가중치 적용 중...")
            self.weight_manager.optimize_for_seal_manufacturing()
            self.feature_weights = self.weight_manager.feature_weights
        
        # 자동 feature 가중치 계산
        if self.auto_feature_weights and self.feature_weights is None:
            logger.info("Feature importance 자동 계산 중...")
            importance_calc = FeatureImportanceCalculator(self.weight_manager.model_dir)
            self.feature_weights = importance_calc.calculate_variance_importance(df, feature_columns)
            self.feature_weights = importance_calc.calculate_correlation_penalty(df, feature_columns, self.feature_weights)
            
            # FeatureWeightManager와 병합
            for feature, weight in self.feature_weights.items():
                if feature in self.weight_manager.DEFAULT_WEIGHTS:
                    # 도메인 지식과 데이터 기반 가중치의 조화평균
                    domain_weight = self.weight_manager.DEFAULT_WEIGHTS[feature]
                    self.feature_weights[feature] = 2 * (weight * domain_weight) / (weight + domain_weight)
            
            # 가중치 로그 출력
            top_features = sorted(self.feature_weights.items(), key=lambda x: x[1], reverse=True)[:10]
            logger.info("Top 10 feature weights: %s", top_features)
        
        # 범주형 인코딩
        df[cat_cols] = df[cat_cols].astype("category")
        df_sample = df.sample(frac=sample_frac, random_state=42) if sample_frac < 1.0 else df
        df_cat = df_sample[cat_cols].apply(self._safe_string) if cat_cols else pd.DataFrame()
        df_num = df[num_cols].apply(self._safe_numeric) if num_cols else pd.DataFrame()

        if cat_cols:
            self.encoder = OrdinalEncoder(
                handle_unknown="use_encoded_value",
                unknown_value=-1,
                dtype=np.float32,
            )
            self.encoder.fit(df_cat)
        else:
            self.encoder = OrdinalEncoder(dtype=np.float32)

        # 전체 데이터에 대해 인코딩 적용
        df_cat_full = df[cat_cols].apply(self._safe_string) if cat_cols else pd.DataFrame()
        if cat_cols:
            enc_cat_full = self.encoder.transform(df_cat_full)
            enc_cat_df_full = pd.DataFrame(enc_cat_full, columns=cat_cols, index=df.index)
        else:
            enc_cat_df_full = pd.DataFrame(index=df.index)

        # 결합 및 가중치 적용
        fit_mat = pd.concat([enc_cat_df_full, df_num], axis=1).astype(np.float32)
        
        if self.feature_weights:
            weights = np.array([self.feature_weights.get(col, 1.0) for col in fit_mat.columns], dtype=np.float32)
            fit_mat *= weights
            
            # 가중치를 weight_manager에도 저장
            self.weight_manager.feature_weights = self.feature_weights
        
        # Variance 기반 feature 선택
        if self.variance_threshold > 0:
            self.variance_selector = VarianceThreshold(threshold=self.variance_threshold)
            fit_mat_filtered = self.variance_selector.fit_transform(fit_mat)
            selected_features = fit_mat.columns[self.variance_selector.get_support()]
            logger.info("Variance 기반 feature 선택: %d -> %d", len(fit_mat.columns), len(selected_features))
            fit_mat = pd.DataFrame(fit_mat_filtered, columns=selected_features, index=fit_mat.index)
        
        # 스케일링
        self.scaler = StandardScaler().fit(fit_mat)
        
        # PCA (옵션)
        if self.use_pca and fit_mat.shape[1] > DEFAULT_MAX_FEATURES:
            scaled_data = self.scaler.transform(fit_mat)
            if self.pca_components is None:
                # 95% 분산 유지
                self.pca = PCA(n_components=0.95, random_state=42)
            else:
                self.pca = PCA(n_components=self.pca_components, random_state=42)
            self.pca.fit(scaled_data)
            logger.info("PCA 적용: %d -> %d 차원", fit_mat.shape[1], self.pca.n_components_)

        # Feature 메타데이터 저장
        self._save_feature_metadata(df, feature_columns)
        
        # ============ 중복 임베딩 제거 ============
        # optimize_for_seal이 True여도 여기서는 임베딩을 생성하지 않음
        # 대신 나중에 train_model_with_ml_improved에서 생성된 임베딩을 활용
        # ==========================================
        
        # 단순히 가중치만 저장
        if self.optimize_for_seal and self.weight_manager.model_dir:
            self.weight_manager.save_weights()

        elapsed_time = time.time() - start_time
        logger.info(
            "Improved Preprocessor fit 완료 – rows=%d, features=%d, 소요 시간: %.2f초",
            len(df), fit_mat.shape[1], elapsed_time
        )

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        """개선된 transform 메서드"""
        if self.encoder is None or self.scaler is None:
            raise RuntimeError("fit() 먼저 호출하세요.")

        cat_cols = [c for c in self.feature_columns if c not in NUMERIC_FEATURES]
        num_cols = [c for c in self.feature_columns if c in NUMERIC_FEATURES]

        df_cat = df[cat_cols].apply(self._safe_string) if cat_cols else pd.DataFrame()
        df_num = df[num_cols].apply(self._safe_numeric) if num_cols else pd.DataFrame()

        if cat_cols:
            enc_cat = self.encoder.transform(df_cat)
            enc_cat_df = pd.DataFrame(enc_cat, columns=cat_cols, index=df.index)
        else:
            enc_cat_df = pd.DataFrame(index=df.index)

        mat = pd.concat([enc_cat_df, df_num], axis=1).astype(np.float32)
        
        # 가중치 적용
        if self.feature_weights:
            weights = np.array([self.feature_weights.get(col, 1.0) for col in mat.columns], dtype=np.float32)
            mat *= weights
        
        # Variance selector 적용
        if self.variance_selector is not None:
            mat = self.variance_selector.transform(mat)
        
        # 스케일링
        transformed = self.scaler.transform(mat)
        
        # PCA 적용
        if self.pca is not None:
            transformed = self.pca.transform(transformed)
        
        # 차원 밸런싱 (옵션)
        if self.balance_dimensions:
            # 각 차원의 표준편차를 균등하게 조정
            dim_stds = np.std(transformed, axis=0) + 1e-8
            target_std = np.median(dim_stds)
            scale_factors = target_std / dim_stds
            scale_factors = np.clip(scale_factors, 0.5, 2.0)  # 극단적인 스케일링 방지
            transformed *= scale_factors
        
        return transformed

    def process_all(
        self,
        df: pd.DataFrame,
        item_col: str = "ITEM_CD",
        n_jobs: int = DEFAULT_N_JOBS,
        chunk_size: int = CHUNK_SIZE
    ) -> Tuple[np.ndarray, List[str]]:
        """개선된 process_all 메서드"""
        self._check_memory()
        grouped = df.groupby(item_col)
        total_groups = len(grouped)
        logger.info("Improved process_all 시작, 총 그룹 수: %d", total_groups)

        codes, vecs = [], []
        start_time = time.time()

        def process_one(code: str, group: pd.DataFrame) -> Optional[Tuple[str, np.ndarray]]:
            try:
                self._check_memory()
                vec = self.transform(group).mean(axis=0)
                return code, vec.astype(np.float32)
            except Exception as e:
                logger.error("품목 %s 처리 중 오류 발생: %s", code, str(e), exc_info=True)
                return None

        grouped_list = list(grouped)
        for i in range(0, len(grouped_list), chunk_size):
            chunk = grouped_list[i:i + chunk_size]
            chunk_start_time = time.time()
            results = Parallel(n_jobs=n_jobs, prefer="processes")(
                delayed(process_one)(code, group) for code, group in chunk
            )
            results = [r for r in results if r is not None]
            if results:
                chunk_codes, chunk_vecs = zip(*results)
                codes.extend(chunk_codes)
                vecs.append(np.vstack(chunk_vecs))
            self._check_memory()
            logger.info("임베딩 진행 ▸ %s 개, 처리된 그룹: %d/%d, 청크 소요 시간: %.2f초",
                        f"{i + len(chunk):,}", i + len(chunk), total_groups, time.time() - chunk_start_time)

        if not codes:
            raise RuntimeError("유효한 품목 벡터가 생성되지 않았습니다.")

        vec_mat = np.vstack(vecs)

        # Dead dimension 제거
        if self.std_prune_threshold > 0:
            dim_stds = np.std(vec_mat, axis=0)
            active_dims = dim_stds >= self.std_prune_threshold
            removed_dims = (~active_dims).sum()
            
            if removed_dims > 0:
                vec_mat = vec_mat[:, active_dims]
                self.active_features = active_dims
                logger.info("Dead dimension 제거: %d개 제거, %d개 유지", 
                          removed_dims, active_dims.sum())

        # 정규화 (옵션)
        if self.normalize_output:
            # L2 정규화 대신 더 부드러운 정규화 적용
            norms = np.linalg.norm(vec_mat, axis=1, keepdims=True)
            # Soft normalization: norm을 1.0 근처로 조정하되 완전히 고정하지 않음
            target_norm = 1.0
            alpha = 0.9  # 정규화 강도 (0~1)
            adjusted_norms = alpha * target_norm + (1 - alpha) * norms
            vec_mat = vec_mat * (adjusted_norms / (norms + 1e-8))

        logger.info("임베딩 완료 – shape=%s, 총 소요 시간: %.2f초", 
                   vec_mat.shape, time.time() - start_time)
        
        return vec_mat, list(codes)
    
    def _save_feature_metadata(self, df: pd.DataFrame, feature_columns: List[str]):
        """Feature 메타데이터 저장"""
        self.feature_metadata = {
            "total_samples": len(df),
            "features": {}
        }
        
        for col in feature_columns:
            if col not in df.columns:
                continue
            
            feature_info = {
                "name": col,
                "type": "numeric" if col in NUMERIC_FEATURES else "categorical",
                "missing_count": int(df[col].isna().sum()),
                "missing_ratio": float(df[col].isna().sum() / len(df))
            }
            
            if col not in NUMERIC_FEATURES:
                # 범주형 feature 정보
                value_counts = df[col].astype(str).value_counts()
                feature_info.update({
                    "unique_count": int(df[col].nunique()),
                    "top_20_values": value_counts.head(20).to_dict()
                })
            else:
                # 숫자형 feature 정보
                col_data = pd.to_numeric(df[col], errors='coerce')
                if not col_data.isna().all():
                    feature_info.update({
                        "mean": float(col_data.mean()),
                        "std": float(col_data.std()),
                        "min": float(col_data.min()),
                        "max": float(col_data.max()),
                        "q25": float(col_data.quantile(0.25)),
                        "q50": float(col_data.quantile(0.50)),
                        "q75": float(col_data.quantile(0.75))
                    })
            
            if self.feature_weights and col in self.feature_weights:
                feature_info["weight"] = float(self.feature_weights[col])
            
            self.feature_metadata["features"][col] = feature_info

# ════════════════════════════════════════════════
# 개선된 학습 파이프라인
# ════════════════════════════════════════════════
def _train_model_with_ml_improved_core(
    df: pd.DataFrame,
    *,
    progress_cb: Optional[Callable[[int], None]] = None,
    stop_flag: Optional[threading.Event] = None,
    save_dir: Optional[Union[str, Path]] = None,
    save_metadata: bool = True,
    optimize_for_seal: bool = False,
    auto_feature_weights: bool = True,
    variance_threshold: float = 0.001,
    balance_dimensions: bool = True,
    export_tb_projector: bool = False,                      # ← 추가
    projector_metadata_cols: Optional[List[str]] = None,     # ← 추가
) -> Optional[Tuple[HNSWSearch, LabelEncoder, StandardScaler, List[str]]]:

    logger.info("🚀 개선된 ML 모델 학습 시작")

    def update_progress(pct: int):
        if progress_cb:
            progress_cb(pct)
        if stop_flag and stop_flag.is_set():
            logger.info("학습이 중단되었습니다")
            return False
        return True

    if not update_progress(5):
        return None

    # 1) 모델 디렉터리
    model_dir = Path(save_dir) if save_dir else None
    if model_dir:
        model_dir.mkdir(parents=True, exist_ok=True)

    # 2) Feature Manager (옵션)
    feature_manager = FeatureWeightManager(model_dir) if model_dir else None
    if feature_manager and optimize_for_seal:
        feature_manager.optimize_for_seal_manufacturing()

    # 3) Feature 컬럼
    feature_cols = [c for c in df.columns if c not in ["ITEM_CD", "ITEM_NM"]]
    logger.info(f"전체 피처 수: {len(feature_cols)}개")

    if not update_progress(10):
        return None

    # 5) 데이터 전처리
    df_subset = df[["ITEM_CD"] + feature_cols].copy()
    logger.info(f"학습 데이터: {len(df_subset)}행 × {len(feature_cols)}열")

    cat_cols = [c for c in feature_cols if c not in NUMERIC_FEATURES]
    num_cols = [c for c in feature_cols if c in NUMERIC_FEATURES]

    if cat_cols:
        df_subset[cat_cols] = df_subset[cat_cols].apply(lambda x: x.astype(str).str.strip())
    if num_cols:
        for col in num_cols:
            df_subset[col] = pd.to_numeric(df_subset[col], errors='coerce').fillna(0)

    if not update_progress(20):
        return None

    # 7) Label Encoding
    encoder = LabelEncoder()
    encoded_cat = pd.DataFrame(index=df_subset.index)
    if cat_cols:
        for col in cat_cols:
            try:
                encoded_cat[col] = encoder.fit_transform(df_subset[col].astype(str))
            except Exception as e:
                logger.warning(f"인코딩 실패 {col}: {e}")
                encoded_cat[col] = 0

    # 8) 병합
    final_data = pd.concat([encoded_cat, df_subset[num_cols]], axis=1)[feature_cols]
    if not update_progress(30):
        return None

    # 9) Feature weights (선택)
    if feature_manager:
        weights = feature_manager.get_weights_as_array(feature_cols, apply_active_mask=False)
        logger.info(f"Feature weights 적용: min={weights.min():.2f}, max={weights.max():.2f}")
        final_data = final_data * weights

    # 10) Scaling
    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(final_data)
    if not update_progress(40):
        return None

    # 11) Variance threshold
    if variance_threshold > 0:
        from sklearn.feature_selection import VarianceThreshold
        selector = VarianceThreshold(threshold=variance_threshold)
        scaled_data = selector.fit_transform(scaled_data)
        selected_features = [feature_cols[i] for i in selector.get_support(indices=True)]
        removed_count = len(feature_cols) - len(selected_features)
        if removed_count > 0:
            logger.info(f"Variance threshold 적용: {removed_count}개 피처 제거됨")
            feature_cols = selected_features

    if not update_progress(50):
        return None

    # 12) Dimension balancing → 128 고정
    target_dim, current_dim = 128, scaled_data.shape[1]
    if balance_dimensions and current_dim != target_dim:
        if current_dim > target_dim:
            from sklearn.decomposition import PCA
            pca = PCA(n_components=target_dim, random_state=42)
            scaled_data = pca.fit_transform(scaled_data)
            logger.info(f"PCA 차원 축소: {current_dim} → {target_dim}")
        else:
            padding = np.zeros((scaled_data.shape[0], target_dim - current_dim))
            scaled_data = np.hstack([scaled_data, padding])
            logger.info(f"차원 패딩: {current_dim} → {target_dim}")

    # 13) 최종 벡터
    vectors = scaled_data.astype(np.float32)
    if not update_progress(70):
        return None

    # 14) HNSW 인덱스
    hnsw_params = _get_hnsw_params()
    logger.info(
        "HNSW 인덱스 생성 중... (벡터 차원: %d, M=%d, ef_construction=%d, ef_search=%s)",
        vectors.shape[1],
        hnsw_params["M"],
        hnsw_params["ef_construction"],
        str(hnsw_params["ef_search"]),
    )
    searcher = HNSWSearch(
        vectors,
        df_subset["ITEM_CD"].tolist(),
        M=hnsw_params["M"],
        ef_construction=hnsw_params["ef_construction"],
        ef_search=hnsw_params["ef_search"],
    )
    if not update_progress(90):
        return None

    # 15) Feature importance (옵션)
    if auto_feature_weights and feature_manager:
        try:
            feature_manager.analyze_feature_importance(vectors, feature_cols, df_subset["ITEM_CD"].tolist())
            logger.info("Feature importance 분석 완료")
        except Exception as e:
            logger.warning(f"Feature importance 분석 실패: {e}")

    # 16) 저장 & (옵션) Projector 로그
    if save_dir and model_dir:
        try:
            save_optimized_model(searcher, encoder, scaler, feature_cols, str(model_dir))
            if feature_manager:
                feature_manager.save_weights()

            if save_metadata:
                metadata = {
                    'total_items': len(df_subset),
                    'total_features': len(feature_cols),
                    'original_features': len(df.columns) - 2,
                    'vector_dimension': vectors.shape[1],
                    'training_date': pd.Timestamp.now().isoformat(),
                    'optimize_for_seal': optimize_for_seal,
                    'variance_threshold': variance_threshold,
                    'balance_dimensions': balance_dimensions,
                    'target_dimension': 128,
                    'note': 'Active features are applied only during prediction',
                    'workflow_runtime': dict(TRAINER_RUNTIME_SETTINGS),
                    'runtime_versions': _collect_training_runtime_versions(),
                }
                (model_dir / "training_metadata.json").write_text(
                    json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8"
                )
            logger.info(f"모델 저장 완료: {model_dir}")

            # ← 추가: TensorBoard Projector 내보내기
            if export_tb_projector:
                tb_dir = model_dir / "tb_projector"
                item_codes = df_subset["ITEM_CD"].tolist()
                metadata_columns = projector_metadata_cols or ["ITEM_NM"]
                try:
                    from models.export_tb_projector import export_for_tensorboard_projector

                    export_for_tensorboard_projector(
                        vectors=vectors,
                        item_codes=item_codes,
                        log_dir=str(tb_dir),
                        metadata_df=df,
                        metadata_cols=metadata_columns,
                    )
                    logger.info("TensorBoard Projector logs created at: %s", tb_dir)
                except Exception as exc:
                    logger.warning("고급 Projector 로그 생성 실패: %s", exc)
                    _export_projector_fallback(
                        tb_dir,
                        vectors=vectors,
                        item_codes=item_codes,
                        metadata_df=df,
                        metadata_cols=metadata_columns,
                    )

            try:
                write_manifest(model_dir, strict=True)
                logger.info("모델 매니페스트 생성 완료: %s", model_dir / "manifest.json")
            except Exception as manifest_error:
                logger.error("모델 매니페스트 생성 실패: %s", manifest_error)

        except Exception as e:
            logger.error(f"모델 저장 실패: {e}")

    if not update_progress(100):
        return None

    logger.info("✅ ML 모델 학습 완료!")
    return searcher, encoder, scaler, feature_cols

def train_model_with_ml_improved(
    df: pd.DataFrame,
    *,
    progress_cb: Optional[Callable[[int], None]] = None,
    stop_flag: Optional[threading.Event] = None,
    save_dir: Optional[Union[str, Path]] = None,
    save_metadata: bool = True,
    optimize_for_seal: bool = False,
    auto_feature_weights: bool = True,
    variance_threshold: float = 0.001,
    balance_dimensions: bool = True,
    export_tb_projector: bool = False,
    projector_metadata_cols: Optional[List[str]] = None,
) -> Optional[Tuple[HNSWSearch, LabelEncoder, StandardScaler, List[str]]]:
    """Run the improved ML training pipeline with a file-lock guard."""

    lock_dir = Path(save_dir) if save_dir else Path("models")
    lock_dir.mkdir(parents=True, exist_ok=True)
    lock_file = lock_dir / ".training.lock"
    file_lock = FileLock(lock_file)
    logger.debug("학습 잠금 파일 경로: %s", lock_file)

    def _run_training() -> Optional[Tuple[HNSWSearch, LabelEncoder, StandardScaler, List[str]]]:

        return _train_model_with_ml_improved_core(
            df,
            progress_cb=progress_cb,
            stop_flag=stop_flag,
            save_dir=save_dir,
            save_metadata=save_metadata,
            optimize_for_seal=optimize_for_seal,
            auto_feature_weights=auto_feature_weights,
            variance_threshold=variance_threshold,
            balance_dimensions=balance_dimensions,
            export_tb_projector=export_tb_projector,
            projector_metadata_cols=projector_metadata_cols,
        )


        def update_progress(pct: int) -> bool:
            if progress_cb:
                progress_cb(pct)
            if stop_flag and stop_flag.is_set():
                logger.info("학습이 중단되었습니다")
                return False
            return True

        if not update_progress(5):
            return None

        model_dir: Optional[Path]
        if save_dir:
            model_dir = lock_dir
        else:
            model_dir = None

        feature_manager = None
        if model_dir:
            feature_manager = FeatureWeightManager(model_dir)
            if optimize_for_seal:
                feature_manager.optimize_for_seal_manufacturing()

        feature_cols = [c for c in df.columns if c not in ["ITEM_CD", "ITEM_NM"]]
        logger.info("전체 피처 수: %d개", len(feature_cols))

        if not update_progress(10):
            return None

        df_subset = df[["ITEM_CD"] + feature_cols].copy()
        logger.info("학습 데이터: %d행 × %d열", len(df_subset), len(feature_cols))

        cat_cols = [c for c in feature_cols if c not in NUMERIC_FEATURES]
        num_cols = [c for c in feature_cols if c in NUMERIC_FEATURES]

        if cat_cols:
            df_subset[cat_cols] = df_subset[cat_cols].apply(lambda x: x.astype(str).str.strip())
        if num_cols:
            for col in num_cols:
                df_subset[col] = pd.to_numeric(df_subset[col], errors="coerce").fillna(0)

        if not update_progress(20):
            return None

        encoder = LabelEncoder()
        encoded_cat = pd.DataFrame(index=df_subset.index)

        if cat_cols:
            for col in cat_cols:
                try:
                    encoded_cat[col] = encoder.fit_transform(df_subset[col].astype(str))
                except Exception as exc:  # pragma: no cover - 예외 보호
                    logger.warning("인코딩 실패 %s: %s", col, exc)
                    encoded_cat[col] = 0

        final_data = pd.concat([encoded_cat, df_subset[num_cols]], axis=1)[feature_cols]

        if not update_progress(30):
            return None

        if feature_manager:
            weights = feature_manager.get_weights_as_array(feature_cols, apply_active_mask=False)
            logger.info("Feature weights 적용: min=%.2f, max=%.2f", weights.min(), weights.max())
            final_data = final_data * weights

        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(final_data)

        if not update_progress(40):
            return None

        if variance_threshold > 0:
            from sklearn.feature_selection import VarianceThreshold

            selector = VarianceThreshold(threshold=variance_threshold)
            scaled_data = selector.fit_transform(scaled_data)
            selected_features = [feature_cols[i] for i in selector.get_support(indices=True)]
            removed_count = len(feature_cols) - len(selected_features)

            if removed_count > 0:
                logger.info("Variance threshold 적용: %d개 피처 제거됨", removed_count)
                feature_cols = selected_features

        if not update_progress(50):
            return None

        target_dim = 128
        current_dim = scaled_data.shape[1]

        if balance_dimensions and current_dim != target_dim:
            if current_dim > target_dim:
                from sklearn.decomposition import PCA

                pca = PCA(n_components=target_dim)
                vectors = pca.fit_transform(scaled_data)
                logger.info("PCA 적용: %d -> %d 차원", current_dim, vectors.shape[1])
            else:
                padding = np.zeros((scaled_data.shape[0], target_dim - current_dim))
                vectors = np.concatenate([scaled_data, padding], axis=1)
                logger.info("Zero-padding 적용: %d -> %d 차원", current_dim, vectors.shape[1])
        else:
            vectors = scaled_data

        if not update_progress(60):
            return None

        vectors = normalize(vectors, axis=1)

        time_profiles_payload: Optional[Dict[str, Any]] = None
        if model_dir and TRAINER_RUNTIME_SETTINGS.get("time_profiles_enabled"):
            try:
                agg_config = TimeAggregationConfig(
                    strategy=str(TRAINER_RUNTIME_SETTINGS.get("time_profile_strategy", "sigma_profile")),
                    trim_std_enabled=bool(TRAINER_RUNTIME_SETTINGS.get("trim_std_enabled", True)),
                    trim_lower_percent=float(TRAINER_RUNTIME_SETTINGS.get("trim_lower_percent", 0.05)),
                    trim_upper_percent=float(TRAINER_RUNTIME_SETTINGS.get("trim_upper_percent", 0.95)),
                    optimal_sigma=float(TRAINER_RUNTIME_SETTINGS.get("time_profile_optimal_sigma", 0.67)),
                    safe_sigma=float(TRAINER_RUNTIME_SETTINGS.get("time_profile_safe_sigma", 1.28)),
                )
                time_profiles_payload = generate_time_profiles(df, config=agg_config)
                if time_profiles_payload.get("columns"):
                    profiles_path = model_dir / "time_profiles.json"
                    profiles_path.write_text(
                        json.dumps(time_profiles_payload, indent=2, ensure_ascii=False),
                        encoding="utf-8",
                    )
                    logger.info("시간 프로파일 저장 완료: %s", profiles_path)
                else:
                    logger.info("시간 프로파일 생성 요청됨: 유효한 열이 없어 저장을 건너뜁니다")
            except Exception as exc:  # pragma: no cover - 보호용
                logger.warning("시간 프로파일 생성 실패: %s", exc)

        if not update_progress(70):
            return None

        hnsw_params = _get_hnsw_params()
        logger.info(
            "HNSW 인덱스 생성 중... (벡터 차원: %d, M=%d, ef_construction=%d, ef_search=%s)",
            vectors.shape[1],
            hnsw_params["M"],
            hnsw_params["ef_construction"],
            str(hnsw_params["ef_search"]),
        )
        searcher = HNSWSearch(
            vectors,
            df_subset["ITEM_CD"].tolist(),
            M=hnsw_params["M"],
            ef_construction=hnsw_params["ef_construction"],
            ef_search=hnsw_params["ef_search"],
        )

        if not update_progress(90):
            return None

        if auto_feature_weights and feature_manager:
            try:
                feature_manager.analyze_feature_importance(
                    vectors,
                    feature_cols,
                    df_subset["ITEM_CD"].tolist(),
                )
                logger.info("Feature importance 분석 완료")
            except Exception as exc:  # pragma: no cover - 분석 실패 보호
                logger.warning("Feature importance 분석 실패: %s", exc)

        if save_dir and model_dir:
            try:
                save_optimized_model(searcher, encoder, scaler, feature_cols, str(model_dir))

                if feature_manager:
                    feature_manager.save_weights()

                if save_metadata:
                    metadata = {
                        "total_items": len(df_subset),
                        "total_features": len(feature_cols),
                        "original_features": len(df.columns) - 2,
                        "vector_dimension": vectors.shape[1],
                        "training_date": pd.Timestamp.now().isoformat(),
                        "optimize_for_seal": optimize_for_seal,
                        "variance_threshold": variance_threshold,
                        "balance_dimensions": balance_dimensions,
                        "target_dimension": target_dim if balance_dimensions else None,
                        "note": "Active features are applied only during prediction",
                        "workflow_runtime": dict(TRAINER_RUNTIME_SETTINGS),
                        "runtime_versions": _collect_training_runtime_versions(),
                        "time_profiles": {
                            "enabled": bool(time_profiles_payload and time_profiles_payload.get("columns")),
                            "strategy": (time_profiles_payload or {}).get("strategy"),
                            "profile_file": "time_profiles.json"
                            if time_profiles_payload and time_profiles_payload.get("columns")
                            else None,
                            "columns": list((time_profiles_payload or {}).get("columns", {}).keys()),
                        },
                    }

                    metadata_path = model_dir / "training_metadata.json"
                    with open(metadata_path, "w", encoding="utf-8") as handle:
                        json.dump(metadata, handle, indent=2, ensure_ascii=False)

                try:
                    write_manifest(model_dir, strict=True)
                    logger.info("모델 매니페스트 생성 완료: %s", model_dir / "manifest.json")
                except Exception as manifest_error:  # pragma: no cover - 안전 로그
                    logger.error("모델 매니페스트 생성 실패: %s", manifest_error)

                logger.info("모델 저장 완료: %s", model_dir)
            except Exception as exc:  # pragma: no cover - 저장 실패 보호
                logger.error("모델 저장 실패: %s", exc)

        if not update_progress(100):
            return None

        logger.info("✅ ML 모델 학습 완료!")
        return searcher, encoder, scaler, feature_cols


    try:
        with file_lock.context(timeout=300):
            logger.info("모델 디렉터리 잠금 획득: %s", lock_file)
            return _run_training()
    except FileLockTimeout as exc:
        message = f"모델 디렉터리 잠금 확보 실패: {lock_file}"
        logger.error(message)
        raise RuntimeError(message) from exc

# ════════════════════════════════════════════════
# 기존 함수들 (호환성 유지)
# ════════════════════════════════════════════════

# 기존 train_model_with_ml_optimized 함수를 개선된 버전으로 리다이렉트
def train_model_with_ml_optimized(
    df: pd.DataFrame,
    feature_columns: Optional[List[str]] = None,
    progress_cb: Optional[Callable[[int], None]] = None,
    stop_flag: Optional[threading.Event] = None,
    *,
    use_hnsw: bool = True,
    feature_weights: Optional[Dict[str, float]] = None,
    normalize_output: bool = True,
    std_prune_threshold: float = 0.0,
) -> Optional[Tuple[
    Union['EfficientSimilaritySearch', 'HNSWSearch'],
    OrdinalEncoder,
    StandardScaler,
    List[str],
]]:
    """기존 API 호환성을 위한 래퍼 함수"""
    return train_model_with_ml_improved(
        df=df,
        feature_columns=feature_columns,
        progress_cb=progress_cb,
        stop_flag=stop_flag,
        use_hnsw=use_hnsw,
        feature_weights=feature_weights,
        normalize_output=normalize_output,
        std_prune_threshold=std_prune_threshold if std_prune_threshold > 0 else DEFAULT_STD_THRESHOLD,
        variance_threshold=0.0,  # 기존 버전은 variance threshold 사용 안 함
        use_pca=False,  # 기존 버전은 PCA 사용 안 함
        auto_feature_weights=False,  # 기존 버전은 자동 가중치 사용 안 함
        balance_dimensions=False,  # 기존 버전은 차원 밸런싱 사용 안 함
        save_metadata=False,
        optimize_for_seal=False,  # 기존 버전은 씰 최적화 사용 안 함
    )

# EfficientSimilaritySearch와 save/load 함수들은 그대로 유지...
class EfficientSimilaritySearch:
    """L2 정규화 후 내적 = cosine, 완전 탐색"""

    def __init__(self, vectors: np.ndarray, item_codes: List[str]):
        self.vectors = normalize(vectors, axis=1)
        self.item_codes = np.asarray(item_codes)
        logger.info("EfficientSimilaritySearch 초기화, 벡터 수: %d, 차원: %d", len(item_codes), vectors.shape[1])

    def find_similar(
        self, query: np.ndarray, top_k: int = 1
    ) -> Union[Tuple[str, float], Tuple[List[str], List[float]]]:
        logger.debug("find_similar 시작, top_k: %d", top_k)
        q = normalize(query.reshape(1, -1))
        sims = (q @ self.vectors.T).ravel()

        if top_k == 1:
            idx = int(np.argmax(sims))
            result = self.item_codes[idx], float(sims[idx])
            logger.debug("최상위 1개 결과: %s, 점수: %.4f", result[0], result[1])
            return result

        top_idx = np.argpartition(-sims, top_k - 1)[:top_k]
        top_idx = top_idx[np.argsort(-sims[top_idx])]
        codes = [self.item_codes[i] for i in top_idx]
        scores = [float(sims[i]) for i in top_idx]
        logger.debug("최상위 %d개 결과: %s, 점수: %s", top_k, codes, scores)
        return codes, scores

# 모델 저장/로드 함수
def save_optimized_model(
    searcher: Union[EfficientSimilaritySearch, HNSWSearch],
    encoder: OrdinalEncoder,
    scaler: StandardScaler,
    feature_columns: List[str],
    save_dir: str,
) -> None:
    logger.info("모델 저장 시작, 디렉토리: %s", save_dir)
    start_time = time.time()
    p = Path(save_dir).expanduser()
    p.mkdir(parents=True, exist_ok=True)

    joblib.dump(searcher, p / "similarity_engine.joblib", compress=3)
    joblib.dump(encoder, p / "encoder.joblib", compress=3)
    joblib.dump(scaler, p / "scaler.joblib", compress=3)
    joblib.dump(feature_columns, p / "feature_columns.joblib")

    elapsed_time = time.time() - start_time
    logger.info("모델 저장 완료 → %s, 소요 시간: %.2f초", p, elapsed_time)

def load_optimized_model(
    load_dir: str,
) -> Tuple[
    Union[EfficientSimilaritySearch, HNSWSearch],
    OrdinalEncoder,
    StandardScaler,
    List[str],
]:
    logger.info("모델 로드 시작, 디렉토리: %s", load_dir)
    start_time = time.time()
    p = Path(load_dir).expanduser()

    similarity_path = p / "similarity_engine.joblib"
    encoder_path = p / "encoder.joblib"
    scaler_path = p / "scaler.joblib"
    feature_column_path = p / "feature_columns.joblib"

    try:
        searcher = joblib.load(similarity_path)
    except AttributeError as exc:
        if "DummySimilarityEngine" in str(exc):
            logger.warning("레거시 DummySimilarityEngine 피클을 감지했습니다. 호환 모드로 재시도합니다.")
            try:
                searcher = joblib.load(similarity_path, pickle_module=_LegacyDummyPickleModule)
            except Exception as fallback_exc:  # noqa: BLE001
                logger.error("호환 모드 로드 실패, 기본 더미 검색 엔진으로 대체합니다: %s", fallback_exc)
                from backend.dummy_models import DummySimilarityEngine  # pylint: disable=import-outside-toplevel

                searcher = DummySimilarityEngine()
        else:
            raise

    try:
        encoder = joblib.load(encoder_path)
    except AttributeError as exc:
        if "DummyEncoder" in str(exc):
            logger.warning("레거시 DummyEncoder 피클을 감지했습니다. 호환 모드로 재시도합니다.")
            try:
                encoder = joblib.load(encoder_path, pickle_module=_LegacyDummyPickleModule)
            except Exception as fallback_exc:  # noqa: BLE001
                logger.error("호환 모드 DummyEncoder 로드 실패, 기본 더미 인코더로 대체합니다: %s", fallback_exc)
                from backend.dummy_models import DummyEncoder  # pylint: disable=import-outside-toplevel

                encoder = DummyEncoder()
        else:
            raise

    try:
        scaler = joblib.load(scaler_path)
    except AttributeError as exc:
        if "DummyScaler" in str(exc):
            logger.warning("레거시 DummyScaler 피클을 감지했습니다. 호환 모드로 재시도합니다.")
            try:
                scaler = joblib.load(scaler_path, pickle_module=_LegacyDummyPickleModule)
            except Exception as fallback_exc:  # noqa: BLE001
                logger.error("호환 모드 DummyScaler 로드 실패, 기본 더미 스케일러로 대체합니다: %s", fallback_exc)
                from backend.dummy_models import DummyScaler  # pylint: disable=import-outside-toplevel

                scaler = DummyScaler()
        else:
            raise

    feature_columns = joblib.load(feature_column_path)
    elapsed_time = time.time() - start_time
    logger.info("모델 로드: %s, 소요 시간: %.2f초", p, elapsed_time)
    return searcher, encoder, scaler, feature_columns


def _load_training_dataset(data_path: Path) -> pd.DataFrame:
    """Load a training dataset supporting CSV and Parquet formats."""

    resolved = data_path.expanduser().resolve()
    if not resolved.exists():
        raise FileNotFoundError(f"Dataset not found: {resolved}")

    suffix = resolved.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(resolved)
    if suffix in {".parquet", ".pq"}:
        return pd.read_parquet(resolved)
    raise ValueError(f"Unsupported dataset format: {resolved.suffix}")


def _load_trainer_config(config_path: Path) -> Dict[str, Any]:
    resolved = config_path.expanduser().resolve()
    if not resolved.exists():
        raise FileNotFoundError(f"Trainer config not found: {resolved}")

    with open(resolved, "r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}

    if not isinstance(data, dict):
        raise ValueError(f"Trainer config must be a mapping, got: {type(data)!r}")

    return data


def _apply_cli_config_overrides(config: Dict[str, Any]) -> Dict[str, Any]:
    """Apply config overrides to runtime settings and return CLI options."""

    seed = config.get("seed")
    if seed is not None:
        try:
            seed_value = int(seed)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid seed value: {seed!r}") from exc
        random.seed(seed_value)
        np.random.seed(seed_value)
        logger.info("난수 시드 설정: %d", seed_value)

    if "similarity_threshold" in config:
        try:
            TRAINER_RUNTIME_SETTINGS["similarity_threshold"] = float(config["similarity_threshold"])
        except (TypeError, ValueError) as exc:
            raise ValueError("similarity_threshold must be numeric") from exc

    hnsw_config = config.get("hnsw", {})
    if "max_neighbors" in config:
        hnsw_config = dict(hnsw_config)
        hnsw_config.setdefault("M", config["max_neighbors"])

    if isinstance(hnsw_config, dict):
        for key, setting_key in (
            ("M", "hnsw_M"),
            ("ef_construction", "hnsw_ef_construction"),
            ("ef_search", "hnsw_ef_search"),
        ):
            if key in hnsw_config:
                TRAINER_RUNTIME_SETTINGS[setting_key] = hnsw_config[key]

    export_cfg = ((config.get("export") or {}).get("projector") or {})
    export_enabled = bool(export_cfg.get("enabled"))
    projector_metadata = export_cfg.get("metadata_fields")
    if projector_metadata is not None and not isinstance(projector_metadata, list):
        raise ValueError("metadata_fields must be a list when provided")

    output_cfg = config.get("output") or {}
    output_dir = output_cfg.get("directory")
    overwrite = bool(output_cfg.get("overwrite", False))

    return {
        "export_tb_projector": export_enabled,
        "projector_metadata_cols": projector_metadata,
        "output_dir": Path(output_dir) if output_dir else None,
        "overwrite": overwrite,
    }


def _build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Routing ML trainer command line interface")
    parser.add_argument("--config", type=Path, required=True, help="Path to the trainer YAML config")
    parser.add_argument("--data-path", type=Path, required=True, help="Path to the training dataset")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Optional override for the artifact output directory",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite the output directory if it already exists",
    )
    parser.add_argument(
        "--projector-metadata",
        nargs="*",
        default=None,
        help="Optional metadata fields to include in the projector export",
    )
    parser.add_argument(
        "--disable-projector",
        action="store_true",
        help="Disable projector export even if enabled in the config",
    )
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    """Entry point for running the trainer from the command line."""

    args = _build_cli_parser().parse_args(argv)
    config_data = _load_trainer_config(args.config)
    cli_options = _apply_cli_config_overrides(config_data)

    dataset = _load_training_dataset(args.data_path)

    output_dir = args.output_dir or cli_options["output_dir"] or Path("models")
    output_dir = output_dir.expanduser().resolve()

    overwrite = args.overwrite or cli_options["overwrite"]
    if output_dir.exists() and overwrite:
        logger.info("기존 출력 디렉터리 삭제: %s", output_dir)
        for child in output_dir.iterdir():
            if child.is_file() or child.is_symlink():
                child.unlink()
            elif child.is_dir():
                import shutil

                shutil.rmtree(child)

    output_dir.mkdir(parents=True, exist_ok=True)

    export_tb_projector = cli_options["export_tb_projector"] and not args.disable_projector
    projector_metadata = (
        args.projector_metadata
        if args.projector_metadata is not None
        else cli_options["projector_metadata_cols"]
    )

    logger.info(
        "트레이너 CLI 실행",
        extra={
            "dataset": str(args.data_path),
            "output_dir": str(output_dir),
            "export_tb_projector": export_tb_projector,
            "projector_metadata": projector_metadata,
        },
    )

    train_model_with_ml_improved(
        dataset,
        save_dir=output_dir,
        export_tb_projector=export_tb_projector,
        projector_metadata_cols=projector_metadata,
    )

    logger.info("트레이너 CLI 완료: %s", output_dir)
    print(str(output_dir))
    return 0


if __name__ == "__main__":
    sys.exit(main())
