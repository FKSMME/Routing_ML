"""Helpers for generating lightweight demo model artifacts on demand."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import OrdinalEncoder, StandardScaler

from backend.constants import NUMERIC_FEATURES, TRAIN_FEATURES
from backend.demo_data import demo_item_master, list_demo_items
from backend.index_hnsw import HNSWSearch
from models.manifest import write_manifest


def _build_vectors(df: pd.DataFrame) -> Tuple[np.ndarray, OrdinalEncoder, StandardScaler]:
    df = df.copy()

    numeric_cols = sorted(col for col in TRAIN_FEATURES if col in NUMERIC_FEATURES)
    categorical_cols = [col for col in TRAIN_FEATURES if col not in numeric_cols]

    encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    if categorical_cols:
        encoder.fit(df[categorical_cols])
        encoded = encoder.transform(df[categorical_cols]).astype(np.float32)
    else:  # pragma: no cover - demo dataset always has categoricals
        encoder.fit(np.zeros((1, 0)))
        encoded = np.zeros((len(df), 0), dtype=np.float32)

    if numeric_cols:
        scaler = StandardScaler()
        scaler.fit(df[numeric_cols])
        scaled_numeric = scaler.transform(df[numeric_cols]).astype(np.float32)
    else:  # pragma: no cover - demo dataset always has numerics
        scaler = StandardScaler(with_mean=False, with_std=False)
        scaler.fit(np.zeros((1, 1)))
        scaled_numeric = np.zeros((len(df), 1), dtype=np.float32)

    vectors = np.hstack([encoded, scaled_numeric]).astype(np.float32)
    return vectors, encoder, scaler


def _export_tb_projector(vectors: np.ndarray, item_codes: Iterable[str], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = out_dir / "metadata.tsv"
    vectors_path = out_dir / "vectors.tsv"
    config_path = out_dir / "projector_config.json"

    df = demo_item_master().set_index("ITEM_CD")
    lines = ["item_code\tpart_type"]
    for code in item_codes:
        part_type = df.loc[code, "PART_TYPE"] if code in df.index else "Unknown"
        lines.append(f"{code}\t{part_type}")
    metadata_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    with vectors_path.open("w", encoding="utf-8") as handle:
        for row in vectors:
            handle.write("\t".join(f"{float(val):.6f}" for val in row) + "\n")

    config = {
        "embeddings": [
            {
                "tensorName": "demo_embeddings",
                "tensorShape": [len(vectors), vectors.shape[1]],
                "tensorPath": vectors_path.name,
                "metadataPath": metadata_path.name,
            }
        ]
    }
    config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")


def materialize_demo_artifacts(
    model_dir: Path | str,
    *,
    overwrite: bool = False,
    update_manifest: bool = True,
) -> Path:
    """Ensure demo artifacts exist under ``model_dir``.

    Returns the resolved directory containing the generated artifacts.
    """

    target = Path(model_dir).expanduser().resolve()
    target.mkdir(parents=True, exist_ok=True)

    df = demo_item_master()
    vectors, encoder, scaler = _build_vectors(df)
    item_codes = list(list_demo_items())
    searcher = HNSWSearch(vectors.copy(), item_codes, ef_search=64)

    def _dump(obj: object, filename: str) -> None:
        path = target / filename
        if path.exists() and not overwrite:
            return
        joblib.dump(obj, path, compress=3)

    _dump(searcher, "similarity_engine.joblib")
    _dump(encoder, "encoder.joblib")
    _dump(scaler, "scaler.joblib")
    _dump(TRAIN_FEATURES, "feature_columns.joblib")

    _export_tb_projector(vectors, item_codes, target / "tb_projector")

    if update_manifest:
        write_manifest(target, strict=False, metadata={"generator": "demo", "items": len(item_codes)})

    return target


__all__ = ["materialize_demo_artifacts"]
