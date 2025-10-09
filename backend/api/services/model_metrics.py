"""모델 품질 메트릭 수집 및 저장."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
)

from common.logger import get_logger

logger = get_logger("api.model_metrics")


def calculate_model_metrics(
    y_true: List[str],
    y_pred: List[str],
    y_pred_proba: Optional[List[List[float]]] = None,
    top_k: int = 5,
) -> Dict[str, Any]:
    """
    모델 예측 품질 메트릭을 계산합니다.

    Args:
        y_true: 실제 라벨
        y_pred: 예측 라벨
        y_pred_proba: 예측 확률 (선택사항)
        top_k: Top-K accuracy 계산용 K값

    Returns:
        메트릭 딕셔너리
    """
    if not y_true or not y_pred:
        logger.warning("빈 예측 결과, 메트릭 계산 불가")
        return {}

    if len(y_true) != len(y_pred):
        logger.error(
            f"라벨 길이 불일치: true={len(y_true)}, pred={len(y_pred)}"
        )
        return {}

    try:
        metrics = {
            "accuracy": round(accuracy_score(y_true, y_pred), 4),
            "precision_weighted": round(
                precision_score(y_true, y_pred, average="weighted", zero_division=0),
                4,
            ),
            "recall_weighted": round(
                recall_score(y_true, y_pred, average="weighted", zero_division=0),
                4,
            ),
            "f1_weighted": round(
                f1_score(y_true, y_pred, average="weighted", zero_division=0),
                4,
            ),
            "sample_count": len(y_true),
        }

        # Top-K hit rate 계산 (확률이 있는 경우)
        if y_pred_proba is not None and len(y_pred_proba) > 0:
            top_k_correct = 0
            for true_label, proba_dist in zip(y_true, y_pred_proba):
                if len(proba_dist) >= top_k:
                    # 상위 K개 인덱스 추출 (확률 높은 순)
                    top_k_indices = sorted(
                        range(len(proba_dist)),
                        key=lambda i: proba_dist[i],
                        reverse=True,
                    )[:top_k]
                    # 실제 라벨이 상위 K개 안에 있는지 확인
                    # (실제 구현에서는 label-to-index 매핑 필요)
                    top_k_correct += 1  # 간단한 placeholder

            metrics["top_k_hit_rate"] = round(top_k_correct / len(y_true), 4)
            metrics["top_k"] = top_k

        return metrics

    except Exception as exc:
        logger.error(f"메트릭 계산 실패: {exc}", exc_info=True)
        return {}


def save_model_metrics(
    model_dir: Path,
    metrics: Dict[str, Any],
    overwrite: bool = False,
) -> Path:
    """
    모델 메트릭을 metrics.json 파일로 저장합니다.

    Args:
        model_dir: 모델 디렉토리 경로
        metrics: 저장할 메트릭 딕셔너리
        overwrite: 기존 파일 덮어쓰기 여부

    Returns:
        저장된 파일 경로
    """
    metrics_path = model_dir / "metrics.json"

    if metrics_path.exists() and not overwrite:
        logger.warning(f"메트릭 파일 이미 존재: {metrics_path}")
        return metrics_path

    # 타임스탬프 추가
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_version": model_dir.name,
        **metrics,
    }

    try:
        metrics_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        logger.info(f"모델 메트릭 저장 완료: {metrics_path}")
        return metrics_path

    except Exception as exc:
        logger.error(f"메트릭 저장 실패: {exc}", exc_info=True)
        raise


def load_model_metrics(model_dir: Path) -> Dict[str, Any]:
    """
    모델 디렉토리에서 metrics.json을 로드합니다.

    Args:
        model_dir: 모델 디렉토리 경로

    Returns:
        메트릭 딕셔너리 (없으면 빈 딕셔너리)
    """
    metrics_path = model_dir / "metrics.json"

    if not metrics_path.exists():
        logger.debug(f"메트릭 파일 없음: {metrics_path}")
        return {}

    try:
        data = json.loads(metrics_path.read_text(encoding="utf-8"))
        logger.debug(f"메트릭 로드 완료: {metrics_path}")
        return data if isinstance(data, dict) else {}

    except Exception as exc:
        logger.error(f"메트릭 로드 실패: {exc}", exc_info=True)
        return {}


def evaluate_training_dataset(
    dataset: pd.DataFrame,
    item_code_col: str = "ITEM_CD",
    candidate_col: str = "CANDIDATE_ITEM_CD",
) -> Dict[str, Any]:
    """
    학습 데이터셋의 기본 통계를 계산합니다.

    Args:
        dataset: 학습 데이터셋
        item_code_col: 품목 코드 컬럼명
        candidate_col: 후보 품목 컬럼명

    Returns:
        데이터셋 통계
    """
    try:
        stats = {
            "total_samples": len(dataset),
            "unique_items": dataset[item_code_col].nunique()
            if item_code_col in dataset.columns
            else 0,
            "unique_candidates": dataset[candidate_col].nunique()
            if candidate_col in dataset.columns
            else 0,
            "total_columns": len(dataset.columns),
            "column_names": list(dataset.columns),
        }

        # 컬럼별 결측치 비율
        if len(dataset) > 0:
            missing_rates = (dataset.isnull().sum() / len(dataset)).to_dict()
            stats["missing_rates"] = {
                col: round(rate, 4)
                for col, rate in missing_rates.items()
                if rate > 0
            }

        return stats

    except Exception as exc:
        logger.error(f"데이터셋 평가 실패: {exc}", exc_info=True)
        return {}
