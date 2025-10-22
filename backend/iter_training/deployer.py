"""
Model deployment module for iterative training system.

This module handles:
- Saving trained models with versioning
- Updating model manifest
- Cache invalidation for predictor service
- Rollback to previous model versions
"""

from __future__ import annotations

import json
import logging
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib

from models.manifest import write_manifest, read_model_manifest

logger = logging.getLogger(__name__)


class ModelDeployer:
    """Handles model deployment and versioning.

    This class manages the lifecycle of trained models:
    - Saving models to versioned directories
    - Updating manifest files
    - Cache invalidation
    - Rollback to previous versions

    Directory structure:
        models/
            routing_rf_v1.pkl       # Current active model (symlink or copy)
            version_20251022_123456/  # Versioned model
                similarity_engine.joblib
                encoder.joblib
                scaler.joblib
                manifest.json
            version_20251021_100000/  # Previous version
                ...
    """

    def __init__(self, models_dir: str = "models"):
        """Initialize deployer.

        Args:
            models_dir: Root directory for models
        """
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"ModelDeployer initialized with models_dir: {self.models_dir}")

    def save_model(
        self,
        model: Any,
        scaler: Any,
        encoder: Any,
        feature_columns: List[str],
        metadata: Optional[Dict[str, Any]] = None,
        version: Optional[str] = None,
    ) -> Path:
        """Save trained model with versioning.

        Args:
            model: Trained model (HNSW, MLPRegressor, StackingRegressor, etc.)
            scaler: Feature scaler (StandardScaler)
            encoder: Label encoder for categorical features
            feature_columns: List of feature column names
            metadata: Optional metadata (training metrics, timestamps, etc.)
            version: Optional version string (default: timestamp)

        Returns:
            Path to versioned model directory

        Raises:
            ValueError: If model artifacts are invalid
        """
        # Generate version string
        if version is None:
            version = datetime.now().strftime("version_%Y%m%d_%H%M%S")

        version_dir = self.models_dir / version
        version_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"Saving model to {version_dir}")

        # Save model artifacts
        try:
            # Save similarity engine (model)
            model_path = version_dir / "similarity_engine.joblib"
            joblib.dump(model, model_path)
            logger.info(f"  Saved similarity_engine: {model_path.stat().st_size} bytes")

            # Save scaler
            scaler_path = version_dir / "scaler.joblib"
            joblib.dump(scaler, scaler_path)
            logger.info(f"  Saved scaler: {scaler_path.stat().st_size} bytes")

            # Save encoder
            encoder_path = version_dir / "encoder.joblib"
            joblib.dump(encoder, encoder_path)
            logger.info(f"  Saved encoder: {encoder_path.stat().st_size} bytes")

            # Save feature columns
            columns_path = version_dir / "feature_columns.joblib"
            joblib.dump(feature_columns, columns_path)
            logger.info(f"  Saved feature_columns: {columns_path.stat().st_size} bytes")

            # Save metadata
            if metadata:
                metadata_path = version_dir / "training_metadata.json"
                with open(metadata_path, "w", encoding="utf-8") as f:
                    json.dump(metadata, f, indent=2, ensure_ascii=False)
                logger.info(f"  Saved training_metadata: {metadata_path.stat().st_size} bytes")

        except Exception as e:
            # Clean up on error
            if version_dir.exists():
                shutil.rmtree(version_dir)
            raise RuntimeError(f"Failed to save model artifacts: {e}")

        # Generate manifest
        try:
            manifest_path = write_manifest(version_dir, strict=False, metadata=metadata)
            logger.info(f"  Generated manifest: {manifest_path}")
        except Exception as e:
            logger.warning(f"Failed to generate manifest: {e}")

        return version_dir

    def update_manifest(
        self,
        version_dir: Path,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Path:
        """Update manifest for a model version.

        Args:
            version_dir: Path to versioned model directory
            metadata: Optional metadata to add to manifest

        Returns:
            Path to manifest file

        Raises:
            FileNotFoundError: If version directory doesn't exist
        """
        if not version_dir.exists():
            raise FileNotFoundError(f"Version directory not found: {version_dir}")

        logger.info(f"Updating manifest for {version_dir.name}")

        # Regenerate manifest
        manifest_path = write_manifest(version_dir, strict=False, metadata=metadata)

        logger.info(f"  Manifest updated: {manifest_path}")
        return manifest_path

    def activate_version(
        self,
        version: str,
        active_name: str = "routing_rf_v1.pkl",
    ) -> Path:
        """Activate a specific model version.

        This creates/updates a symlink or copies files to make the version active.

        Args:
            version: Version directory name (e.g., "version_20251022_123456")
            active_name: Name for active model file (legacy compatibility)

        Returns:
            Path to activated model

        Raises:
            FileNotFoundError: If version doesn't exist
        """
        version_dir = self.models_dir / version
        if not version_dir.exists():
            raise FileNotFoundError(f"Version not found: {version_dir}")

        logger.info(f"Activating version: {version}")

        # For now, we'll create a marker file to track active version
        # In production, this might update a database record or config file
        active_marker = self.models_dir / "active_version.txt"
        active_marker.write_text(version, encoding="utf-8")

        logger.info(f"  Active version set to: {version}")

        return version_dir

    def invalidate_cache(self) -> None:
        """Invalidate predictor service cache.

        This signals the predictor service to reload models.
        In Phase 2, we use a simple timestamp file.
        In Phase 4, this might use Redis pub/sub or API call.
        """
        logger.info("Invalidating predictor cache...")

        # Create cache invalidation marker
        cache_marker = self.models_dir / "cache_invalidated_at.txt"
        timestamp = datetime.now().isoformat()
        cache_marker.write_text(timestamp, encoding="utf-8")

        logger.info(f"  Cache invalidation marker created: {timestamp}")

        # TODO: In Phase 4, implement proper cache invalidation
        # - Redis pub/sub to notify running predictor processes
        # - API endpoint to trigger cache clear
        # - Database flag for distributed systems

    def rollback(
        self,
        target_version: Optional[str] = None,
    ) -> Path:
        """Rollback to a previous model version.

        Args:
            target_version: Specific version to rollback to (default: previous version)

        Returns:
            Path to rolled-back version

        Raises:
            FileNotFoundError: If no rollback target found
        """
        logger.info("Initiating model rollback...")

        # Get current version
        active_marker = self.models_dir / "active_version.txt"
        if active_marker.exists():
            current_version = active_marker.read_text(encoding="utf-8").strip()
            logger.info(f"  Current version: {current_version}")
        else:
            current_version = None
            logger.warning("  No active version marker found")

        # Find target version
        if target_version:
            target_dir = self.models_dir / target_version
            if not target_dir.exists():
                raise FileNotFoundError(f"Target version not found: {target_version}")
        else:
            # Find previous version (most recent before current)
            versions = self.list_versions()
            if not versions:
                raise FileNotFoundError("No model versions found for rollback")

            if current_version and current_version in versions:
                current_idx = versions.index(current_version)
                if current_idx + 1 < len(versions):
                    target_version = versions[current_idx + 1]
                else:
                    raise FileNotFoundError("No previous version available for rollback")
            else:
                # No current version, use most recent
                target_version = versions[0]

            target_dir = self.models_dir / target_version

        logger.info(f"  Rolling back to: {target_version}")

        # Activate target version
        self.activate_version(target_version)

        # Invalidate cache
        self.invalidate_cache()

        logger.info(f"Rollback complete: {target_version}")
        return target_dir

    def list_versions(self, limit: int = 50) -> List[str]:
        """List available model versions.

        Args:
            limit: Maximum number of versions to return

        Returns:
            List of version directory names, sorted by timestamp (newest first)
        """
        versions = []
        for item in self.models_dir.iterdir():
            if item.is_dir() and item.name.startswith("version_"):
                versions.append(item.name)

        # Sort by directory name (timestamp embedded)
        versions.sort(reverse=True)

        return versions[:limit]

    def get_version_info(self, version: str) -> Dict[str, Any]:
        """Get information about a model version.

        Args:
            version: Version directory name

        Returns:
            Dictionary with version information

        Raises:
            FileNotFoundError: If version doesn't exist
        """
        version_dir = self.models_dir / version
        if not version_dir.exists():
            raise FileNotFoundError(f"Version not found: {version}")

        info = {
            "version": version,
            "path": str(version_dir),
            "created_at": datetime.fromtimestamp(version_dir.stat().st_ctime).isoformat(),
            "size_bytes": sum(f.stat().st_size for f in version_dir.rglob("*") if f.is_file()),
        }

        # Read manifest if available
        manifest_path = version_dir / "manifest.json"
        if manifest_path.exists():
            try:
                manifest = read_model_manifest(version_dir)
                info["manifest"] = manifest.payload
            except Exception as e:
                logger.warning(f"Failed to read manifest for {version}: {e}")

        # Read metadata if available
        metadata_path = version_dir / "training_metadata.json"
        if metadata_path.exists():
            try:
                with open(metadata_path, "r", encoding="utf-8") as f:
                    info["metadata"] = json.load(f)
            except Exception as e:
                logger.warning(f"Failed to read metadata for {version}: {e}")

        return info

    def cleanup_old_versions(
        self,
        keep_latest: int = 5,
    ) -> int:
        """Clean up old model versions.

        Args:
            keep_latest: Number of latest versions to keep

        Returns:
            Number of versions deleted
        """
        versions = self.list_versions()
        if len(versions) <= keep_latest:
            logger.info(f"No cleanup needed ({len(versions)} versions <= {keep_latest} keep)")
            return 0

        # Get active version
        active_marker = self.models_dir / "active_version.txt"
        active_version = None
        if active_marker.exists():
            active_version = active_marker.read_text(encoding="utf-8").strip()

        # Determine versions to delete
        to_keep = set(versions[:keep_latest])
        if active_version:
            to_keep.add(active_version)

        deleted = 0
        for version in versions:
            if version not in to_keep:
                version_dir = self.models_dir / version
                try:
                    shutil.rmtree(version_dir)
                    deleted += 1
                    logger.info(f"Deleted old version: {version}")
                except Exception as e:
                    logger.warning(f"Failed to delete version {version}: {e}")

        logger.info(f"Cleanup complete: deleted {deleted} versions, kept {len(to_keep)}")
        return deleted
