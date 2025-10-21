#!/usr/bin/env python3
"""CLI utility to train the ML model and register the resulting index."""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import pandas as pd

from backend.api.config import get_settings
from backend.maintenance.model_registry import register_version
from backend.trainer_ml import train_model_with_ml_improved
from common.file_lock import FileLock, FileLockTimeout
from common.logger import get_logger
from common.training_state import DEFAULT_STATUS_PATH, TrainingStatusPayload, save_status
from models.manifest import write_manifest

LOGGER = get_logger("cli.train_build_index")


def _parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, required=True, help="Path to the training dataset (CSV or Parquet)")
    parser.add_argument("--save-dir", type=Path, required=True, help="Directory where trained artifacts will be stored")
    parser.add_argument("--version-label", type=str, default=None, help="Optional explicit version name")
    parser.add_argument(
        "--requested-by",
        type=str,
        default="scheduler",
        help="Identifier recorded in the registry as the requester",
    )
    parser.add_argument(
        "--registry-url",
        type=str,
        default=None,
        help="Override model registry database URL (defaults to MODEL_REGISTRY_URL PostgreSQL connection)",
    )
    parser.add_argument(
        "--state-path",
        type=Path,
        default=None,
        help=f"Location of the status file (default: {DEFAULT_STATUS_PATH})",
    )
    parser.add_argument(
        "--projector-metadata",
        type=str,
        nargs="*",
        default=None,
        help="Optional metadata columns for TensorBoard projector export",
    )
    parser.add_argument(
        "--export-projector",
        action="store_true",
        help="Export TensorBoard projector assets alongside the model",
    )
    parser.add_argument(
        "--lock-timeout",
        type=float,
        default=120.0,
        help="Seconds to wait for the inter-process lock before giving up",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate pipeline without persisting artifacts",
    )
    return parser.parse_args(argv)


def _load_dataset(path: Path) -> pd.DataFrame:
    resolved = path.expanduser().resolve()
    if not resolved.exists():
        raise FileNotFoundError(f"Dataset not found: {resolved}")

    if resolved.suffix.lower() == ".csv":
        return pd.read_csv(resolved)
    if resolved.suffix.lower() in {".parquet", ".pq"}:
        return pd.read_parquet(resolved)
    raise ValueError(f"Unsupported dataset format: {resolved.suffix}")


def main(argv: Optional[List[str]] = None) -> int:
    args = _parse_args(argv)

    save_dir = args.save_dir.expanduser().resolve()
    save_dir.mkdir(parents=True, exist_ok=True)

    status_path = args.state_path.expanduser().resolve() if args.state_path else DEFAULT_STATUS_PATH
    registry_url = args.registry_url or get_settings().model_registry_url
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    version_label = args.version_label or f"version_{now_str}"
    job_id = f"cli-train-{now_str}"
    projector_metadata = args.projector_metadata

    lock = FileLock(save_dir / ".train_build_index.lock")

    try:
        LOGGER.info("Acquiring training lock", extra={"lock": str(lock.path)})
        with lock.context(timeout=args.lock_timeout):
            start_ts = datetime.now(timezone.utc)
            start_monotonic = time.monotonic()
            running_status = TrainingStatusPayload(
                job_id=job_id,
                status="running",
                started_at=start_ts.isoformat(),
                progress=5,
                message="Loading dataset",
                version_path=str(save_dir),
            )
            save_status(running_status, status_path)

            dataset = _load_dataset(args.dataset)
            sample_count = len(dataset)

            running_status.progress = 20
            running_status.message = f"Dataset loaded ({sample_count} rows)"
            save_status(running_status, status_path)

            metrics = {
                "samples": sample_count,
                "dataset_path": str(args.dataset),
                "version_name": version_label,
                "dry_run": args.dry_run,
            }

            if args.dry_run:
                LOGGER.info("Dry-run mode enabled; skipping model persistence")
                time.sleep(0.5)
                trained = None
            else:
                LOGGER.info("Starting model training", extra={"save_dir": str(save_dir)})
                running_status.progress = 40
                running_status.message = "Training pipeline running"
                save_status(running_status, status_path)
                trained = train_model_with_ml_improved(
                    dataset,
                    save_dir=save_dir,
                    export_tb_projector=args.export_projector,
                    projector_metadata_cols=projector_metadata,
                )

            duration = time.monotonic() - start_monotonic
            metrics["duration_sec"] = round(duration, 2)

            running_status.progress = 80
            running_status.message = "Writing manifest"
            save_status(running_status, status_path)

            completed_ts = datetime.now(timezone.utc)
            manifest_metadata = {
                "version": version_label,
                "job": {
                    "id": job_id,
                    "requested_by": args.requested_by,
                    "started_at": start_ts.isoformat(),
                    "completed_at": completed_ts.isoformat(),
                    "dry_run": args.dry_run,
                },
                "metrics": metrics,
                "source": "scripts/train_build_index.py",
            }
            if projector_metadata:
                manifest_metadata["projector_metadata_columns"] = projector_metadata

            manifest_path = write_manifest(save_dir, strict=not args.dry_run, metadata=manifest_metadata)
            LOGGER.info("Manifest written", extra={"manifest": str(manifest_path)})

            metrics["manifest_path"] = str(manifest_path)

            if not args.dry_run:
                metrics_path = save_dir / "training_metrics.json"
                metrics_path.write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")

                register_version(
                    db_url=registry_url,
                    version_name=version_label,
                    artifact_dir=str(save_dir),
                    manifest_path=str(manifest_path),
                    requested_by=args.requested_by,
                    trained_at=datetime.now(timezone.utc),
                )
                LOGGER.info("Model registry updated", extra={"registry_url": registry_url})

            running_status.status = "completed"
            running_status.progress = 100
            running_status.message = "Training complete"
            running_status.finished_at = completed_ts.isoformat()
            running_status.metrics = metrics
            save_status(running_status, status_path)
            LOGGER.info("Training job finished", extra={"job_id": job_id})

            return 0
    except FileLockTimeout as exc:
        LOGGER.error("Could not acquire training lock: %s", exc)
        blocked_status = TrainingStatusPayload(
            job_id=job_id,
            status="blocked",
            started_at=datetime.now(timezone.utc).isoformat(),
            finished_at=datetime.now(timezone.utc).isoformat(),
            progress=0,
            message=str(exc),
            version_path=str(save_dir),
            metrics={"dataset_path": str(args.dataset)},
        )
        save_status(blocked_status, status_path)
        return 2
    except Exception as exc:  # pragma: no cover - ensures status persistence on failure
        LOGGER.exception("Training job failed")
        failure_status = TrainingStatusPayload(
            job_id=job_id,
            status="failed",
            started_at=datetime.now(timezone.utc).isoformat(),
            finished_at=datetime.now(timezone.utc).isoformat(),
            progress=100,
            message=str(exc),
            version_path=str(save_dir),
            metrics={"dataset_path": str(args.dataset)},
        )
        save_status(failure_status, status_path)
        return 1


if __name__ == "__main__":
    sys.exit(main())
