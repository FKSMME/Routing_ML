"""이상 탐지 알고리즘 서비스 (Isolation Forest 기반) - PyODBC 버전."""
from __future__ import annotations

import json
import pickle
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import pyodbc
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from common.logger import get_logger

logger = get_logger(__name__)


# ============================================================================
# Models
# ============================================================================


class AnomalyScore(BaseModel):
    """이상치 점수."""

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
    ml_model_info: Dict[str, Any] = Field(..., description="모델 정보")
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


class AnomalyStats(BaseModel):
    """이상 탐지 통계."""

    total_items: int
    anomaly_count: int
    anomaly_rate: float
    avg_score: float
    min_score: float
    max_score: float
    threshold: float
    last_trained_at: Optional[datetime] = None


# ============================================================================
# Anomaly Detection Service
# ============================================================================


class AnomalyDetectionService:
    """Isolation Forest 기반 이상 탐지 서비스 (PyODBC 버전)."""

    def __init__(self, conn: pyodbc.Connection, config: Optional[AnomalyDetectionConfig] = None):
        self.conn = conn
        self.config = config or AnomalyDetectionConfig()
        self.model: Optional[IsolationForest] = None
        self.scaler: Optional[StandardScaler] = None
        self.feature_names: List[str] = []
        self.model_path = Path("models/anomaly_detection")
        self.model_path.mkdir(parents=True, exist_ok=True)

    def train_model(self) -> Dict[str, Any]:
        """Isolation Forest 모델을 학습합니다."""
        logger.info("이상 탐지 모델 학습 시작")

        try:
            # 데이터 로드 (dbo_BI_ITEM_INFO_VIEW 사용)
            query = """
                SELECT
                    ITEM_CD,
                    out_diameter,
                    in_diameter,
                    thickness,
                    length,
                    width,
                    height
                FROM dbo_BI_ITEM_INFO_VIEW
                WHERE out_diameter IS NOT NULL
                    OR in_diameter IS NOT NULL
                    OR thickness IS NOT NULL
                    OR length IS NOT NULL
                    OR width IS NOT NULL
                    OR height IS NOT NULL
            """

            df = pd.read_sql(query, self.conn)

            if len(df) == 0:
                raise ValueError("학습할 데이터가 없습니다")

            logger.info(f"학습 데이터 로드 완료: {len(df)}개 품목")

            # 피처 추출 (NULL을 0으로 대체)
            feature_cols = [col for col in self.config.features if col in df.columns]
            self.feature_names = feature_cols

            X = df[feature_cols].fillna(0).values

            if X.shape[0] < 10:
                raise ValueError("학습 데이터가 너무 적습니다 (최소 10개 필요)")

            # StandardScaler로 정규화
            self.scaler = StandardScaler()
            X_scaled = self.scaler.fit_transform(X)

            # Isolation Forest 모델 학습
            self.model = IsolationForest(
                contamination=self.config.contamination,
                n_estimators=self.config.n_estimators,
                max_samples=min(self.config.max_samples, len(X)),
                random_state=self.config.random_state,
                n_jobs=-1,  # 모든 CPU 코어 사용
            )

            self.model.fit(X_scaled)

            # 이상치 점수 계산
            scores = self.model.score_samples(X_scaled)

            # 통계 수집
            stats = {
                "n_samples": len(X),
                "n_features": len(feature_cols),
                "feature_names": feature_cols,
                "contamination": self.config.contamination,
                "n_estimators": self.config.n_estimators,
                "score_stats": {
                    "mean": float(np.mean(scores)),
                    "std": float(np.std(scores)),
                    "min": float(np.min(scores)),
                    "max": float(np.max(scores)),
                    "median": float(np.median(scores)),
                },
                "trained_at": datetime.now().isoformat(),
            }

            # 모델 저장
            self._save_model()

            logger.info("이상 탐지 모델 학습 완료")
            return stats

        except Exception as e:
            logger.error(f"모델 학습 중 오류: {e}")
            raise

    def detect_anomalies(
        self,
        item_codes: Optional[List[str]] = None,
        threshold: Optional[float] = None,
    ) -> AnomalyDetectionResult:
        """이상치를 탐지합니다."""
        if self.model is None or self.scaler is None:
            # 저장된 모델 로드 시도
            if not self._load_model():
                raise ValueError("학습된 모델이 없습니다. 먼저 train_model()을 실행하세요")

        threshold = threshold if threshold is not None else self.config.threshold

        logger.info(f"이상치 탐지 시작 (임계값: {threshold})")

        try:
            # 데이터 로드
            query = """
                SELECT
                    ITEM_CD,
                    out_diameter,
                    in_diameter,
                    thickness,
                    length,
                    width,
                    height
                FROM dbo_BI_ITEM_INFO_VIEW
                WHERE 1=1
            """

            params = []
            if item_codes:
                placeholders = ",".join("?" * len(item_codes))
                query += f" AND ITEM_CD IN ({placeholders})"
                params.extend(item_codes)

            df = pd.read_sql(query, self.conn, params=params if params else None)

            if len(df) == 0:
                return AnomalyDetectionResult(
                    total_items=0,
                    anomaly_count=0,
                    anomaly_rate=0.0,
                    anomalies=[],
                    ml_model_info={},
                    threshold=threshold,
                    detected_at=datetime.now(),
                )

            # 피처 추출
            X = df[self.feature_names].fillna(0).values
            X_scaled = self.scaler.transform(X)

            # 이상치 점수 계산
            scores = self.model.score_samples(X_scaled)
            predictions = self.model.predict(X_scaled)  # -1: 이상치, 1: 정상

            # 이상치 식별
            anomalies = []
            for i, (idx, row) in enumerate(df.iterrows()):
                score = float(scores[i])
                is_anomaly = score < threshold or predictions[i] == -1

                if is_anomaly:
                    features_dict = {
                        name: float(row[name]) if pd.notna(row[name]) else 0.0
                        for name in self.feature_names
                    }

                    reason = self._explain_anomaly(X[i], self.feature_names)
                    confidence = 1.0 - min(abs(score / threshold), 1.0) if threshold != 0 else 0.5

                    anomaly = AnomalyScore(
                        item_code=row["ITEM_CD"],
                        anomaly_score=score,
                        is_anomaly=True,
                        confidence=confidence,
                        detected_at=datetime.now(),
                        features=features_dict,
                        reason=reason,
                    )
                    anomalies.append(anomaly)

            # 결과 생성
            result = AnomalyDetectionResult(
                total_items=len(df),
                anomaly_count=len(anomalies),
                anomaly_rate=len(anomalies) / len(df) if len(df) > 0 else 0.0,
                anomalies=anomalies,
                ml_model_info={
                    "n_estimators": self.config.n_estimators,
                    "contamination": self.config.contamination,
                    "features": self.feature_names,
                },
                threshold=threshold,
                detected_at=datetime.now(),
            )

            logger.info(f"이상치 탐지 완료: {len(anomalies)}/{len(df)} 품목")
            return result

        except Exception as e:
            logger.error(f"이상치 탐지 중 오류: {e}")
            raise

    def get_anomaly_score(self, item_code: str) -> Optional[AnomalyScore]:
        """특정 품목의 이상치 점수를 조회합니다."""
        result = self.detect_anomalies(item_codes=[item_code])

        if result.anomaly_count > 0:
            return result.anomalies[0]

        return None

    def get_stats(self) -> AnomalyStats:
        """이상 탐지 통계를 반환합니다."""
        if self.model is None:
            self._load_model()

        result = self.detect_anomalies()

        scores = [a.anomaly_score for a in result.anomalies] if result.anomalies else [0.0]

        return AnomalyStats(
            total_items=result.total_items,
            anomaly_count=result.anomaly_count,
            anomaly_rate=result.anomaly_rate,
            avg_score=float(np.mean(scores)),
            min_score=float(np.min(scores)),
            max_score=float(np.max(scores)),
            threshold=result.threshold,
            last_trained_at=None,  # TODO: 모델 메타데이터에서 가져오기
        )

    def _explain_anomaly(self, features: np.ndarray, feature_names: List[str]) -> str:
        """이상치가 된 이유를 설명합니다 (z-score 기반)."""
        if self.scaler is None:
            return "설명 불가 (스케일러 없음)"

        mean = self.scaler.mean_
        std = self.scaler.scale_

        z_scores = []
        for i, (feat_val, feat_mean, feat_std) in enumerate(zip(features, mean, std)):
            if feat_std > 0:
                z_score = abs((feat_val - feat_mean) / feat_std)
                z_scores.append((feature_names[i], feat_val, z_score))

        # z-score가 높은 상위 2개 피처
        z_scores.sort(key=lambda x: x[2], reverse=True)
        top_features = z_scores[:2]

        reasons = []
        for feat_name, feat_val, z_score in top_features:
            if z_score > 3:
                level = "매우 높음"
            elif z_score > 2:
                level = "높음"
            else:
                level = "약간 높음"

            reasons.append(f"{feat_name}={feat_val:.2f} ({level}, z={z_score:.1f})")

        return ", ".join(reasons) if reasons else "이상 패턴 감지"

    def _save_model(self):
        """모델을 파일로 저장합니다."""
        try:
            model_file = self.model_path / "isolation_forest.pkl"
            scaler_file = self.model_path / "scaler.pkl"
            config_file = self.model_path / "config.json"

            with open(model_file, "wb") as f:
                pickle.dump(self.model, f)

            with open(scaler_file, "wb") as f:
                pickle.dump(self.scaler, f)

            config_data = {
                "feature_names": self.feature_names,
                "contamination": self.config.contamination,
                "n_estimators": self.config.n_estimators,
                "threshold": self.config.threshold,
                "trained_at": datetime.now().isoformat(),
            }

            with open(config_file, "w") as f:
                json.dump(config_data, f, indent=2)

            logger.info(f"모델 저장 완료: {model_file}")

        except Exception as e:
            logger.error(f"모델 저장 중 오류: {e}")

    def _load_model(self) -> bool:
        """저장된 모델을 로드합니다."""
        try:
            model_file = self.model_path / "isolation_forest.pkl"
            scaler_file = self.model_path / "scaler.pkl"
            config_file = self.model_path / "config.json"

            if not model_file.exists() or not scaler_file.exists():
                return False

            with open(model_file, "rb") as f:
                self.model = pickle.load(f)

            with open(scaler_file, "rb") as f:
                self.scaler = pickle.load(f)

            if config_file.exists():
                with open(config_file, "r") as f:
                    config_data = json.load(f)
                    self.feature_names = config_data.get("feature_names", [])

            logger.info(f"모델 로드 완료: {model_file}")
            return True

        except Exception as e:
            logger.error(f"모델 로드 중 오류: {e}")
            return False
