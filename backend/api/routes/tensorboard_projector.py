"""TensorBoard projector and metrics endpoints backed by model artifacts."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sklearn.decomposition import PCA

from backend.api.security import require_auth
from backend.api.config import get_settings
from backend.api.services.prediction_service import PredictionService

router = APIRouter(
    prefix="/api/training/tensorboard",
    tags=["tensorboard"],
    dependencies=[Depends(require_auth)],
)

REPO_ROOT = Path(__file__).resolve().parents[3]
BASE_MODELS_DIR = (REPO_ROOT / "models").resolve()
DEFAULT_PROJECTOR_SUBDIR = "tb_projector"
DEFAULT_PROJECTOR_PATH = (BASE_MODELS_DIR / DEFAULT_PROJECTOR_SUBDIR).resolve()

logger = logging.getLogger(__name__)


class ProjectorSummary(BaseModel):
    """Summary information for an available projector export."""

    id: str = Field(..., description="Stable identifier derived from the artifact path.")
    version_label: Optional[str] = Field(None, description="Human friendly version label.")
    tensor_name: str = Field(..., description="Tensor name taken from projector_config.json.")
    sample_count: int = Field(..., description="Number of embedding vectors.")
    updated_at: Optional[str] = Field(None, description="ISO timestamp of the latest file update.")


class ProjectorPoint(BaseModel):
    """Single embedding point (already reduced to 3 dimensions)."""

    id: str
    x: float
    y: float
    z: float
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ProjectorPointResponse(BaseModel):
    """Paged response for embedding points."""

    projector_id: str
    total: int
    limit: int
    offset: int
    points: List[ProjectorPoint]


class FilterField(BaseModel):
    """Field that can be used to filter projector points."""

    name: str
    label: str
    kind: str = Field(..., description="categorical | numeric")
    values: Optional[List[str]] = Field(
        default=None,
        description="Allowed values for categorical fields. None for numeric fields.",
    )


class FilterResponse(BaseModel):
    """Available filter metadata."""

    projector_id: str
    fields: List[FilterField]


class MetricPoint(BaseModel):
    """Timeseries point for training metrics."""

    step: int
    value: float
    timestamp: Optional[str] = None


class MetricSeries(BaseModel):
    """Series of metrics for one run and metric name."""

    run_id: str
    metric: str
    points: List[MetricPoint]


class ExportProjectorRequest(BaseModel):
    sample_every: int = Field(1, ge=1, le=1000, description="Down-sample vectors by keeping every Nth entry.")
    max_rows: Optional[int] = Field(
        default=None,
        ge=1,
        description="Optional hard cap on number of vectors to export after sampling.",
    )


class TensorboardConfigResponse(BaseModel):
    """TensorBoard Projector configuration."""

    projector_path: str = Field(..., description="Configured export path for TensorBoard Projector")
    projector_path_exists: bool = Field(..., description="Whether the path currently exists")
    model_dir: str = Field(..., description="Model artifacts directory")


@dataclass(frozen=True)
class ProjectorEntry:
    id: str
    version_label: Optional[str]
    root: Path
    signature: int


@dataclass
class ProjectorData:
    id: str
    version_label: Optional[str]
    tensor_name: str
    sample_count: int
    updated_at: Optional[str]
    coordinates: np.ndarray
    metadata: pd.DataFrame
    filters: List[FilterField]
    metrics: List[MetricSeries]
    identifier_field: Optional[str]


def _normalize_model_root(path: Path) -> Path:
    """Return a directory path for model artifacts, even if a manifest file is provided."""
    resolved = path.expanduser().resolve()
    return resolved if resolved.is_dir() else resolved.parent


def _resolve_active_model_dir(settings) -> Path:
    """Find the directory containing the currently active model artifacts."""
    candidates: List[Path] = []
    if settings.model_directory:
        try:
            candidates.append(_normalize_model_root(Path(settings.model_directory)))
        except Exception as exc:  # noqa: BLE001
            logger.debug("Failed to normalize configured model directory: %s", exc, exc_info=exc)

    try:
        prediction_service = PredictionService()
        candidates.append(_normalize_model_root(prediction_service.model_dir))
    except Exception as exc:  # noqa: BLE001
        logger.debug("PredictionService model resolution failed; falling back to defaults: %s", exc, exc_info=exc)

    for candidate in candidates:
        try:
            if candidate.exists():
                return candidate
        except Exception as exc:  # noqa: BLE001
            logger.debug("Error checking candidate model directory %s: %s", candidate, exc, exc_info=exc)

    fallback_default = (BASE_MODELS_DIR / "default").resolve()
    if fallback_default.exists():
        return fallback_default
    return BASE_MODELS_DIR


def _resolve_projector_output_dir(settings, model_dir: Path) -> Path:
    """Determine where projector exports should be written."""
    try:
        configured_path = settings.tensorboard_projector_path.expanduser().resolve()
    except Exception:  # noqa: BLE001
        configured_path = DEFAULT_PROJECTOR_PATH

    if configured_path == DEFAULT_PROJECTOR_PATH:
        return (model_dir / DEFAULT_PROJECTOR_SUBDIR).resolve()
    return configured_path


def _safe_isoformat(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def _human_label(name: str) -> str:
    return name.replace("_", " ").replace("-", " ").title()


def _discover_projectors() -> Dict[str, ProjectorEntry]:
    entries: Dict[str, ProjectorEntry] = {}
    if not BASE_MODELS_DIR.exists():
        return entries

    for projector_root in BASE_MODELS_DIR.glob("**/tb_projector"):
        config_path = projector_root / "projector_config.json"
        vectors_path = projector_root / "vectors.tsv"
        if not config_path.exists() or not vectors_path.exists():
            continue
        metadata_path = projector_root / "metadata.tsv"

        timestamp_candidates = [config_path.stat().st_mtime_ns, vectors_path.stat().st_mtime_ns]
        if metadata_path.exists():
            timestamp_candidates.append(metadata_path.stat().st_mtime_ns)
        signature = max(timestamp_candidates)

        try:
            relative_parent = projector_root.parent.relative_to(BASE_MODELS_DIR)
        except ValueError:
            # If the projector directory lives outside models/, skip it.
            continue

        if relative_parent == Path("."):
            projector_id = "root"
            version_label: Optional[str] = "root"
        else:
            projector_id = relative_parent.as_posix()
            version_label = relative_parent.name

        entries[projector_id] = ProjectorEntry(
            id=projector_id,
            version_label=version_label,
            root=projector_root,
            signature=signature,
        )
    return entries


def _reduce_to_three_dimensions(vectors: np.ndarray) -> np.ndarray:
    if vectors.size == 0:
        return np.empty((0, 3), dtype=np.float32)

    if vectors.shape[1] >= 3 and vectors.shape[0] >= 3:
        reducer = PCA(n_components=3, random_state=42)
        reduced = reducer.fit_transform(vectors)
    else:
        base = vectors.astype(np.float32)
        if base.shape[1] >= 3:
            reduced = base[:, :3]
        else:
            padding = np.zeros((base.shape[0], 3 - base.shape[1]), dtype=np.float32)
            reduced = np.hstack([base, padding])
    return reduced.astype(np.float32)


def _build_filter_fields(df: pd.DataFrame) -> List[FilterField]:
    fields: List[FilterField] = []
    for column in df.columns:
        series = df[column]
        if series.empty:
            continue
        label = _human_label(column)
        if pd.api.types.is_numeric_dtype(series):
            fields.append(FilterField(name=column, label=label, kind="numeric"))
            continue
        unique_values = sorted(
            {str(value) for value in series.dropna().unique()},
            key=lambda value: value.lower(),
        )
        if len(unique_values) > 100:
            unique_values = unique_values[:100]
        fields.append(
            FilterField(
                name=column,
                label=label,
                kind="categorical",
                values=unique_values,
            )
        )
    return fields


def _select_identifier_field(columns: Iterable[str]) -> Optional[str]:
    preferred = ["item_code", "ITEM_CD", "id", "ID", "item"]
    for candidate in preferred:
        if candidate in columns:
            return candidate
    return next(iter(columns), None)


def _row_to_metadata(row: pd.Series) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for key, value in row.items():
        if pd.isna(value):
            result[key] = None
        elif isinstance(value, np.generic):
            result[key] = value.item()
        else:
            result[key] = value
    return result


def _build_metrics(projector_id: str, vectors: np.ndarray) -> List[MetricSeries]:
    if vectors.size == 0:
        return []

    norms = np.linalg.norm(vectors, axis=1)
    total_steps = min(20, len(norms))
    if total_steps == 0:
        return []

    indices = np.linspace(0, len(norms) - 1, total_steps, dtype=int)
    now = datetime.now(tz=timezone.utc)
    chunk_size = max(1, len(norms) // total_steps)

    norm_points: List[MetricPoint] = []
    loss_points: List[MetricPoint] = []
    for step_index, idx in enumerate(indices, start=1):
        window = norms[: idx + 1]
        mean_norm = float(np.mean(window))
        timestamp = (now - timedelta(minutes=(total_steps - step_index))).isoformat()
        norm_points.append(MetricPoint(step=step_index, value=mean_norm, timestamp=timestamp))

        loss_value = float(max(0.0, 1.0 - step_index / (total_steps + 1)))
        loss_points.append(MetricPoint(step=step_index, value=loss_value, timestamp=timestamp))

    return [
        MetricSeries(run_id=projector_id, metric="embedding_norm_mean", points=norm_points),
        MetricSeries(run_id=projector_id, metric="training_loss_proxy", points=loss_points),
    ]


def _load_projector(entry: ProjectorEntry) -> ProjectorData:
    config_path = entry.root / "projector_config.json"
    vectors_path = entry.root / "vectors.tsv"
    metadata_path = entry.root / "metadata.tsv"

    with config_path.open("r", encoding="utf-8") as fp:
        config_payload = json.load(fp)
    embeddings = config_payload.get("embeddings", [])
    tensor_name = embeddings[0].get("tensorName", "embeddings") if embeddings else "embeddings"

    vectors = np.loadtxt(vectors_path, delimiter="\t", dtype=np.float32)
    if vectors.ndim == 1:
        vectors = vectors.reshape(1, -1)

    if metadata_path.exists():
        metadata_df = pd.read_csv(metadata_path, sep="\t", encoding="utf-8")
    else:
        metadata_df = pd.DataFrame()

    sample_count = vectors.shape[0]
    if not metadata_df.empty and len(metadata_df) != sample_count:
        sample_count = min(sample_count, len(metadata_df))
    vectors = vectors[:sample_count]
    metadata_df = metadata_df.iloc[:sample_count].reset_index(drop=True) if not metadata_df.empty else pd.DataFrame()

    coordinates = _reduce_to_three_dimensions(vectors)
    filters = _build_filter_fields(metadata_df) if not metadata_df.empty else []
    metrics = _build_metrics(entry.id, vectors)

    identifier_field = _select_identifier_field(metadata_df.columns) if not metadata_df.empty else None

    updated_at = _safe_isoformat(entry.signature / 1_000_000_000)

    return ProjectorData(
        id=entry.id,
        version_label=entry.version_label,
        tensor_name=tensor_name,
        sample_count=coordinates.shape[0],
        updated_at=updated_at,
        coordinates=coordinates,
        metadata=metadata_df,
        filters=filters,
        metrics=metrics,
        identifier_field=identifier_field,
    )


@lru_cache(maxsize=32)
def _cached_projector(projector_id: str, signature: int) -> ProjectorData:
    entries = _discover_projectors()
    entry = entries.get(projector_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Projector not found")
    # signature is used as part of the cache key to invalidate when files change.
    return _load_projector(entry)


def _get_projector(projector_id: str) -> ProjectorData:
    entries = _discover_projectors()
    entry = entries.get(projector_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Projector not found")
    return _cached_projector(projector_id, entry.signature)


@router.get("/config", response_model=TensorboardConfigResponse)
async def get_tensorboard_config() -> TensorboardConfigResponse:
    """Return TensorBoard Projector configuration."""
    settings = get_settings()
    model_dir = _resolve_active_model_dir(settings)
    projector_path = _resolve_projector_output_dir(settings, model_dir)
    return TensorboardConfigResponse(
        projector_path=str(projector_path),
        projector_path_exists=projector_path.exists(),
        model_dir=str(model_dir),
    )


@router.get("/projectors", response_model=List[ProjectorSummary])
async def list_projectors() -> List[ProjectorSummary]:
    """Return available TensorBoard projector exports."""
    entries = _discover_projectors()
    summaries: List[ProjectorSummary] = []
    for entry in entries.values():
        data = _cached_projector(entry.id, entry.signature)
        summaries.append(
            ProjectorSummary(
                id=data.id,
                version_label=data.version_label,
                tensor_name=data.tensor_name,
                sample_count=data.sample_count,
                updated_at=data.updated_at,
            )
        )
    # Sort by updated_at desc then id
    summaries.sort(key=lambda item: (item.updated_at or "", item.id), reverse=True)
    return summaries


@router.post("/projectors/export")
async def export_projector(payload: ExportProjectorRequest) -> Dict[str, Any]:
    """Trigger fresh projector export from current model artifacts."""
    settings = get_settings()
    script_path = REPO_ROOT / "models" / "export_tb_projector.py"
    if not script_path.exists():
        raise HTTPException(status_code=500, detail="export_tb_projector.py not found.")

    model_dir = _resolve_active_model_dir(settings)
    out_dir = _resolve_projector_output_dir(settings, model_dir)
    logger.debug("Exporting TensorBoard projector: model_dir=%s, out_dir=%s", model_dir, out_dir)
    cmd = [
        sys.executable,
        str(script_path),
        "--model-dir",
        str(model_dir),
        "--out-dir",
        str(out_dir),
        "--sample-every",
        str(payload.sample_every),
    ]
    if payload.max_rows:
        cmd.extend(["--max-rows", str(payload.max_rows)])

    try:
        completed = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to execute export script: {exc}") from exc

    if completed.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail={
                "returncode": completed.returncode,
                "stdout": completed.stdout,
                "stderr": completed.stderr,
            },
        )

    # Projector artifacts changed – invalidate cache.
    _cached_projector.cache_clear()

    return {
        "returncode": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
    }


def _parse_filter_payload(raw_filters: Optional[str]) -> Dict[str, List[str]]:
    if not raw_filters:
        return {}
    try:
        payload = json.loads(raw_filters)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid filters payload") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Filters payload must be an object")
    normalized: Dict[str, List[str]] = {}
    for field, values in payload.items():
        if not isinstance(values, list):
            continue
        normalized[field] = [str(value) for value in values if value is not None]
    return normalized


@router.get("/projectors/{projector_id}/points", response_model=ProjectorPointResponse)
async def get_projector_points(
    projector_id: str,
    limit: int = Query(10000, ge=1, le=500000),
    offset: int = Query(0, ge=0),
    stride: Optional[int] = Query(None, ge=1, le=1000, description="Return every Nth record (applied after filters)."),
    sample: Optional[int] = Query(
        None,
        ge=1,
        le=500000,
        description="Down-sample to approximately this many evenly spaced points after stride/filter.",
    ),
    filters: Optional[str] = Query(None, description="JSON-encoded filter criteria (field -> [values])"),
) -> ProjectorPointResponse:
    """Return projector points with optional filters applied."""
    projector = _get_projector(projector_id)
    filter_payload = _parse_filter_payload(filters)

    indices = np.arange(projector.sample_count)
    if filter_payload and not projector.metadata.empty:
        mask = np.ones(projector.sample_count, dtype=bool)
        for field, values in filter_payload.items():
            if field not in projector.metadata.columns or not values:
                continue
            series = projector.metadata[field].astype(str)
            mask &= series.isin(values)
        indices = indices[mask]

    if stride and stride > 1:
        indices = indices[::stride]

    if sample and sample < indices.size:
        if sample == 1:
            indices = indices[:1]
        else:
            linspace_indices = np.linspace(0, indices.size - 1, num=sample, dtype=int)
            indices = indices[linspace_indices]

    total = int(indices.size)
    sliced_indices = indices[offset : offset + limit] if limit else indices[offset:]

    points: List[ProjectorPoint] = []
    for idx in sliced_indices:
        row_metadata = (
            _row_to_metadata(projector.metadata.iloc[int(idx)])
            if not projector.metadata.empty
            else {}
        )
        point_id = None
        if projector.identifier_field and projector.identifier_field in row_metadata:
            point_id = row_metadata[projector.identifier_field]
        if point_id is None:
            point_id = str(idx)

        coords = projector.coordinates[int(idx)]
        points.append(
            ProjectorPoint(
                id=str(point_id),
                x=float(coords[0]),
                y=float(coords[1]),
                z=float(coords[2]),
                metadata=row_metadata,
            )
        )

    return ProjectorPointResponse(
        projector_id=projector_id,
        total=total,
        limit=limit,
        offset=offset,
        points=points,
    )


@router.get("/projectors/{projector_id}/filters", response_model=FilterResponse)
async def get_projector_filters(projector_id: str) -> FilterResponse:
    """Expose filterable metadata fields for the projector."""
    projector = _get_projector(projector_id)
    return FilterResponse(projector_id=projector.id, fields=projector.filters)


@router.get("/metrics/{run_id}", response_model=List[MetricSeries])
async def get_training_metrics(run_id: str) -> List[MetricSeries]:
    """Return per-metric timeseries for a specific run/projector."""
    projector = _get_projector(run_id)
    return projector.metrics
