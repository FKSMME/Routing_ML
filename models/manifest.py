"""Model artifact manifest utilities."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Sequence

MANIFEST_FILENAME = "manifest.json"
MANIFEST_SCHEMA_VERSION = "routing-ml/manifest@1"
HASH_ALGORITHM = "sha256"
CORE_ARTIFACTS = ("similarity_engine", "encoder", "scaler", "feature_columns")


@dataclass(frozen=True)
class ArtifactSpec:
    """Description for a known artifact tracked by the manifest."""

    name: str
    filename: str
    schema_version: str
    optional: bool = False


ARTIFACT_SPECS: Sequence[ArtifactSpec] = (
    ArtifactSpec("similarity_engine", "similarity_engine.joblib", "routing-ml/searcher@1"),
    ArtifactSpec("encoder", "encoder.joblib", "routing-ml/encoder@1"),
    ArtifactSpec("scaler", "scaler.joblib", "routing-ml/scaler@1"),
    ArtifactSpec("feature_columns", "feature_columns.joblib", "routing-ml/feature-columns@1"),
    ArtifactSpec("training_metadata", "training_metadata.json", "routing-ml/training-metadata@1", optional=True),
    ArtifactSpec("feature_weights", "feature_weights.joblib", "routing-ml/feature-weights@1", optional=True),
    ArtifactSpec("feature_weights_state", "feature_weights.json", "routing-ml/feature-weights@1", optional=True),
    ArtifactSpec("active_features", "active_features.json", "routing-ml/feature-weights@1", optional=True),
    ArtifactSpec("training_request", "training_request.json", "routing-ml/training-request@1", optional=True),
    ArtifactSpec("training_metrics", "training_metrics.json", "routing-ml/training-metrics@1", optional=True),
)


def _compute_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_manifest(
    directory: Path,
    *,
    strict: bool = True,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build a manifest payload for ``directory``.

    Args:
        directory: Directory containing the trained artifacts.
        strict: When ``True`` missing required artifacts raise an exception.

    Returns:
        Manifest payload matching :data:`MANIFEST_SCHEMA_VERSION`.
    """

    root = Path(directory).expanduser().resolve()
    if not root.exists():
        raise FileNotFoundError(f"Artifact directory not found: {root}")
    if not root.is_dir():
        raise NotADirectoryError(f"Artifact root must be a directory: {root}")

    artifacts: Dict[str, Dict[str, str]] = {}
    missing: list[str] = []

    for spec in ARTIFACT_SPECS:
        candidate = root / spec.filename
        if not candidate.exists():
            if spec.optional or not strict:
                continue
            missing.append(spec.filename)
            continue
        artifacts[spec.name] = {
            "path": candidate.relative_to(root).as_posix(),
            "sha256": _compute_sha256(candidate),
            "schema_version": spec.schema_version,
        }

    if missing:
        raise FileNotFoundError(
            "Missing required artifacts for manifest: " + ", ".join(sorted(missing))
        )

    payload: Dict[str, Any] = {
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "generated_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "hash_algorithm": HASH_ALGORITHM,
        "artifacts": artifacts,
    }
    if metadata:
        payload["metadata"] = metadata
    return payload


def write_manifest(
    directory: Path,
    *,
    strict: bool = True,
    metadata: Optional[Dict[str, Any]] = None,
) -> Path:
    """Generate and persist ``manifest.json`` under ``directory``."""

    manifest = build_manifest(directory, strict=strict, metadata=metadata)
    manifest_path = Path(directory).expanduser().resolve() / MANIFEST_FILENAME
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return manifest_path


@dataclass
class ModelManifest:
    """Parsed manifest helper."""

    root_dir: Path
    manifest_path: Path
    payload: Dict[str, Any]

    def get_artifacts(self) -> Dict[str, Dict[str, str]]:
        return self.payload.get("artifacts", {})

    def resolve_path(self, artifact_name: str) -> Path:
        artifacts = self.get_artifacts()
        if artifact_name not in artifacts:
            raise KeyError(f"Artifact not found in manifest: {artifact_name}")
        rel_path = artifacts[artifact_name]["path"]
        return (self.root_dir / rel_path).resolve()

    def verify(self, names: Optional[Iterable[str]] = None) -> None:
        artifacts = self.get_artifacts()
        expected_algo = self.payload.get("hash_algorithm", HASH_ALGORITHM)
        if expected_algo != HASH_ALGORITHM:
            raise ValueError(f"Unsupported hash algorithm: {expected_algo}")
        targets = list(names) if names is not None else list(artifacts.keys())
        for name in targets:
            if name not in artifacts:
                raise KeyError(f"Artifact missing from manifest: {name}")
            path = self.resolve_path(name)
            if not path.exists():
                raise FileNotFoundError(f"Artifact path missing: {path}")
            current_hash = _compute_sha256(path)
            if current_hash != artifacts[name]["sha256"]:
                raise ValueError(f"Checksum mismatch for {name}: {path}")

    def require_optimized_model_dir(self) -> Path:
        self.verify(CORE_ARTIFACTS)
        return self.root_dir


def read_model_manifest(reference: Path | str, *, strict: bool = True) -> ModelManifest:
    """Load a :class:`ModelManifest` from ``reference``.

    ``reference`` can point to a version directory or directly to ``manifest.json``.
    When a directory is provided and the manifest is missing, it is generated
    automatically (respecting ``strict``).
    """

    ref_path = Path(reference).expanduser().resolve()

    if ref_path.is_dir():
        manifest_path = ref_path / MANIFEST_FILENAME
        if not manifest_path.exists():
            write_manifest(ref_path, strict=strict)
        root_dir = ref_path
    else:
        manifest_path = ref_path
        root_dir = manifest_path.parent
        if manifest_path.suffix.lower() == ".json" and not manifest_path.exists() and root_dir.exists():
            write_manifest(root_dir, strict=strict)

    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifest not found: {manifest_path}")

    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    schema = payload.get("schema_version")
    if schema != MANIFEST_SCHEMA_VERSION:
        raise ValueError(f"Unsupported manifest schema: {schema}")

    return ModelManifest(root_dir=root_dir, manifest_path=manifest_path, payload=payload)


__all__ = [
    "ArtifactSpec",
    "ModelManifest",
    "MANIFEST_FILENAME",
    "MANIFEST_SCHEMA_VERSION",
    "CORE_ARTIFACTS",
    "build_manifest",
    "write_manifest",
    "read_model_manifest",
]
