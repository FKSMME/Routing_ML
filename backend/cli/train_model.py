"""Console entry point for training the Routing ML model."""
from __future__ import annotations

import argparse
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List, Optional

import pandas as pd

from backend.trainer_ml import train_model_with_ml_improved
from common.logger import get_logger

LOGGER = get_logger("cli.train_model")
REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_ROOT = REPO_ROOT / "deliverables" / "models"


def _parse_args(argv: Optional[Iterable[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "dataset",
        type=Path,
        help="Path to the training dataset. Supports CSV and Parquet files.",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=DEFAULT_OUTPUT_ROOT,
        help="Directory where model versions are stored (default: deliverables/models).",
    )
    parser.add_argument(
        "--name",
        type=str,
        default=None,
        help="Optional explicit name for the model directory. Defaults to a timestamped value.",
    )
    parser.add_argument(
        "--projector-metadata",
        nargs="*",
        default=None,
        help="Optional column names to include in the TensorBoard projector export.",
    )
    parser.add_argument(
        "--export-projector",
        action="store_true",
        help="Export TensorBoard projector assets in addition to the core artifacts.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow overwriting an existing model directory with the same name.",
    )
    return parser.parse_args(argv)


def _load_dataset(path: Path) -> pd.DataFrame:
    resolved = path.expanduser().resolve()
    if not resolved.exists():
        raise FileNotFoundError(f"Dataset not found: {resolved}")

    suffix = resolved.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(resolved)
    if suffix in {".parquet", ".pq"}:
        return pd.read_parquet(resolved)
    raise ValueError(f"Unsupported dataset format: {resolved.suffix}")


def _resolve_output_dir(root: Path, name: Optional[str], overwrite: bool) -> Path:
    root = root.expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)

    if name is None:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        name = f"model_{timestamp}"

    target = root / name
    if target.exists():
        if overwrite:
            LOGGER.warning("Overwriting existing model directory: %s", target)
            shutil.rmtree(target)
        else:
            raise FileExistsError(
                f"Target directory already exists: {target}. Use --overwrite to replace it."
            )
    target.mkdir(parents=True, exist_ok=True)
    return target


def main(argv: Optional[List[str]] = None) -> int:
    args = _parse_args(argv)

    dataset = _load_dataset(args.dataset)
    output_dir = _resolve_output_dir(args.output_root, args.name, args.overwrite)

    LOGGER.info("Starting training run", extra={"dataset": str(args.dataset), "output": str(output_dir)})
    train_model_with_ml_improved(
        dataset,
        save_dir=output_dir,
        export_tb_projector=args.export_projector,
        projector_metadata_cols=args.projector_metadata,
    )

    LOGGER.info("Training completed", extra={"output": str(output_dir)})
    print(str(output_dir))
    return 0


if __name__ == "__main__":
    sys.exit(main())
