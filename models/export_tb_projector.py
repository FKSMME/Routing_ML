# -*- coding: utf-8 -*-
# export_tb_projector.py

import sys
from pathlib import Path
from typing import Tuple, List, Optional, Dict, Any
import os

# backend 경로 (joblib 역직렬화용)
sys.path.insert(0, r"D:\routing\machine")

import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorboard.plugins import projector

# ===== 사용자 옵션 =====
MODEL_DIR     = Path(r"D:\routing\machine\models")
OUT_DIR       = MODEL_DIR / "tb_projector"
TENSOR_NAME   = "item_embeddings"
SAMPLE_EVERY  = 1

META_PATH     = MODEL_DIR / "item_master.tsv"

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
def ensure_dir(p: Path) -> Path:
    p.mkdir(parents=True, exist_ok=True)
    return p

def load_searcher(model_dir: Path):
    return joblib.load(model_dir / "similarity_engine.joblib")

def extract_vectors_and_labels(searcher) -> Tuple[np.ndarray, List[str]]:
    item_codes = list(getattr(searcher, "item_codes", []))
    if not item_codes:
        raise RuntimeError("item_codes를 찾을 수 없습니다. HNSWSearch가 item_codes를 보유해야 합니다.")
    vecs = getattr(searcher, "vectors", None)
    if isinstance(vecs, np.ndarray) and vecs.ndim == 2:
        return vecs.astype(np.float32, copy=False), item_codes

    faiss_index = getattr(searcher, "index", None)
    if faiss_index is None or not hasattr(faiss_index, "reconstruct"):
        raise RuntimeError("FAISS index가 없거나 reconstruct를 지원하지 않습니다.")
    ntotal = int(getattr(faiss_index, "ntotal", 0))
    dim = int(getattr(faiss_index, "d", 0))
    if ntotal <= 0 or dim <= 0:
        raise RuntimeError("FAISS index 정보가 올바르지 않습니다.")
    if ntotal != len(item_codes):
        print(f"[WARN] ntotal({ntotal}) != len(item_codes)({len(item_codes)}). 최소 길이에 맞춰 복원합니다.")

    n = min(ntotal, len(item_codes))
    X = np.empty((n, dim), dtype=np.float32)
    for i in range(n):
        X[i] = faiss_index.reconstruct(i)
        if (i + 1) % 10000 == 0:
            print(f"  reconstructed {i+1}/{n}")
    return X, item_codes[:n]

def maybe_downsample(vectors: np.ndarray, labels: List[str]) -> Tuple[np.ndarray, List[str]]:
    if SAMPLE_EVERY <= 1:
        return vectors, labels
    vectors = vectors[::SAMPLE_EVERY]
    labels  = labels[::SAMPLE_EVERY]
    print(f"[INFO] downsampled → vectors: {vectors.shape}, labels: {len(labels)}")
    return vectors, labels

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
    for file in out_dir.glob("*"):
        if file.is_file():
            file.unlink()

    print(f"[INFO] Exporting {len(labels)} embeddings with {vectors.shape[1]} dimensions")

    metadata_path = out_dir / "metadata.tsv"
    if metadata_df is None:
        with open(metadata_path, 'w', encoding='utf-8') as f:
            f.write("ITEM_CD\n")
            for label in labels:
                f.write(f"{label}\n")
        print(f"[INFO] Saved simple metadata (1 column): {metadata_path}")
    else:
        print(f"[INFO] metadata columns(final): {list(metadata_df.columns)}")
        if "PART_TYPE" not in metadata_df.columns:
            print("[WARN] metadata.tsv에 PART_TYPE가 포함되지 않습니다!")
        else:
            nunique = metadata_df["PART_TYPE"].nunique(dropna=False)
            print(f"[INFO] PART_TYPE nunique: {nunique}")
            if nunique <= 1:
                print("[WARN] PART_TYPE가 한 가지 값만 존재(예: 모두 Unknown). Projector 드롭다운에 숨겨질 수 있습니다.")
        metadata_df.to_csv(metadata_path, sep="\t", index=False, encoding="utf-8")
        print(f"[INFO] Saved detailed metadata: {metadata_path}")

    import tensorflow.compat.v1 as tf_v1
    tf_v1.disable_v2_behavior()
    tf_v1.reset_default_graph()

    with tf_v1.Session() as sess:
        embedding = tf_v1.get_variable(
            name=TENSOR_NAME,
            shape=vectors.shape,
            dtype=tf.float32,
            initializer=tf_v1.constant_initializer(vectors),
            trainable=False
        )
        sess.run(tf_v1.global_variables_initializer())
        saver = tf_v1.train.Saver([embedding])
        checkpoint_path = out_dir / "model.ckpt"
        saver.save(sess, str(checkpoint_path))

    config = projector.ProjectorConfig()
    embedding_config = config.embeddings.add()
    embedding_config.tensor_name = TENSOR_NAME
    embedding_config.metadata_path = "metadata.tsv"

    config_path = out_dir / "projector_config.pbtxt"
    with open(config_path, 'w', encoding='utf-8') as f:
        f.write(str(config))

    writer = tf_v1.summary.FileWriter(str(out_dir))
    writer.add_graph(tf_v1.get_default_graph())
    writer.close()

    print(f"[OK] Projector export complete: {out_dir}")

def verify_export(out_dir: Path):
    required_files = ["metadata.tsv", "projector_config.pbtxt"]
    checkpoint_files = list(out_dir.glob("model.ckpt*"))

    print(f"\n[VERIFY] Checking export in {out_dir}")
    for file in required_files:
        file_path = out_dir / file
        print(("  ✓ " if file_path.exists() else "  ✗ ") + f"{file} ({'exists' if file_path.exists() else 'missing'})")
    if checkpoint_files:
        print(f"  ✓ Checkpoint files: {[f.name for f in checkpoint_files]}")
    else:
        print("  ✗ No checkpoint files found!")

    metadata_path = out_dir / "metadata.tsv"
    if metadata_path.exists():
        try:
            df = pd.read_csv(metadata_path, sep="\t", dtype=str).fillna("")
            print(f"  ✓ Metadata shape: {df.shape}, columns: {list(df.columns)}")
            if "PART_TYPE" in df.columns:
                print(f"  ✓ PART_TYPE nunique: {df['PART_TYPE'].nunique(dropna=False)}; sample={df['PART_TYPE'].head(3).tolist()}")
            else:
                print("  ✗ PART_TYPE column missing in metadata.tsv")
        except Exception as e:
            print(f"  ✗ Error reading metadata: {e}")

# ===== 메인 =====
def main():
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
