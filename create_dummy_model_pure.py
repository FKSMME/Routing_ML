#!/usr/bin/env python3
"""
더미 ML 모델 파일 생성 스크립트 (순수 Python, 의존성 없음)
"""
import pickle
import json
import random
from pathlib import Path

# 모델 디렉토리
MODEL_DIR = Path("models/default")
MODEL_DIR.mkdir(parents=True, exist_ok=True)

print(f"Creating dummy model files in {MODEL_DIR}...")

# 1. Encoder (더미 카테고리 인코더)
class DummyEncoder:
    """더미 카테고리 인코더"""
    def __init__(self):
        self.categories_ = {}
        self.feature_names_ = []

    def transform(self, X):
        # 37차원 제로 벡터 반환
        if hasattr(X, '__len__'):
            return [[0.0] * 37 for _ in range(len(X))]
        return [[0.0] * 37]

    def fit(self, X, y=None):
        return self

encoder = DummyEncoder()
with open(MODEL_DIR / "encoder.joblib", "wb") as f:
    pickle.dump(encoder, f)
print("✓ Created encoder.joblib")

# 2. Scaler (StandardScaler 더미)
class DummyScaler:
    """더미 scaler"""
    def __init__(self):
        self.mean_ = [0.0] * 37
        self.scale_ = [1.0] * 37
        self.var_ = [1.0] * 37
        self.n_features_in_ = 37
        self.n_samples_seen_ = 1000

    def transform(self, X):
        return X

    def fit(self, X, y=None):
        return self

scaler = DummyScaler()
with open(MODEL_DIR / "scaler.joblib", "wb") as f:
    pickle.dump(scaler, f)
print("✓ Created scaler.joblib")

# 3. Feature columns
feature_columns = [
    "ITEM_TYPE", "PART_TYPE", "SealTypeGrup", "RAW_MATL_KIND",
    "ITEM_MATERIAL", "OUTDIAMETER", "INDIAMETER", "OUTTHICKNESS",
    "IN_SEALTYPE_CD", "OUT_SEALTYPE_CD", "MID_SEALTYPE_CD",
    "GROUP1", "GROUP2", "ITEM_GRP1", "STANDARD_YN",
    "ROTATE_CLOCKWISE", "ROTATE_CTRCLOCKWISE",
    "IN_SEALSIZE", "OUT_SEALSIZE", "MID_SEALSIZE",
    "ITEM_SPEC", "GROUP3", "OUTDIAMETER_UNIT", "DRAW_NO",
    "DRAW_REV", "MATERIAL_DESC", "RAW_MATL_KINDNM",
    "ITEM_GRP1NM", "IN_SEALSIZE_UOM", "OUT_SEALSIZE_UOM",
    "MID_SEALSIZE_UOM", "ITEM_UNIT", "ITEM_ACCT",
    "ITEM_CD", "ITEM_NM", "PartNm", "DRAW_SHEET_NO"
]
with open(MODEL_DIR / "feature_columns.joblib", "wb") as f:
    pickle.dump(feature_columns, f)
print("✓ Created feature_columns.joblib")

# 4. Similarity Engine
class DummySimilarityEngine:
    """더미 유사도 검색 엔진"""
    def __init__(self):
        self.index_built = True
        self.item_codes = [
            "DUMMY-SEAL-001", "DUMMY-SEAL-002", "DUMMY-SEAL-003",
            "DUMMY-GASKET-001", "DUMMY-GASKET-002",
            "DUMMY-O-RING-001", "DUMMY-O-RING-002",
            "DUMMY-PART-001", "DUMMY-PART-002", "DUMMY-PART-003"
        ]
        # 37차원 랜덤 벡터들
        random.seed(42)
        self.vectors = [[random.gauss(0, 0.2) for _ in range(37)]
                       for _ in range(len(self.item_codes))]

    def search(self, query_vector, k=10, threshold=0.0):
        """더미 검색 결과 반환"""
        results = []
        for i, code in enumerate(self.item_codes[:k]):
            results.append({
                "item_code": code,
                "similarity": max(0.5, 0.95 - (i * 0.05)),
                "distance": min(0.5, 0.05 + (i * 0.05))
            })
        return results

similarity_engine = DummySimilarityEngine()
with open(MODEL_DIR / "similarity_engine.joblib", "wb") as f:
    pickle.dump(similarity_engine, f)
print("✓ Created similarity_engine.joblib")

# 5. Manifest 파일
manifest = {
    "schema_version": "routing-ml/manifest@1",
    "generated_at": "2025-10-03T12:05:00Z",
    "hash_algorithm": "sha256",
    "artifacts": {
        "similarity_engine": {
            "path": "similarity_engine.joblib",
            "sha256": "dummy_emergency_recovery_20251003",
            "schema_version": "routing-ml/searcher@1"
        },
        "encoder": {
            "path": "encoder.joblib",
            "sha256": "dummy_emergency_recovery_20251003",
            "schema_version": "routing-ml/encoder@1"
        },
        "scaler": {
            "path": "scaler.joblib",
            "sha256": "dummy_emergency_recovery_20251003",
            "schema_version": "routing-ml/scaler@1"
        },
        "feature_columns": {
            "path": "feature_columns.joblib",
            "sha256": "dummy_emergency_recovery_20251003",
            "schema_version": "routing-ml/feature-columns@1"
        }
    },
    "metadata": {
        "model_version": "dummy-0.1.0",
        "channel": "emergency-recovery",
        "description": "Dummy model files for emergency service recovery",
        "sql_profile_schema_versions": ["routing-ml/sql-profile@1"]
    }
}

with open(MODEL_DIR / "manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)
print("✓ Created manifest.json")

print("\n" + "="*60)
print("✅ ALL DUMMY MODEL FILES CREATED SUCCESSFULLY!")
print("="*60)
print(f"\nLocation: {MODEL_DIR.absolute()}")
print("\nFiles created:")
for file in sorted(MODEL_DIR.glob("*.joblib")) + sorted(MODEL_DIR.glob("manifest.json")):
    if file.is_file():
        size = file.stat().st_size
        print(f"  - {file.name:30s} ({size:,} bytes)")

print("\n" + "="*60)
print("⚠️  IMPORTANT WARNING")
print("="*60)
print("These are DUMMY/MOCK model files for testing only!")
print("Predictions will return fake results.")
print("\nNext steps:")
print("1. Restart backend server to reload models")
print("2. Test /api/predict endpoint")
print("3. Train real model with actual data for production")
print("="*60)
