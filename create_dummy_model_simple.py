#!/usr/bin/env python3
"""
더미 ML 모델 파일 생성 스크립트 (간단 버전 - pickle 사용)
"""
import pickle
import json
from pathlib import Path

from backend.dummy_models import DummyEncoder, DummyScaler, DummySimilarityEngine

# 모델 디렉토리
MODEL_DIR = Path("models/default")
MODEL_DIR.mkdir(parents=True, exist_ok=True)

print(f"Creating dummy model files in {MODEL_DIR}...")

encoder = DummyEncoder()
with open(MODEL_DIR / "encoder.joblib", "wb") as f:
    pickle.dump(encoder, f)
print("[OK] Created encoder.joblib")

# 2. Scaler (StandardScaler)
scaler = DummyScaler()
with open(MODEL_DIR / "scaler.joblib", "wb") as f:
    pickle.dump(scaler, f)
print("[OK] Created scaler.joblib")

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
print("[OK] Created feature_columns.joblib")

# 4. Similarity Engine
similarity_engine = DummySimilarityEngine()
with open(MODEL_DIR / "similarity_engine.joblib", "wb") as f:
    pickle.dump(similarity_engine, f)
print("[OK] Created similarity_engine.joblib")

# 5. Manifest 파일
manifest = {
    "schema_version": "routing-ml/manifest@1",
    "generated_at": "2025-10-03T12:00:00Z",
    "hash_algorithm": "sha256",
    "artifacts": {
        "similarity_engine": {
            "path": "similarity_engine.joblib",
            "sha256": "dummy_emergency_recovery",
            "schema_version": "routing-ml/searcher@1"
        },
        "encoder": {
            "path": "encoder.joblib",
            "sha256": "dummy_emergency_recovery",
            "schema_version": "routing-ml/encoder@1"
        },
        "scaler": {
            "path": "scaler.joblib",
            "sha256": "dummy_emergency_recovery",
            "schema_version": "routing-ml/scaler@1"
        },
        "feature_columns": {
            "path": "feature_columns.joblib",
            "sha256": "dummy_emergency_recovery",
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
print("[OK] Created manifest.json")

print("\n" + "="*60)
print("[SUCCESS] All dummy model files created successfully!")
print("="*60)
print(f"\nLocation: {MODEL_DIR.absolute()}")
print("\nFiles created:")
for file in sorted(MODEL_DIR.glob("*")):
    if file.is_file():
        size = file.stat().st_size
        print(f"  - {file.name:30s} ({size:,} bytes)")
print("\n[WARNING] These are DUMMY files for testing only!")
print("          Predictions will return mock results.")
print("          Train a real model with actual data for production use.")
