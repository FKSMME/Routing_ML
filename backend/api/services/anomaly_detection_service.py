"""이상 탐지 알고리즘 서비스 (Isolation Forest 기반)."""
from __future__ import annotations

import json
import pickle
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.api.database import get_session
from backend.models.items import Item
from common.logger import get_logger

logger = get_logger(__name__)


# ============================================================================
# Models
# ============================================================================


class AnomalyScore(BaseModel):
    """이상치 점수."""

    item_id: int = Field(..., description="품목 ID")
    item_code: str = Field(..., description="품목 코드")
    anomaly_score: float = Field(..., description="이상치 점수 (-1 ~ 1, 낮을수록 이상)")
    is_anomaly: bool = Field(..., description="이상치 여부")
    confidence: float = Field(..., description="신뢰도 (0-1)")
    detected_at: datetime = Field(..., description="탐지 시간")
    features: Dict[str, float] = Field(..., description="피처 값")
    reason: str = Field(..., description="이상치로 분류된 이유")


class AnomalyDetectionResult(BaseModel):
    """이상 탐지 결과."""

    total_items: int = Field(..., description="검사한 총 품목 수")
    anomaly_count: int = Field(..., description="탐지된 이상치 수")
    anomaly_rate: float = Field(..., description="이상치 비율 (0-1)")
    anomalies: List[AnomalyScore] = Field(..., description="이상치 목록")
    model_info: Dict[str, Any] = Field(..., description="모델 정보")
    threshold: float = Field(..., description="이상치 임계값")
    detected_at: datetime = Field(..., description="탐지 시간")


class AnomalyDetectionConfig(BaseModel):
    """이상 탐지 설정."""

    contamination: float = Field(0.1, description="예상 이상치 비율 (0.05-0.3)")
    n_estimators: int = Field(100, description="트리 개수")
    max_samples: int = Field(256, description="샘플 크기")
    random_state: int = Field(42, description="랜덤 시드")
    threshold: float = Field(-0.5, description="이상치 점수 임계값")
    features: List[str] = Field(
        default_factory=lambda: [
            "out_diameter",
            "in_diameter",
            "thickness",
            "length",
            "width",
            "height",
        ],
        description="사용할 피처 목록",
    )


# ============================================================================
# Anomaly Detection Service
# ============================================================================


class AnomalyDetectionService:
    """Isolation Forest 기반 이상 탐지 서비스."""

    def __init__(self, session: Session, config: Optional[AnomalyDetectionConfig] = None):
        self.session = session
        self.config = config or AnomalyDetectionConfig()
        self.model: Optional[IsolationForest] = None
        self.scaler: Optional[StandardScaler] = None
        self.model_path = Path("models/anomaly_detection")
        self.model_path.mkdir(parents=True, exist_ok=True)

    def train_model(self) -> Dict[str, Any]:
        """Isolation Forest 모델을 학습합니다."""
        logger.info("이상 탐지 모델 학습 시작")

        try:
            # 데이터 로드
            items = self.session.query(Item).all()
            if len(items) == 0:
                raise ValueError("학습할 데이터가 없습니다")

            logger.info(f"학습 데이터: {len(items)}개 품목")

            # 피처 추출
            X, valid_items = self._extract_features(items)
            if len(X) == 0:
                raise ValueError("유효한 피처를 가진 품목이 없습니다")

            logger.info(f"유효한 품목: {len(valid_items)}개 (피처 차원: {X.shape[1]})")

            # 스케일링
            self.scaler = StandardScaler()
            X_scaled = self.scaler.fit_transform(X)

            # Isolation Forest 학습
            self.model = IsolationForest(
                contamination=self.config.contamination,
                n_estimators=self.config.n_estimators,
                max_samples=min(self.config.max_samples, len(X)),
                random_state=self.config.random_state,
                n_jobs=-1,  # 모든 CPU 코어 사용
            )
            self.model.fit(X_scaled)

            # 모델 저장
            self._save_model()

            # 학습 통계
            anomaly_scores = self.model.score_samples(X_scaled)
            mean_score = float(np.mean(anomaly_scores))
            std_score = float(np.std(anomaly_scores))
            min_score = float(np.min(anomaly_scores))
            max_score = float(np.max(anomaly_scores))

            result = {
                "success": True,
                "trained_at": datetime.now().isoformat(),
                "n_samples": len(X),
                "n_features": X.shape[1],
                "contamination": self.config.contamination,
                "n_estimators": self.config.n_estimators,
                "score_stats": {
                    "mean": mean_score,
                    "std": std_score,
                    "min": min_score,
                    "max": max_score,
                },
                "model_path": str(self.model_path / "model.pkl"),
            }

            logger.info(f"모델 학습 완료: 평균 점수 {mean_score:.3f} ± {std_score:.3f}")
            return result

        except Exception as e:
            logger.error(f"모델 학습 중 오류: {e}")
            raise

    def detect_anomalies(
        self, item_ids: Optional[List[int]] = None
    ) -> AnomalyDetectionResult:
        """품목의 이상치를 탐지합니다."""
        logger.info("이상 탐지 시작")

        try:
            # 모델 로드
            if self.model is None:
                self._load_model()

            if self.model is None:
                raise ValueError("모델이 학습되지 않았습니다. train_model()을 먼저 실행하세요")

            # 데이터 로드
            query = self.session.query(Item)
            if item_ids:
                query = query.filter(Item.id.in_(item_ids))
            items = query.all()

            if len(items) == 0:
                raise ValueError("검사할 품목이 없습니다")

            logger.info(f"검사 대상: {len(items)}개 품목")

            # 피처 추출
            X, valid_items = self._extract_features(items)
            if len(X) == 0:
                raise ValueError("유효한 피처를 가진 품목이 없습니다")

            # 스케일링
            X_scaled = self.scaler.transform(X)

            # 이상치 예측
            predictions = self.model.predict(X_scaled)  # 1: 정상, -1: 이상
            anomaly_scores_raw = self.model.score_samples(X_scaled)

            # 결과 생성
            anomalies: List[AnomalyScore] = []
            now = datetime.now()

            for i, (item, pred, score) in enumerate(
                zip(valid_items, predictions, anomaly_scores_raw)
            ):
                is_anomaly = pred == -1 or score < self.config.threshold
                confidence = self._calculate_confidence(score)

                if is_anomaly:
                    reason = self._explain_anomaly(X[i], self.config.features)
                    anomalies.append(
                        AnomalyScore(
                            item_id=item.id,
                            item_code=item.item_code,
                            anomaly_score=float(score),
                            is_anomaly=True,
                            confidence=confidence,
                            detected_at=now,
                            features={
                                feat: float(X[i][j])
                                for j, feat in enumerate(self.config.features)
                            },
                            reason=reason,
                        )
                    )

            # 이상치 점수로 정렬 (낮은 순)
            anomalies.sort(key=lambda a: a.anomaly_score)

            anomaly_count = len(anomalies)
            anomaly_rate = anomaly_count / len(valid_items)

            result = AnomalyDetectionResult(
                total_items=len(valid_items),
                anomaly_count=anomaly_count,
                anomaly_rate=anomaly_rate,
                anomalies=anomalies,
                model_info={
                    "contamination": self.config.contamination,
                    "n_estimators": self.config.n_estimators,
                    "features": self.config.features,
                },
                threshold=self.config.threshold,
                detected_at=now,
            )

            logger.info(
                f"이상 탐지 완료: {anomaly_count}/{len(valid_items)} ({anomaly_rate*100:.1f}%)"
            )
            return result

        except Exception as e:
            logger.error(f"이상 탐지 중 오류: {e}")
            raise

    def get_anomaly_trends(self, days: int = 30) -> Dict[str, Any]:
        """이상치 추세를 조회합니다."""
        # TODO: 시계열 데이터 저장 후 구현
        logger.info(f"최근 {days}일간 이상치 추세 조회")
        return {
            "period_days": days,
            "message": "추세 데이터 수집 중입니다. 시계열 저장소 구현 후 제공됩니다.",
        }

    # ========================================================================
    # Private Methods
    # ========================================================================

    def _extract_features(self, items: List[Item]) -> Tuple[np.ndarray, List[Item]]:
        """품목에서 피처를 추출합니다."""
        features_list = []
        valid_items = []

        for item in items:
            feature_dict = {}
            is_valid = True

            for feat in self.config.features:
                # Item 객체에서 피처 값 추출
                if feat == "out_diameter":
                    value = getattr(item, "out_diameter", None) or getattr(
                        item, "outer_diameter", None
                    )
                elif feat == "in_diameter":
                    value = getattr(item, "in_diameter", None) or getattr(
                        item, "inner_diameter", None
                    )
                else:
                    value = getattr(item, feat, None)

                # None이거나 0이면 스킵 (필수 피처)
                if value is None or value == 0:
                    is_valid = False
                    break

                try:
                    feature_dict[feat] = float(value)
                except (ValueError, TypeError):
                    is_valid = False
                    break

            if is_valid:
                features_list.append([feature_dict[f] for f in self.config.features])
                valid_items.append(item)

        if len(features_list) == 0:
            return np.array([]), []

        return np.array(features_list), valid_items

    def _calculate_confidence(self, score: float) -> float:
        """이상치 점수를 신뢰도(0-1)로 변환합니다."""
        # score는 대략 -1 ~ 1 범위
        # -1에 가까울수록 이상치 (confidence 높음)
        # 1에 가까울수록 정상 (confidence 낮음)
        if score < self.config.threshold:
            # 이상치: threshold보다 낮을수록 confidence 높음
            confidence = min(1.0, abs(score - self.config.threshold) / abs(self.config.threshold))
            return confidence
        else:
            # 정상: confidence 낮음
            return 0.0

    def _explain_anomaly(self, features: np.ndarray, feature_names: List[str]) -> str:
        """이상치로 분류된 이유를 설명합니다."""
        # 피처 값의 z-score 계산 (표준편차 기준)
        if self.scaler is None:
            return "알 수 없음"

        # 각 피처의 평균과 표준편차
        mean = self.scaler.mean_
        std = self.scaler.scale_

        z_scores = []
        for i, (feat_val, feat_mean, feat_std) in enumerate(
            zip(features, mean, std)
        ):
            z_score = abs((feat_val - feat_mean) / feat_std) if feat_std > 0 else 0
            z_scores.append((feature_names[i], feat_val, z_score))

        # z-score가 높은 순으로 정렬
        z_scores.sort(key=lambda x: x[2], reverse=True)

        # 상위 2개 피처를 설명에 포함
        reasons = []
        for feat_name, feat_val, z_score in z_scores[:2]:
            if z_score > 3:  # 3-sigma 이상
                reasons.append(f"{feat_name}={feat_val:.2f} (매우 높음)")
            elif z_score > 2:  # 2-sigma 이상
                reasons.append(f"{feat_name}={feat_val:.2f} (높음)")

        if reasons:
            return ", ".join(reasons)
        else:
            return "전체적인 패턴이 비정상적임"

    def _save_model(self):
        """모델을 파일로 저장합니다."""
        try:
            # 모델 저장
            model_file = self.model_path / "model.pkl"
            with open(model_file, "wb") as f:
                pickle.dump(self.model, f)

            # 스케일러 저장
            scaler_file = self.model_path / "scaler.pkl"
            with open(scaler_file, "wb") as f:
                pickle.dump(self.scaler, f)

            # 설정 저장
            config_file = self.model_path / "config.json"
            with open(config_file, "w") as f:
                json.dump(self.config.dict(), f, indent=2)

            logger.info(f"모델 저장 완료: {model_file}")

        except Exception as e:
            logger.error(f"모델 저장 중 오류: {e}")
            raise

    def _load_model(self):
        """저장된 모델을 로드합니다."""
        try:
            model_file = self.model_path / "model.pkl"
            scaler_file = self.model_path / "scaler.pkl"
            config_file = self.model_path / "config.json"

            if not model_file.exists():
                logger.warning("저장된 모델이 없습니다")
                return

            # 모델 로드
            with open(model_file, "rb") as f:
                self.model = pickle.load(f)

            # 스케일러 로드
            with open(scaler_file, "rb") as f:
                self.scaler = pickle.load(f)

            # 설정 로드
            if config_file.exists():
                with open(config_file, "r") as f:
                    config_dict = json.load(f)
                    self.config = AnomalyDetectionConfig(**config_dict)

            logger.info(f"모델 로드 완료: {model_file}")

        except Exception as e:
            logger.error(f"모델 로드 중 오류: {e}")
            raise


# ============================================================================
# Helper Functions
# ============================================================================


def get_anomaly_detection_service(
    session: Optional[Session] = None, config: Optional[AnomalyDetectionConfig] = None
) -> AnomalyDetectionService:
    """이상 탐지 서비스 인스턴스를 반환합니다."""
    if session is None:
        session = next(get_session())
    return AnomalyDetectionService(session, config)
