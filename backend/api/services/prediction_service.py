"""예측 서비스 레이어."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any, Dict, Iterable, List, Optional, Tuple, cast
from uuid import uuid4
import json
import re
import sys

import joblib
from importlib import metadata as importlib_metadata

import pandas as pd

from backend.api.config import get_settings
from backend import database
from backend.demo_artifacts import materialize_demo_artifacts
from backend.demo_data import demo_mode_enabled

from backend.api.schemas import (
    CandidateRouting,
    CandidateSaveResponse,
    GroupRecommendation,
    GroupRecommendationRequest,
    GroupRecommendationResponse,
    RuleValidationRequest,
    RuleValidationResponse,
    RuleViolation,
    RoutingSummary,
    SimilarItem,
    SimilaritySearchRequest,
    SimilaritySearchResponse,
    SimilaritySearchResult,
    TimeBreakdown,
    TimeSummaryRequest,
    TimeSummaryResponse,
)

from backend.api.schemas import CandidateRouting, CandidateSaveResponse, RoutingSummary
from common.datetime_utils import utc_isoformat, utc_now_naive, utc_timestamp
from backend.maintenance.model_registry import get_active_version, initialize_schema

from backend.predictor_ml import predict_items_with_ml_optimized
from backend.feature_weights import FeatureWeightManager
from backend.trainer_ml import load_optimized_model
from models.manifest import MANIFEST_SCHEMA_VERSION, ModelManifest, read_model_manifest
from common.logger import get_logger
from common.config_store import (
    SQLColumnConfig,
    workflow_config_store,
)
from common.sql_schema import DEFAULT_SQL_OUTPUT_COLUMNS

from .time_aggregator import TimeAggregator


try:
    from models.save_load import load_model_with_metadata as _ENHANCED_MODEL_LOADER
except Exception:  # pragma: no cover - 선택적 의존성
    _ENHANCED_MODEL_LOADER = None


logger = get_logger("api.prediction")


class ManifestLoader:
    """매니페스트 파일을 안전하게 읽고 캐시한다."""

    def __init__(self) -> None:
        self._cache: Dict[Path, Dict[str, Any]] = {}
        self._mtimes: Dict[Path, Optional[float]] = {}
        self._lock = Lock()

    def load(self, model_dir: Path) -> Dict[str, Any]:
        manifest_path = model_dir / "manifest.json"
        default_payload = {"items": [], "rules": [], "revision": None}
        with self._lock:
            if not manifest_path.exists():
                self._cache[manifest_path] = dict(default_payload)
                self._mtimes[manifest_path] = None
                return dict(default_payload)

            mtime = manifest_path.stat().st_mtime
            cached = self._cache.get(manifest_path)
            if cached is not None and self._mtimes.get(manifest_path) == mtime:
                return dict(cached)

            try:
                data = json.loads(manifest_path.read_text(encoding="utf-8"))
                if not isinstance(data, dict):
                    data = {}
            except Exception as exc:  # pragma: no cover - 방어적 로깅
                logger.warning("매니페스트 로드 실패: %s", exc)
                data = {}

            normalized = dict(data)
            normalized.setdefault("items", [])
            normalized.setdefault("rules", [])
            normalized.setdefault(
                "revision",
                normalized.get("revision")
                or normalized.get("version")
                or normalized.get("build"),
            )

            # 캐시 업데이트 (deep copy 방지용 얕은 사본 저장)
            self._cache[manifest_path] = {
                "items": list(normalized.get("items", [])),
                "rules": list(normalized.get("rules", [])),
                "revision": normalized.get("revision"),
                "metadata": normalized.get("metadata"),
            }
            self._mtimes[manifest_path] = mtime
            return dict(self._cache[manifest_path])

    def invalidate(self, model_dir: Optional[Path] = None) -> None:
        """
        캐시를 즉시 무효화합니다.

        Args:
            model_dir: 특정 디렉토리 캐시만 삭제 (None이면 전체 삭제)
        """
        with self._lock:
            if model_dir is None:
                # 전체 캐시 삭제
                self._cache.clear()
                self._mtimes.clear()
                logger.info("Manifest 캐시 전체 무효화")
            else:
                # 특정 경로만 삭제
                manifest_path = model_dir / "manifest.json"
                self._cache.pop(manifest_path, None)
                self._mtimes.pop(manifest_path, None)
                logger.info(f"Manifest 캐시 무효화: {manifest_path}")



class JsonArtifactCache:
    """모델 디렉터리 내 JSON 아티팩트를 안전하게 캐시한다."""

    def __init__(self) -> None:
        self._cache: Dict[Path, Optional[Dict[str, Any]]] = {}
        self._mtimes: Dict[Path, Optional[float]] = {}
        self._lock = Lock()

    def load(self, path: Path) -> Optional[Dict[str, Any]]:
        resolved = path.expanduser().resolve()
        if not resolved.exists():
            with self._lock:
                self._cache.pop(resolved, None)
                self._mtimes.pop(resolved, None)
            return None

        mtime = resolved.stat().st_mtime

        with self._lock:
            cached = self._cache.get(resolved, object())
            cached_mtime = self._mtimes.get(resolved)
            if cached_mtime == mtime:
                if cached is None:
                    return None
                return json.loads(json.dumps(cached))

        try:
            payload = json.loads(resolved.read_text(encoding="utf-8"))
        except Exception as exc:  # pragma: no cover - 방어적 로깅
            logger.warning("JSON 아티팩트 로드 실패 (%s): %s", resolved, exc)
            with self._lock:
                self._cache[resolved] = None
                self._mtimes[resolved] = mtime
            return None

        with self._lock:
            self._cache[resolved] = payload
            self._mtimes[resolved] = mtime

        return json.loads(json.dumps(payload))

    def invalidate(self, path: Path) -> None:
        resolved = path.expanduser().resolve()
        with self._lock:
            self._cache.pop(resolved, None)
            self._mtimes.pop(resolved, None)


# TimeAggregator는 backend/api/services/time_aggregator.py에서 import됨 (line 54)
# Polars 기반 고성능 구현을 사용하여 대용량 공정 집계 성능 최적화


class PredictionService:
    """FastAPI 라우터에서 사용하는 비즈니스 로직."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._model_lock: bool = False
        self._last_metrics: Dict[str, Any] = {}
        self._manifest_loader = ManifestLoader()
        self._json_artifacts = JsonArtifactCache()
        self.time_aggregator = TimeAggregator()

    @staticmethod
    def _sanitize_token(value: Optional[str], fallback: str = "anonymous") -> str:
        token = value or fallback
        token = re.sub(r"[^A-Za-z0-9_-]", "-", token)
        token = token.strip("-") or fallback
        return token[:80]

    @staticmethod
    def _unique_token() -> str:
        return f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{uuid4().hex}"

    def _build_user_token(self, username: Optional[str], session_id: Optional[str]) -> str:
        primary = self._sanitize_token(username, fallback="user")
        secondary = self._sanitize_token(session_id, fallback="session")
        return f"{primary}_{secondary}"
        self._compatibility_notes: List[str] = []
        self._loader_strategy: str = "default"

        self._model_registry_url = self.settings.model_registry_url
        initialize_schema(self._model_registry_url)
        self._model_reference = self._resolve_model_reference()
        self._model_manifest: Optional[ModelManifest] = None
        self._model_root: Optional[Path] = None

    def _resolve_model_reference(self) -> Path:
        """Determine the manifest or directory to load the model from.

        Fallback strategy:
        1. Environment override (MODEL_DIRECTORY_OVERRIDE)
        2. Active version from registry
        3. Default directory (models/default)
        4. RuntimeError with helpful message
        """

        override = self.settings.model_directory
        if override is not None:
            return Path(override).expanduser().resolve(strict=False)

        active_version = get_active_version(db_url=self._model_registry_url)
        if active_version is None:
            fallback_dir = Path(__file__).resolve().parents[3] / "models" / "default"
            if fallback_dir.exists():
                logger.warning(
                    "⚠️  활성화된 모델 버전이 없어 기본 디렉토리를 사용합니다: %s",
                    fallback_dir,
                )
                return fallback_dir

            # Enhanced error message with actionable steps
            raise RuntimeError(
                "🚨 모델 레지스트리에 활성화된 버전이 없고, 기본 디렉토리도 존재하지 않습니다.\n\n"
                f"해결 방법:\n"
                f"1. 모델 학습: python -m backend.cli.train_model\n"
                f"2. 기본 디렉토리 생성: mkdir -p {fallback_dir}\n"
                f"3. 환경 변수 설정: MODEL_DIRECTORY_OVERRIDE=/path/to/model\n"
                f"4. 레지스트리 연결 확인: {self._model_registry_url}\n\n"
                f"현재 레지스트리 URL: {self._model_registry_url}\n"
                f"기대 디렉토리: {fallback_dir}"
            )

        manifest_path = Path(active_version.manifest_path).expanduser().resolve(strict=False)
        if manifest_path.suffix.lower() == ".json":
            return manifest_path

        artifact_dir = Path(active_version.artifact_dir).expanduser().resolve(strict=False)
        if manifest_path.exists():
            return manifest_path
        return artifact_dir

    @property
    def model_dir(self) -> Path:
        if self._model_root is None:
            try:
                self._model_root = self._get_manifest().root_dir
            except FileNotFoundError:
                reference = self._model_reference
                self._model_root = reference if reference.is_dir() else reference.parent
        return self._model_root

    def _maybe_materialize_demo_artifacts(self, reference: Path) -> None:
        if not demo_mode_enabled():
            return

        ref_path = Path(reference).expanduser().resolve(strict=False)
        target_dir = ref_path.parent if ref_path.suffix.lower() == ".json" else ref_path

        required = (
            "similarity_engine.joblib",
            "encoder.joblib",
            "scaler.joblib",
            "feature_columns.joblib",
        )

        if all((target_dir / name).exists() for name in required):
            return

        try:
            logger.info("데모 모드: 누락된 모델 아티팩트를 재생성합니다 (%s)", target_dir)
            materialize_demo_artifacts(target_dir, overwrite=False, update_manifest=True)
        except Exception as exc:  # pragma: no cover - 방어 로직
            logger.warning("데모 아티팩트 생성 실패 (%s): %s", target_dir, exc, exc_info=exc)

    def _refresh_manifest(self, *, strict: bool = True) -> ModelManifest:
        override = self.settings.model_directory
        if override is not None:
            resolved_reference = Path(override).expanduser().resolve(strict=False)
            if resolved_reference != self._model_reference:
                self._model_reference = resolved_reference
                self._model_manifest = None
                self._model_root = None
        else:
            resolved_reference = self._resolve_model_reference()
            if resolved_reference != self._model_reference:
                self._model_reference = resolved_reference
                self._model_manifest = None
                self._model_root = None

        try:
            if demo_mode_enabled():
                self._maybe_materialize_demo_artifacts(self._model_reference)
            manifest = read_model_manifest(self._model_reference, strict=strict)
        except ValueError as exc:
            if not strict and "Unsupported manifest schema" in str(exc):
                manifest_path = (
                    self._model_reference
                    if self._model_reference.suffix.lower() == ".json"
                    else self._model_reference / "manifest.json"
                )
                if manifest_path.exists():
                    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
                    payload["schema_version"] = payload.get("schema_version") or MANIFEST_SCHEMA_VERSION
                    manifest_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
                    manifest = read_model_manifest(manifest_path, strict=False)
                else:  # pragma: no cover - 안전장치
                    raise
            else:
                raise
        self._model_manifest = manifest
        self._model_root = manifest.root_dir
        return manifest

    def _get_manifest(self) -> ModelManifest:
        if self._model_manifest is None:
            return self._refresh_manifest(strict=False)
        return self._model_manifest

    @staticmethod
    def _collect_runtime_versions() -> Dict[str, Optional[str]]:
        versions: Dict[str, Optional[str]] = {
            "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "joblib": getattr(joblib, "__version__", None),
        }

        try:
            versions["scikit_learn"] = importlib_metadata.version("scikit-learn")
        except importlib_metadata.PackageNotFoundError:
            versions["scikit_learn"] = None

        return versions

    @staticmethod
    def _parse_version_tuple(version: Optional[str], *, length: int = 3) -> Optional[Tuple[int, ...]]:
        if not version:
            return None

        parts: List[int] = []
        for token in str(version).replace("-", ".").split("."):
            digits = ''.join(ch for ch in token if ch.isdigit())
            if not digits:
                continue
            parts.append(int(digits))
            if len(parts) >= length:
                break

        if not parts:
            return None

        while len(parts) < length:
            parts.append(0)

        return tuple(parts[:length])

    def _load_training_metadata(self, model_dir: Path, manifest: ModelManifest) -> Dict[str, Any]:
        metadata_path: Optional[Path] = None
        try:
            metadata_path = manifest.resolve_path("training_metadata")
        except (KeyError, FileNotFoundError):
            candidate = model_dir / "training_metadata.json"
            if candidate.exists():
                metadata_path = candidate

        if not metadata_path or not metadata_path.exists():
            return {}

        try:
            payload = json.loads(metadata_path.read_text(encoding="utf-8"))
        except Exception as exc:  # pragma: no cover - JSON 오류 방어
            logger.warning("학습 메타데이터 로드 실패: %s", exc)
            return {}

        if not isinstance(payload, dict):
            return {}
        return payload

    def _evaluate_runtime_compatibility(
        self,
        training_versions: Dict[str, Any],
        runtime_versions: Dict[str, Optional[str]],
    ) -> Dict[str, Any]:
        warnings: List[str] = []
        guidance: List[str] = []
        strategy = "default"

        train_py = self._parse_version_tuple(training_versions.get("python"))
        runtime_py = self._parse_version_tuple(runtime_versions.get("python"))

        # Python major version이 다르면 에러, minor version은 경고만
        if train_py and runtime_py and train_py[0] != runtime_py[0]:
            raise RuntimeError(
                "Python 런타임 불일치: 모델은 Python %s에서 학습되었고 현재 런타임은 %s 입니다. "
                "동일한 Python 버전으로 환경을 맞추거나 모델을 재학습하세요."
                % (training_versions.get("python"), runtime_versions.get("python"))
            )
        elif train_py and runtime_py and train_py[:2] != runtime_py[:2]:
            logger.warning(
                "Python minor 버전 불일치: 모델은 Python %s에서 학습되었고 현재 런타임은 %s 입니다. "
                "대부분의 경우 호환되지만, 문제 발생 시 동일한 버전을 사용하세요.",
                training_versions.get("python"),
                runtime_versions.get("python")
            )

        fallback_required = False

        for key, label in (("scikit_learn", "scikit-learn"), ("joblib", "joblib")):
            train_ver = training_versions.get(key)
            runtime_ver = runtime_versions.get(key)
            if not train_ver or not runtime_ver:
                continue

            train_tuple = self._parse_version_tuple(train_ver)
            runtime_tuple = self._parse_version_tuple(runtime_ver)

            if not train_tuple or not runtime_tuple:
                continue

            if train_tuple[0] != runtime_tuple[0]:
                fallback_required = True
                warnings.append(
                    f"{label} 주요 버전 불일치: 학습({train_ver}) ↔ 런타임({runtime_ver})."
                )
            elif train_tuple != runtime_tuple:
                warnings.append(
                    f"{label} 버전 차이 감지: 학습({train_ver}) ↔ 런타임({runtime_ver})."
                )

        if fallback_required:
            if _ENHANCED_MODEL_LOADER is not None:
                strategy = "enhanced-metadata"
                guidance.append(
                    "호환 모드: 향상된 메타데이터 로더를 사용하여 교차 버전 모델을 로드합니다. "
                    "운영 환경을 학습 시점과 맞추거나 모델 재학습을 검토하세요."
                )
            else:
                raise RuntimeError(
                    "모델을 학습한 scikit-learn/joblib 주요 버전과 현재 런타임이 다릅니다. "
                    "런타임을 학습 환경과 맞추거나 모델을 재학습하세요."
                )
        elif warnings:
            guidance.append(
                "경미한 버전 차이가 감지되었습니다. 호환성 확인 후 필요 시 라이브러리 버전을 조정하세요."
            )

        return {"strategy": strategy, "warnings": warnings, "guidance": guidance}

    def _resolve_loader(self, strategy: str):
        if strategy == "default":
            return load_optimized_model
        if strategy == "enhanced-metadata":
            if _ENHANCED_MODEL_LOADER is None:  # pragma: no cover - 방어 로직
                raise RuntimeError("향상된 메타데이터 로더를 사용할 수 없습니다.")

            def _loader(path: Path) -> Dict[str, Any]:
                return _ENHANCED_MODEL_LOADER(str(path), load_sample_data=False)

            return _loader

        raise ValueError(f"알 수 없는 로더 전략: {strategy}")

    def _ensure_model(self) -> None:
        """모델 디렉토리 유효성 검사."""
        try:
            manifest = self._refresh_manifest(strict=True)
        except FileNotFoundError as exc:
            if demo_mode_enabled():
                self._maybe_materialize_demo_artifacts(self._model_reference)
                manifest = self._refresh_manifest(strict=True)
            else:
                logger.error("모델 매니페스트 검증 실패", exc_info=exc)
                raise

        try:
            load_dir = manifest.require_optimized_model_dir()
        except (FileNotFoundError, KeyError, ValueError) as exc:
            if demo_mode_enabled():
                self._maybe_materialize_demo_artifacts(manifest.root_dir)
                manifest = self._refresh_manifest(strict=True)
                load_dir = manifest.require_optimized_model_dir()
            else:
                logger.error("모델 매니페스트 검증 실패", exc_info=exc)
                raise

        training_metadata = self._load_training_metadata(load_dir, manifest)
        training_versions = training_metadata.get("runtime_versions", {}) if isinstance(training_metadata, dict) else {}
        runtime_versions = self._collect_runtime_versions()

        assessment = self._evaluate_runtime_compatibility(training_versions, runtime_versions)
        self._loader_strategy = assessment.get("strategy", "default")
        self._compatibility_notes = assessment.get("warnings", []) + assessment.get("guidance", [])

        for warning in assessment.get("warnings", []):
            logger.warning(warning)
        for note in assessment.get("guidance", []):
            logger.info(note)

        loader = self._resolve_loader(self._loader_strategy)
        try:
            loader(load_dir)
        except Exception as exc:  # pragma: no cover - 안전장치
            logger.error("모델 로드 실패 (loader=%s)", self._loader_strategy, exc_info=exc)
            raise

    def _apply_feature_weights(
        self,
        *,
        manual_weights: Optional[Dict[str, float]] = None,
        profile_name: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        try:
            manifest = self._get_manifest()
            manager = FeatureWeightManager(manifest=manifest)
        except Exception as exc:  # pragma: no cover - 안전장치
            logger.warning("FeatureWeightManager 초기화 실패: %s", exc)
            return None

        snapshot: Optional[Dict[str, Any]] = None
        if profile_name:
            try:
                manager.apply_profile(profile_name, persist=True)
                snapshot = manager.export_state()
            except KeyError:
                logger.warning("정의되지 않은 가중치 프로파일: %s", profile_name)
        if manual_weights:
            manager.apply_manual_weights(manual_weights, persist=True)
            snapshot = manager.export_state()

        if snapshot is None:
            snapshot = manager.export_state()
        return snapshot

    def _load_manifest(self) -> Dict[str, Any]:
        return self._manifest_loader.load(self.model_dir)

    def _resolve_optional_artifact(
        self,
        manifest: ModelManifest,
        artifact_name: str,
        default_filename: str,
    ) -> Optional[Path]:
        try:
            artifact_path = manifest.resolve_path(artifact_name)
            if artifact_path.exists():
                return artifact_path
        except KeyError:
            pass
        except Exception as exc:  # pragma: no cover - 방어적 로깅
            logger.debug(
                "매니페스트 아티팩트 해석 실패 (%s): %s",
                artifact_name,
                exc,
            )

        candidate = manifest.root_dir / default_filename
        if candidate.exists():
            return candidate
        return None

    def _load_json_artifact(
        self,
        manifest: ModelManifest,
        artifact_name: str,
        default_filename: str,
    ) -> Optional[Dict[str, Any]]:
        artifact_path = self._resolve_optional_artifact(
            manifest, artifact_name, default_filename
        )
        if artifact_path is None:
            return None
        return self._json_artifacts.load(artifact_path)

    def get_time_profiles(self) -> Optional[Dict[str, Any]]:
        try:
            manifest = self._get_manifest()
        except Exception as exc:  # pragma: no cover - 방어적 로깅
            logger.debug("시간 프로파일 매니페스트 로드 실패: %s", exc)
            return None
        return self._load_json_artifact(manifest, "time_profiles", "time_profiles.json")

    @staticmethod
    def _normalize_item_code(item_code: Optional[str]) -> Optional[str]:
        if item_code is None:
            return None
        code = str(item_code).strip().upper()
        return code or None

    def _build_manifest_index(self, manifest: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        index: Dict[str, Dict[str, Any]] = {}
        for entry in manifest.get("items", []):
            if not isinstance(entry, dict):
                continue
            code = (
                entry.get("item_code")
                or entry.get("ITEM_CD")
                or entry.get("code")
                or entry.get("id")
            )
            normalized = self._normalize_item_code(code)
            if normalized:
                index[normalized] = entry
        return index

    def _execute_prediction(
        self,
        item_codes: List[str],
        *,
        top_k: int,
        similarity_threshold: float,
        mode: str,
        feature_weights: Optional[Dict[str, float]],
        weight_profile: Optional[str],
    ) -> Tuple[
        List[RoutingSummary],
        List[CandidateRouting],
        Dict[str, Any],
        Optional[pd.DataFrame],
        Optional[pd.DataFrame],
    ]:
        self._ensure_model()

        weight_snapshot: Optional[Dict[str, Any]] = None
        if feature_weights or weight_profile:
            weight_snapshot = self._apply_feature_weights(
                manual_weights=feature_weights,
                profile_name=weight_profile,
            )

        routing_df, candidates_df = predict_items_with_ml_optimized(
            item_codes,
            self.model_dir,
            top_k=top_k,
            miss_thr=1.0 - similarity_threshold,
            mode=mode,
        )

        routing_payload = self._serialize_routing(routing_df)
        candidate_payload = self._serialize_candidates(candidates_df)

        metrics = {
            "requested_items": len(item_codes),
            "returned_routings": len(routing_payload),
            "returned_candidates": len(candidate_payload),
            "threshold": similarity_threshold,
            "generated_at": utc_isoformat(),
        }
        if weight_snapshot:
            metrics["feature_weights"] = weight_snapshot

        metrics = self._attach_cache_metrics(metrics)
        return routing_payload, candidate_payload, metrics, routing_df, candidates_df

    def _attach_cache_metrics(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        enriched = dict(metrics)
        try:
            enriched["cache"] = database.get_cache_snapshot()
            enriched["cache_versions"] = database.get_cache_versions()
        except Exception as exc:  # pragma: no cover - 방어적 로깅
            logger.warning("캐시 메트릭 수집 실패: %s", exc)
        return enriched

    def _set_last_metrics(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        enriched = self._attach_cache_metrics(metrics)
        self._last_metrics = enriched
        return enriched

    def predict(
        self,
        item_codes: Iterable[str],
        *,
        top_k: int,
        similarity_threshold: float,
        mode: str,
        feature_weights: Optional[Dict[str, float]] = None,
        weight_profile: Optional[str] = None,
        with_visualization: bool = False,
    ) -> Tuple[List[RoutingSummary], List[CandidateRouting], Dict[str, Any]]:
        """라우팅 예측 수행."""
        item_code_list = list(item_codes)
        logger.info(
            "[예측] item=%s, top_k=%s, similarity_threshold=%.2f, mode=%s",
            item_code_list,
            top_k,
            similarity_threshold,
            mode,
        )
        (
            routing_payload,
            candidate_payload,
            metrics,
            routing_df,
            candidates_df,
        ) = self._execute_prediction(
            item_code_list,
            top_k=top_k,
            similarity_threshold=similarity_threshold,
            mode=mode,
            feature_weights=feature_weights,
            weight_profile=weight_profile,
        )

        if with_visualization:
            viz_payload = self.prepare_visualization_snapshot(routing_df, candidates_df)
            if viz_payload:
                metrics["visualization"] = viz_payload

        metrics = self._set_last_metrics(metrics)
        logger.info("[예측] 완료 - routings=%d candidates=%d", len(routing_payload), len(candidate_payload))
        return routing_payload, candidate_payload, metrics

    def search_similar_items(self, request: SimilaritySearchRequest) -> SimilaritySearchResponse:
        item_code_list = list(dict.fromkeys(request.item_codes))
        logger.info("[유사도] 검색 요청 item=%s", item_code_list)
        if not item_code_list:
            metrics = self._set_last_metrics({"requested_items": 0, "total_matches": 0})
            return SimilaritySearchResponse(results=[], metrics=metrics)

        limit = request.top_k or self.settings.default_top_k
        threshold = request.min_similarity or self.settings.default_similarity_threshold

        (
            _routing_payload,
            candidate_payload,
            base_metrics,
            _routing_df,
            _candidates_df,
        ) = self._execute_prediction(
            item_code_list,
            top_k=limit,
            similarity_threshold=threshold,
            mode="summary",
            feature_weights=request.feature_weights,
            weight_profile=request.weight_profile,
        )

        manifest = self._load_manifest()
        manifest_revision = manifest.get("revision")
        manifest_index = self._build_manifest_index(manifest)

        grouped_candidates: Dict[str, List[CandidateRouting]] = {}
        fallback_key = "__default__"
        default_key = self._normalize_item_code(item_code_list[0]) or fallback_key
        for candidate in candidate_payload:
            source_key = self._normalize_item_code(candidate.source_item_code) or default_key
            grouped_candidates.setdefault(source_key, []).append(candidate)

        results: List[SimilaritySearchResult] = []
        total_matches = 0

        for original_code in item_code_list:
            normalized_code = self._normalize_item_code(original_code) or fallback_key
            candidate_list = grouped_candidates.get(normalized_code, [])
            if not candidate_list and normalized_code != fallback_key:
                candidate_list = grouped_candidates.get(fallback_key, [])
            sorted_candidates = sorted(
                candidate_list,
                key=lambda cand: cand.similarity_score or 0.0,
                reverse=True,
            )

            matches: List[SimilarItem] = []
            seen_codes = set()
            for candidate in sorted_candidates:
                score = candidate.similarity_score or 0.0
                if score < threshold:
                    continue
                normalized_candidate = self._normalize_item_code(candidate.candidate_item_code)
                if normalized_candidate and normalized_candidate in seen_codes:
                    continue
                metadata: Dict[str, Any] = {}
                if request.include_manifest_metadata and normalized_candidate:
                    manifest_entry = manifest_index.get(normalized_candidate)
                    if manifest_entry:
                        manifest_meta = manifest_entry.get("metadata") or manifest_entry.get("attributes") or {}
                        metadata = dict(manifest_meta)
                matches.append(
                    SimilarItem(
                        item_code=str(candidate.candidate_item_code),
                        similarity_score=score,
                        source="prediction",
                        metadata=metadata,
                    )
                )
                if normalized_candidate:
                    seen_codes.add(normalized_candidate)
                if len(matches) >= limit:
                    break

            manifest_entry_for_item = manifest_index.get(self._normalize_item_code(original_code))
            if manifest_entry_for_item and len(matches) < limit:
                manifest_similars = manifest_entry_for_item.get("similar_items") or manifest_entry_for_item.get("similarItems") or []
                for entry in manifest_similars:
                    if not isinstance(entry, dict):
                        continue
                    candidate_code = entry.get("item_code") or entry.get("ITEM_CD") or entry.get("code")
                    normalized_candidate = self._normalize_item_code(candidate_code)
                    if not normalized_candidate or normalized_candidate in seen_codes:
                        continue
                    score_value = entry.get("score") or entry.get("similarity") or entry.get("similarity_score")
                    try:
                        score_float = float(score_value) if score_value is not None else threshold
                    except (TypeError, ValueError):
                        score_float = threshold
                    if score_float < threshold:
                        continue
                    metadata = entry.get("metadata") or entry.get("attributes") or {}
                    matches.append(
                        SimilarItem(
                            item_code=str(candidate_code),
                            similarity_score=score_float,
                            source="manifest",
                            metadata=dict(metadata) if request.include_manifest_metadata else {},
                        )
                    )
                    seen_codes.add(normalized_candidate)
                    if len(matches) >= limit:
                        break

            matches.sort(key=lambda match: match.similarity_score, reverse=True)
            if len(matches) > limit:
                matches = matches[:limit]

            total_matches += len(matches)
            results.append(
                SimilaritySearchResult(
                    item_code=original_code,
                    matches=matches,
                    manifest_revision=manifest_revision,
                )
            )

        metrics = dict(base_metrics)
        metrics.update({
            "total_matches": total_matches,
            "manifest_revision": manifest_revision,
        })
        metrics = self._set_last_metrics(metrics)
        return SimilaritySearchResponse(results=results, metrics=metrics)

    def recommend_groups(self, request: GroupRecommendationRequest) -> GroupRecommendationResponse:
        logger.info("[추천] 그룹 추천 요청 item=%s", request.item_code)
        manifest = self._load_manifest()
        manifest_revision = manifest.get("revision")
        manifest_index = self._build_manifest_index(manifest)

        limit = request.candidate_limit or 5
        recommendations: List[GroupRecommendation] = []
        inspected_candidates = 0

        manifest_entry = manifest_index.get(self._normalize_item_code(request.item_code))
        if manifest_entry:
            manifest_groups = manifest_entry.get("groups") or manifest_entry.get("group_recommendations") or []
            for group in manifest_groups:
                if not isinstance(group, dict):
                    continue
                group_id = (
                    group.get("id")
                    or group.get("group_id")
                    or group.get("code")
                    or group.get("name")
                )
                group_id = str(group_id).strip() if group_id is not None else ""
                if not group_id:
                    continue
                score_value = group.get("score") or group.get("weight") or group.get("priority") or 1.0
                try:
                    score = float(score_value)
                except (TypeError, ValueError):
                    score = 1.0
                metadata = group.get("metadata") or group.get("attributes") or {}
                recommendations.append(
                    GroupRecommendation(
                        group_id=group_id,
                        score=score,
                        source="manifest",
                        metadata=dict(metadata),
                    )
                )
                if len(recommendations) >= limit:
                    break

        routing_payload: List[RoutingSummary] = []
        if len(recommendations) < limit:
            (
                routing_payload,
                candidate_payload,
                _metrics,
                _routing_df,
                _candidates_df,
            ) = self._execute_prediction(
                [request.item_code],
                top_k=request.candidate_limit or self.settings.default_top_k,
                similarity_threshold=request.similarity_threshold
                or self.settings.default_similarity_threshold,
                mode="summary",
                feature_weights=None,
                weight_profile=None,
            )
            inspected_candidates = len(candidate_payload)

            group_scores: Dict[str, Dict[str, Any]] = {}
            for candidate in candidate_payload:
                manifest_candidate = manifest_index.get(self._normalize_item_code(candidate.candidate_item_code))
                base_score = candidate.similarity_score or 0.0
                if manifest_candidate:
                    candidate_groups = manifest_candidate.get("groups") or manifest_candidate.get("group_recommendations") or []
                    for group in candidate_groups:
                        if not isinstance(group, dict):
                            continue
                        group_id = (
                            group.get("id")
                            or group.get("group_id")
                            or group.get("code")
                            or group.get("name")
                        )
                        group_id = str(group_id).strip() if group_id is not None else ""
                        if not group_id:
                            continue
                        score_value = group.get("score") or group.get("weight") or group.get("priority") or base_score
                        try:
                            score = float(score_value)
                        except (TypeError, ValueError):
                            score = float(base_score)
                        metadata = group.get("metadata") or group.get("attributes") or {}
                        current = group_scores.get(group_id)
                        if current is None or score > current["score"]:
                            group_scores[group_id] = {"score": score, "metadata": dict(metadata)}

            for existing in recommendations:
                group_scores.pop(existing.group_id, None)

            for group_id, payload in sorted(
                group_scores.items(), key=lambda item: item[1]["score"], reverse=True
            ):
                if len(recommendations) >= limit:
                    break
                recommendations.append(
                    GroupRecommendation(
                        group_id=group_id,
                        score=payload["score"],
                        source="prediction",
                        metadata=payload["metadata"],
                    )
                )

        if not recommendations:
            operations: List[Dict[str, Any]] = []
            for summary in routing_payload:
                if summary.item_code == request.item_code:
                    operations = summary.operations
                    break
            agg_result = self.time_aggregator.summarize(operations, include_breakdown=False)
            if agg_result["process_count"]:
                recommendations.append(
                    GroupRecommendation(
                        group_id="process-profile",
                        score=float(agg_result["process_count"]),
                        source="inference",
                        metadata={"lead_time": agg_result["totals"].get("lead_time", 0.0)},
                    )
                )

        recommendations.sort(key=lambda rec: rec.score, reverse=True)
        if len(recommendations) > limit:
            recommendations = recommendations[:limit]

        metrics = {
            "item_code": request.item_code,
            "manifest_revision": manifest_revision,
            "recommendations": len(recommendations),
            "inspected_candidates": inspected_candidates,
        }
        metrics = self._set_last_metrics(metrics)

        return GroupRecommendationResponse(
            item_code=request.item_code,
            recommendations=recommendations,
            inspected_candidates=inspected_candidates,
            manifest_revision=manifest_revision,
        )

    def summarize_process_times(self, request: TimeSummaryRequest) -> TimeSummaryResponse:
        operations_payload = [op.dict(by_alias=True, exclude_none=True) for op in request.operations]
        summary = self.time_aggregator.summarize(
            operations_payload,
            include_breakdown=request.include_breakdown,
        )

        breakdown_models: Optional[List[TimeBreakdown]] = None
        if request.include_breakdown and summary.get("breakdown"):
            breakdown_models = [TimeBreakdown(**record) for record in summary["breakdown"]]

        response = TimeSummaryResponse(
            item_code=request.item_code,
            totals=summary["totals"],
            process_count=summary["process_count"],
            breakdown=breakdown_models,
        )

        self._set_last_metrics(
            {
                "item_code": request.item_code,
                "process_count": summary["process_count"],
                "lead_time": summary["totals"].get("lead_time", 0.0),
            }
        )
        return response

    def validate_rules(self, request: RuleValidationRequest) -> RuleValidationResponse:
        operations_payload = [op.dict(by_alias=True, exclude_none=True) for op in request.operations]
        summary = self.time_aggregator.summarize(operations_payload, include_breakdown=True)
        totals = summary["totals"]

        manifest = self._load_manifest()
        manifest_revision = manifest.get("revision")
        rules = [rule for rule in manifest.get("rules", []) if isinstance(rule, dict)]

        if request.rule_ids:
            requested_ids = {str(rule_id).strip().lower() for rule_id in request.rule_ids}
            rules = [
                rule
                for rule in rules
                if str(rule.get("id") or rule.get("name") or "").strip().lower() in requested_ids
            ]

        violations: List[RuleViolation] = []
        evaluated_rules = 0
        context = request.context or {}

        for rule in rules:
            evaluated_rules += 1
            violations.extend(
                self._evaluate_rule(
                    rule,
                    operations_payload,
                    totals,
                    context,
                    summary.get("breakdown", []),
                )
            )

        passed = not any(violation.severity == "error" for violation in violations)

        metrics = {
            "item_code": request.item_code,
            "evaluated_rules": evaluated_rules,
            "violations": len(violations),
            "manifest_revision": manifest_revision,
            "process_count": summary["process_count"],
        }
        metrics.update({f"total_{key}": value for key, value in totals.items()})
        metrics = self._set_last_metrics(metrics)

        return RuleValidationResponse(
            item_code=request.item_code,
            passed=passed,
            violations=violations,
            evaluated_rules=evaluated_rules,
        )

    def _evaluate_rule(
        self,
        rule: Dict[str, Any],
        operations: List[Dict[str, Any]],
        totals: Dict[str, float],
        context: Dict[str, Any],
        _breakdown: List[Dict[str, Any]],
    ) -> List[RuleViolation]:
        rule_id = str(rule.get("id") or rule.get("name") or "rule").strip() or "rule"
        severity = str(rule.get("severity", "error")).lower()
        if severity not in {"info", "warning", "error"}:
            severity = "error"

        rule_type = str(rule.get("type") or rule.get("kind") or "").lower()
        violations: List[RuleViolation] = []

        if rule_type == "threshold":
            field = str(rule.get("field") or rule.get("metric") or "").upper()
            if not field:
                return violations
            operator = str(rule.get("operator") or rule.get("op") or ">=").strip() or ">="
            target_value = rule.get("value", 0)
            scope = str(rule.get("scope") or "total").lower()

            if scope == "per_operation":
                for idx, op in enumerate(operations, start=1):
                    value = self._extract_numeric(op, field)
                    if value is None:
                        continue
                    if not self._compare(value, operator, target_value):
                        message = rule.get("message") or (
                            f"공정 {idx}의 {field} 값 {value}이(가) 조건 {operator} {target_value}을 만족하지 않습니다."
                        )
                        violations.append(
                            RuleViolation(rule_id=rule_id, message=message, severity=severity)
                        )
            else:
                value = self._resolve_metric(field, totals, context)
                if value is None:
                    return violations
                if not self._compare(value, operator, target_value):
                    message = rule.get("message") or (
                        f"{field} 값 {value}이(가) 조건 {operator} {target_value}을 만족하지 않습니다."
                    )
                    violations.append(
                        RuleViolation(rule_id=rule_id, message=message, severity=severity)
                    )

        elif rule_type == "max_operations":
            limit_raw = rule.get("value")
            try:
                limit = int(limit_raw)
            except (TypeError, ValueError):
                limit = None
            if limit is not None and len(operations) > limit:
                message = rule.get("message") or (
                    f"공정 수 {len(operations)}가 최대 {limit}을 초과합니다."
                )
                violations.append(
                    RuleViolation(rule_id=rule_id, message=message, severity=severity)
                )

        elif rule_type == "required_field":
            field = str(rule.get("field") or rule.get("column") or "").upper()
            if field:
                missing_indices: List[int] = []
                for idx, op in enumerate(operations, start=1):
                    normalized = {str(key).upper(): value for key, value in op.items()}
                    value = normalized.get(field)
                    if value in (None, "", []):
                        missing_indices.append(idx)
                if missing_indices:
                    message = rule.get("message") or (
                        f"{field} 값이 필요한 공정: {', '.join(map(str, missing_indices))}"
                    )
                    violations.append(
                        RuleViolation(rule_id=rule_id, message=message, severity=severity)
                    )

        return violations

    @staticmethod
    def _compare(value: float, operator: str, target: Any) -> bool:
        try:
            target_value = float(target)
        except (TypeError, ValueError):
            target_value = 0.0

        op = operator.strip()
        if op == ">=" or op == "ge":
            return value >= target_value
        if op == ">":
            return value > target_value
        if op == "<=" or op == "le":
            return value <= target_value
        if op == "<":
            return value < target_value
        if op in {"==", "=", "eq"}:
            return value == target_value
        if op in {"!=", "<>", "ne"}:
            return value != target_value
        return value >= target_value

    def _resolve_metric(
        self,
        field: str,
        totals: Dict[str, float],
        context: Dict[str, Any],
    ) -> Optional[float]:
        normalized_field = field.lower()
        for key, value in totals.items():
            if key.lower() == normalized_field or key.upper() == field:
                return float(value)
        context_value = context.get(field) or context.get(field.lower()) or context.get(field.upper())
        if context_value is None:
            return None
        try:
            return float(context_value)
        except (TypeError, ValueError):
            return None

    def _extract_numeric(self, row: Dict[str, Any], field: str) -> Optional[float]:
        normalized = {str(key).upper(): value for key, value in row.items()}
        value = normalized.get(field)
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def save_candidate(
        self,
        item_code: str,
        candidate_id: str,
        payload: Dict[str, Any],
        *,
        username: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> CandidateSaveResponse:
        """Persist routing candidate data to disk."""
        if not self.settings.enable_candidate_persistence:
            raise RuntimeError("Candidate persistence is disabled")

        operations_payload = payload.get("operations", [])
        if not operations_payload:
            raise RuntimeError("No operation records provided for persistence")

        sql_config = workflow_config_store.get_sql_column_config()
        try:
            sql_config.validate_columns(list(DEFAULT_SQL_OUTPUT_COLUMNS))
        except ValueError as exc:
            logger.error("Failed to validate SQL output columns", extra={"error": str(exc)})
            raise RuntimeError("Configured SQL output columns are invalid") from exc

        df = pd.DataFrame(operations_payload)
        warnings: List[str] = []
        allowed_columns = set(sql_config.available_columns or DEFAULT_SQL_OUTPUT_COLUMNS)

        missing_required = [col for col in sql_config.output_columns if col not in df.columns]
        if missing_required:
            for col in missing_required:
                df[col] = None
            message = "Missing required columns were filled with NULL: " + ", ".join(sorted(missing_required))
            warnings.append(message)
            logger.warning(message, extra={"candidate_id": candidate_id, "item_code": item_code})

        unexpected_columns = [col for col in df.columns if col not in allowed_columns]
        if unexpected_columns:
            df = df.drop(columns=unexpected_columns)
            message = "Unexpected columns were dropped: " + ", ".join(sorted(unexpected_columns))
            warnings.append(message)
            logger.warning(message, extra={"candidate_id": candidate_id, "item_code": item_code})

        df = df.reindex(columns=sql_config.output_columns, fill_value=None)

        sql_preview = self._build_sql_preview(
            item_code=item_code,
            candidate_id=candidate_id,
            payload=payload,
            operations_df=df,
            warnings=warnings,
            sql_config=sql_config,
        )

        record = {
            "item_code": item_code,
            "candidate_id": candidate_id,
            "saved_at": utc_isoformat(),
            "summary": payload.get("summary"),
            "operations": df.to_dict(orient="records"),
            "warnings": warnings,
            "sql_preview": sql_preview,
            "user": username,
            "session_id": session_id,
        }

        self.settings.candidate_store_dir.mkdir(parents=True, exist_ok=True)
        safe_item = (item_code or "item").replace("/", "-")
        candidate_ref = (candidate_id or "candidate").replace("/", "-")
        user_token = self._build_user_token(username, session_id)

        last_error: Optional[Exception] = None
        for _ in range(5):
            filename = f"{safe_item}_{candidate_ref}_{user_token}_{self._unique_token()}.json"
            save_path = self.settings.candidate_store_dir / filename
            if save_path.exists():
                continue
            try:
                with save_path.open("x", encoding="utf-8") as fp:
                    json.dump(record, fp, ensure_ascii=False, indent=2)

                logger.info(
                    "[candidate.save] %s stored at %s (warnings=%d)",
                    candidate_id,
                    save_path,
                    len(warnings),
                )
                return CandidateSaveResponse(
                    item_code=item_code,
                    candidate_id=candidate_id,
                    saved_path=str(save_path),
                    saved_at=utc_now_naive(),
                    sql_preview=sql_preview,
                    warnings=warnings,
                )
            except FileExistsError as exc:
                last_error = exc
                continue
            except Exception as exc:
                last_error = exc
                raise

        raise RuntimeError(f"Unable to persist candidate file after multiple attempts: {last_error}")

    def export_predictions(
        self,
        routings: List[RoutingSummary],
        candidates: List[CandidateRouting],
        formats: Iterable[str],
        *,
        username: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> Tuple[List[str], List[Dict[str, str]]]:
        export_cfg = workflow_config_store.get_export_config()
        requested = {fmt.lower() for fmt in formats}
        exported_paths: List[str] = []
        export_errors: List[Dict[str, str]] = []
        if not requested:
            return exported_paths, export_errors

        export_dir = Path(export_cfg.export_directory)
        export_dir.mkdir(parents=True, exist_ok=True)
        timestamp = utc_timestamp("%Y%m%d%H%M%S")
        user_token = self._build_user_token(username, session_id)
        unique_token = self._unique_token()

        routing_records: List[Dict[str, Any]] = []
        for summary in routings:
            summary_dict = summary.dict(by_alias=True)
            operations = summary_dict.pop("operations", [])
            if not operations:
                routing_records.append(summary_dict)
                continue
            for operation in operations:
                merged = dict(summary_dict)
                merged.update(operation)
                routing_records.append(merged)

        candidate_records = [candidate.dict(by_alias=True) for candidate in candidates]
        routing_df = pd.DataFrame(routing_records)
        candidate_df = pd.DataFrame(candidate_records)

        encoding = export_cfg.default_encoding or "utf-8"

        def _unique_path(prefix: str, extension: str) -> Path:
            base = f"{prefix}_{user_token}_{unique_token}"
            path = export_dir / f"{base}.{extension}"
            if path.exists():
                path = export_dir / f"{prefix}_{user_token}_{self._unique_token()}.{extension}"
            return path

        def _safe_export(action, path: Path) -> None:
            try:
                action()
                exported_paths.append(str(path))
                logger.info("���� ��� �������� �Ϸ�: %s", path)
            except Exception as exc:  # pragma: no cover - ���� ���� ���� ��ȣ
                logger.warning("���� ��� �������� ���� (%s): %s", path, exc)
                export_errors.append(
                    {"path": str(path), "error": f"{exc.__class__.__name__}: {exc}"}
                )

        if "csv" in requested and export_cfg.enable_csv and not routing_df.empty:
            csv_path = _unique_path("routing_operations", "csv")
            _safe_export(lambda: routing_df.to_csv(csv_path, index=False, encoding=encoding), csv_path)

        if "txt" in requested and export_cfg.enable_txt and not routing_df.empty:
            txt_path = _unique_path("routing_operations", "txt")
            _safe_export(lambda: routing_df.to_csv(txt_path, index=False, sep="	", encoding=encoding), txt_path)

        if "excel" in requested and export_cfg.enable_excel:
            excel_path = _unique_path("routing_bundle", "xlsx")

            def _write_excel() -> None:
                with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:  # type: ignore[arg-type]
                    routing_df.to_excel(writer, sheet_name="operations", index=False)
                    candidate_df.to_excel(writer, sheet_name="candidates", index=False)

            _safe_export(_write_excel, excel_path)

        if "json" in requested and export_cfg.enable_json:
            json_path = _unique_path("routing_bundle", "json")
            payload = {
                "routings": routing_records,
                "candidates": candidate_records,
                "generated_at": timestamp,
                "user": username,
            }
            _safe_export(
                lambda: json_path.write_text(
                    json.dumps(payload, ensure_ascii=False, indent=2), encoding=encoding
                ),
                json_path,
            )

        if "erp" in requested and export_cfg.erp_interface_enabled:
            erp_path = _unique_path("routing_erp", "json")
            erp_payload = {
                "protocol": export_cfg.erp_protocol,
                "endpoint": export_cfg.erp_endpoint,
                "payload": {
                    "candidates": candidate_records,
                    "operations": routing_records,
                },
            }
            _safe_export(
                lambda: erp_path.write_text(
                    json.dumps(erp_payload, ensure_ascii=False, indent=2), encoding=encoding
                ),
                erp_path,
            )

        if "xml" in requested and export_cfg.enable_xml and not routing_df.empty:
            xml_path = _unique_path("routing_operations", "xml")
            _safe_export(lambda: self._write_xml_export(routing_records, candidate_records, xml_path, encoding), xml_path)

        if "database" in requested and export_cfg.enable_database_export and export_cfg.database_target_table:
            try:
                inserted_count = self._write_database_export(
                    routing_records,
                    export_cfg.database_target_table,
                )
                target_info = f"{export_cfg.database_target_table} ({inserted_count} rows)"
                exported_paths.append(target_info)
                logger.info("MSSQL ���̺� ���� �Ϸ�: %s", target_info)
            except Exception as exc:
                logger.warning("MSSQL ���̺� ���� ����: %s", exc)
                export_errors.append(
                    {"table": export_cfg.database_target_table or "unknown", "error": f"{exc.__class__.__name__}: {exc}"}
                )

        if export_cfg.compress_on_save and exported_paths and not routing_df.empty:
            gz_path = _unique_path("routing_operations", "csv.gz")
            _safe_export(
                lambda: routing_df.to_csv(gz_path, index=False, encoding=encoding, compression="gzip"),
                gz_path,
            )

        return exported_paths, export_errors

    def _write_xml_export(
        self,
        routing_records: List[Dict[str, Any]],
        candidate_records: List[Dict[str, Any]],
        xml_path: Path,
        encoding: str = "utf-8"
    ) -> None:
        """XML 형식으로 라우팅 데이터 내보내기."""
        import xml.etree.ElementTree as ET
        from xml.dom import minidom

        root = ET.Element("RoutingExport")
        root.set("generated_at", utc_isoformat())
        root.set("record_count", str(len(routing_records)))

        # Candidates section
        candidates_elem = ET.SubElement(root, "Candidates")
        for candidate in candidate_records:
            cand_elem = ET.SubElement(candidates_elem, "Candidate")
            for key, value in candidate.items():
                if value is not None:
                    child = ET.SubElement(cand_elem, str(key))
                    child.text = str(value)

        # Routings section
        routings_elem = ET.SubElement(root, "Routings")

        # Group by item_code
        from collections import defaultdict
        routings_by_item: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for record in routing_records:
            item_code = record.get("item_code") or record.get("ITEM_CD", "UNKNOWN")
            routings_by_item[str(item_code)].append(record)

        for item_code, operations in routings_by_item.items():
            item_elem = ET.SubElement(routings_elem, "Item")
            item_elem.set("code", item_code)
            item_elem.set("operation_count", str(len(operations)))

            ops_elem = ET.SubElement(item_elem, "Operations")
            for operation in operations:
                op_elem = ET.SubElement(ops_elem, "Operation")
                for key, value in operation.items():
                    if value is not None and key not in ["item_code", "ITEM_CD"]:
                        child = ET.SubElement(op_elem, str(key))
                        child.text = str(value)

        # Pretty print
        xml_str = ET.tostring(root, encoding="unicode")
        dom = minidom.parseString(xml_str)
        pretty_xml = dom.toprettyxml(indent="  ", encoding=encoding)

        xml_path.write_bytes(pretty_xml)

    def _write_database_export(
        self,
        routing_records: List[Dict[str, Any]],
        target_table: str,
    ) -> int:
        """MSSQL 데이터베이스에 라우팅 데이터를 저장한다."""

        if not routing_records:
            return 0

        sample_record = routing_records[0]
        columns = [col for col, value in sample_record.items() if value is not None]
        if not columns:
            return 0

        normalized_table = ".".join(f"[{part.strip('[]')}]" for part in target_table.split(".") if part)
        placeholders = ", ".join(["?"] * len(columns))
        column_names = ", ".join(f"[{col}]" for col in columns)
        insert_query = f"INSERT INTO {normalized_table} ({column_names}) VALUES ({placeholders})"

        payload_rows = [[record.get(col) for col in columns] for record in routing_records]

        conn = database._create_connection()
        try:
            cursor = conn.cursor()
            cursor.executemany(insert_query, payload_rows)
            conn.commit()
        finally:
            try:
                conn.close()
            except Exception:
                pass

        return len(payload_rows)

    def prepare_visualization_snapshot(
        self,
        routing_df: Optional[pd.DataFrame],
        candidates_df: Optional[pd.DataFrame],
    ) -> Dict[str, Any]:
        viz_cfg = workflow_config_store.get_visualization_config()
        snapshot: Dict[str, Any] = {}
        timestamp = utc_timestamp("%Y%m%d%H%M%S")

        def _safe_dataframe(df: Optional[pd.DataFrame]) -> pd.DataFrame:
            if df is None or df.empty:
                return pd.DataFrame()
            return df.copy()

        routing_df = _safe_dataframe(routing_df)
        candidates_df = _safe_dataframe(candidates_df)

        if viz_cfg.projector_enabled:
            projector_root = Path(viz_cfg.tensorboard_projector_dir)
            version_dir = projector_root / f"projector_{timestamp}"
            version_dir.mkdir(parents=True, exist_ok=True)

            if routing_df.empty:
                meta_df = pd.DataFrame(columns=["ITEM_CD", "process_count", "avg_setup", "avg_run"])
            else:
                meta_df = routing_df.groupby("ITEM_CD").agg(
                    process_count=("PROC_SEQ", "count") if "PROC_SEQ" in routing_df.columns else ("ITEM_CD", "count"),
                    avg_setup=("SETUP_TIME", "mean") if "SETUP_TIME" in routing_df.columns else ("ITEM_CD", "size"),
                    avg_run=("MACH_WORKED_HOURS", "mean") if "MACH_WORKED_HOURS" in routing_df.columns else ("ITEM_CD", "size"),
                ).reset_index()

            metadata_path = version_dir / "metadata.tsv"
            vectors_path = version_dir / "vectors.tsv"

            if meta_df.empty:
                metadata_path.write_text("ITEM_CD\tprocess_count\tavg_setup\tavg_run\n", encoding="utf-8")
                vectors_path.write_text("0\t0\t0\n", encoding="utf-8")
            else:
                meta_df.to_csv(metadata_path, sep="\t", index=False, encoding="utf-8")
                vector_df = meta_df.select_dtypes(include=["number"]).fillna(0.0)
                vector_df.to_csv(vectors_path, sep="\t", index=False, encoding="utf-8")

            projector_config = {
                "generated_at": timestamp,
                "metadata_file": metadata_path.name,
                "vector_file": vectors_path.name,
                "columns": viz_cfg.projector_metadata_columns,
            }
            (version_dir / "projector_config.json").write_text(
                json.dumps(projector_config, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            snapshot["tensorboard"] = str(version_dir)

        if viz_cfg.neo4j_enabled:
            neo4j_dir = Path(viz_cfg.tensorboard_projector_dir) / "neo4j"
            neo4j_dir.mkdir(parents=True, exist_ok=True)
            graph_path = neo4j_dir / f"routing_graph_{timestamp}.json"
            nodes: List[Dict[str, Any]] = []
            edges: List[Dict[str, Any]] = []

            for candidate in candidates_df.to_dict(orient="records"):
                node_id = candidate.get("CANDIDATE_ITEM_CD") or candidate.get("ITEM_CD")
                if not node_id:
                    continue
                nodes.append(
                    {
                        "id": node_id,
                        "label": candidate.get("CANDIDATE_ITEM_CD", "candidate"),
                        "similarity": candidate.get("SIMILARITY_SCORE"),
                    }
                )

            if not routing_df.empty and "ITEM_CD" in routing_df.columns and "CANDIDATE_ITEM_CD" in routing_df.columns:
                for row in routing_df.to_dict(orient="records"):
                    source = row.get("ITEM_CD")
                    target = row.get("CANDIDATE_ITEM_CD")
                    if not source or not target:
                        continue
                    edges.append(
                        {
                            "source": source,
                            "target": target,
                            "weight": row.get("SIMILARITY_SCORE"),
                        }
                    )

            graph_payload = {
                "workspace": viz_cfg.neo4j_workspace,
                "generated_at": timestamp,
                "nodes": nodes,
                "edges": edges,
            }
            graph_path.write_text(
                json.dumps(graph_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            snapshot["neo4j"] = {
                "workspace": viz_cfg.neo4j_workspace,
                "browser_url": viz_cfg.neo4j_browser_url,
                "graph_file": str(graph_path),
            }

        if snapshot:
            logger.info("시각화 아티팩트 생성 완료", extra={"payload": snapshot})
        return snapshot

    def latest_metrics(self) -> Dict[str, Any]:
        """마지막 예측 메트릭 반환."""
        return self._last_metrics

    def _build_sql_preview(
        self,
        *,
        item_code: str,
        candidate_id: str,
        payload: Dict[str, Any],
        operations_df: pd.DataFrame,
        warnings: List[str],
        sql_config: SQLColumnConfig,
    ) -> List[str]:
        if operations_df.empty:
            warnings.append("공정 데이터가 비어 있어 SQL 미리보기를 생성할 수 없습니다.")
            return []

        summary_meta = payload.get("summary") or {}
        first_row = operations_df.iloc[0].to_dict()

        def _meta(key: str) -> Any:
            return summary_meta.get(key) or first_row.get(key)

        candidate_row = {
            "item_code": item_code,
            "candidate_id": candidate_id,
            "routing_signature": _meta("ROUTING_SIGNATURE"),
            "similarity_score": _meta("SIMILARITY_SCORE"),
            "priority": _meta("PRIORITY"),
            "similarity_tier": _meta("SIMILARITY_TIER"),
            "reference_item_cd": _meta("REFERENCE_ITEM_CD"),
            "generated_at": utc_isoformat(),
        }

        for field_key, label in {
            "routing_signature": "ROUTING_SIGNATURE",
            "similarity_score": "SIMILARITY_SCORE",
            "priority": "PRIORITY",
            "similarity_tier": "SIMILARITY_TIER",
            "reference_item_cd": "REFERENCE_ITEM_CD",
        }.items():
            if candidate_row.get(field_key) is None:
                warning_msg = f"{label} 값을 찾을 수 없어 NULL로 저장됩니다."
                warnings.append(warning_msg)

        candidate_columns = [
            "item_code",
            "candidate_id",
            "routing_signature",
            "similarity_score",
            "priority",
            "similarity_tier",
            "reference_item_cd",
            "generated_at",
        ]
        candidate_values = ", ".join(self._sql_literal(candidate_row[col]) for col in candidate_columns)
        candidate_sql = (
            f"INSERT INTO {self.settings.sql_table_candidates} ("
            + ", ".join(candidate_columns)
            + f") VALUES ({candidate_values});"
        )

        preview_limit = self.settings.sql_preview_row_limit
        preview_df = operations_df.head(preview_limit)
        truncated = len(operations_df) > preview_limit

        operations_columns = sql_config.output_columns
        value_lines = []
        for row in preview_df.itertuples(index=False, name=None):
            value_lines.append("(" + ", ".join(self._sql_literal(value) for value in row) + ")")

        operations_sql = (
            f"INSERT INTO {self.settings.sql_table_operations} ("
            + ", ".join(operations_columns)
            + ") VALUES\n  "
            + ",\n  ".join(value_lines)
            + ";"
        )

        if truncated:
            operations_sql += (
                f"\n-- 총 {len(operations_df)}행 중 {preview_limit}행만 미리보기로 포함되었습니다."
            )
            warnings.append(
                f"SQL 미리보기는 {preview_limit}행까지만 표시되며 전체 {len(operations_df)}행이 저장 대상입니다."
            )

        return [candidate_sql, operations_sql]

    @staticmethod
    def _sql_literal(value: Any) -> str:
        if value is None:
            return "NULL"
        if isinstance(value, datetime):
            return f"'{value.isoformat()}'"
        if pd.isna(value):  # type: ignore[arg-type]
            return "NULL"
        if isinstance(value, bool):
            return "1" if value else "0"
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return str(value)
        return "'" + str(value).replace("'", "''") + "'"

    @staticmethod
    def _serialize_routing(df: pd.DataFrame) -> List[RoutingSummary]:
        if df is None or df.empty:
            return []
        grouped = df.groupby("ITEM_CD") if "ITEM_CD" in df.columns else [(None, df)]
        summaries: List[RoutingSummary] = []
        for item_cd, group in grouped:
            operations = group.to_dict(orient="records")
            for op in operations:
                if "PROC_SEQ" not in op or op["PROC_SEQ"] is None:
                    op["PROC_SEQ"] = 0
                value = op.get("PROC_SEQ")
                if value is None:
                    op["PROC_SEQ"] = 0
                    continue
                if isinstance(value, str):
                    value = value.strip()
                    if not value:
                        op["PROC_SEQ"] = 0
                        continue
                try:
                    op["PROC_SEQ"] = int(float(value))
                except (TypeError, ValueError):
                    op["PROC_SEQ"] = 0
            meta = {}
            for key in [
                "ITEM_CD",
                "CANDIDATE_ID",
                "ROUTING_SIGNATURE",
                "PRIORITY",
                "SIMILARITY_TIER",
                "SIMILARITY_SCORE",
                "REFERENCE_ITEM_CD",
            ]:
                if key in group.columns and not group[key].isna().all():
                    meta[key] = group[key].iloc[0]

            summary_item_cd = meta.get("ITEM_CD") or (
                item_cd if item_cd is not None else ""
            )
            summaries.append(
                RoutingSummary(
                    ITEM_CD=summary_item_cd,
                    CANDIDATE_ID=str(meta.get("CANDIDATE_ID")) if meta.get("CANDIDATE_ID") else None,
                    ROUTING_SIGNATURE=meta.get("ROUTING_SIGNATURE"),
                    PRIORITY=meta.get("PRIORITY"),
                    SIMILARITY_TIER=meta.get("SIMILARITY_TIER"),
                    SIMILARITY_SCORE=meta.get("SIMILARITY_SCORE"),
                    REFERENCE_ITEM_CD=meta.get("REFERENCE_ITEM_CD"),
                    operations=operations,
                )
            )
        return summaries

    @staticmethod
    def _serialize_candidates(df: pd.DataFrame) -> List[CandidateRouting]:
        if df is None or df.empty:
            return []
        sorted_df = df.sort_values(by="SIMILARITY_SCORE", ascending=False, na_position="last")
        return [CandidateRouting(**row) for row in sorted_df.to_dict(orient="records")]


class _PredictionServiceFallback:
    """모델 레지스트리가 비어 있는 테스트 환경용 폴백."""

    def __init__(self, error: Exception) -> None:
        self._init_error = error
        self.settings = get_settings()
        self.time_aggregator = TimeAggregator()

    def __getattr__(self, name: str) -> Any:  # pragma: no cover - 방어적 경고
        def _not_ready(*args: Any, **kwargs: Any) -> Any:
            raise RuntimeError(
                "PredictionService 초기화에 실패해 사용할 수 없습니다"
            ) from self._init_error

        return _not_ready


try:
    prediction_service = PredictionService()
except RuntimeError as exc:  # pragma: no cover - 테스트 환경 폴백
    logger.warning("PredictionService 초기화 실패: %s", exc)
    prediction_service = cast(PredictionService, _PredictionServiceFallback(exc))

__all__ = ["prediction_service", "PredictionService"]
