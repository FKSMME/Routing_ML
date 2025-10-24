# -*- coding: utf-8 -*-
# export_tb_projector.py

import argparse
import sys
from pathlib import Path
from typing import Tuple, List, Optional, Dict, Any, Iterable

# backend 경로 (joblib 역직렬화용)
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import joblib
import numpy as np
import pandas as pd
from tensorboard.plugins import projector

# ===== 사용자 옵션 =====
MODEL_DIR     = (REPO_ROOT / "models" / "default").resolve()
OUT_DIR       = (REPO_ROOT / "models" / "tb_projector").resolve()
TENSOR_NAME   = "item_embeddings"
SAMPLE_EVERY  = 1
MAX_ROWS      = None

META_PATH     = (REPO_ROOT / "models" / "item_master.tsv").resolve()

KEEP_COLS     = [
    "ITEM_CD", "PART_TYPE", "ITEM_NM", "ITEM_SPEC",
    "ITEM_MATERIAL", "MATERIAL_DESC", "ITEM_TYPE",
    "ITEM_GRP1", "ITEM_GRP1NM", "STANDARD_YN",
    "DRAW_NO", "DRAW_REV",
    "OUTDIAMETER", "INDIAMETER", "OUTTHICKNESS", "OUTDIAMETER_UNIT",
    "RAW_MATL_KINDNM",
    "SALES_ITEM_GROUP", "STOCK_POLICY_NM", "ITEM_TYPE_NM"
]

# 추가 Color-by 파생 피처(원하시면 확장)
ADD_COLOR_KEY = True
COLOR_FIELDS: List[str] = ["PART_TYPE"]

COLOR_BY_FEATURES: Dict[str, Dict[str, Any]] = {
    "PART_TYPE": {"kind": "copy", "from": "PART_TYPE"},
    # 예시:
    # "OUTDIAMETER_BIN": {"kind":"bucket","from":"OUTDIAMETER",
    #     "bins":[0,25,50,100,200,float("inf")],
    #     "labels":["<=25","25-50","50-100","100-200",">200"]}
}

# ===== 유틸 =====
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export TensorBoard projector artifacts from model embeddings.")
    parser.add_argument("--model-dir", type=Path, default=MODEL_DIR, help="모델 아티팩트가 위치한 디렉토리")
    parser.add_argument("--out-dir", type=Path, default=None, help="프로젝터 내보내기 결과 디렉토리")
    parser.add_argument("--meta-path", type=Path, default=META_PATH, help="메타데이터 TSV 경로")
    parser.add_argument("--sample-every", type=int, default=SAMPLE_EVERY, help="N번째 벡터마다 샘플링")
    parser.add_argument("--max-rows", type=int, default=None, help="최대 내보낼 벡터 수 제한")
    return parser.parse_args()


def ensure_dir(p: Path) -> Path:
    p.mkdir(parents=True, exist_ok=True)
    return p

def load_searcher(model_dir: Path):
    return joblib.load(model_dir / "similarity_engine.joblib")

def extract_vectors_and_labels(searcher) -> Tuple[np.ndarray, List[str]]:
    item_codes = list(getattr(searcher, "item_codes", []))
    if not item_codes:
        raise RuntimeError("item_codes is empty. HNSWSearch.item_codes must be populated.")
    for attr in ("original_vectors", "vectors"):
        vecs = getattr(searcher, attr, None)
        if isinstance(vecs, np.ndarray) and vecs.ndim == 2:
            print(f"[INFO] Using stored vectors from searcher attribute '{attr}'.")
            return vecs.astype(np.float32, copy=False), item_codes

    faiss_index = getattr(searcher, "index", None)
    if faiss_index is None or not hasattr(faiss_index, "reconstruct"):
        raise RuntimeError("FAISS index lacks reconstruct(). Re-train with updated HNSWSearch so original_vectors are persisted.")

    ntotal = int(getattr(faiss_index, "ntotal", 0))
    dim = int(getattr(faiss_index, "d", 0))
    if ntotal <= 0 or dim <= 0:
        raise RuntimeError("FAISS index dimensions are invalid.")
    if ntotal != len(item_codes):
        print(f"[WARN] ntotal({ntotal}) != len(item_codes)({len(item_codes)}). Adjusting to minimum length.")

    n = min(ntotal, len(item_codes))
    vectors = np.empty((n, dim), dtype=np.float32)
    for i in range(n):
        vectors[i] = faiss_index.reconstruct(i)
        if (i + 1) % 10000 == 0:
            print(f"  reconstructed {i+1}/{n}")
    return vectors, item_codes[:n]

def maybe_downsample(vectors: np.ndarray, labels: List[str]) -> Tuple[np.ndarray, List[str]]:
    sliced_vectors = vectors
    sliced_labels = labels

    if SAMPLE_EVERY > 1:
        sliced_vectors = sliced_vectors[::SAMPLE_EVERY]
        sliced_labels = sliced_labels[::SAMPLE_EVERY]
        print(
            f"[INFO] downsampled every {SAMPLE_EVERY} rows → vectors: {sliced_vectors.shape}, labels: {len(sliced_labels)}"
        )

    if MAX_ROWS is not None and len(sliced_vectors) > MAX_ROWS:
        sliced_vectors = sliced_vectors[:MAX_ROWS]
        sliced_labels = sliced_labels[:MAX_ROWS]
        print(f"[INFO] applied max_rows={MAX_ROWS} → vectors: {sliced_vectors.shape}, labels: {len(sliced_labels)}")

    return sliced_vectors, sliced_labels

# ===== 메타데이터 유틸 =====
def load_item_metadata_tsv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, sep="\t", dtype=str).fillna("")
    if "ITEM_CD" not in df.columns:
        raise RuntimeError("메타데이터 TSV에 'ITEM_CD' 컬럼이 없습니다.")
    print(f"[INFO] Metadata columns (raw): {list(df.columns)[:20]}{'...' if len(df.columns)>20 else ''}")
    return df

def _normalize_colname(name: str) -> str:
    return "".join(ch if ch.isalnum() else "_" for ch in str(name).upper())

def standardize_alias_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    넓은 alias 매핑으로 PART_TYPE을 최대한 찾아 표준화.
    """
    alias_map = {
        "PART_TYPE": {
            "PART_TYPE","PARTTYPE","PART TYPE","PART_TP","PARTCATEGORY","PART_CATEGORY",
            "PART-GROUP","PART_GROUP","품목유형","부품유형","부품구분","품목구분",
            "ITEM_GROUP_LV1","ITEM_GROUP1","ITEM_GRP_L1","ITEM_GRP_1","ITEM_GRP1_NAME"
        },
    }
    norm_targets = {t: {_normalize_colname(x) for x in xs} for t, xs in alias_map.items()}
    renames = {}
    for col in list(df.columns):
        n = _normalize_colname(col)
        for target, normset in norm_targets.items():
            if n in normset and col != target:
                renames[col] = target
                break
    if renames:
        print(f"[INFO] Alias rename: {renames}")
        df = df.rename(columns=renames)
    return df

def ensure_part_type(df: pd.DataFrame) -> pd.DataFrame:
    """
    PART_TYPE이 없거나 전부 공백이면 후보에서 값 채움.
    """
    candidates = [c for c in ["PART_TYPE", "ITEM_GRP1NM", "ITEM_TYPE_NM", "ITEM_TYPE", "ITEM_GRP1"] if c in df.columns]
    if "PART_TYPE" not in df.columns:
        if candidates:
            def pick(row):
                for c in candidates:
                    v = str(row.get(c, "")).strip()
                    if v:
                        return v
                return "Unknown"
            df["PART_TYPE"] = df.apply(pick, axis=1)
            print(f"[INFO] PART_TYPE created from candidates: {candidates}")
        else:
            df["PART_TYPE"] = "Unknown"
            print("[WARN] PART_TYPE 생성 실패 → 모든 행 Unknown")
    else:
        # 존재하더라도 공백 정리
        df["PART_TYPE"] = df["PART_TYPE"].astype(str).str.strip()

    # 공백 → Unknown
    df["PART_TYPE"] = df["PART_TYPE"].replace({"": "Unknown"})
    # 분포 로그
    vc = df["PART_TYPE"].value_counts(dropna=False).head(10)
    print(f"[INFO] PART_TYPE sample value_counts: {vc.to_dict()}")

    return df

def _safe_float(x: Any) -> Optional[float]:
    try:
        if pd.isna(x):
            return None
        s = str(x).strip().replace(",", "")
        if s == "":
            return None
        return float(s)
    except Exception:
        return None

def apply_color_by_features(df: pd.DataFrame, config: Dict[str, Dict[str, Any]]) -> pd.DataFrame:
    if not config:
        return df
    for new_col, spec in config.items():
        kind = spec.get("kind")
        try:
            if kind == "copy":
                src = spec.get("from")
                df[new_col] = df[src].astype(str).fillna("").replace({"": "Unknown"}) if src in df.columns else "Unknown"

            elif kind == "combine":
                fields: List[str] = spec.get("fields", [])
                sep = spec.get("sep", " | ")
                series_list: List[pd.Series] = []
                for col in fields:
                    series_list.append(df[col].astype(str).fillna("") if col in df.columns else pd.Series([""]*len(df), index=df.index))
                if not series_list:
                    df[new_col] = "Unknown"
                else:
                    joined = series_list[0]
                    for s in series_list[1:]:
                        joined = joined.astype(str) + sep + s.astype(str)
                    df[new_col] = joined.apply(lambda x: x if x.replace(sep, "").strip() else "Unknown")

            elif kind == "bucket":
                src = spec.get("from")
                bins: List[float] = spec.get("bins", [])
                labels: List[str] = spec.get("labels", [])
                if src not in df.columns or not bins:
                    df[new_col] = "Unknown"
                else:
                    vals = df[src].map(_safe_float)
                    try:
                        binned = pd.cut(vals, bins=bins, labels=labels if labels else None, include_lowest=True)
                        df[new_col] = binned.astype(str).replace({"nan": "Unknown"})
                    except Exception:
                        df[new_col] = "Unknown"

            elif kind == "map":
                src = spec.get("from")
                mp: Dict[str, str] = spec.get("map", {})
                default = spec.get("default", "Other")
                if src in df.columns:
                    df[new_col] = df[src].astype(str).map(lambda v: mp.get(v, default) if v.strip() else "Unknown")
                else:
                    df[new_col] = "Unknown"
            else:
                df[new_col] = "Unknown"
        except Exception as e:
            print(f"[WARN] COLOR_BY_FEATURES 생성 실패: {new_col} → {e}")
            df[new_col] = "Unknown"
    return df

def align_metadata_to_labels(
    df_meta: pd.DataFrame,
    labels: List[str],
    keep_cols: List[str],
    extra_cols: Optional[List[str]] = None
) -> pd.DataFrame:
    base = [c for c in keep_cols if c != "ITEM_CD"]
    extras = [c for c in (extra_cols or []) if c not in base and c != "ITEM_CD"]
    desired = ["ITEM_CD"] + base + extras

    available = ["ITEM_CD"] + [c for c in desired[1:] if c in df_meta.columns]
    if "PART_TYPE" not in available:
        print(f"[WARN] PART_TYPE가 df_meta.columns에 없습니다. available={available[:15]}...")
    meta_idx = df_meta.set_index("ITEM_CD")

    rows = []
    missing = 0
    for code in labels:
        if code in meta_idx.index:
            row = meta_idx.loc[code]
            rows.append([code] + [str(row.get(c, "")) for c in available[1:]])
        else:
            rows.append([code] + [""] * (len(available) - 1))
            missing += 1
    if missing:
        print(f"[WARN] 메타데이터에서 찾지 못한 ITEM_CD: {missing}건")

    df_aligned = pd.DataFrame(rows, columns=available)
    df_aligned = df_aligned.applymap(lambda x: str(x).replace("\t"," ").replace("\r"," ").replace("\n"," ").strip())
    return df_aligned

def add_color_key_column(df: pd.DataFrame,
                         fields: List[str],
                         new_col: str = "COLOR_KEY",
                         sep: str = " | ") -> pd.DataFrame:
    if not fields:
        return df
    series_list: List[pd.Series] = []
    for col in fields:
        series_list.append(df[col].astype(str).fillna("") if col in df.columns \
            else pd.Series([""]*len(df), index=df.index))
    joined = series_list[0]
    for s in series_list[1:]:
        joined = joined.astype(str) + sep + s.astype(str)
    df[new_col] = joined.apply(lambda x: x if x.replace(sep, "").strip() else "Unknown")
    return df

# ===== Export & Verify =====
def export_tensorboard_projector(
    vectors: np.ndarray, labels: List[str], out_dir: Path, metadata_df: Optional[pd.DataFrame] = None
):
    ensure_dir(out_dir)
    for file in out_dir.glob('*'):
        if file.is_file():
            file.unlink()

    print(f"[INFO] Exporting {len(labels)} embeddings with {vectors.shape[1]} dimensions")

    vectors = np.asarray(vectors, dtype=np.float32)
    tensor_path = out_dir / "vectors.tsv"
    np.savetxt(tensor_path, vectors, delimiter="\t", fmt="%.6f")
    print(f"[INFO] Saved embedding matrix: {tensor_path}")

    metadata_path = out_dir / "metadata.tsv"
    if metadata_df is None:
        with open(metadata_path, "w", encoding="utf-8") as handle:
            handle.write("ITEM_CD\n")
            for label in labels:
                handle.write(f"{label}\n")
        print(f"[INFO] Saved simple metadata (ITEM_CD only): {metadata_path}")
    else:
        metadata_df.to_csv(metadata_path, sep="\t", index=False, encoding="utf-8")
        print(f"[INFO] Saved detailed metadata: {metadata_path}")

    config = projector.ProjectorConfig()
    embedding_config = config.embeddings.add()
    embedding_config.tensor_path = tensor_path.name
    embedding_config.metadata_path = metadata_path.name
    embedding_config.tensor_name = TENSOR_NAME

    config_path = out_dir / "projector_config.pbtxt"
    with open(config_path, "w", encoding="utf-8") as handle:
        handle.write(str(config))
    print(f"[INFO] Saved projector config: {config_path}")

    print(f"[OK] Projector export complete: {out_dir}")

def export_for_tensorboard_projector(
    *,
    vectors: np.ndarray,
    item_codes: Iterable[str],
    log_dir: str,
    metadata_df: Optional[pd.DataFrame] = None,
    metadata_cols: Optional[List[str]] = None,
) -> Path:
    """Compatibility wrapper used by training pipeline to export projector assets."""
    labels = list(item_codes)
    if len(labels) == 0:
        raise ValueError("item_codes must contain at least one entry.")

    if vectors.shape[0] != len(labels):
        raise ValueError(f"Vector count ({vectors.shape[0]}) does not match item_codes count ({len(labels)}).")

    out_dir = Path(log_dir).expanduser().resolve()

    prepared_metadata: Optional[pd.DataFrame] = None
    if metadata_df is not None:
        df_meta = metadata_df.copy()
        df_meta = standardize_alias_columns(df_meta)
        df_meta = ensure_part_type(df_meta)
        df_meta = apply_color_by_features(df_meta, COLOR_BY_FEATURES)
        extra_color_cols = [c for c in COLOR_BY_FEATURES.keys() if c != "ITEM_CD"]

        if ADD_COLOR_KEY:
            df_meta = add_color_key_column(df_meta, COLOR_FIELDS, new_col="COLOR_KEY")
            if "COLOR_KEY" not in extra_color_cols:
                extra_color_cols.append("COLOR_KEY")

        requested_cols = metadata_cols or KEEP_COLS
        if "ITEM_CD" not in requested_cols:
            requested_cols = ["ITEM_CD"] + [col for col in requested_cols if col != "ITEM_CD"]

        prepared_metadata = align_metadata_to_labels(
            df_meta,
            labels,
            requested_cols,
            extra_cols=extra_color_cols,
        )

    export_tensorboard_projector(
        np.asarray(vectors, dtype=np.float32),
        labels,
        out_dir,
        metadata_df=prepared_metadata,
    )
    verify_export(out_dir)
    return out_dir


def verify_export(out_dir: Path):
    required_files = ["metadata.tsv", "projector_config.pbtxt"]
    checkpoint_files = list(out_dir.glob("model.ckpt*"))

    print(f"\n[VERIFY] Checking export in {out_dir}")
    for file in required_files:
        file_path = out_dir / file
        status = "OK" if file_path.exists() else "MISSING"
        print(f"  - {file}: {status}")
    if checkpoint_files:
        print(f"  - Checkpoint files: {[f.name for f in checkpoint_files]}")
    else:
        print("  - No checkpoint files found (not required for TSV-based export).")

    metadata_path = out_dir / "metadata.tsv"
    if metadata_path.exists():
        try:
            df = pd.read_csv(metadata_path, sep="\t", dtype=str).fillna("")
            print(f"  - Metadata shape: {df.shape}, columns: {list(df.columns)}")
            if "PART_TYPE" in df.columns:
                print(f"  - PART_TYPE nunique: {df['PART_TYPE'].nunique(dropna=False)}; sample={df['PART_TYPE'].head(3).tolist()}")
            else:
                print("  - PART_TYPE column missing in metadata.tsv")
        except Exception as e:
            print(f"  - Error reading metadata: {e}")

# ===== 메인 =====
def main() -> None:
    global MODEL_DIR, OUT_DIR, META_PATH, SAMPLE_EVERY, MAX_ROWS  # noqa: PLW0603

    args = parse_args()
    MODEL_DIR = args.model_dir.expanduser().resolve()
    OUT_DIR = (args.out_dir or (MODEL_DIR / "tb_projector")).expanduser().resolve()
    META_PATH = args.meta_path.expanduser().resolve() if args.meta_path else (MODEL_DIR / "item_master.tsv")
    SAMPLE_EVERY = max(1, int(args.sample_every))
    MAX_ROWS = args.max_rows

    print(f"[INFO] Loading searcher from: {MODEL_DIR}")
    searcher = load_searcher(MODEL_DIR)

    print("[INFO] Extracting vectors + labels …")
    vectors, labels = extract_vectors_and_labels(searcher)
    print(f"[INFO] vectors shape: {vectors.shape}, labels: {len(labels)}")

    if len(vectors) == 0 or len(labels) == 0:
        raise RuntimeError("벡터나 라벨이 비어있습니다!")
    if len(vectors) != len(labels):
        raise RuntimeError(f"벡터 수({len(vectors)})와 라벨 수({len(labels)})가 일치하지 않습니다!")

    vectors, labels = maybe_downsample(vectors, labels)

    metadata_df = None
    extra_color_cols: List[str] = []
    if META_PATH.exists():
        try:
            full_meta = load_item_metadata_tsv(META_PATH)
            full_meta = standardize_alias_columns(full_meta)
            full_meta = ensure_part_type(full_meta)

            # 선언적 Color-by 파생 컬럼
            full_meta = apply_color_by_features(full_meta, COLOR_BY_FEATURES)
            extra_color_cols = [c for c in COLOR_BY_FEATURES.keys() if c != "ITEM_CD"]

            # 라벨 순서 정렬 + 필요한 컬럼만 포함
            metadata_df = align_metadata_to_labels(full_meta, labels, KEEP_COLS, extra_cols=extra_color_cols)

            # COLOR_KEY 옵션
            if ADD_COLOR_KEY and metadata_df is not None:
                metadata_df = add_color_key_column(metadata_df, COLOR_FIELDS, new_col="COLOR_KEY")
                if "COLOR_KEY" not in extra_color_cols:
                    extra_color_cols.append("COLOR_KEY")

            # 최종 점검
            if "PART_TYPE" not in metadata_df.columns:
                print("[ERROR] 최종 metadata_df에 PART_TYPE가 없습니다. alias/입력 데이터 확인이 필요합니다.")
            else:
                nunique = metadata_df["PART_TYPE"].nunique(dropna=False)
                print(f"[INFO] (final) PART_TYPE nunique: {nunique}")
                if nunique <= 1:
                    print("[WARN] (final) PART_TYPE가 한 가지 값만 존재합니다. 드롭다운에 나타나지 않을 수 있습니다.")

        except Exception as e:
            print(f"[WARN] 메타데이터 로딩/가공 실패 → 라벨만 사용합니다: {e}")
            metadata_df = None
    else:
        print(f"[WARN] 메타데이터 파일이 없어 라벨(ITEM_CD)만 기록합니다: {META_PATH}")

    print(f"[INFO] Exporting TensorBoard Projector logs → {OUT_DIR}")
    export_tensorboard_projector(vectors, labels, OUT_DIR, metadata_df)
    verify_export(OUT_DIR)

    print("\n[OK] Done. Now run:")
    print(f'  tensorboard --logdir "{OUT_DIR}"')
    print("  Open http://localhost:6006 → PROJECTOR tab")

if __name__ == "__main__":
    main()
