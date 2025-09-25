"""
Enhanced model save/load utilities with metadata support
"""

from __future__ import annotations

import joblib
from pathlib import Path
from typing import List, Tuple, Dict, Optional, Any, Union
import json
import logging

import numpy as np
import pandas as pd
from sklearn.preprocessing import OrdinalEncoder, StandardScaler

# Import from trainer_ml
from backend.trainer_ml import (
    EfficientSimilaritySearch,
    HNSWSearch,
    ImprovedPreprocessor,
)

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────
# Enhanced Save
# ────────────────────────────────────────────────

def save_model_with_metadata(
    searcher: Union[EfficientSimilaritySearch, HNSWSearch],
    encoder: OrdinalEncoder,
    scaler: StandardScaler,
    feature_columns: List[str],
    save_dir: str,
    *,
    preprocessor: Optional[ImprovedPreprocessor] = None,
    vectors: Optional[np.ndarray] = None,
    item_codes: Optional[List[str]] = None,
    training_data: Optional[pd.DataFrame] = None,
    compress_level: int = 3,
) -> None:
    """
    Enhanced model saving with comprehensive metadata
    
    Args:
        searcher: 유사도 검색 엔진
        encoder: 범주형 인코더
        scaler: 스케일러
        feature_columns: 피처 컬럼 리스트
        save_dir: 저장 디렉토리
        preprocessor: ImprovedPreprocessor 인스턴스 (메타데이터 포함)
        vectors: 임베딩 벡터 (통계 계산용)
        item_codes: 품목 코드 리스트
        training_data: 학습 데이터 (샘플 저장용)
        compress_level: 압축 레벨 (0-9)
    """
    save_path = Path(save_dir).expanduser().resolve()
    save_path.mkdir(parents=True, exist_ok=True)
    
    logger.info("Enhanced model saving to: %s", save_path)
    
    try:
        # 1. 기본 모델 컴포넌트 저장
        joblib.dump(searcher, save_path / "similarity_engine.joblib", compress=compress_level)
        joblib.dump(encoder, save_path / "encoder.joblib", compress=compress_level)
        joblib.dump(scaler, save_path / "scaler.joblib", compress=compress_level)
        joblib.dump(feature_columns, save_path / "feature_columns.joblib", compress=compress_level)
        
        # 2. PCA 저장 (있는 경우)
        if preprocessor and hasattr(preprocessor, 'pca') and preprocessor.pca is not None:
            joblib.dump(preprocessor.pca, save_path / "pca.joblib", compress=compress_level)
            logger.info("PCA 컴포넌트 저장 완료")
        
        # 3. Variance Selector 저장 (있는 경우)
        if preprocessor and hasattr(preprocessor, 'variance_selector') and preprocessor.variance_selector is not None:
            joblib.dump(preprocessor.variance_selector, save_path / "variance_selector.joblib", compress=compress_level)
            logger.info("Variance selector 저장 완료")
        
        # 4. Feature weights 저장
        if preprocessor and preprocessor.feature_weights:
            joblib.dump(preprocessor.feature_weights, save_path / "feature_weights.joblib", compress=compress_level)
            logger.info("Feature weights 저장 완료")
        
        # 5. Active features mask 저장
        if preprocessor and hasattr(preprocessor, 'active_features') and preprocessor.active_features is not None:
            joblib.dump(preprocessor.active_features, save_path / "active_features.joblib", compress=compress_level)
            logger.info("Active features mask 저장 완료")
        
        # 6. 메타데이터 생성 및 저장
        metadata = create_comprehensive_metadata(
            searcher=searcher,
            encoder=encoder,
            scaler=scaler,
            feature_columns=feature_columns,
            preprocessor=preprocessor,
            vectors=vectors,
            item_codes=item_codes
        )
        
        with open(save_path / "model_metadata.json", 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        logger.info("모델 메타데이터 저장 완료")
        
        # 7. Feature 메타데이터 저장 (preprocessor에서 가져오기)
        if preprocessor and hasattr(preprocessor, 'feature_metadata') and preprocessor.feature_metadata:
            with open(save_path / "feature_metadata.json", 'w', encoding='utf-8') as f:
                json.dump(preprocessor.feature_metadata, f, indent=2, ensure_ascii=False)
            logger.info("Feature 메타데이터 저장 완료")
        
        # 8. 학습 데이터 샘플 저장 (분석용)
        if training_data is not None and not training_data.empty:
            sample_size = min(5000, len(training_data))
            sample_data = training_data.sample(n=sample_size, random_state=42)
            
            # Parquet 형식으로 저장 (압축 효율적)
            sample_data.to_parquet(save_path / "sample_data.parquet", index=False)
            logger.info("학습 데이터 샘플 저장 완료 (%d rows)", sample_size)
        
        # 9. 벡터 통계 저장 (선택적)
        if vectors is not None:
            vector_stats = calculate_vector_statistics(vectors)
            joblib.dump(vector_stats, save_path / "vector_statistics.joblib", compress=compress_level)
            logger.info("벡터 통계 저장 완료")
        
        logger.info("모든 모델 컴포넌트 저장 완료: %s", save_path)
        
    except Exception as e:
        logger.error("모델 저장 중 오류 발생: %s", e)
        raise RuntimeError(f"모델 저장 실패: {e}") from e

# ────────────────────────────────────────────────
# Enhanced Load
# ────────────────────────────────────────────────

def load_model_with_metadata(
    load_dir: str,
    load_sample_data: bool = False,
) -> Dict[str, Any]:
    """
    Enhanced model loading with all metadata
    
    Args:
        load_dir: 로드할 디렉토리
        load_sample_data: 샘플 데이터도 로드할지 여부
        
    Returns:
        Dict containing all model components and metadata
    """
    load_path = Path(load_dir).expanduser().resolve()
    
    if not load_path.exists():
        raise FileNotFoundError(f"모델 디렉토리를 찾을 수 없습니다: {load_path}")
    
    logger.info("Enhanced model loading from: %s", load_path)
    
    result = {}
    
    try:
        # 1. 기본 모델 컴포넌트 로드
        result['searcher'] = joblib.load(load_path / "similarity_engine.joblib")
        result['encoder'] = joblib.load(load_path / "encoder.joblib")
        result['scaler'] = joblib.load(load_path / "scaler.joblib")
        result['feature_columns'] = joblib.load(load_path / "feature_columns.joblib")
        
        # 2. PCA 로드 (있는 경우)
        pca_path = load_path / "pca.joblib"
        if pca_path.exists():
            result['pca'] = joblib.load(pca_path)
            logger.info("PCA 컴포넌트 로드 완료")
        
        # 3. Variance Selector 로드 (있는 경우)
        var_selector_path = load_path / "variance_selector.joblib"
        if var_selector_path.exists():
            result['variance_selector'] = joblib.load(var_selector_path)
            logger.info("Variance selector 로드 완료")
        
        # 4. Feature weights 로드
        weights_path = load_path / "feature_weights.joblib"
        if weights_path.exists():
            result['feature_weights'] = joblib.load(weights_path)
            logger.info("Feature weights 로드 완료")
        
        # 5. Active features mask 로드
        active_features_path = load_path / "active_features.joblib"
        if active_features_path.exists():
            result['active_features'] = joblib.load(active_features_path)
            logger.info("Active features mask 로드 완료")
        
        # 6. 메타데이터 로드
        metadata_path = load_path / "model_metadata.json"
        if metadata_path.exists():
            with open(metadata_path, 'r', encoding='utf-8') as f:
                result['model_metadata'] = json.load(f)
            logger.info("모델 메타데이터 로드 완료")
        
        # 7. Feature 메타데이터 로드
        feature_metadata_path = load_path / "feature_metadata.json"
        if feature_metadata_path.exists():
            with open(feature_metadata_path, 'r', encoding='utf-8') as f:
                result['feature_metadata'] = json.load(f)
            logger.info("Feature 메타데이터 로드 완료")
        
        # 8. 학습 메타데이터 로드 (새 버전)
        training_metadata_path = load_path / "training_metadata.json"
        if training_metadata_path.exists():
            with open(training_metadata_path, 'r', encoding='utf-8') as f:
                result['training_metadata'] = json.load(f)
            logger.info("학습 메타데이터 로드 완료")
        
        # 9. 샘플 데이터 로드 (선택적)
        if load_sample_data:
            sample_data_path = load_path / "sample_data.parquet"
            if sample_data_path.exists():
                result['sample_data'] = pd.read_parquet(sample_data_path)
                logger.info("샘플 데이터 로드 완료 (%d rows)", len(result['sample_data']))
        
        # 10. 벡터 통계 로드 (있는 경우)
        vector_stats_path = load_path / "vector_statistics.joblib"
        if vector_stats_path.exists():
            result['vector_statistics'] = joblib.load(vector_stats_path)
            logger.info("벡터 통계 로드 완료")
        
        logger.info("모든 모델 컴포넌트 로드 완료")
        return result
        
    except Exception as e:
        logger.error("모델 로드 중 오류 발생: %s", e)
        raise RuntimeError(f"모델 로드 실패: {e}") from e

# ────────────────────────────────────────────────
# Helper Functions
# ────────────────────────────────────────────────

def create_comprehensive_metadata(
    searcher: Union[EfficientSimilaritySearch, HNSWSearch],
    encoder: OrdinalEncoder,
    scaler: StandardScaler,
    feature_columns: List[str],
    preprocessor: Optional[ImprovedPreprocessor] = None,
    vectors: Optional[np.ndarray] = None,
    item_codes: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """종합 메타데이터 생성"""
    metadata = {
        "creation_time": pd.Timestamp.now().isoformat(),
        "model_type": type(searcher).__name__,
        "feature_count": len(feature_columns),
        "components": {
            "encoder": {
                "type": type(encoder).__name__,
                "n_features": len(encoder.feature_names_in_) if hasattr(encoder, 'feature_names_in_') else None,
            },
            "scaler": {
                "type": type(scaler).__name__,
                "n_features": scaler.n_features_in_ if hasattr(scaler, 'n_features_in_') else None,
                "with_mean": scaler.with_mean if hasattr(scaler, 'with_mean') else None,
                "with_std": scaler.with_std if hasattr(scaler, 'with_std') else None,
            }
        }
    }
    
    # Searcher 정보
    if hasattr(searcher, 'vectors'):
        metadata["searcher_info"] = {
            "vector_count": len(searcher.vectors),
            "vector_dimension": searcher.vectors.shape[1],
        }
    elif hasattr(searcher, 'index'):
        metadata["searcher_info"] = {
            "index_type": "HNSW",
            "vector_count": searcher.index.ntotal if hasattr(searcher.index, 'ntotal') else None,
            "vector_dimension": searcher.index.d if hasattr(searcher.index, 'd') else None,
        }
    
    # Preprocessor 설정
    if preprocessor:
        metadata["preprocessor_config"] = {
            "normalize_output": preprocessor.normalize_output,
            "std_prune_threshold": preprocessor.std_prune_threshold,
            "variance_threshold": preprocessor.variance_threshold,
            "use_pca": preprocessor.use_pca,
            "auto_feature_weights": preprocessor.auto_feature_weights,
            "balance_dimensions": preprocessor.balance_dimensions,
        }
        
        if hasattr(preprocessor, 'pca') and preprocessor.pca is not None:
            metadata["pca_info"] = {
                "n_components": preprocessor.pca.n_components_,
                "explained_variance_ratio_sum": float(preprocessor.pca.explained_variance_ratio_.sum()),
            }
    
    # 벡터 통계
    if vectors is not None:
        metadata["vector_statistics_summary"] = {
            "shape": list(vectors.shape),
            "mean_norm": float(np.mean(np.linalg.norm(vectors, axis=1))),
            "std_norm": float(np.std(np.linalg.norm(vectors, axis=1))),
        }
    
    # 품목 정보
    if item_codes:
        metadata["item_info"] = {
            "total_items": len(item_codes),
            "unique_items": len(set(item_codes)),
        }
    
    return metadata

def calculate_vector_statistics(vectors: np.ndarray) -> Dict[str, Any]:
    """벡터 통계 계산"""
    norms = np.linalg.norm(vectors, axis=1)
    dim_means = np.mean(vectors, axis=0)
    dim_stds = np.std(vectors, axis=0)
    
    return {
        "shape": list(vectors.shape),
        "norms": {
            "mean": float(np.mean(norms)),
            "std": float(np.std(norms)),
            "min": float(np.min(norms)),
            "max": float(np.max(norms)),
            "percentiles": {
                "25": float(np.percentile(norms, 25)),
                "50": float(np.percentile(norms, 50)),
                "75": float(np.percentile(norms, 75)),
                "95": float(np.percentile(norms, 95)),
            }
        },
        "dimensions": {
            "mean_per_dim": dim_means.tolist()[:50],  # 처음 50개만
            "std_per_dim": dim_stds.tolist()[:50],    # 처음 50개만
            "dead_dimensions": int((dim_stds < 0.01).sum()),
            "active_dimensions": int((dim_stds >= 0.01).sum()),
        },
        "sparsity": {
            "zero_ratio": float((np.abs(vectors) < 1e-8).sum() / vectors.size),
            "near_zero_ratio": float((np.abs(vectors) < 0.01).sum() / vectors.size),
        }
    }

# ────────────────────────────────────────────────
# Legacy Support (기존 API 호환)
# ────────────────────────────────────────────────

def save_embedding_assets(
    encoder: OrdinalEncoder,
    scaler: StandardScaler,
    feature_columns: List[str],
    item_vectors: pd.DataFrame,
    save_dir: str,
) -> None:
    """Legacy API - 기존 코드와의 호환성을 위해 유지"""
    save_path = Path(save_dir).expanduser().resolve()
    save_path.mkdir(parents=True, exist_ok=True)

    try:
        joblib.dump(encoder, save_path / "encoder.joblib", compress=3)
        joblib.dump(scaler, save_path / "scaler.joblib", compress=3)
        joblib.dump(feature_columns, save_path / "feature_columns.joblib", compress=3)
        joblib.dump(item_vectors.index.tolist(), save_path / "item_ids.joblib", compress=3)
        joblib.dump(item_vectors.values.astype(np.float32), save_path / "item_vectors.joblib", compress=3)

        print(f"[OK] 임베딩 구성요소 저장 완료: {save_path}")
    except Exception as e:
        raise RuntimeError(f"[ERROR] 임베딩 저장 실패: {e}") from e

def load_embedding_assets(load_dir: str) -> Tuple[OrdinalEncoder, StandardScaler, List[str], pd.DataFrame]:
    """Legacy API - 기존 코드와의 호환성을 위해 유지"""
    load_path = Path(load_dir).expanduser().resolve()

    try:
        encoder = joblib.load(load_path / "encoder.joblib")
        scaler = joblib.load(load_path / "scaler.joblib")
        feature_columns = joblib.load(load_path / "feature_columns.joblib")
        item_ids = joblib.load(load_path / "item_ids.joblib")
        item_vectors = joblib.load(load_path / "item_vectors.joblib")

        item_vectors_df = pd.DataFrame(item_vectors, index=item_ids)
        return encoder, scaler, feature_columns, item_vectors_df

    except Exception as e:
        raise RuntimeError(f"[ERROR] 임베딩 구성요소 로드 실패: {e}") from e
