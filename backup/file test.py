# inspect_saved_model.py  ── 터미널/Anaconda Prompt에서 실행
from pathlib import Path
import joblib, numpy as np, pandas as pd

MODEL_DIR = Path(r"D:\routing\machine\models")      # ↔ 저장 위치

# ───────────────────────────────────────────────
# 1) similarity_engine.joblib  ─ 검색 인덱스
# ───────────────────────────────────────────────
searcher = joblib.load(MODEL_DIR / "similarity_engine.joblib")

print("\n▶ similarity_engine")
print("  type          :", type(searcher).__name__)
if hasattr(searcher, "item_codes"):                   # Numpy 탐색기
    print("  #vectors      :", len(searcher.item_codes))
    first = searcher.item_codes[:5]
    print("  first 5 codes :", first)
    # 벡터 차원 알아내기
    try:
        dim = searcher.vectors.shape[1]
    except AttributeError:                            # HNSW(faiss) 인덱스
        dim = searcher.index.d
    print("  vector dim    :", dim)

# ───────────────────────────────────────────────
# 2) encoder.joblib  (OrdinalEncoder)
# ───────────────────────────────────────────────
encoder = joblib.load(MODEL_DIR / "encoder.joblib")
print("\n▶ encoder")
print("  type          :", type(encoder).__name__)
print("  #categories   :", len(encoder.categories_))

# ───────────────────────────────────────────────
# 3) scaler.joblib   (StandardScaler)
# ───────────────────────────────────────────────
scaler = joblib.load(MODEL_DIR / "scaler.joblib")
print("\n▶ scaler")
print("  type          :", type(scaler).__name__)
print("  #features     :", scaler.mean_.shape[0])

# ───────────────────────────────────────────────
# 4) feature_columns.joblib  (list[str])
# ───────────────────────────────────────────────
feat_cols: list[str] = joblib.load(MODEL_DIR / "feature_columns.joblib")
print("\n▶ feature_columns")
print("  length        :", len(feat_cols))
print("  first 10      :", feat_cols[:10])

# ───────────────────────────────────────────────
# (선택) 벡터 1개 확인
# ───────────────────────────────────────────────
if hasattr(searcher, "item_codes"):
    code0 = searcher.item_codes[0]
    # HNSWSearch: 벡터를 따로 보관하지 않으므로 아래는 EfficientSimilaritySearch 전용
    if hasattr(searcher, "vectors"):
        vec0 = searcher.vectors[0]
        np.set_printoptions(precision=4, suppress=True)
        print(f"\n▶ example vector for {code0}\n", vec0[:20], "...")
