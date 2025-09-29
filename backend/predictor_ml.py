# backend/predictor_ml.py
from __future__ import annotations

# ── 표준 라이브러리
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple, Dict, Optional, Any, Union
import json
import logging
from collections import Counter, defaultdict
from threading import RLock
import time
import numpy as np
import pandas as pd
from datetime import datetime

# ── 서드파티
from cachetools import LRUCache

# ── 사내 모듈
from backend.constants import (
    NUMERIC_FEATURES,
    ROUTING_OUTPUT_COLS,
    get_routing_alias_map,
    get_routing_output_columns,
)
from common.config_store import PredictorRuntimeConfig, workflow_config_store
from backend.trainer_ml import load_optimized_model
from backend.database import (
    fetch_single_item, 
    fetch_routing_for_item, 
    check_item_has_routing,
)
from common.logger import get_logger

# 개선된 save_load 모듈 import
try:
    from models.save_load import load_model_with_metadata
except ImportError:
    load_model_with_metadata = None

logger = get_logger("predictor_ml_improved", level=logging.DEBUG)

# ───────────────────────────── 기본 설정값
DEFAULT_TOP_K: int = 10
MISSING_RATIO_THRESHOLD: float = 0.50
MIN_SAMPLES_FOR_STATS: int = 1
CONFIDENCE_THRESHOLD: float = 0.0
SIMILARITY_HIGH_THRESHOLD: float = 0.8
MIN_SIMILARITY_THRESHOLD: float = SIMILARITY_HIGH_THRESHOLD
MAX_ROUTING_VARIANTS: int = 4

# 제외할 컬럼들 - 일관성 있게 정의
COLUMNS_TO_EXCLUDE = ['DRAW_USE', 'ITEM_NM_ENG', 'MID_SEALSIZE_UOM', 'ROTATE_CTRCLOCKWISE']

ROUTING_ALIAS_MAP = {
    'JOB_CD': 'dbo_BI_ROUTING_VIEW_JOB_CD',
    'CUST_NM': 'dbo_BI_ROUTING_VIEW_CUST_NM',
    'VIEW_REMARK': 'dbo_BI_ROUTING_VIEW_REMARK',
}


@dataclass
class ModelCacheEntry:
    components: Dict[str, Any]
    metadata: Dict[str, Any]
    is_enhanced: bool


_MODEL_CACHE_LOCK = RLock()
_MODEL_CACHE: Dict[str, ModelCacheEntry] = {}

DEFAULT_ENCODING_CACHE_MAXSIZE: int = 20000
DEFAULT_ENCODING_CACHE_TTL_SECONDS: int = 900

ENCODING_CACHE_MAXSIZE: int = DEFAULT_ENCODING_CACHE_MAXSIZE
ENCODING_CACHE_TTL_SECONDS: int = DEFAULT_ENCODING_CACHE_TTL_SECONDS

_ENCODING_CACHE_LOCK = RLock()
_ENCODING_CACHE: Optional[LRUCache[str, Tuple[float, Tuple[np.ndarray, float]]]] = LRUCache(
    maxsize=DEFAULT_ENCODING_CACHE_MAXSIZE
)


def _active_alias_map() -> Dict[str, str]:
    """현재 설정 기반 컬럼 별칭을 반환한다."""

    try:
        return get_routing_alias_map()
    except Exception:  # pragma: no cover - 설정 파일 손상 시 기본값 사용
        return dict(ROUTING_ALIAS_MAP)


def _configure_encoding_cache(maxsize: int, ttl_seconds: int) -> None:
    """재사용 인코딩 캐시를 재구성한다."""

    global ENCODING_CACHE_MAXSIZE, ENCODING_CACHE_TTL_SECONDS, _ENCODING_CACHE

    ENCODING_CACHE_MAXSIZE = max(0, int(maxsize))
    ENCODING_CACHE_TTL_SECONDS = max(0, int(ttl_seconds))

    with _ENCODING_CACHE_LOCK:
        if ENCODING_CACHE_MAXSIZE == 0:
            _ENCODING_CACHE = None
        else:
            _ENCODING_CACHE = LRUCache(maxsize=ENCODING_CACHE_MAXSIZE)


def _normalize_value_for_cache(value: Any) -> Any:
    """캐시 키를 생성하기 위한 입력 값을 정규화한다."""

    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()

    if isinstance(value, np.generic):
        value = value.item()

    if isinstance(value, (list, tuple)):
        return [_normalize_value_for_cache(v) for v in value]

    if isinstance(value, dict):
        return {str(k): _normalize_value_for_cache(v) for k, v in sorted(value.items())}

    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    return value


def _build_encoding_cache_key(df: pd.DataFrame) -> str:
    """입력 레코드를 직렬화하여 캐시 키를 생성한다."""

    if df.empty:
        return "{}"

    record = df.iloc[0]
    normalized: Dict[str, Any] = {}
    for column in sorted(df.columns):
        normalized[column] = _normalize_value_for_cache(record.get(column))

    return json.dumps(normalized, sort_keys=True, ensure_ascii=False, default=str)


def _get_cached_encoding(key: str) -> Optional[Tuple[np.ndarray, float]]:
    cache = _ENCODING_CACHE
    if cache is None:
        return None

    with _ENCODING_CACHE_LOCK:
        entry = cache.get(key)

    if entry is None:
        return None

    timestamp, payload = entry

    if ENCODING_CACHE_TTL_SECONDS > 0 and (time.time() - timestamp) > ENCODING_CACHE_TTL_SECONDS:
        with _ENCODING_CACHE_LOCK:
            try:
                cache.pop(key, None)
            except Exception:
                pass
        return None

    return payload


def _store_cached_encoding(key: str, value: Tuple[np.ndarray, float]) -> None:
    cache = _ENCODING_CACHE
    if cache is None:
        return

    with _ENCODING_CACHE_LOCK:
        cache[key] = (time.time(), value)


def _has_enhanced_model(model_dir: Path) -> bool:
    enhanced_files = [
        'training_metadata.json',
        'feature_metadata.json',
        'model_metadata.json'
    ]
    return any((model_dir / filename).exists() for filename in enhanced_files)


def _load_legacy_weights(model_dir: Path, feature_columns: List[str]) -> Optional[Dict[str, float]]:
    weights_path = model_dir / "feature_weights.joblib"
    if weights_path.exists():
        try:
            import joblib

            weights = joblib.load(weights_path)
            if isinstance(weights, dict):
                return {k: v for k, v in weights.items() if k not in COLUMNS_TO_EXCLUDE}
            return weights
        except Exception as exc:
            logger.warning(f"joblib 가중치 로드 실패: {exc}")

    npy_path = model_dir / "feature_weights.npy"
    if npy_path.exists():
        try:
            weights_array = np.load(npy_path)
            if feature_columns and len(weights_array) >= len(feature_columns):
                return {
                    col: float(weights_array[i])
                    for i, col in enumerate(feature_columns)
                    if col not in COLUMNS_TO_EXCLUDE
                }
        except Exception as exc:
            logger.warning(f"numpy 가중치 로드 실패: {exc}")

    return None


def _load_model_entry(model_dir: Path) -> ModelCacheEntry:
    metadata: Dict[str, Any] = {}
    components: Dict[str, Any] = {}
    is_enhanced = False

    if load_model_with_metadata and _has_enhanced_model(model_dir):
        try:
            logger.info("개선된 모델 로드 시도...")
            enhanced_components = load_model_with_metadata(model_dir, load_sample_data=False)

            feature_weights = enhanced_components.get('feature_weights')
            if feature_weights is None or isinstance(feature_weights, (dict, np.ndarray)):
                try:
                    from backend.feature_weights import FeatureWeightManager

                    fw_manager = FeatureWeightManager(model_dir)
                    fw_manager.load_weights()
                    feature_weights = fw_manager
                    logger.debug("FeatureWeightManager로 가중치 로드 성공")
                except Exception as exc:
                    logger.debug(f"FeatureWeightManager 로드 실패, 기존 방식 사용: {exc}")
                    if feature_weights is None:
                        feature_columns = enhanced_components.get('feature_columns') or []
                        feature_weights = _load_legacy_weights(
                            model_dir, [c for c in feature_columns if c not in COLUMNS_TO_EXCLUDE]
                        )

            feature_columns = [
                c for c in enhanced_components.get('feature_columns', [])
                if c not in COLUMNS_TO_EXCLUDE
            ]

            components = {
                'searcher': enhanced_components['searcher'],
                'encoder': enhanced_components['encoder'],
                'scaler': enhanced_components['scaler'],
                'feature_columns': feature_columns,
                'pca': enhanced_components.get('pca'),
                'variance_selector': enhanced_components.get('variance_selector'),
                'feature_weights': feature_weights,
                'active_features': enhanced_components.get('active_features'),
            }

            metadata = {
                'model_metadata': enhanced_components.get('model_metadata', {}),
                'feature_metadata': enhanced_components.get('feature_metadata', {}),
                'training_metadata': enhanced_components.get('training_metadata', {}),
                'vector_statistics': enhanced_components.get('vector_statistics', {}),
            }

            is_enhanced = True
            logger.info("✅ 개선된 모델 로드 성공 (캐시 저장)")
            return ModelCacheEntry(components=components, metadata=metadata, is_enhanced=is_enhanced)
        except Exception as exc:
            logger.warning(f"개선된 모델 로드 실패, 기본 로드 시도: {exc}")

    searcher, encoder, scaler, feature_columns = load_optimized_model(model_dir)

    clean_feature_columns = [
        c for c in feature_columns
        if c not in COLUMNS_TO_EXCLUDE
    ]

    components = {
        'searcher': searcher,
        'encoder': encoder,
        'scaler': scaler,
        'feature_columns': clean_feature_columns,
        'pca': None,
        'variance_selector': None,
        'feature_weights': _load_legacy_weights(model_dir, clean_feature_columns),
        'active_features': None,
    }

    logger.info("✅ 기본 모델 로드 성공 (캐시 저장)")
    return ModelCacheEntry(components=components, metadata=metadata, is_enhanced=is_enhanced)


def get_loaded_model(model_dir: Union[str, Path]) -> ModelCacheEntry:
    """모델 디렉터리별 로드 결과를 캐시에 저장하고 재활용한다."""

    path = Path(model_dir).resolve()
    cache_key = str(path)

    with _MODEL_CACHE_LOCK:
        cached = _MODEL_CACHE.get(cache_key)
        if cached is not None:
            logger.debug("모델 캐시 히트: %s", cache_key)
            return cached

        logger.debug("모델 캐시 미스: %s", cache_key)
        entry = _load_model_entry(path)
        _MODEL_CACHE[cache_key] = entry
        return entry


SUMMARY_META_COLUMNS = {
    'ITEM_CD', 'CANDIDATE_ID', 'ROUTING_SIGNATURE', 'PRIORITY',
    'SIMILARITY_TIER', 'SIMILARITY_SCORE', 'REFERENCE_ITEM_CD'
}


def build_routing_signature(routing_df: pd.DataFrame) -> str:
    """공정 목록을 기반으로 라우팅 시그니처 문자열 생성."""
    if routing_df is None or routing_df.empty:
        return ""

    job_names = routing_df.get('JOB_NM')
    tokens: List[str] = []
    if job_names is not None:
        tokens = [str(val).strip() for val in job_names if isinstance(val, str) and val.strip()]

    if not tokens:
        res_names = routing_df.get('RES_DIS')
        if res_names is not None:
            tokens = [str(val).strip() for val in res_names if isinstance(val, str) and val.strip()]

    if not tokens:
        return "ROUTING"

    return '+'.join(tokens[:4])


def normalize_routing_frame(
    target_item: str,
    candidate_id: str,
    base_df: pd.DataFrame,
    *,
    similarity: float,
    reference_item: str,
    priority: str,
    signature: str,
) -> pd.DataFrame:
    """라우팅 DataFrame을 API/SQL 출력 규격에 맞게 정규화."""
    if base_df is None or base_df.empty:
        return pd.DataFrame()

    frame = base_df.copy()
    alias_map = _active_alias_map()
    frame = frame.rename(columns=alias_map)

    alias_map = _active_alias_map()
    frame = frame.rename(columns=alias_map)
    frame = frame.rename(columns=ROUTING_ALIAS_MAP)


    frame['ITEM_CD'] = target_item
    frame['CANDIDATE_ID'] = candidate_id
    frame['ROUTING_SIGNATURE'] = signature
    frame['PRIORITY'] = priority
    frame['SIMILARITY_TIER'] = 'HIGH' if similarity >= SIMILARITY_HIGH_THRESHOLD else 'LOW'
    frame['SIMILARITY_SCORE'] = float(similarity)
    frame['REFERENCE_ITEM_CD'] = reference_item

    if 'MACH_WORKED_HOURS' not in frame.columns:
        if 'ACT_RUN_TIME' in frame.columns:
            frame['MACH_WORKED_HOURS'] = pd.to_numeric(frame['ACT_RUN_TIME'], errors='coerce').fillna(0.0)
        elif 'RUN_TIME' in frame.columns:
            frame['MACH_WORKED_HOURS'] = pd.to_numeric(frame['RUN_TIME'], errors='coerce').fillna(0.0)
        else:
            frame['MACH_WORKED_HOURS'] = 0.0

    numeric_columns = [
        'MFG_LT', 'QUEUE_TIME', 'SETUP_TIME', 'MACH_WORKED_HOURS',
        'ACT_SETUP_TIME', 'ACT_RUN_TIME', 'WAIT_TIME', 'MOVE_TIME',
        'RUN_TIME_QTY', 'SUBCONTRACT_PRC'
    ]
    for col in numeric_columns:
        if col in frame.columns:
            frame[col] = pd.to_numeric(frame[col], errors='coerce').fillna(0.0)
        else:
            frame[col] = 0.0

    for col in SUMMARY_META_COLUMNS:
        if col not in frame.columns:
            if col == 'SIMILARITY_SCORE':
                frame[col] = float(similarity)
            elif col == 'REFERENCE_ITEM_CD':
                frame[col] = reference_item
            elif col == 'PRIORITY':
                frame[col] = priority
            elif col == 'SIMILARITY_TIER':
                frame[col] = 'HIGH' if similarity >= SIMILARITY_HIGH_THRESHOLD else 'LOW'
            elif col == 'ROUTING_SIGNATURE':
                frame[col] = signature
            else:
                frame[col] = None

    output_columns = get_routing_output_columns()
    frame = frame.reindex(columns=output_columns, fill_value=None)

    output_columns = get_routing_output_columns()
    frame = frame.reindex(columns=output_columns, fill_value=None)
    frame = frame.reindex(columns=ROUTING_OUTPUT_COLS, fill_value=None)

    return frame

# ════════════════════════════════════════════════
# 🔧 안전한 타입 변환 함수들
# ════════════════════════════════════════════════

def safe_int_conversion(value, default=0):
    """안전한 정수 변환"""
    if value is None or value == '':
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        logger.warning(f"정수 변환 실패: {value}, 기본값 {default} 사용")
        return default

def safe_float_conversion(value, default=0.0):
    """안전한 실수 변환"""
    if value is None or value == '':
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        logger.warning(f"실수 변환 실패: {value}, 기본값 {default} 사용")
        return default

def _safe_numeric(col: pd.Series) -> pd.Series:
    """안전한 수치형 변환"""
    col = col.replace(["", " ", "-", "--", "nan", "NaN", "null", "NULL", "None"], np.nan)
    num = pd.to_numeric(col, errors="coerce")
    return num.fillna(0).replace([np.inf, -np.inf], 0).infer_objects(copy=False).astype(np.float32)

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

# ════════════════════════════════════════════════
# 🎯 시간 시나리오 설정 클래스
# ════════════════════════════════════════════════

class TimeScenarioConfig:
    """시간 시나리오 설정값들 - GUI에서 조정 가능"""
    
    def __init__(self):
        self.OPTIMAL_SIGMA = 0.67
        self.SAFE_SIGMA = 1.28
        self.CORRELATION_INDEPENDENT = 0.75
        self.CORRELATION_DEPENDENT = 0.25
        self.CV_STABLE = 0.15
        self.CV_MODERATE = 0.30
        self.CV_VARIABLE = 0.50
        self.SAMPLE_BONUS_RATE = 0.05
        self.MAX_SAMPLE_BONUS = 0.2
        self.PROCESS_OVERLAP_THRESHOLD = 0.3
        self.OUTLIER_DETECTION_ENABLED = True
        self.OUTLIER_Z_SCORE_THRESHOLD = 2.5
        self.SIMILARITY_WEIGHT_POWER = 2.0
        self.TRIM_STD_ENABLED = True
        self.TRIM_LOWER_PERCENT = 0.05
        self.TRIM_UPPER_PERCENT = 0.95
    
    def get_scenario_description(self, cv: float) -> str:
        if cv < self.CV_STABLE:
            return "안정적 (낮은 변동성)"
        elif cv < self.CV_MODERATE:
            return "보통 (중간 변동성)"
        elif cv < self.CV_VARIABLE:
            return "가변적 (높은 변동성)"
        else:
            return "불안정 (매우 높은 변동성)"
    
    def get_scenario_emoji(self, cv: float) -> str:
        if cv < self.CV_STABLE:
            return "🟢"
        elif cv < self.CV_MODERATE:
            return "🟡"
        elif cv < self.CV_VARIABLE:
            return "🟠"
        else:
            return "🔴"
    
    def to_dict(self) -> Dict:
        return {
            'optimal_sigma': self.OPTIMAL_SIGMA,
            'safe_sigma': self.SAFE_SIGMA,
            'correlation_independent': self.CORRELATION_INDEPENDENT,
            'correlation_dependent': self.CORRELATION_DEPENDENT,
            'cv_stable': self.CV_STABLE,
            'cv_moderate': self.CV_MODERATE,
            'cv_variable': self.CV_VARIABLE,
            'sample_bonus_rate': self.SAMPLE_BONUS_RATE,
            'max_sample_bonus': self.MAX_SAMPLE_BONUS,
            'process_overlap_threshold': self.PROCESS_OVERLAP_THRESHOLD,
            'outlier_detection_enabled': self.OUTLIER_DETECTION_ENABLED,
            'outlier_z_score_threshold': self.OUTLIER_Z_SCORE_THRESHOLD,
            'similarity_weight_power': self.SIMILARITY_WEIGHT_POWER,
            'trim_std_enabled': self.TRIM_STD_ENABLED,
            'trim_lower_percent': self.TRIM_LOWER_PERCENT,
            'trim_upper_percent': self.TRIM_UPPER_PERCENT,
        }

    def from_dict(self, config_dict: Dict):
        self.OPTIMAL_SIGMA = config_dict.get('optimal_sigma', 0.67)
        self.SAFE_SIGMA = config_dict.get('safe_sigma', 1.28)
        self.CORRELATION_INDEPENDENT = config_dict.get('correlation_independent', 0.75)
        self.CORRELATION_DEPENDENT = config_dict.get('correlation_dependent', 0.25)
        self.CV_STABLE = config_dict.get('cv_stable', 0.15)
        self.CV_MODERATE = config_dict.get('cv_moderate', 0.30)
        self.CV_VARIABLE = config_dict.get('cv_variable', 0.50)
        self.SAMPLE_BONUS_RATE = config_dict.get('sample_bonus_rate', 0.05)
        self.MAX_SAMPLE_BONUS = config_dict.get('max_sample_bonus', 0.2)
        self.PROCESS_OVERLAP_THRESHOLD = config_dict.get('process_overlap_threshold', 0.3)
        self.OUTLIER_DETECTION_ENABLED = config_dict.get('outlier_detection_enabled', True)
        self.OUTLIER_Z_SCORE_THRESHOLD = config_dict.get('outlier_z_score_threshold', 2.5)
        self.SIMILARITY_WEIGHT_POWER = config_dict.get('similarity_weight_power', 2.0)
        self.TRIM_STD_ENABLED = config_dict.get('trim_std_enabled', True)
        self.TRIM_LOWER_PERCENT = config_dict.get('trim_lower_percent', 0.05)
        self.TRIM_UPPER_PERCENT = config_dict.get('trim_upper_percent', 0.95)

# 전역 설정 인스턴스
SCENARIO_CONFIG = TimeScenarioConfig()

# ════════════════════════════════════════════════
# 🔧 개선된 모델 로드 및 관리
# ════════════════════════════════════════════════

class EnhancedModelManager:
    """개선된 모델 관리자 - 메타데이터 및 추가 컴포넌트 지원"""

    def __init__(self, model_dir: Union[str, Path]):
        self.model_dir = Path(model_dir)
        self.model_components: Dict[str, Any] = {}
        self.metadata: Dict[str, Any] = {}
        self.is_enhanced = False
        self._cache_entry: Optional[ModelCacheEntry] = None

    def __enter__(self):
        """Context manager 진입"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager 종료 시 리소스 정리"""
        self.cleanup()
        
    def cleanup(self):
        """메모리 리소스 정리"""
        self.model_components = {}
        self.metadata = {}
        self.is_enhanced = False
        self._cache_entry = None
        logger.debug("모델 매니저 리소스 참조 해제")

    def load(self):
        """모델 로드 - 개선된 버전 우선, 호환성 유지"""

        entry = get_loaded_model(self.model_dir)
        self._cache_entry = entry
        self.model_components = entry.components
        self.metadata = entry.metadata
        self.is_enhanced = entry.is_enhanced

    def get_feature_weights_array(self) -> np.ndarray:
        feature_cols = self.model_components['feature_columns']
        weights_dict = self.model_components.get('feature_weights')
        
        if weights_dict and isinstance(weights_dict, dict):
            weights = []
            for col in feature_cols:
                weights.append(weights_dict.get(col, 1.0))
            weights = np.array(weights)
        else:
            weights = np.ones(len(feature_cols))
        
        return weights.astype(np.float32)
    
    def transform_features(self, encoded_features: np.ndarray) -> np.ndarray:
        result = encoded_features
        
        if self.model_components.get('variance_selector') is not None:
            try:
                result = self.model_components['variance_selector'].transform(result)
                logger.debug(f"Variance selector 적용: {encoded_features.shape} → {result.shape}")
            except Exception as e:
                logger.warning(f"Variance selector 적용 실패: {e}")
        
        if self.model_components.get('pca') is not None:
            try:
                result = self.model_components['pca'].transform(result)
                logger.debug(f"PCA 적용: {result.shape[0]} → {self.model_components['pca'].n_components_} 차원")
            except Exception as e:
                logger.warning(f"PCA 적용 실패: {e}")
        
        if self.model_components.get('active_features') is not None:
            try:
                active_mask = self.model_components['active_features']
                if len(active_mask) == result.shape[1]:
                    result = result[:, active_mask]
                    logger.debug(f"Active features 적용: {np.sum(active_mask)}개 차원 유지")
            except Exception as e:
                logger.warning(f"Active features 적용 실패: {e}")
        
        return result
    
    def get_model_info(self) -> Dict[str, Any]:
        info = {
            'is_enhanced': self.is_enhanced,
            'has_pca': self.model_components.get('pca') is not None,
            'has_variance_selector': self.model_components.get('variance_selector') is not None,
            'has_feature_weights': self.model_components.get('feature_weights') is not None,
            'has_active_features': self.model_components.get('active_features') is not None,
        }
        
        if self.is_enhanced and self.metadata.get('model_metadata'):
            info.update({
                'creation_time': self.metadata['model_metadata'].get('creation_time'),
                'vector_dimension': self.metadata['model_metadata'].get('searcher_info', {}).get('vector_dimension'),
                'total_items': self.metadata['model_metadata'].get('item_info', {}).get('total_items'),
            })
        
        return info

# ════════════════════════════════════════════════
# 🔧 개선된 인코딩 함수
# ════════════════════════════════════════════════

def _clean_and_encode_enhanced(
    df: pd.DataFrame,
    feature_cols: List[str],
    model_manager: EnhancedModelManager
) -> Tuple[np.ndarray, float]:
    """
    아이템 정보를 정리하고 인코딩 (개선 버전)
    OrdinalEncoder와 StandardScaler의 요구사항을 모두 충족
    """
    cache_key = _build_encoding_cache_key(df)
    cached = _get_cached_encoding(cache_key)
    if cached is not None:
        cached_vector, cached_miss_ratio = cached
        logger.debug("인코딩 캐시 히트 - 재사용")
        return cached_vector.copy(), float(cached_miss_ratio)

    df = df.copy()

    # 제외할 컬럼 실제 제거
    for col in COLUMNS_TO_EXCLUDE:
        if col in df.columns:
            df = df.drop(columns=[col])
            logger.debug(f"입력 데이터에서 제외된 컬럼: {col}")
    
    # 결측률 계산은 입력 데이터 기준으로
    available_cols = [col for col in feature_cols if col in df.columns]
    miss_ratio = df[available_cols].isna().mean(axis=1).iloc[0] if available_cols else 0.0
    
    # 1) OrdinalEncoder가 필요로 하는 범주형 컬럼 처리
    encoder = model_manager.model_components['encoder']
    encoder_cols = encoder.feature_names_in_  # encoder가 학습 시 본 컬럼들
    
    # encoder가 필요로 하는 컬럼만 선택하고, 없는 컬럼은 'missing'으로 채움
    df_for_encoder = df.reindex(columns=encoder_cols, fill_value='missing')
    df_cat = df_for_encoder.apply(_safe_string)
    
    # 인코딩 수행
    enc_cat = encoder.transform(df_cat)
    enc_cat_df = pd.DataFrame(enc_cat, columns=encoder_cols, index=df.index)
    
    # 2) 수치형 컬럼 처리
    num_cols = [c for c in feature_cols if c in NUMERIC_FEATURES and c not in COLUMNS_TO_EXCLUDE]
    if num_cols:
        # 수치형 컬럼 중 실제로 있는 것만 처리
        available_num_cols = [c for c in num_cols if c in df.columns]
        if available_num_cols:
            df_num = df[available_num_cols].apply(_safe_numeric)
        else:
            df_num = pd.DataFrame(index=df.index)
        
        # 없는 수치형 컬럼은 0으로 채움
        for col in num_cols:
            if col not in df_num.columns:
                df_num[col] = 0.0
    else:
        df_num = pd.DataFrame(index=df.index)
    
    # 3) 범주형과 수치형 결합
    fin = pd.concat([enc_cat_df, df_num], axis=1)
    
    # 4) StandardScaler가 필요로 하는 컬럼만 선택하고 순서 맞춤
    scaler = model_manager.model_components['scaler']
    scaler_cols = scaler.feature_names_in_  # scaler가 학습 시 본 컬럼들
    
    # scaler가 필요로 하는 컬럼만 선택 (reindex로 순서도 맞춤)
    fin = fin.reindex(columns=scaler_cols, fill_value=0.0).astype(np.float32)
    
    # 5) 가중치 적용
    weights_obj = model_manager.model_components.get('feature_weights')
    
    # FeatureWeightManager 객체인지 확인
    if hasattr(weights_obj, 'get_weights_as_array'):
        # FeatureWeightManager를 사용하는 경우 - 활성화 상태 반영
        weights = weights_obj.get_weights_as_array(scaler_cols, apply_active_mask=True)
        logger.debug("FeatureWeightManager 사용 - 활성화된 피처만 가중치 적용")
    elif isinstance(weights_obj, dict):
        # 기존 딕셔너리 방식 (하위 호환성)
        weights = []
        for col in scaler_cols:
            weights.append(weights_obj.get(col, 1.0))
        weights = np.array(weights)
    else:
        # 가중치 정보가 없는 경우
        weights = np.ones(len(scaler_cols))
        logger.debug("가중치 정보 없음 - 기본값 1.0 사용")
    
    # 가중치 적용
    if len(weights) == fin.shape[1]:
        fin = fin * weights
        # 0인 가중치를 가진 피처 수 로깅
        zero_weight_count = np.sum(weights == 0)
        if zero_weight_count > 0:
            logger.info(f"비활성화된 피처 {zero_weight_count}개가 예측에서 제외됨")
    else:
        logger.warning(f"가중치 차원 불일치: weights={len(weights)}, features={fin.shape[1]}")
    
    # 6) 스케일링
    scaled = scaler.transform(fin)
    
    # 7) 추가 변환 (PCA 등)
    result = model_manager.transform_features(scaled)

    _store_cached_encoding(cache_key, (result.copy(), float(miss_ratio)))

    return result, miss_ratio

# ════════════════════════════════════════════════
# 🚀 개선된 메인 예측 함수
# ════════════════════════════════════════════════

def predict_single_item_with_ml_enhanced(
    item_cd: str,
    model_dir: Union[str, Path],
    *,
    top_k: int = DEFAULT_TOP_K,
    miss_thr: float = MISSING_RATIO_THRESHOLD,
    config: TimeScenarioConfig = None,
    mode: str = "summary",
    routing_selection: str = "latest"
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    """Enhanced ML 단일 품목 예측 - 기존 라우팅 우선"""
    if config is None:
        config = SCENARIO_CONFIG
    
    logger.info(f"🚀 Enhanced ML 예측 시작 - 품목: {item_cd}, 모드: {mode}, 라우팅: {routing_selection}")
    
    # 1. 먼저 기존 라우팅 확인
    existing_routing = fetch_routing_for_item(item_cd, latest_only=True, selection_mode=routing_selection)
    if not existing_routing.empty:
        # A안: 모드에 따라 반환 형태를 달리한다
        if mode == "summary":
            # ① 집계 → 1 행으로 변환
            summary_row = {
                "ITEM_CD": item_cd,
                "SETUP_TIME": existing_routing["SETUP_TIME"].sum(),
                "RUN_TIME": existing_routing["RUN_TIME"].sum(),
                "WAIT_TIME": existing_routing["WAIT_TIME"].sum() if "WAIT_TIME" in existing_routing else 0,
                "MOVE_TIME": existing_routing["MOVE_TIME"].sum() if "MOVE_TIME" in existing_routing else 0,
                "OPTIMAL_TIME": None,
                "STANDARD_TIME": None,
                "SAFE_TIME": None,
                "PREDICTION_TYPE": "EXISTING",
                "CONFIDENCE": 1.0,
                "MESSAGE": "기존 라우팅(요약)"
            }
            summary_df = pd.DataFrame([summary_row])
            empty_cand_df = pd.DataFrame()
            model_info = {"is_enhanced": False, "source": "existing_routing"}
            return summary_df, empty_cand_df, model_info

        else:  # detailed 모드
            existing_routing = existing_routing.copy()
            existing_routing["PREDICTION_TYPE"] = "EXISTING"
            existing_routing["INPUT_ITEM_CD"] = item_cd
            empty_cand_df = pd.DataFrame()
            model_info = {"is_enhanced": False, "source": "existing_routing"}
            return existing_routing, empty_cand_df, model_info
    
    # 2. 기존 라우팅이 없는 경우에만 ML 예측 진행
    logger.info(f"🔍 {item_cd}의 기존 라우팅 없음 - ML 예측 진행")
    
    is_valid, msg, item_info = validate_input_item(item_cd)
    if not is_valid:
        error_df = pd.DataFrame({
            "ITEM_CD": [item_cd],
            "MESSAGE": [msg]
        })
        return error_df, pd.DataFrame(), {}
    
    # Context manager를 사용한 모델 관리
    with EnhancedModelManager(model_dir) as model_manager:
        model_manager.load()
        model_info = model_manager.get_model_info()
        
        logger.info(f"📊 모델 정보: Enhanced={model_info['is_enhanced']}, "
                   f"PCA={model_info['has_pca']}, "
                   f"Feature Weights={model_info['has_feature_weights']}")
        
        # 모델에서 feature_cols 가져오기
        model_feature_cols = model_manager.model_components['feature_columns']
        
        # 인코딩 수행
        encoded_vec, miss_ratio = _clean_and_encode_enhanced(item_info, model_feature_cols, model_manager)
        
        if miss_ratio > miss_thr:
            error_df = pd.DataFrame({
                "ITEM_CD": [item_cd],
                "MESSAGE": [f"기준정보 결측률 {miss_ratio:.0%} (임계값: {miss_thr:.0%})"]
            })
            return error_df, pd.DataFrame(), model_info
        
        vec = encoded_vec.mean(axis=0).reshape(1, -1)
        
        searcher = model_manager.model_components['searcher']
        codes, scores = searcher.find_similar(vec, top_k)
        
        if not isinstance(codes, list):
            codes = [codes]
        if not isinstance(scores, list):
            scores = [scores]
        
        logger.info(f"🔍 유사품 검색 완료: {len(codes)}개 (유사도: {min(scores):.3f}~{max(scores):.3f})")
        
        # ML 예측 수행
        routing_df = predict_routing_from_similar_items(
            item_cd, codes, scores, config, mode
        )
        
        # ML 예측 결과에 PREDICTION_TYPE 추가
        if not routing_df.empty:
            routing_df['PREDICTION_TYPE'] = 'ML_BASED'
            routing_df['INPUT_ITEM_CD'] = item_cd
            
            if model_info.get('vector_dimension'):
                routing_df['MODEL_INFO'] = f"Dim={model_info['vector_dimension']}, Enhanced={model_info['is_enhanced']}"
        
        cand_df = pd.DataFrame({
            "ITEM_CD": item_cd,
            "CANDIDATE_RANK": list(range(1, len(codes)+1)),
            "CANDIDATE_ITEM_CD": codes,
            "SIMILARITY_SCORE": scores,
        })
        
        return routing_df, cand_df, model_info

def validate_input_item(item_cd: str) -> Tuple[bool, str, Optional[pd.DataFrame]]:
    """입력 품목 검증 - 기존 라우팅 경고 제거"""
    item_info = fetch_single_item(item_cd)
    if item_info.empty:
        return False, f"품목 정보가 없습니다: {item_cd}", None
    
    # 기존 라우팅 존재 여부는 단순 로깅만
    has_routing = check_item_has_routing(item_cd)
    if has_routing:
        logger.debug(f"품목 {item_cd}에 기존 라우팅 존재")
    
    return True, "품목 정보 확인 완료", item_info

# ════════════════════════════════════════════════
# 🔧 유틸리티 함수들
# ════════════════════════════════════════════════

def apply_similarity_weights(values: List[float], similarities: List[float], 
                           power: float = None) -> Tuple[List[float], List[float]]:
    if power is None:
        power = SCENARIO_CONFIG.SIMILARITY_WEIGHT_POWER
    
    weights = np.power(similarities, power)
    total_weight = np.sum(weights)
    if total_weight > 0:
        weights = weights / total_weight
    else:
        weights = np.ones_like(weights) / len(weights)
    
    return values, weights.tolist()

def filter_by_similarity_threshold(items: List[str], similarities: List[float], 
                                 threshold: float = MIN_SIMILARITY_THRESHOLD) -> Tuple[List[str], List[float]]:
    filtered_items = []
    filtered_sims = []
    
    for item, sim in zip(items, similarities):
        if sim >= threshold:
            filtered_items.append(item)
            filtered_sims.append(sim)
    
    if not filtered_items and items:
        filtered_items = [items[0]]
        filtered_sims = [similarities[0]]
        logger.warning(f"모든 품목이 임계값({threshold:.2f}) 미만 - 최고 유사도 품목만 유지: {similarities[0]:.3f}")
    
    logger.info(f"유사도 필터링: {len(items)}개 → {len(filtered_items)}개 (임계값: {threshold:.2f})")
    return filtered_items, filtered_sims

def remove_outliers_zscore(values: List[float], weights: List[float],
                          z_threshold: float = 2.5) -> Tuple[List[float], List[float], List[bool]]:
    if len(values) < 3:
        normalized = _normalize_weights_array(weights) if weights else np.ones(len(values)) / max(len(values), 1)
        return values, normalized.tolist(), [True] * len(values)

    values_array = np.array(values)
    weights_array = _normalize_weights_array(weights if weights else np.ones(len(values_array)))

    mean = np.average(values_array, weights=weights_array)
    variance = np.average((values_array - mean)**2, weights=weights_array)
    std = np.sqrt(variance)

    if std == 0:
        return values, weights_array.tolist(), [True] * len(values)

    z_scores = np.abs((values_array - mean) / std)
    valid_mask = z_scores <= z_threshold

    filtered_values = values_array[valid_mask].tolist()
    filtered_weights = weights_array[valid_mask].tolist()

    if filtered_weights:
        total_weight = sum(filtered_weights)
        filtered_weights = [w/total_weight for w in filtered_weights]

    removed_count = len(values) - len(filtered_values)
    if removed_count > 0:
        logger.debug(f"이상치 제거: {removed_count}개 제거됨 (Z-score > {z_threshold})")

    return filtered_values, filtered_weights, valid_mask.tolist()


def _normalize_weights_array(weights: Union[List[float], np.ndarray]) -> np.ndarray:
    arr = np.asarray(weights, dtype=np.float64)
    if arr.size == 0:
        return arr
    total = arr.sum()
    if total <= 0:
        return np.ones_like(arr) / len(arr)
    return arr / total


def _apply_weighted_trimmed_range(
    values: np.ndarray,
    weights: np.ndarray,
    lower_pct: float,
    upper_pct: float
) -> Tuple[np.ndarray, np.ndarray]:
    if values.size < 3:
        return values, weights

    lower_pct = float(np.clip(lower_pct, 0.0, 0.5))
    upper_pct = float(np.clip(upper_pct, 0.5, 1.0))
    if upper_pct <= lower_pct:
        return values, weights

    order = np.argsort(values)
    sorted_values = values[order]
    sorted_weights = weights[order]

    cumulative = np.cumsum(sorted_weights)
    lower_bounds = cumulative - sorted_weights

    keep_mask = (cumulative > lower_pct) & (lower_bounds < upper_pct)
    trimmed_values = sorted_values[keep_mask]
    trimmed_weights = sorted_weights[keep_mask]

    if trimmed_values.size == 0:
        return values, weights

    trimmed_weights = _normalize_weights_array(trimmed_weights)
    return trimmed_values, trimmed_weights

# ════════════════════════════════════════════════
# 📊 제조 시간 통계 계산
# ════════════════════════════════════════════════

def calculate_manufacturing_time_stats(
    times_list: List[float],
    weights_list: List[float],
    config: TimeScenarioConfig = None,
    *,
    apply_trimmed: bool = False,
    trim_lower: Optional[float] = None,
    trim_upper: Optional[float] = None
) -> Dict[str, float]:
    """제조 시간 통계 계산"""
    if config is None:
        config = SCENARIO_CONFIG

    if not times_list:
        return {
            'mean': 0.0,
            'std': 0.0,
            'cv': 0.0,
            'optimal': 0.0,
            'standard': 0.0,
            'safe': 0.0,
            'samples': 0,
            'raw_samples': 0,
        }

    times = np.array(times_list, dtype=np.float64)
    weights = _normalize_weights_array(weights_list if weights_list else np.ones(len(times)))

    trimmed_times = times
    trimmed_weights = weights

    if (
        apply_trimmed
        and len(times) >= 3
        and getattr(config, 'TRIM_STD_ENABLED', True)
    ):
        lower = trim_lower if trim_lower is not None else getattr(config, 'TRIM_LOWER_PERCENT', 0.05)
        upper = trim_upper if trim_upper is not None else getattr(config, 'TRIM_UPPER_PERCENT', 0.95)
        trimmed_times, trimmed_weights = _apply_weighted_trimmed_range(times, weights, lower, upper)
        removed = len(times) - len(trimmed_times)
        if removed > 0:
            logger.debug(
                "가중치 트림 적용: 총 %d개 중 %d개 제거 (하위 %.0f%%, 상위 %.0f%%)",
                len(times),
                removed,
                lower * 100,
                (1 - upper) * 100,
            )

    mean = np.average(trimmed_times, weights=trimmed_weights)
    variance = np.average((trimmed_times - mean)**2, weights=trimmed_weights)
    std = np.sqrt(variance)
    cv = std / mean if mean > 0 else 0

    optimal_time = mean + config.OPTIMAL_SIGMA * std
    standard_time = mean
    safe_time = mean + config.SAFE_SIGMA * std

    return {
        'mean': mean,
        'std': std,
        'cv': cv,
        'optimal': optimal_time,
        'standard': standard_time,
        'safe': safe_time,
        'samples': len(trimmed_times),
        'raw_samples': len(times)
    }

def calculate_confidence_score(
    sample_count: int,
    avg_similarity: float,
    cv: float,
    config: TimeScenarioConfig
) -> float:
    """예측 신뢰도 점수 계산"""
    sample_score = min(0.3, sample_count * 0.05)
    similarity_score = avg_similarity * 0.4
    if cv < config.CV_STABLE:
        cv_score = 0.3
    elif cv < config.CV_MODERATE:
        cv_score = 0.2
    elif cv < config.CV_VARIABLE:
        cv_score = 0.1
    else:
        cv_score = 0.0
    
    confidence = sample_score + similarity_score + cv_score
    if sample_count >= 5 and avg_similarity >= 0.8:
        confidence = min(1.0, confidence * 1.1)
    
    return min(1.0, confidence)

# ════════════════════════════════════════════════
# 🚀 라우팅 예측 함수
# ════════════════════════════════════════════════

def predict_routing_from_similar_items(
    input_item_cd: str,
    similar_items: List[str],
    similarity_scores: List[float],
    config: TimeScenarioConfig = None,
    mode: str = "summary",
    routing_selection: str = "latest"
) -> pd.DataFrame:
    """
    유사 품목들의 라우팅 정보를 기반으로 새로운 품목의 라우팅 예측
    """
    if config is None:
        config = SCENARIO_CONFIG
    
    logger.info(f"라우팅 예측 시작 - 품목: {input_item_cd}, 유사품: {len(similar_items)}개, 모드: {mode}, 라우팅: {routing_selection}")
    
    # 디버깅: 유사품과 유사도 출력
    for item, score in zip(similar_items[:5], similarity_scores[:5]):
        logger.debug(f"  유사품: {item}, 유사도: {score:.3f}")
    
    # 1. 유사도 필터링 - 더 유연하게 처리
    filtered_items, filtered_scores = filter_by_similarity_threshold(
        similar_items, similarity_scores, MIN_SIMILARITY_THRESHOLD
    )
    
    # 2. 유사품의 라우팅 데이터 조회 - 라우팅이 있는 품목을 찾을 때까지 확장 탐색
    all_routings = []
    items_with_routing = []
    items_without_routing = []
    checked_items = set()  # 중복 체크 방지
    
    # 필터링된 품목들부터 확인
    for i, item_cd in enumerate(filtered_items):
        if item_cd in checked_items:
            continue
        checked_items.add(item_cd)
        
        routing = fetch_routing_for_item(item_cd, latest_only=True, selection_mode=routing_selection)
        if not routing.empty:
            all_routings.append((item_cd, routing))
            items_with_routing.append(item_cd)
            
            # ROUT_NO 정보 로깅
            rout_no = routing['ROUT_NO'].iloc[0] if 'ROUT_NO' in routing.columns else 'UNKNOWN'
            logger.info(f"  라우팅 발견: {item_cd} (유사도: {filtered_scores[i]:.3f}, ROUT_NO: {rout_no})")
            
            # ⭐ 중요: 단일 ROUT_NO 그룹만 사용하므로 첫 번째 라우팅을 찾으면 중단
            logger.info(f"단일 ROUT_NO 그룹 사용: {item_cd}의 {rout_no} (공정 수: {len(routing)})")
            break  # 첫 번째 라우팅만 사용하고 중단
        else:
            items_without_routing.append(item_cd)
    
    # 3. 라우팅이 없으면 전체 유사품 목록에서 추가 탐색
    if not all_routings and len(similar_items) > len(filtered_items):
        logger.info("필터링된 품목에서 라우팅을 찾지 못함. 전체 유사품 목록에서 추가 탐색...")
        
        # 원래 유사품 목록에서 아직 확인하지 않은 품목들 확인
        for i, item_cd in enumerate(similar_items):
            if item_cd in checked_items:
                continue
            checked_items.add(item_cd)
            
            routing = fetch_routing_for_item(item_cd, latest_only=True)
            if not routing.empty:
                all_routings.append((item_cd, routing))
                items_with_routing.append(item_cd)
                # 원래 유사도 사용하되, filtered_scores에도 추가
                if item_cd not in filtered_items:
                    filtered_items.append(item_cd)
                    filtered_scores.append(similarity_scores[i])
                
                # ROUT_NO 정보 로깅
                rout_no = routing['ROUT_NO'].iloc[0] if 'ROUT_NO' in routing.columns else 'UNKNOWN'
                logger.info(f"  라우팅 발견: {item_cd} (유사도: {similarity_scores[i]:.3f}, ROUT_NO: {rout_no})")
                
                # ⭐ 중요: 단일 ROUT_NO 그룹만 사용하므로 첫 번째 라우팅을 찾으면 중단
                logger.info(f"단일 ROUT_NO 그룹 사용: {item_cd}의 {rout_no} (공정 수: {len(routing)})")
                break  # 첫 번째 라우팅만 사용하고 중단
            else:
                items_without_routing.append(item_cd)
    
    logger.info(f"라우팅 있는 품목: {len(items_with_routing)}개 - {items_with_routing[:5]}")
    logger.info(f"라우팅 없는 품목: {len(items_without_routing)}개 - {items_without_routing[:5]}")
    logger.info(f"전체 확인한 품목: {len(checked_items)}개")
    
    # 단일 ROUT_NO 사용 정보 추가 로깅
    if all_routings:
        used_item = all_routings[0][0]
        used_routing = all_routings[0][1]
        used_rout_no = used_routing['ROUT_NO'].iloc[0] if 'ROUT_NO' in used_routing.columns else 'UNKNOWN'
        logger.info(f"[예측] 단일 ROUT_NO 기준 예측: {used_item}의 {used_rout_no} 사용")
    
    # 4. 여전히 라우팅을 찾지 못한 경우
    if not all_routings:
        logger.warning(f"모든 유사품 ({len(checked_items)}개) 중 라우팅 데이터가 없습니다: {input_item_cd}")
        
        # 유사도가 높은 상위 5개 품목 정보 포함
        top_items_info = []
        for i, (item, score) in enumerate(zip(similar_items[:5], similarity_scores[:5])):
            top_items_info.append(f"{i+1}. {item} (유사도: {score:.3f})")
        
        return pd.DataFrame({
            'ITEM_CD': [input_item_cd],
            'MESSAGE': [f'상위 {len(checked_items)}개 유사품 중 라우팅 데이터가 없음'],
            'SIMILAR_ITEMS_CHECKED': [', '.join(similar_items[:10])],
            'SIMILARITY_SCORES': [', '.join([f'{s:.3f}' for s in similarity_scores[:10]])],
            'TOP_SIMILAR_ITEMS': ['\n'.join(top_items_info)]
        })
    
    logger.info(f"라우팅 데이터 수집 완료: {len(all_routings)}개 품목")
    
    if mode == "detailed":
        # 상세 모드: 공정별 라우팅 예측
        process_predictions = defaultdict(list)
        
        for item_cd, routing_df in all_routings:
            try:
                item_index = filtered_items.index(item_cd)
                item_similarity = filtered_scores[item_index]
            except (ValueError, IndexError):
                logger.warning(f"유사도를 찾을 수 없음: {item_cd}, 기본값 사용")
                item_similarity = 0.5  # 기본값
            
            for _, row in routing_df.iterrows():
                proc_seq = safe_int_conversion(row.get('PROC_SEQ'), 0)
                proc_info = {
                    'ROUT_NO': str(row.get('ROUT_NO', '')),
                    'PROC_SEQ': proc_seq,
                    'JOB_CD': str(row.get('JOB_CD', '')),
                    'JOB_NM': str(row.get('JOB_NM', '')),
                    'RES_CD': str(row.get('RES_CD', '')),
                    'RES_DIS': str(row.get('RES_DIS', '')),
                    'INSIDE_FLAG': str(row.get('INSIDE_FLAG', '사내')),
                    'TIME_UNIT': str(row.get('TIME_UNIT', '분(Min.)')),
                    'SETUP_TIME': safe_float_conversion(row.get('SETUP_TIME'), 0.0),
                    'RUN_TIME': safe_float_conversion(row.get('RUN_TIME'), 0.0),
                    'MACH_WORKED_HOURS': safe_float_conversion(
                        row.get('MACH_WORKED_HOURS')
                        or row.get('ACT_RUN_TIME')
                        or row.get('RUN_TIME'),
                        0.0,
                    ),
                    'ACT_SETUP_TIME': safe_float_conversion(row.get('ACT_SETUP_TIME') or row.get('SETUP_TIME'), 0.0),
                    'ACT_RUN_TIME': safe_float_conversion(row.get('ACT_RUN_TIME') or row.get('RUN_TIME'), 0.0),
                    'WAIT_TIME': safe_float_conversion(row.get('WAIT_TIME'), 0.0),
                    'MOVE_TIME': safe_float_conversion(row.get('MOVE_TIME'), 0.0),
                    'SOURCE_ITEM': item_cd,
                    'SIMILARITY': item_similarity
                }
                process_predictions[proc_seq].append(proc_info)
        
        predicted_routing = []
        
        # PROC_SEQ 순서대로 처리
        for proc_seq in sorted(process_predictions.keys()):
            proc_list = process_predictions[proc_seq]
            if not proc_list:
                continue
            
            # 가장 빈번한 값 선택
            job_cd = Counter(p['JOB_CD'] for p in proc_list).most_common(1)[0][0]
            job_nm = Counter(p['JOB_NM'] for p in proc_list).most_common(1)[0][0]
            res_cd = Counter(p['RES_CD'] for p in proc_list).most_common(1)[0][0]
            res_dis = Counter(p['RES_DIS'] for p in proc_list).most_common(1)[0][0]
            inside_flag = Counter(p['INSIDE_FLAG'] for p in proc_list).most_common(1)[0][0]
            time_unit = '분(Min.)'  # 고정값
            
            # 시간 데이터 계산
            setup_times = [p['SETUP_TIME'] for p in proc_list]
            run_times = [p['RUN_TIME'] for p in proc_list]
            mach_times = [p['MACH_WORKED_HOURS'] for p in proc_list]
            wait_times = [p['WAIT_TIME'] for p in proc_list]
            move_times = [p['MOVE_TIME'] for p in proc_list]
            similarities = [p['SIMILARITY'] for p in proc_list]

            _, weights = apply_similarity_weights(run_times, similarities, config.SIMILARITY_WEIGHT_POWER)

            if config.OUTLIER_DETECTION_ENABLED and len(run_times) >= 3:
                run_times, weights, valid_mask = remove_outliers_zscore(
                    run_times, weights, config.OUTLIER_Z_SCORE_THRESHOLD
                )
                setup_times = [val for val, keep in zip(setup_times, valid_mask) if keep]
                mach_times = [val for val, keep in zip(mach_times, valid_mask) if keep]
                wait_times = [val for val, keep in zip(wait_times, valid_mask) if keep]
                move_times = [val for val, keep in zip(move_times, valid_mask) if keep]
                similarities = [val for val, keep in zip(similarities, valid_mask) if keep]

            setup_stats = calculate_manufacturing_time_stats(setup_times, weights, config, apply_trimmed=True)
            run_stats = calculate_manufacturing_time_stats(run_times, weights, config)
            mach_stats = calculate_manufacturing_time_stats(mach_times, weights, config, apply_trimmed=True)
            wait_stats = calculate_manufacturing_time_stats(wait_times, weights, config)
            move_stats = calculate_manufacturing_time_stats(move_times, weights, config)

            similarity_mean = np.mean(similarities) if similarities else 0.0

            confidence = calculate_confidence_score(
                len(proc_list), similarity_mean, mach_stats['cv'], config
            )

            prediction = {
                'ROUT_NO': 'PREDICTED',
                'ITEM_CD': input_item_cd,
                'PROC_SEQ': proc_seq,
                'INSIDE_FLAG': inside_flag,
                'JOB_CD': job_cd,
                'JOB_NM': job_nm,
                'RES_CD': res_cd,
                'RES_DIS': res_dis,
                'TIME_UNIT': time_unit,
                'SETUP_TIME': round(setup_stats['mean'], 3),
                'RUN_TIME': round(run_stats['mean'], 3),
                'MACH_WORKED_HOURS': round(mach_stats['mean'], 3),
                'ACT_SETUP_TIME': round(setup_stats['mean'], 3),
                'ACT_RUN_TIME': round(mach_stats['mean'], 3),
                'WAIT_TIME': round(wait_stats['mean'], 3),
                'MOVE_TIME': round(move_stats['mean'], 3),
                'OPTIMAL_TIME': round(mach_stats['optimal'], 3),
                'STANDARD_TIME': round(mach_stats['standard'], 3),
                'SAFE_TIME': round(mach_stats['safe'], 3),
                'TIME_STD': round(mach_stats['std'], 3),
                'TIME_CV': round(mach_stats['cv'], 3),
                'SIMILAR_ITEMS_USED': len(proc_list),
                'AVG_SIMILARITY': round(similarity_mean, 3),
                'CONFIDENCE': round(confidence, 3),
                'SCENARIO': config.get_scenario_description(mach_stats['cv']),
                'SCENARIO_EMOJI': config.get_scenario_emoji(mach_stats['cv']),
                'SOURCE_ITEMS': ','.join([p['SOURCE_ITEM'] for p in proc_list]),
                'SIMILARITY_SCORES': ','.join([f"{p['SIMILARITY']:.3f}" for p in proc_list]),
                'WEIGHTS': ','.join([f"{w:.3f}" for w in weights]),
                'VALID_FROM_DT': '01-Jan-01',
                'VALID_TO_DT': '31-Dec-99',
                'INSRT_DT': datetime.now().strftime('%Y-%m-%d')
            }
            
            predicted_routing.append(prediction)
        
        if predicted_routing:
            routing_df = pd.DataFrame(predicted_routing)
            routing_df = routing_df.sort_values('PROC_SEQ').reset_index(drop=True)
            
            # 데이터베이스 컬럼 순서에 맞게 재정렬
            base_cols = [
                'ROUT_NO', 'ITEM_CD', 'PROC_SEQ', 'INSIDE_FLAG', 'JOB_CD', 'JOB_NM',
                'RES_CD', 'RES_DIS', 'TIME_UNIT', 'SETUP_TIME', 'RUN_TIME',
                'MACH_WORKED_HOURS', 'ACT_SETUP_TIME', 'ACT_RUN_TIME', 'WAIT_TIME', 'MOVE_TIME',
                'OPTIMAL_TIME', 'STANDARD_TIME', 'SAFE_TIME', 'VALID_FROM_DT', 'VALID_TO_DT', 'INSRT_DT'
            ]
            extra_cols = [col for col in routing_df.columns if col not in base_cols]
            routing_df = routing_df[base_cols + extra_cols]
            
            logger.info(f"상세 라우팅 예측 완료: {len(routing_df)}개 공정")
            return routing_df
        else:
            logger.warning(f"예측할 수 있는 공정이 없습니다: {input_item_cd}")
            return pd.DataFrame({
                'ITEM_CD': [input_item_cd],
                'MESSAGE': ['예측된 공정 데이터 없음']
            })
    
    else:
        # 요약 모드: 총합 시간 시나리오 예측
        total_setup_times = []
        total_run_times = []
        total_wait_times = []
        total_move_times = []
        total_mach_hours = []
        similarities = []
        source_items = []

        for item_cd, routing_df in all_routings:
            try:
                item_index = filtered_items.index(item_cd)
                item_similarity = filtered_scores[item_index]
            except (ValueError, IndexError):
                logger.warning(f"유사도를 찾을 수 없음: {item_cd}, 기본값 사용")
                item_similarity = 0.5  # 기본값
                
            setup_sum = routing_df['SETUP_TIME'].sum()
            run_sum = routing_df['RUN_TIME'].sum()
            wait_sum = routing_df['WAIT_TIME'].sum()
            move_sum = routing_df['MOVE_TIME'].sum()
            if 'MACH_WORKED_HOURS' in routing_df.columns:
                mach_series = pd.to_numeric(routing_df['MACH_WORKED_HOURS'], errors='coerce').fillna(0.0)
            elif 'ACT_RUN_TIME' in routing_df.columns:
                mach_series = pd.to_numeric(routing_df['ACT_RUN_TIME'], errors='coerce').fillna(0.0)
            else:
                mach_series = pd.to_numeric(routing_df['RUN_TIME'], errors='coerce').fillna(0.0)
            mach_sum = float(mach_series.sum())

            total_setup_times.append(setup_sum)
            total_run_times.append(run_sum)
            total_wait_times.append(wait_sum)
            total_move_times.append(move_sum)
            total_mach_hours.append(mach_sum)
            similarities.append(item_similarity)
            source_items.append(item_cd)

        _, weights = apply_similarity_weights(total_run_times, similarities, config.SIMILARITY_WEIGHT_POWER)

        if config.OUTLIER_DETECTION_ENABLED and len(total_run_times) >= 3:
            total_run_times, weights, valid_mask = remove_outliers_zscore(
                total_run_times, weights, config.OUTLIER_Z_SCORE_THRESHOLD
            )
            total_setup_times = [val for val, keep in zip(total_setup_times, valid_mask) if keep]
            total_wait_times = [val for val, keep in zip(total_wait_times, valid_mask) if keep]
            total_move_times = [val for val, keep in zip(total_move_times, valid_mask) if keep]
            total_mach_hours = [val for val, keep in zip(total_mach_hours, valid_mask) if keep]
            similarities = [val for val, keep in zip(similarities, valid_mask) if keep]
            source_items = [val for val, keep in zip(source_items, valid_mask) if keep]

        setup_stats = calculate_manufacturing_time_stats(total_setup_times, weights, config, apply_trimmed=True)
        run_stats = calculate_manufacturing_time_stats(total_run_times, weights, config)
        mach_stats = calculate_manufacturing_time_stats(total_mach_hours, weights, config, apply_trimmed=True)
        wait_stats = calculate_manufacturing_time_stats(total_wait_times, weights, config)
        move_stats = calculate_manufacturing_time_stats(total_move_times, weights, config)

        similarity_mean = np.mean(similarities) if similarities else 0.0

        confidence = calculate_confidence_score(
            len(all_routings), similarity_mean, mach_stats['cv'], config
        )

        prediction = {
            'ITEM_CD': input_item_cd,
            'SETUP_TIME': round(setup_stats['mean'], 3),
            'RUN_TIME': round(run_stats['mean'], 3),
            'MACH_WORKED_HOURS': round(mach_stats['mean'], 3),
            'ACT_SETUP_TIME': round(setup_stats['mean'], 3),
            'ACT_RUN_TIME': round(mach_stats['mean'], 3),
            'WAIT_TIME': round(wait_stats['mean'], 3),
            'MOVE_TIME': round(move_stats['mean'], 3),
            'OPTIMAL_TIME': round(mach_stats['optimal'], 3),
            'STANDARD_TIME': round(mach_stats['standard'], 3),
            'SAFE_TIME': round(mach_stats['safe'], 3),
            'TIME_STD': round(mach_stats['std'], 3),
            'TIME_CV': round(mach_stats['cv'], 3),
            'SIMILAR_ITEMS_USED': len(all_routings),
            'AVG_SIMILARITY': round(similarity_mean, 3),
            'CONFIDENCE': round(confidence, 3),
            'SCENARIO': config.get_scenario_description(mach_stats['cv']),
            'SCENARIO_EMOJI': config.get_scenario_emoji(mach_stats['cv']),
            'SOURCE_ITEMS': ','.join(source_items),
            'SIMILARITY_SCORES': ','.join([f"{s:.3f}" for s in similarities]),
            'WEIGHTS': ','.join([f"{w:.3f}" for w in weights]),
            'VALID_FROM_DT': '01-Jan-01',
            'VALID_TO_DT': '31-Dec-99',
            'INSRT_DT': datetime.now().strftime('%Y-%m-%d')
        }
        
        routing_df = pd.DataFrame([prediction])
        logger.info("요약 라우팅 예측 완료: 1개 레코드")
        return routing_df

# ════════════════════════════════════════════════
# 📊 품질 검증 개선
# ════════════════════════════════════════════════

def validate_prediction_quality_enhanced(
    routing_df: pd.DataFrame, 
    model_info: Dict[str, Any] = None
) -> Dict[str, Any]:
    if routing_df.empty:
        return {'error': 'No predictions to validate'}
    
    metrics = {}
    
    if 'CONFIDENCE' in routing_df.columns:
        metrics['avg_confidence'] = routing_df['CONFIDENCE'].mean()
        metrics['min_confidence'] = routing_df['CONFIDENCE'].min()
        metrics['max_confidence'] = routing_df['CONFIDENCE'].max()
        metrics['high_confidence_ratio'] = (routing_df['CONFIDENCE'] >= 0.7).sum() / len(routing_df)
    
    if 'AVG_SIMILARITY' in routing_df.columns:
        metrics['avg_similarity'] = routing_df['AVG_SIMILARITY'].mean()
    
    if 'SIMILAR_ITEMS_USED' in routing_df.columns:
        metrics['avg_similar_items'] = routing_df['SIMILAR_ITEMS_USED'].mean()
    
    time_cols = ['SETUP_TIME', 'RUN_TIME']
    for col in time_cols:
        if col in routing_df.columns:
            metrics[f'total_{col.lower()}'] = routing_df[col].sum()
    
    if model_info:
        quality_score = 0.5
        if model_info.get('is_enhanced'):
            quality_score += 0.1
        if model_info.get('has_pca'):
            quality_score += 0.05
        if model_info.get('has_feature_weights'):
            quality_score += 0.1
        
        avg_conf = metrics.get('avg_confidence', 0.5)
        quality_score = quality_score * (0.5 + avg_conf * 0.5)
        
        metrics['model_quality_score'] = min(1.0, quality_score)
    
    avg_conf = metrics.get('avg_confidence', 0)
    model_score = metrics.get('model_quality_score', 0.5)
    combined_score = (avg_conf + model_score) / 2
    
    if combined_score >= 0.8:
        metrics['quality_grade'] = 'A (우수)'
    elif combined_score >= 0.7:
        metrics['quality_grade'] = 'B (양호)'
    elif combined_score >= 0.6:
        metrics['quality_grade'] = 'C (보통)'
    else:
        metrics['quality_grade'] = 'D (개선필요)'
    
    suggestions = []
    if avg_conf < 0.7:
        suggestions.append("더 많은 유사 품목 데이터 수집 필요")
    if not model_info or not model_info.get('is_enhanced'):
        suggestions.append("개선된 모델로 재학습 권장")
    if metrics.get('avg_similar_items', 0) < 5:
        suggestions.append("유사품 검색 범위(top_k) 확대 고려")
    
    metrics['improvement_suggestions'] = suggestions
    
    return metrics

# ════════════════════════════════════════════════
# 🔧 기존 API 호환성 유지
# ════════════════════════════════════════════════

def predict_single_item_with_ml_optimized(
    item_cd: str,
    model_dir: Union[str, Path],
    *,
    top_k: int = DEFAULT_TOP_K,
    miss_thr: float = MISSING_RATIO_THRESHOLD,
    config: TimeScenarioConfig = None,
    mode: str = "summary"
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    routing_df, cand_df, _ = predict_single_item_with_ml_enhanced(
        item_cd, model_dir, top_k=top_k, miss_thr=miss_thr, 
        config=config, mode=mode
    )
    
    if not cand_df.empty:
        has_routing = []
        routing_counts = []
        
        for candidate in cand_df['CANDIDATE_ITEM_CD']:
            routing = fetch_routing_for_item(candidate)
            if not routing.empty:
                has_routing.append("✓ 있음")
                routing_counts.append(len(routing))
            else:
                has_routing.append("✗ 없음")
                routing_counts.append(0)
        
        cand_df['HAS_ROUTING'] = has_routing
        cand_df['PROCESS_COUNT'] = routing_counts
        
        cols = list(cand_df.columns)
        if 'SIMILARITY_SCORE' in cols and 'HAS_ROUTING' in cols:
            cols.remove('HAS_ROUTING')
            cols.remove('PROCESS_COUNT')
            idx = cols.index('SIMILARITY_SCORE') + 1
            cols.insert(idx, 'HAS_ROUTING')
            cols.insert(idx + 1, 'PROCESS_COUNT')
            cand_df = cand_df[cols]
    
    return routing_df, cand_df

def predict_items_with_ml_optimized(
    item_codes: List[str],
    model_dir: Union[str, Path],
    *,
    top_k: int = DEFAULT_TOP_K,
    miss_thr: float = MISSING_RATIO_THRESHOLD,
    config: TimeScenarioConfig = None,
    mode: str = "summary"
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    if config is None:
        config = SCENARIO_CONFIG

    logger.info(f"🚀 Enhanced ML 배치 예측 시작: {len(item_codes)}개 품목")

    predicted_routings: Dict[str, pd.DataFrame] = {}
    raw_candidate_frames: List[pd.DataFrame] = []
    routing_cache: Dict[str, pd.DataFrame] = {}

    for item_cd in item_codes:
        routing_df, cand_df, _ = predict_single_item_with_ml_enhanced(
            item_cd, model_dir, top_k=top_k, miss_thr=miss_thr,
            config=config, mode=mode
        )

        predicted_routings[item_cd] = routing_df if routing_df is not None else pd.DataFrame()

        if not cand_df.empty:
            cand_df['ITEM_CD'] = item_cd
            raw_candidate_frames.append(cand_df)
            for cand_item in cand_df['CANDIDATE_ITEM_CD']:
                if cand_item not in routing_cache:
                    routing_cache[cand_item] = fetch_routing_for_item(cand_item)

    composed_frames: List[pd.DataFrame] = []
    enhanced_candidates: List[Dict[str, Any]] = []
    per_item_counts: Dict[str, int] = defaultdict(int)

    # ML 예측 조합(존재 시) 우선 추가
    for item_cd, predicted_df in predicted_routings.items():
        if predicted_df is None or predicted_df.empty:
            continue
        signature = build_routing_signature(predicted_df)
        candidate_id = f"{item_cd}_MLP"
        normalized = normalize_routing_frame(
            item_cd,
            candidate_id,
            predicted_df,
            similarity=1.0,
            reference_item="ML_PREDICTED",
            priority="primary",
            signature=signature,
        )
        if normalized.empty:
            continue
        composed_frames.append(normalized)
        per_item_counts[item_cd] += 1
        enhanced_candidates.append({
            'ITEM_CD': item_cd,
            'CANDIDATE_ITEM_CD': 'ML_PREDICTED',
            'SIMILARITY_SCORE': 1.0,
            'ROUTING_SIGNATURE': signature,
            'ROUTING_SUMMARY': f"ML 예측 공정 {len(normalized)}개",
            'PRIORITY': 'primary',
            'SIMILARITY_TIER': 'HIGH',
            'HAS_ROUTING': '✓ 있음',
            'PROCESS_COUNT': len(normalized),
        })


    raw_candidates_df = (
        pd.concat(raw_candidate_frames, ignore_index=True)
        if raw_candidate_frames
        else pd.DataFrame()
    )

    if not raw_candidates_df.empty:
        raw_candidates_df = raw_candidates_df.sort_values(
            ['ITEM_CD', 'SIMILARITY_SCORE'], ascending=[True, False]
        )

        for _, cand_row in raw_candidates_df.iterrows():
            item_cd = cand_row.get('ITEM_CD')
            candidate_item = cand_row.get('CANDIDATE_ITEM_CD')
            similarity = float(cand_row.get('SIMILARITY_SCORE', 0.0))

            if not item_cd or not candidate_item:
                continue

            if per_item_counts[item_cd] >= MAX_ROUTING_VARIANTS:
                continue

            routing = routing_cache.get(candidate_item)
            if routing is None or routing.empty:
                continue

            signature = build_routing_signature(routing)
            priority = 'primary' if similarity >= SIMILARITY_HIGH_THRESHOLD else 'fallback'
            candidate_index = per_item_counts[item_cd] + 1
            candidate_id = f"{item_cd}_C{candidate_index:02d}"

            normalized = normalize_routing_frame(
                item_cd,
                candidate_id,
                routing,
                similarity=similarity,
                reference_item=candidate_item,
                priority=priority,
                signature=signature,
            )

            if normalized.empty:
                continue

            composed_frames.append(normalized)
            per_item_counts[item_cd] += 1

            process_count = len(normalized)
            summary_text = f"공정 {process_count}개 / 유사도 {similarity:.2f}"
            enhanced_candidates.append({
                'ITEM_CD': item_cd,
                'CANDIDATE_ITEM_CD': candidate_item,
                'SIMILARITY_SCORE': similarity,
                'ROUTING_SIGNATURE': signature,
                'ROUTING_SUMMARY': summary_text,
                'PRIORITY': priority,
                'SIMILARITY_TIER': 'HIGH' if similarity >= SIMILARITY_HIGH_THRESHOLD else 'LOW',
                'HAS_ROUTING': '✓ 있음',
                'PROCESS_COUNT': process_count,
            })



    raw_candidates_df = (
        pd.concat(raw_candidate_frames, ignore_index=True)
        if raw_candidate_frames
        else pd.DataFrame()
    )


    raw_candidates_df = (
        pd.concat(raw_candidate_frames, ignore_index=True)
        if raw_candidate_frames
        else pd.DataFrame()
    )

    if not raw_candidates_df.empty:
        raw_candidates_df = raw_candidates_df.sort_values(
            ['ITEM_CD', 'SIMILARITY_SCORE'], ascending=[True, False]
        )

        for _, cand_row in raw_candidates_df.iterrows():
            item_cd = cand_row.get('ITEM_CD')
            candidate_item = cand_row.get('CANDIDATE_ITEM_CD')
            similarity = float(cand_row.get('SIMILARITY_SCORE', 0.0))

            if not item_cd or not candidate_item:
                continue

            if per_item_counts[item_cd] >= MAX_ROUTING_VARIANTS:
                continue

            routing = routing_cache.get(candidate_item)
            if routing is None or routing.empty:
                continue

            signature = build_routing_signature(routing)
            priority = 'primary' if similarity >= SIMILARITY_HIGH_THRESHOLD else 'fallback'
            candidate_index = per_item_counts[item_cd] + 1
            candidate_id = f"{item_cd}_C{candidate_index:02d}"

            normalized = normalize_routing_frame(
                item_cd,
                candidate_id,
                routing,
                similarity=similarity,
                reference_item=candidate_item,
                priority=priority,
                signature=signature,
            )

            if normalized.empty:
                continue

            composed_frames.append(normalized)
            per_item_counts[item_cd] += 1

            process_count = len(normalized)
            summary_text = f"공정 {process_count}개 / 유사도 {similarity:.2f}"
            enhanced_candidates.append({
                'ITEM_CD': item_cd,
                'CANDIDATE_ITEM_CD': candidate_item,
                'SIMILARITY_SCORE': similarity,
                'ROUTING_SIGNATURE': signature,
                'ROUTING_SUMMARY': summary_text,
                'PRIORITY': priority,
                'SIMILARITY_TIER': 'HIGH' if similarity >= SIMILARITY_HIGH_THRESHOLD else 'LOW',
                'HAS_ROUTING': '✓ 있음',
                'PROCESS_COUNT': process_count,
            })


    final_routing_df = (
        pd.concat(composed_frames, ignore_index=True)
        if composed_frames
        else pd.DataFrame()
    )

    final_cand_df = (
        pd.DataFrame(enhanced_candidates)
        if enhanced_candidates
        else pd.DataFrame()
    )

    logger.info(
        "배치 예측 완료: %d개 라우팅 조합, %d개 후보",
        len(final_routing_df),
        len(final_cand_df),
    )

    return final_routing_df, final_cand_df

# ════════════════════════════════════════════════
# ⚙️ 런타임 설정 적용 헬퍼
# ════════════════════════════════════════════════


def apply_runtime_config(runtime: PredictorRuntimeConfig) -> None:
    """워크플로우 저장소에서 전달된 설정을 즉시 반영한다."""

    global SIMILARITY_HIGH_THRESHOLD, MIN_SIMILARITY_THRESHOLD, MAX_ROUTING_VARIANTS

    SIMILARITY_HIGH_THRESHOLD = runtime.similarity_high_threshold
    MIN_SIMILARITY_THRESHOLD = runtime.similarity_high_threshold
    MAX_ROUTING_VARIANTS = runtime.max_routing_variants

    SCENARIO_CONFIG.TRIM_STD_ENABLED = runtime.trim_std_enabled
    SCENARIO_CONFIG.TRIM_LOWER_PERCENT = runtime.trim_lower_percent
    SCENARIO_CONFIG.TRIM_UPPER_PERCENT = runtime.trim_upper_percent

    _configure_encoding_cache(
        runtime.encoding_cache_maxsize,
        runtime.encoding_cache_ttl_seconds,
    )

    logger.info(
        "런타임 설정 갱신: threshold=%.2f, variants=%d, trim_std=%s (%.2f~%.2f), encoding_cache=(size=%d, ttl=%ds)",
        SIMILARITY_HIGH_THRESHOLD,
        MAX_ROUTING_VARIANTS,
        SCENARIO_CONFIG.TRIM_STD_ENABLED,
        SCENARIO_CONFIG.TRIM_LOWER_PERCENT,
        SCENARIO_CONFIG.TRIM_UPPER_PERCENT,
        ENCODING_CACHE_MAXSIZE,
        ENCODING_CACHE_TTL_SECONDS,
    )


try:  # 모듈 로드 시 초기 설정 적용
    apply_runtime_config(workflow_config_store.get_predictor_runtime())
except Exception as exc:  # pragma: no cover - 설정 파일 미존재 등
    logger.debug("기본 런타임 설정을 사용합니다: %s", exc)


# ════════════════════════════════════════════════
# 🔧 레거시 호환성 함수
# ════════════════════════════════════════════════

def predict_single_item_with_statistics_improved(
    item_cd: str,
    model_dir: Union[str, Path],
    *,
    top_k: int = DEFAULT_TOP_K,
    miss_thr: float = MISSING_RATIO_THRESHOLD,
    config: TimeScenarioConfig = None,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    return predict_single_item_with_ml_optimized(
        item_cd, model_dir, top_k=top_k, miss_thr=miss_thr, 
        config=config, mode="summary"
    )

def predict_items_with_ml_improved(
    item_codes: List[str],
    model_dir: Union[str, Path],
    *,
    top_k: int = DEFAULT_TOP_K,
    miss_thr: float = MISSING_RATIO_THRESHOLD,
    config: TimeScenarioConfig = None,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    return predict_items_with_ml_optimized(
        item_codes, model_dir, top_k=top_k, miss_thr=miss_thr,
        config=config, mode="summary"
    )

def predict_single_item_with_ml(
    item_cd: str,
    model_dir: Union[str, Path],
    *,
    top_k: int = DEFAULT_TOP_K,
    miss_thr: float = MISSING_RATIO_THRESHOLD,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    return predict_single_item_with_ml_optimized(
        item_cd, model_dir, top_k=top_k, miss_thr=miss_thr, mode="summary"
    )

def predict_items_with_ml(
    item_codes: List[str],
    model_dir: Union[str, Path],
    *,
    top_k: int = DEFAULT_TOP_K,
    miss_thr: float = MISSING_RATIO_THRESHOLD,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    return predict_items_with_ml_optimized(
        item_codes, model_dir, top_k=top_k, miss_thr=miss_thr, mode="summary"
    )

# ════════════════════════════════════════════════
# 📤 모듈 내보내기 및 설정 함수
# ════════════════════════════════════════════════

def get_scenario_config() -> TimeScenarioConfig:
    return SCENARIO_CONFIG

def set_scenario_config(config: TimeScenarioConfig):
    global SCENARIO_CONFIG
    SCENARIO_CONFIG = config
    logger.info("시나리오 설정이 업데이트되었습니다")

def reset_scenario_config():
    global SCENARIO_CONFIG
    SCENARIO_CONFIG = TimeScenarioConfig()
    logger.info("시나리오 설정이 초기값으로 재설정되었습니다")

__all__ = [
    "TimeScenarioConfig",
    "get_scenario_config",
    "set_scenario_config",
    "reset_scenario_config",
    "predict_single_item_with_ml_enhanced",
    "EnhancedModelManager",
    "validate_prediction_quality_enhanced",
    "predict_single_item_with_ml_optimized",
    "predict_items_with_ml_optimized",
    "predict_routing_from_similar_items",
    "predict_single_item_with_statistics_improved",
    "predict_items_with_ml_improved",
    "predict_single_item_with_ml",
    "predict_items_with_ml",
    "calculate_manufacturing_time_stats",
    "filter_by_similarity_threshold",
    "apply_similarity_weights",
    "safe_int_conversion",
    "safe_float_conversion",
    "apply_runtime_config",
]