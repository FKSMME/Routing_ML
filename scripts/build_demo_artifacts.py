"""CLI utility to regenerate demo-friendly model artifacts."""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Ensure repository root is on PYTHONPATH when executed directly
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.demo_artifacts import materialize_demo_artifacts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model-dir",
        default=os.environ.get("MODEL_DIRECTORY", ROOT / "models"),
        help="Directory where artifacts will be written (defaults to $MODEL_DIRECTORY or ./models)",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing artifacts instead of keeping current files.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    target = Path(args.model_dir)
    materialize_demo_artifacts(target, overwrite=args.overwrite, update_manifest=True)
    print(f"Demo artifacts ready at {target.resolve()}")


if __name__ == "__main__":
    main()
