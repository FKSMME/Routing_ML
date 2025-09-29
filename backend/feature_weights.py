# backend/feature_weights.py
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd

from common.logger import get_logger

logger = get_logger("feature_weights")


class FeatureWeightManager:
    """실제 41개 피처에 대한 가중치 관리 및 활성화/비활성화 클래스"""

    PROFILE_PRESETS: Dict[str, Dict[str, Any]] = {
        "default": {
            "description": "기본 가중치 (도메인 지식 기반)",
            "weights": {},
        },
        "geometry-focus": {
            "description": "치수 및 치공구 관련 피처 강조",
            "weights": {
                "OUTDIAMETER": 2.4,
                "INDIAMETER": 2.2,
                "OUTTHICKNESS": 2.2,
                "IN_SEALSIZE": 1.6,
                "OUT_SEALSIZE": 1.6,
                "MID_SEALSIZE": 1.6,
            },
            "activate": {
                "OUTDIAMETER": True,
                "INDIAMETER": True,
                "OUTTHICKNESS": True,
                "IN_SEALSIZE": True,
                "OUT_SEALSIZE": True,
                "MID_SEALSIZE": True,
            },
        },
        "operation-history": {
            "description": "공정 이력/시간 기반 가중치",
            "weights": {
                "SETUP_TIME": 1.8,
                "MACH_WORKED_HOURS": 1.8,
                "ACT_RUN_TIME": 1.6,
                "ACT_SETUP_TIME": 1.6,
                "WAIT_TIME": 1.4,
                "MOVE_TIME": 1.2,
            },
            "activate": {
                "SETUP_TIME": True,
                "MACH_WORKED_HOURS": True,
                "ACT_RUN_TIME": True,
                "ACT_SETUP_TIME": True,
                "WAIT_TIME": True,
                "MOVE_TIME": True,
            },
        },
    }

    # ----------------------------------------------------------------------
    # ❶ 기본 가중치 (도메인 지식 기반)
    # ----------------------------------------------------------------------
    DEFAULT_WEIGHTS = {
        # === 핵심 피처 (제품 특성 결정) - 가중치 2.0+ ===
        "ITEM_TYPE": 2.5,  # 품목 유형 (가장 중요)
        "PART_TYPE": 2.5,  # 부품 유형
        "SealTypeGrup": 2.5,  # 씰 타입 그룹
        "RAW_MATL_KIND": 2.2,  # 원재료 종류
        "ITEM_MATERIAL": 2.0,  # 품목 재질
        # === 중요 피처 (공정 영향) - 가중치 1.5~2.0 ===
        "OUTDIAMETER": 1.8,  # 외경 (가공 난이도)
        "INDIAMETER": 1.8,  # 내경
        "OUTTHICKNESS": 1.8,  # 두께
        "IN_SEALTYPE_CD": 1.7,  # 내부 씰 타입
        "OUT_SEALTYPE_CD": 1.7,  # 외부 씰 타입
        "MID_SEALTYPE_CD": 1.7,  # 중간 씰 타입
        "GROUP1": 1.6,  # 대분류
        "GROUP2": 1.5,  # 중분류
        "ITEM_GRP1": 1.5,  # 품목 그룹
        # === 일반 피처 (보조 정보) - 가중치 1.0~1.5 ===
        "STANDARD_YN": 1.3,  # 표준품 여부
        "ROTATE_CLOCKWISE": 1.2,  # 시계방향 회전
        "ROTATE_CTRCLOCKWISE": 1.2,  # 반시계방향 회전
        "IN_SEALSIZE": 1.2,  # 내부 씰 크기
        "OUT_SEALSIZE": 1.2,  # 외부 씰 크기
        "MID_SEALSIZE": 1.2,  # 중간 씰 크기
        "ITEM_SPEC": 1.1,  # 품목 사양
        "GROUP3": 1.0,  # 소분류
        "OUTDIAMETER_UNIT": 1.0,  # 외경 단위
        # === 참조 피처 (간접 영향) - 가중치 0.5~1.0 ===
        "DRAW_NO": 0.8,  # 도면 번호
        "DRAW_REV": 0.7,  # 도면 개정
        "MATERIAL_DESC": 0.7,  # 재료 설명
        "RAW_MATL_KINDNM": 0.7,  # 원재료 종류명
        "ITEM_GRP1NM": 0.7,  # 품목 그룹명
        "IN_SEALSIZE_UOM": 0.6,  # 씰 크기 단위
        "OUT_SEALSIZE_UOM": 0.6,
        "MID_SEALSIZE_UOM": 0.6,
        "ITEM_UNIT": 0.6,  # 품목 단위
        "ITEM_ACCT": 0.6,  # 품목 계정
        # === 낮은 중요도 (식별용) - 가중치 0.5 미만 ===
        "ITEM_CD": 0.3,  # 품목 코드 (고유값)
        "ITEM_NM": 0.4,  # 품목명
        "ITEM_NM_ENG": 0.4,  # 품목명(영문)
        "PartNm": 0.4,  # 파트명
        "DRAW_SHEET_NO": 0.3,  # 도면 시트 번호
        "DRAW_USE": 0.3,  # 도면 사용
        "ADDITIONAL_SPEC": 0.4,  # 추가 사양
        "ITEM_SUFFIX": 0.3,  # 품목 접미사
    }

    # 피처 활성화 기본값 (가중치 ≥ 0.5 → 기본 활성)
    DEFAULT_ACTIVE_FEATURES = {
        f: w >= 0.5 for f, w in DEFAULT_WEIGHTS.items()
    }

    # 피처 그룹 정의 (UI 표시용)
    FEATURE_GROUPS: Dict[str, List[str]] = {
        "제품 핵심 특성": [
            "ITEM_TYPE",
            "PART_TYPE",
            "SealTypeGrup",
            "RAW_MATL_KIND",
            "ITEM_MATERIAL",
        ],
        "치수 및 크기": [
            "OUTDIAMETER",
            "INDIAMETER",
            "OUTTHICKNESS",
            "IN_SEALSIZE",
            "OUT_SEALSIZE",
            "MID_SEALSIZE",
            "OUTDIAMETER_UNIT",
            "IN_SEALSIZE_UOM",
            "OUT_SEALSIZE_UOM",
            "MID_SEALSIZE_UOM",
        ],
        "씰 타입 정보": [
            "IN_SEALTYPE_CD",
            "OUT_SEALTYPE_CD",
            "MID_SEALTYPE_CD",
            "SealTypeGrup",
        ],
        "분류 체계": [
            "GROUP1",
            "GROUP2",
            "GROUP3",
            "ITEM_GRP1",
            "ITEM_GRP1NM",
        ],
        "도면 정보": ["DRAW_NO", "DRAW_REV", "DRAW_SHEET_NO", "DRAW_USE"],
        "제품 사양": [
            "ITEM_SPEC",
            "ADDITIONAL_SPEC",
            "STANDARD_YN",
            "ROTATE_CLOCKWISE",
            "ROTATE_CTRCLOCKWISE",
        ],
        "식별 정보": [
            "ITEM_CD",
            "ITEM_NM",
            "ITEM_NM_ENG",
            "PartNm",
            "ITEM_SUFFIX",
            "ITEM_UNIT",
            "ITEM_ACCT",
        ],
        "재료 설명": ["MATERIAL_DESC", "RAW_MATL_KINDNM"],
    }

    # ----------------------------------------------------------------------
    # ❷ 객체 초기화
    # ----------------------------------------------------------------------
    def __init__(self, model_dir: Optional[Path] = None):
        self.model_dir = Path(model_dir) if model_dir else None
        self.feature_weights: Dict[str, float] = self.DEFAULT_WEIGHTS.copy()
        self.active_features: Dict[str, bool] = self.DEFAULT_ACTIVE_FEATURES.copy()
        self.feature_importance: Dict[str, float] = {}
        self.feature_statistics: Dict[str, Dict[str, float]] = {}
        self.load_weights()  # 기존 저장본 있으면 불러오기

    # ------------------------------------------------------------------
    # ❹ 프로파일 관리
    # ------------------------------------------------------------------
    def list_profiles(self) -> List[Dict[str, Any]]:
        profiles: List[Dict[str, Any]] = []
        for name, payload in self.PROFILE_PRESETS.items():
            entry = {"name": name}
            entry.update({k: v for k, v in payload.items() if k != "weights"})
            entry["weights"] = payload.get("weights", {})
            profiles.append(entry)
        return profiles

    def apply_profile(self, name: str, *, persist: bool = True) -> None:
        preset = self.PROFILE_PRESETS.get(name)
        if preset is None:
            raise KeyError(f"알 수 없는 피처 가중치 프로파일: {name}")

        weights = preset.get("weights", {})
        if weights:
            self.feature_weights.update(weights)
        activate = preset.get("activate", {})
        for feature, enabled in activate.items():
            self.active_features[feature] = bool(enabled)

        logger.info("Feature weight profile 적용: %s", name)
        if persist:
            self.save_weights()

    def apply_manual_weights(
        self,
        overrides: Dict[str, float],
        *,
        persist: bool = True,
        clip_range: Tuple[float, float] = (0.0, 4.0),
    ) -> None:
        if not overrides:
            return
        min_val, max_val = clip_range
        clipped = {}
        for feature, weight in overrides.items():
            if not isinstance(weight, (int, float)):
                continue
            clipped[feature] = float(max(min(weight, max_val), min_val))
        self.feature_weights.update(clipped)
        logger.info("수동 피처 가중치 적용: %d개", len(clipped))
        if persist:
            self.save_weights()

    def export_state(self) -> Dict[str, Any]:
        return {
            "weights": dict(self.feature_weights),
            "active_features": dict(self.active_features),
            "profiles": self.list_profiles(),
        }

    # ----------------------------------------------------------------------
    # ❸ 중요도 분석
    # ----------------------------------------------------------------------
    def analyze_feature_importance(
        self,
        embeddings: np.ndarray,
        feature_columns: List[str],
        item_codes: List[str],  # ← 현재 미사용
    ) -> Dict[str, float]:
        """t-SNE / PCA 이후 임베딩을 바탕으로 피처 중요도 산출"""
        logger.info("피처 중요도 분석 시작...")

        # 차원 불일치 시 자르기
        if embeddings.shape[1] != len(feature_columns):
            logger.warning(
                "임베딩 차원(%d) ≠ 피처 컬럼 수(%d). 차원 조정 후 분석.",
                embeddings.shape[1],
                len(feature_columns),
            )
            k = min(embeddings.shape[1], len(feature_columns))
            embeddings, feature_columns = embeddings[:, :k], feature_columns[:k]

        variances = np.var(embeddings, axis=0)  # 1. 분산
        # 3. 독립성
        independence_scores = (
            1 - np.mean(np.abs(np.corrcoef(embeddings.T)), axis=1)
            if embeddings.shape[1] > 1
            else np.ones(embeddings.shape[1])
        )
        non_zero_ratios = np.mean(embeddings != 0, axis=0)  # 4. 활성 비율

        # 5. 균일성
        uniformity_scores: List[float] = []
        for i in range(embeddings.shape[1]):
            uniq = np.unique(embeddings[:, i])
            if len(uniq) > 1:
                hist, _ = np.histogram(embeddings[:, i], bins=20)
                uniformity_scores.append(1 - np.std(hist) / (np.mean(hist) + 1e-10))
            else:
                uniformity_scores.append(0.0)
        uniformity_scores = np.asarray(uniformity_scores)

        importance_scores, statistics = {}, {}
        for i, col in enumerate(feature_columns):
            v = variances[i] / (np.max(variances) + 1e-8)
            ind, act, uni = (
                independence_scores[i],
                non_zero_ratios[i],
                uniformity_scores[i],
            )
            dom = self._get_domain_weight(col)
            total = 0.25 * v + 0.20 * ind + 0.20 * act + 0.15 * uni + 0.20 * dom
            importance_scores[col] = float(total)
            statistics[col] = {
                "variance": float(variances[i]),
                "independence": float(ind),
                "activity_ratio": float(act),
                "uniformity": float(uni),
                "non_zero_count": int(np.sum(embeddings[:, i] != 0)),
                "unique_values": int(len(np.unique(embeddings[:, i]))),
                "domain_weight": float(dom),
                "embedding_dim_index": i,
            }

        # 0~1 정규화
        if importance_scores:
            m = max(importance_scores.values())
            importance_scores = {k: v / m for k, v in importance_scores.items()}

        self.feature_importance = importance_scores
        self.feature_statistics = statistics
        logger.info(
            "피처 중요도 분석 완료: %d개 / 전체 %d개",
            len(importance_scores),
            len(self.DEFAULT_WEIGHTS),
        )
        self._save_analysis_results()
        return importance_scores

    # ----------------------------------------------------------------------
    # ❹ 도메인 가중치 (핸드래프티드 prior)
    # ----------------------------------------------------------------------
    @staticmethod
    def _get_domain_weight(feature_name: str) -> float:
        critical = {
            "ITEM_TYPE",
            "PART_TYPE",
            "SealTypeGrup",
            "RAW_MATL_KIND",
            "ITEM_MATERIAL",
        }
        important = {
            "OUTDIAMETER",
            "INDIAMETER",
            "OUTTHICKNESS",
            "IN_SEALTYPE_CD",
            "OUT_SEALTYPE_CD",
            "MID_SEALTYPE_CD",
        }
        if feature_name in critical:
            return 1.0
        if feature_name in important:
            return 0.8
        if "SEAL" in feature_name.upper():
            return 0.7
        if feature_name in {"GROUP1", "GROUP2", "ITEM_GRP1"}:
            return 0.6
        return 0.4

    # ----------------------------------------------------------------------
    # ❺ 중요도·가중치 기반 추천
    # ----------------------------------------------------------------------
    def get_feature_recommendation(self) -> Dict[str, List[str]]:
        if not self.feature_importance:
            return {}
        buckets = {
            "핵심 피처 (반드시 사용)": [],
            "중요 피처 (권장)": [],
            "일반 피처 (선택적)": [],
            "검토 필요 피처": [],
            "제거 고려 피처": [],
        }
        for f, imp in self.feature_importance.items():
            w = self.feature_weights.get(f, 1.0)
            combined = imp * 0.6 + (w / 3.0) * 0.4
            if combined >= 0.8:
                buckets["핵심 피처 (반드시 사용)"].append(f)
            elif combined >= 0.6:
                buckets["중요 피처 (권장)"].append(f)
            elif combined >= 0.4:
                buckets["일반 피처 (선택적)"].append(f)
            elif combined >= 0.2:
                buckets["검토 필요 피처"].append(f)
            else:
                buckets["제거 고려 피처"].append(f)
        return buckets

    # ----------------------------------------------------------------------
    # ❻ **중요도 → 가중치 동기화 기능 (신규)**
    # ----------------------------------------------------------------------
    def sync_weights_with_importance(
        self,
        alpha: float = 0.3,
        weight_range: Tuple[float, float] = (0.5, 3.0),
        inplace: bool = True,
    ) -> Dict[str, float]:
        """
        중요도(0~1)를 지정 범위(기본 0.5~3.0)로 스케일링해
        기존 가중치와 가중 평균(α)으로 병합한다.

        Parameters
        ----------
        alpha : float
            1.0 → 기존 가중치 100% 유지, 0.0 → 중요도 100% 반영
        weight_range : (min, max)
            중요도 0 → min, 1 → max 로 선형 변환
        inplace : bool
            True 면 self.feature_weights 를 직접 수정 후 저장

        Returns
        -------
        Dict[str, float] : 업데이트된(또는 미리보기) 가중치 딕셔너리
        """
        if not self.feature_importance:
            logger.warning("sync 실패: feature_importance 가 비어 있습니다.")
            return self.feature_weights.copy()

        lo, hi = weight_range
        new_weights: Dict[str, float] = {}
        for f, imp in self.feature_importance.items():
            scaled = lo + (hi - lo) * imp
            old = self.feature_weights.get(f, 1.0)
            new_weights[f] = round(alpha * old + (1 - alpha) * scaled, 3)

        # 누락 피처(중요도 계산 안 된 것)는 그대로 둔다
        for f, w in self.feature_weights.items():
            if f not in new_weights:
                new_weights[f] = w

        if inplace:
            self.feature_weights = new_weights
            self.save_weights()
            logger.info(
                "Weights synced with importance (α=%.2f, range=%s). 총 %d개 갱신.",
                alpha,
                weight_range,
                len(self.feature_importance),
            )
        return new_weights

    # ----------------------------------------------------------------------
    # ❼ 도메인 프리셋 (기존)
    # ----------------------------------------------------------------------
    def optimize_for_seal_manufacturing(self):
        logger.info("씰 제조 도메인 최적화 시작...")
        seal_weights = {
            "SealTypeGrup": 3.0,
            "IN_SEALTYPE_CD": 2.5,
            "OUT_SEALTYPE_CD": 2.5,
            "MID_SEALTYPE_CD": 2.5,
            "OUTDIAMETER": 2.5,
            "INDIAMETER": 2.5,
            "OUTTHICKNESS": 2.2,
            "RAW_MATL_KIND": 2.3,
            "ITEM_MATERIAL": 2.0,
            "ITEM_TYPE": 2.2,
            "PART_TYPE": 2.2,
            "IN_SEALSIZE": 1.8,
            "OUT_SEALSIZE": 1.8,
            "MID_SEALSIZE": 1.8,
            "STANDARD_YN": 1.5,
            "ROTATE_CLOCKWISE": 1.3,
            "ROTATE_CTRCLOCKWISE": 1.3,
        }
        self.feature_weights.update(seal_weights)
        self.save_weights()
        logger.info("씰 제조 도메인 최적화 완료")

    # ----------------------------------------------------------------------
    # ❽ 활성/비활성 등 유틸
    # ----------------------------------------------------------------------
    def update_active_features(self, active_dict: Dict[str, bool]):
        self.active_features.update(active_dict)
        logger.info("Feature 활성화 상태 업데이트: %d개", len(active_dict))
        self.save_weights()

    def get_active_features(self) -> List[str]:
        return [f for f, a in self.active_features.items() if a]

    def get_active_feature_mask(self, feature_columns: List[str]) -> np.ndarray:
        return np.array([self.active_features.get(c, True) for c in feature_columns])

    def reset_active_features(self):
        self.active_features = self.DEFAULT_ACTIVE_FEATURES.copy()
        logger.info("Feature 활성화 상태 기본값으로 초기화")

    def auto_select_features(self, threshold: float = 0.6):
        if not self.feature_importance:
            logger.warning("Feature importance가 계산되지 않았습니다")
            return
        for f, imp in self.feature_importance.items():
            w = self.feature_weights.get(f, 1.0)
            self.active_features[f] = imp * 0.6 + (w / 3.0) * 0.4 >= threshold
        logger.info(
            "자동 피처 선택 완료: %d개 활성화 (≥ %.2f)",
            sum(self.active_features.values()),
            threshold,
        )

    # ----------------------------------------------------------------------
    # ❾ 저장·로드
    # ----------------------------------------------------------------------
    def _save_analysis_results(self):
        if not self.model_dir:
            return
        (self.model_dir / "feature_importance.json").write_text(
            json.dumps(self.feature_importance, ensure_ascii=False, indent=2)
        )
        (self.model_dir / "feature_statistics.json").write_text(
            json.dumps(self.feature_statistics, ensure_ascii=False, indent=2)
        )
        (self.model_dir / "feature_recommendations.json").write_text(
            json.dumps(self.get_feature_recommendation(), ensure_ascii=False, indent=2)
        )
        logger.info("피처 분석 결과 저장 완료")

    def load_weights(self):
        if not self.model_dir:
            logger.info("모델 디렉토리 미지정 → 기본 가중치 사용")
            return
        fp = self.model_dir / "feature_weights.json"
        if fp.exists():
            try:
                data = json.loads(fp.read_text(encoding="utf-8"))
                self.feature_weights = data.get("weights", data)
                self.active_features = data.get(
                    "active_features", self.DEFAULT_ACTIVE_FEATURES.copy()
                )
                logger.info(
                    "Feature weights 로드 완료 (%d개, 활성 %d개)",
                    len(self.feature_weights),
                    sum(self.active_features.values()),
                )
            except Exception as e:
                logger.warning("weights 로드 실패: %s", e)
        # importance/statistics 별도 로드
        for name in ("feature_importance", "feature_statistics"):
            p = self.model_dir / f"{name}.json"
            if p.exists():
                try:
                    setattr(self, name, json.loads(p.read_text(encoding="utf-8")))
                    logger.info("%s 로드 완료", name)
                except Exception as e:
                    logger.warning("%s 로드 실패: %s", name, e)

    def save_weights(self):
        if not self.model_dir:
            logger.warning("모델 디렉토리 미지정 → 저장 생략")
            return
        self.model_dir.mkdir(parents=True, exist_ok=True)
        data = {
            "weights": self.feature_weights,
            "active_features": self.active_features,
            "timestamp": pd.Timestamp.now().isoformat(),
            "version": "2.1",
        }
        (self.model_dir / "feature_weights.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2)
        )
        # 호환 joblib
        joblib.dump(self.feature_weights, self.model_dir / "feature_weights.joblib")
        # 개별 파일도 유지
        (self.model_dir / "active_features.json").write_text(
            json.dumps(self.active_features, ensure_ascii=False, indent=2)
        )
        # importance / stats / rec 저장
        if self.feature_importance:
            self._save_analysis_results()
        logger.info("Feature weights 저장 완료")

    # ----------------------------------------------------------------------
    # ➓ 기타 유틸
    # ----------------------------------------------------------------------
    def get_weights_as_array(
        self, feature_columns: List[str], apply_active_mask: bool = False
    ) -> np.ndarray:
        weights = [
            (
                0.0
                if apply_active_mask and not self.active_features.get(c, True)
                else self.feature_weights.get(c, 1.0)
            )
            for c in feature_columns
        ]
        return np.asarray(weights, dtype=np.float32)

    def update_weights(self, new_weights: Dict[str, float]):
        self.feature_weights.update(new_weights)
        logger.info("Feature weights 수동 업데이트: %d개", len(new_weights))

    def reset_to_defaults(self):
        self.feature_weights = self.DEFAULT_WEIGHTS.copy()
        self.active_features = self.DEFAULT_ACTIVE_FEATURES.copy()
        self.feature_importance, self.feature_statistics = {}, {}
        logger.info("Feature weights & 활성화 상태 기본값으로 초기화")

    def get_feature_info(self, feature_name: str) -> Dict[str, object]:
        info = {
            "name": feature_name,
            "weight": self.feature_weights.get(feature_name, 1.0),
            "active": self.active_features.get(feature_name, True),
            "importance": self.feature_importance.get(feature_name, 0.0),
            "statistics": self.feature_statistics.get(feature_name, {}),
            "group": next(
                (g for g, lst in self.FEATURE_GROUPS.items() if feature_name in lst),
                None,
            ),
        }
        return info

    def get_summary_statistics(self) -> Dict[str, object]:
        weights = np.asarray(list(self.feature_weights.values()))
        importances = (
            np.asarray(list(self.feature_importance.values()))
            if self.feature_importance
            else None
        )
        return {
            "total_features": len(self.feature_weights),
            "active_features": sum(self.active_features.values()),
            "active_ratio": sum(self.active_features.values()) / len(
                self.feature_weights
            ),
            "weight_statistics": {
                "mean": float(weights.mean()),
                "std": float(weights.std()),
                "min": float(weights.min()),
                "max": float(weights.max()),
            },
            "importance_statistics": None
            if importances is None
            else {
                "mean": float(importances.mean()),
                "std": float(importances.std()),
                "min": float(importances.min()),
                "max": float(importances.max()),
            },
        }
