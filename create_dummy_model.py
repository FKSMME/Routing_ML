#!/usr/bin/env python3
"""
더미 ML 모델 파일 생성 스크립트
모델 훈련 없이 빠르게 서비스를 복구하기 위한 임시 솔루션
"""
import joblib
import numpy as np
from pathlib import Path
from sklearn.preprocessing import StandardScaler
import json

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
        # 간단한 해시 기반 인코딩
        return np.zeros((len(X) if hasattr(X, '__len__') else 1, 37))

    def fit(self, X, y=None):
        return self

encoder = DummyEncoder()
joblib.dump(encoder, MODEL_DIR / "encoder.joblib")
print("✓ Created encoder.joblib")

# 2. Scaler (StandardScaler)
scaler = StandardScaler()
# 37차원 더미 데이터로 fit
scaler.mean_ = np.zeros(37)
scaler.scale_ = np.ones(37)
scaler.var_ = np.ones(37)
scaler.n_features_in_ = 37
scaler.n_samples_seen_ = 1000
joblib.dump(scaler, MODEL_DIR / "scaler.joblib")
print("✓ Created scaler.joblib")

# 3. Feature columns (피처 컬럼 정보)
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
joblib.dump(feature_columns, MODEL_DIR / "feature_columns.joblib")
print("✓ Created feature_columns.joblib")

# 4. Similarity Engine (더미 검색 엔진)
class DummySimilarityEngine:
    """더미 유사도 검색 엔진"""
    def __init__(self):
        self.index_built = True
        self.item_codes = [
            "ITEM-001", "ITEM-002", "ITEM-003",
            "DUMMY-PART-1", "DUMMY-PART-2"
        ]
        self.vectors = np.random.randn(5, 37)

    def search(self, query_vector, k=10, threshold=0.0):
        """더미 검색 결과 반환"""
        # 간단한 더미 결과
        results = []
        for i, code in enumerate(self.item_codes):
            results.append({
                "item_code": code,
                "similarity": 0.95 - (i * 0.05),
                "distance": 0.05 + (i * 0.05),
                "vector": self.vectors[i].tolist() if i < len(self.vectors) else []
            })
        return results[:k]

    def build_index(self, vectors, item_codes):
        self.vectors = vectors
        self.item_codes = item_codes
        return self

similarity_engine = DummySimilarityEngine()
joblib.dump(similarity_engine, MODEL_DIR / "similarity_engine.joblib")
print("✓ Created similarity_engine.joblib")

# 5. Manifest 파일 생성
manifest = {
    "schema_version": "routing-ml/manifest@1",
    "generated_at": "2025-10-03T12:00:00Z",
    "hash_algorithm": "sha256",
    "artifacts": {
        "similarity_engine": {
            "path": "similarity_engine.joblib",
            "sha256": "dummy_hash_for_testing",
            "schema_version": "routing-ml/searcher@1"
        },
        "encoder": {
            "path": "encoder.joblib",
            "sha256": "dummy_hash_for_testing",
            "schema_version": "routing-ml/encoder@1"
        },
        "scaler": {
            "path": "scaler.joblib",
            "sha256": "dummy_hash_for_testing",
            "schema_version": "routing-ml/scaler@1"
        },
        "feature_columns": {
            "path": "feature_columns.joblib",
            "sha256": "dummy_hash_for_testing",
            "schema_version": "routing-ml/feature-columns@1"
        }
    },
    "metadata": {
        "model_version": "dummy-0.1.0",
        "channel": "emergency-recovery",
        "sql_profile_schema_versions": ["routing-ml/sql-profile@1"]
    }
}

with open(MODEL_DIR / "manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)
print("✓ Created manifest.json")

print("\n" + "="*60)
print("✅ All dummy model files created successfully!")
print("="*60)
print(f"\nLocation: {MODEL_DIR.absolute()}")
print("\nFiles created:")
for file in MODEL_DIR.glob("*"):
    print(f"  - {file.name}")
print("\n⚠️  WARNING: These are DUMMY files for testing only!")
print("   Real predictions will return mock data.")
print("   Train a real model for production use.")
