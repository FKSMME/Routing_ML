"""이상 탐지 API 엔드포인트."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.api.database import get_session
from backend.api.services.anomaly_detection_service import (
    AnomalyDetectionConfig,
    AnomalyDetectionResult,
    AnomalyDetectionService,
    AnomalyScore,
)
from common.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/anomaly", tags=["anomaly-detection"])


# ============================================================================
# API Endpoints
# ============================================================================


@router.post("/train", summary="이상 탐지 모델 학습")
def train_anomaly_model(
    contamination: float = Query(
        0.1, ge=0.01, le=0.5, description="예상 이상치 비율 (0.01-0.5)"
    ),
    n_estimators: int = Query(100, ge=50, le=500, description="트리 개수 (50-500)"),
    session: Session = Depends(get_session),
):
    """
    Isolation Forest 모델을 학습합니다.

    **파라미터**:
    - `contamination`: 예상 이상치 비율 (기본값: 0.1 = 10%)
    - `n_estimators`: Isolation Forest 트리 개수 (기본값: 100)

    **반환**:
    - 학습 통계 및 모델 정보
    """
    try:
        logger.info(
            f"이상 탐지 모델 학습 요청: contamination={contamination}, n_estimators={n_estimators}"
        )

        config = AnomalyDetectionConfig(
            contamination=contamination, n_estimators=n_estimators
        )
        service = AnomalyDetectionService(session, config)
        result = service.train_model()

        return result

    except ValueError as e:
        logger.error(f"학습 실패: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"모델 학습 중 오류: {e}")
        raise HTTPException(status_code=500, detail="모델 학습 중 오류가 발생했습니다")


@router.post("/detect", response_model=AnomalyDetectionResult, summary="이상치 탐지")
def detect_anomalies(
    item_ids: Optional[List[int]] = None,
    threshold: float = Query(
        -0.5, ge=-1.0, le=1.0, description="이상치 점수 임계값 (-1.0 ~ 1.0)"
    ),
    session: Session = Depends(get_session),
):
    """
    품목의 이상치를 탐지합니다.

    **파라미터**:
    - `item_ids`: 검사할 품목 ID 목록 (없으면 전체 검사)
    - `threshold`: 이상치 점수 임계값 (기본값: -0.5, 낮을수록 이상)

    **반환**:
    - 이상 탐지 결과 (이상치 목록, 통계 등)
    """
    try:
        logger.info(
            f"이상 탐지 요청: {len(item_ids) if item_ids else '전체'} 품목, threshold={threshold}"
        )

        config = AnomalyDetectionConfig(threshold=threshold)
        service = AnomalyDetectionService(session, config)
        result = service.detect_anomalies(item_ids=item_ids)

        return result

    except ValueError as e:
        logger.error(f"탐지 실패: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"이상 탐지 중 오류: {e}")
        raise HTTPException(status_code=500, detail="이상 탐지 중 오류가 발생했습니다")


@router.get("/score/{item_id}", response_model=AnomalyScore, summary="개별 품목 이상치 점수")
def get_item_anomaly_score(
    item_id: int,
    threshold: float = Query(-0.5, ge=-1.0, le=1.0, description="이상치 점수 임계값"),
    session: Session = Depends(get_session),
):
    """
    특정 품목의 이상치 점수를 조회합니다.

    **파라미터**:
    - `item_id`: 품목 ID
    - `threshold`: 이상치 점수 임계값

    **반환**:
    - 이상치 점수 및 설명
    """
    try:
        logger.info(f"품목 {item_id} 이상치 점수 조회")

        config = AnomalyDetectionConfig(threshold=threshold)
        service = AnomalyDetectionService(session, config)
        result = service.detect_anomalies(item_ids=[item_id])

        if result.anomaly_count == 0:
            raise HTTPException(
                status_code=404, detail=f"품목 {item_id}는 정상입니다 (이상치 아님)"
            )

        return result.anomalies[0]

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"조회 실패: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"이상치 점수 조회 중 오류: {e}")
        raise HTTPException(status_code=500, detail="조회 중 오류가 발생했습니다")


@router.get("/trends", summary="이상치 추세 조회")
def get_anomaly_trends(
    days: int = Query(30, ge=1, le=365, description="조회 기간 (일)"),
    session: Session = Depends(get_session),
):
    """
    이상치 추세를 조회합니다.

    **파라미터**:
    - `days`: 조회 기간 (일 단위, 기본값: 30일)

    **반환**:
    - 기간별 이상치 통계
    """
    try:
        logger.info(f"최근 {days}일간 이상치 추세 조회")

        config = AnomalyDetectionConfig()
        service = AnomalyDetectionService(session, config)
        result = service.get_anomaly_trends(days=days)

        return result

    except Exception as e:
        logger.error(f"추세 조회 중 오류: {e}")
        raise HTTPException(status_code=500, detail="추세 조회 중 오류가 발생했습니다")


@router.get("/config", response_model=AnomalyDetectionConfig, summary="현재 설정 조회")
def get_anomaly_config():
    """
    현재 이상 탐지 설정을 조회합니다.

    **반환**:
    - 현재 설정 (contamination, threshold, features 등)
    """
    try:
        # 저장된 설정 로드
        from pathlib import Path
        import json

        config_file = Path("models/anomaly_detection/config.json")
        if config_file.exists():
            with open(config_file, "r") as f:
                config_dict = json.load(f)
                return AnomalyDetectionConfig(**config_dict)
        else:
            # 기본 설정 반환
            return AnomalyDetectionConfig()

    except Exception as e:
        logger.error(f"설정 조회 중 오류: {e}")
        raise HTTPException(status_code=500, detail="설정 조회 중 오류가 발생했습니다")


@router.put("/config", response_model=AnomalyDetectionConfig, summary="설정 업데이트")
def update_anomaly_config(config: AnomalyDetectionConfig):
    """
    이상 탐지 설정을 업데이트합니다.

    **파라미터**:
    - `config`: 새로운 설정

    **반환**:
    - 업데이트된 설정
    """
    try:
        logger.info(f"이상 탐지 설정 업데이트: {config}")

        # 설정 저장
        from pathlib import Path
        import json

        config_dir = Path("models/anomaly_detection")
        config_dir.mkdir(parents=True, exist_ok=True)

        config_file = config_dir / "config.json"
        with open(config_file, "w") as f:
            json.dump(config.dict(), f, indent=2)

        logger.info(f"설정 저장 완료: {config_file}")
        return config

    except Exception as e:
        logger.error(f"설정 업데이트 중 오류: {e}")
        raise HTTPException(status_code=500, detail="설정 업데이트 중 오류가 발생했습니다")


@router.get("/stats", summary="이상 탐지 통계")
def get_anomaly_stats(session: Session = Depends(get_session)):
    """
    전체 이상 탐지 통계를 조회합니다.

    **반환**:
    - 전체 품목 수, 이상치 수, 이상치 비율 등
    """
    try:
        logger.info("이상 탐지 통계 조회")

        config = AnomalyDetectionConfig()
        service = AnomalyDetectionService(session, config)
        result = service.detect_anomalies()

        stats = {
            "total_items": result.total_items,
            "anomaly_count": result.anomaly_count,
            "anomaly_rate": result.anomaly_rate,
            "threshold": result.threshold,
            "detected_at": result.detected_at,
            "model_info": result.model_info,
            "top_10_anomalies": [
                {
                    "item_code": a.item_code,
                    "anomaly_score": a.anomaly_score,
                    "reason": a.reason,
                }
                for a in result.anomalies[:10]
            ],
        }

        return stats

    except Exception as e:
        logger.error(f"통계 조회 중 오류: {e}")
        raise HTTPException(status_code=500, detail="통계 조회 중 오류가 발생했습니다")
