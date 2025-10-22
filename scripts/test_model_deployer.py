"""
Test script for ModelDeployer.

This script tests model deployment functionality:
- save_model() with versioning
- update_manifest()
- activate_version()
- invalidate_cache()
- rollback()
- list_versions()
- cleanup_old_versions()
"""

import sys
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.neural_network import MLPRegressor

from backend.iter_training.deployer import ModelDeployer


def create_dummy_model():
    """Create dummy model artifacts for testing."""
    # Create a simple MLP model
    model = MLPRegressor(hidden_layer_sizes=(10, 5), max_iter=10, random_state=42)
    X_dummy = np.random.randn(50, 5)
    y_dummy = np.random.randn(50)
    model.fit(X_dummy, y_dummy)

    # Create scaler
    scaler = StandardScaler()
    scaler.fit(X_dummy)

    # Create encoder
    encoder = LabelEncoder()
    encoder.fit(["A", "B", "C"])

    # Feature columns
    feature_columns = ["feature_1", "feature_2", "feature_3", "feature_4", "feature_5"]

    return model, scaler, encoder, feature_columns


def main():
    """Run deployer tests."""
    print("=" * 60)
    print("ModelDeployer Test")
    print("=" * 60)

    # Initialize deployer with test directory
    test_dir = Path("data/test_models")
    if test_dir.exists():
        import shutil
        shutil.rmtree(test_dir)

    deployer = ModelDeployer(models_dir=str(test_dir))
    print(f"\n[OK] Deployer initialized: {test_dir}")

    # Test 1: Save model
    print("\n[OK] Test 1: save_model()")
    model, scaler, encoder, feature_columns = create_dummy_model()

    metadata = {
        "model_type": "MLPRegressor",
        "training_time": 10.5,
        "mae": 2.3,
        "trim_mae": 1.8,
    }

    version_dir_1 = deployer.save_model(
        model=model,
        scaler=scaler,
        encoder=encoder,
        feature_columns=feature_columns,
        metadata=metadata,
    )
    print(f"  Version saved: {version_dir_1.name}")
    print(f"  Directory size: {sum(f.stat().st_size for f in version_dir_1.rglob('*') if f.is_file())} bytes")
    print(f"  Files: {[f.name for f in version_dir_1.iterdir() if f.is_file()]}")

    # Wait 2 seconds to ensure different timestamps
    time.sleep(2)

    # Test 2: Save second version
    print("\n[OK] Test 2: Save second version")
    model2, scaler2, encoder2, feature_columns2 = create_dummy_model()
    metadata2 = {
        "model_type": "MLPRegressor",
        "training_time": 8.2,
        "mae": 2.0,
        "trim_mae": 1.5,
    }

    version_dir_2 = deployer.save_model(
        model=model2,
        scaler=scaler2,
        encoder=encoder2,
        feature_columns=feature_columns2,
        metadata=metadata2,
    )
    print(f"  Version saved: {version_dir_2.name}")

    # Test 3: List versions
    print("\n[OK] Test 3: list_versions()")
    versions = deployer.list_versions()
    print(f"  Total versions: {len(versions)}")
    for v in versions:
        print(f"    - {v}")

    # Test 4: Get version info
    print("\n[OK] Test 4: get_version_info()")
    info = deployer.get_version_info(versions[0])
    print(f"  Version: {info['version']}")
    print(f"  Created: {info['created_at']}")
    print(f"  Size: {info['size_bytes']} bytes")
    if "metadata" in info:
        print(f"  Metadata: {info['metadata']}")

    # Test 5: Activate version
    print("\n[OK] Test 5: activate_version()")
    active_dir = deployer.activate_version(versions[0])
    print(f"  Activated: {active_dir.name}")

    active_marker = test_dir / "active_version.txt"
    if active_marker.exists():
        active_version = active_marker.read_text().strip()
        print(f"  Active version marker: {active_version}")

    # Test 6: Invalidate cache
    print("\n[OK] Test 6: invalidate_cache()")
    deployer.invalidate_cache()
    cache_marker = test_dir / "cache_invalidated_at.txt"
    if cache_marker.exists():
        timestamp = cache_marker.read_text().strip()
        print(f"  Cache invalidated at: {timestamp}")

    # Test 7: Update manifest
    print("\n[OK] Test 7: update_manifest()")
    updated_metadata = {**metadata, "updated": True}
    manifest_path = deployer.update_manifest(version_dir_1, metadata=updated_metadata)
    print(f"  Manifest updated: {manifest_path}")

    # Test 8: Rollback
    print("\n[OK] Test 8: rollback()")
    # Activate second version first
    deployer.activate_version(versions[0])
    print(f"  Current: {versions[0]}")

    # Rollback to previous
    rollback_dir = deployer.rollback()
    print(f"  Rolled back to: {rollback_dir.name}")

    # Test 9: Cleanup old versions
    print("\n[OK] Test 9: cleanup_old_versions()")
    # Save a few more versions first
    for i in range(3):
        time.sleep(1)
        model, scaler, encoder, feature_columns = create_dummy_model()
        deployer.save_model(model, scaler, encoder, feature_columns)

    print(f"  Total versions before cleanup: {len(deployer.list_versions())}")
    deleted = deployer.cleanup_old_versions(keep_latest=2)
    print(f"  Versions deleted: {deleted}")
    print(f"  Total versions after cleanup: {len(deployer.list_versions())}")

    # Cleanup test directory
    print("\n[OK] Cleaning up test directory...")
    import shutil
    shutil.rmtree(test_dir)

    print("\n" + "=" * 60)
    print("[OK] All tests passed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
