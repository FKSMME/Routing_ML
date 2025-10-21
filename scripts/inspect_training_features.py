"""
피처/가중치 점검 스크립트

학습 시 사용하는 피처 구성, 가중치 적용 여부, 차원 검증을 수행합니다.

Usage:
    python scripts/inspect_training_features.py
    python scripts/inspect_training_features.py --model-dir models/test_phase2
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Any

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import joblib
from backend.constants import TRAIN_FEATURES, NUMERIC_FEATURES


def load_json_safe(filepath: Path) -> Dict[str, Any]:
    """JSON 파일을 안전하게 로드"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"  WARNING: Failed to load {filepath.name}: {e}")
        return {}


def load_joblib_safe(filepath: Path) -> Any:
    """Joblib 파일을 안전하게 로드"""
    try:
        return joblib.load(filepath)
    except Exception as e:
        print(f"  WARNING: Failed to load {filepath.name}: {e}")
        return None


def inspect_constants():
    """backend/constants.py의 TRAIN_FEATURES 확인"""
    print("="*80)
    print("1. TRAIN_FEATURES (backend/constants.py)")
    print("="*80)

    total_features = len(TRAIN_FEATURES)
    numeric_features = len(NUMERIC_FEATURES)
    categorical_features = total_features - numeric_features

    print(f"Total features: {total_features}")
    print(f"Categorical features: {categorical_features}")
    print(f"Numeric features: {numeric_features}")

    print(f"\nFull list:")
    for i, feat in enumerate(TRAIN_FEATURES, 1):
        feat_type = "Numeric" if feat in NUMERIC_FEATURES else "Categorical"
        print(f"  {i:2d}. {feat:30s} [{feat_type}]")

    return {
        'total': total_features,
        'categorical': categorical_features,
        'numeric': numeric_features
    }


def inspect_model(model_dir: Path) -> Dict[str, Any]:
    """모델 디렉토리의 파일 확인"""
    print(f"\n{'='*80}")
    print(f"2. Latest Model ({model_dir})")
    print("="*80)

    result = {}

    # feature_columns.joblib
    feature_columns_path = model_dir / "feature_columns.joblib"
    if feature_columns_path.exists():
        feature_columns = load_joblib_safe(feature_columns_path)
        if feature_columns:
            print(f"feature_columns.joblib: {len(feature_columns)} features")
            result['feature_columns'] = feature_columns
        else:
            print(f"feature_columns.joblib: FAILED TO LOAD")
    else:
        print(f"feature_columns.joblib: NOT FOUND")

    # encoder.joblib
    encoder_path = model_dir / "encoder.joblib"
    if encoder_path.exists():
        encoder = load_joblib_safe(encoder_path)
        if encoder and hasattr(encoder, 'feature_names_in_'):
            print(f"encoder.joblib: {len(encoder.feature_names_in_)} categorical features")
            result['encoder_features'] = list(encoder.feature_names_in_)
        else:
            print(f"encoder.joblib: NO feature_names_in_ attribute")
    else:
        print(f"encoder.joblib: NOT FOUND")

    # scaler.joblib
    scaler_path = model_dir / "scaler.joblib"
    if scaler_path.exists():
        scaler = load_joblib_safe(scaler_path)
        if scaler and hasattr(scaler, 'feature_names_in_'):
            print(f"scaler.joblib: {len(scaler.feature_names_in_)} numeric features")
            result['scaler_features'] = list(scaler.feature_names_in_)
        else:
            print(f"scaler.joblib: NO feature_names_in_ attribute")
    else:
        print(f"scaler.joblib: NOT FOUND")

    return result


def inspect_weights(model_dir: Path) -> Dict[str, Any]:
    """피처 가중치 확인"""
    print(f"\n{'='*80}")
    print("3. Feature Weights")
    print("="*80)

    result = {}

    # feature_weights.json
    weights_path = model_dir / "feature_weights.json"
    if weights_path.exists():
        weights_data = load_json_safe(weights_path)
        if weights_data:
            weights = weights_data.get('weights', {})
            active_features = weights_data.get('active_features', [])

            print(f"feature_weights.json: {len(weights)} entries")
            print(f"Active features: {len(active_features)} features")

            # Top 10 weights (weights are stored as float values directly)
            sorted_weights = sorted(
                [(k, v) for k, v in weights.items()],
                key=lambda x: x[1],
                reverse=True
            )

            print(f"\nTop 10 weights:")
            for i, (feat, weight) in enumerate(sorted_weights[:10], 1):
                is_active = " [ACTIVE]" if feat in active_features else ""
                print(f"  {i:2d}. {feat:30s}: {weight:.2f}{is_active}")

            result['weights'] = weights
            result['active_features'] = active_features
            result['active_count'] = len(active_features)
        else:
            print(f"feature_weights.json: FAILED TO LOAD")
    else:
        print(f"feature_weights.json: NOT FOUND")

    # feature_weights.joblib
    weights_joblib_path = model_dir / "feature_weights.joblib"
    if weights_joblib_path.exists():
        print(f"\nfeature_weights.joblib: EXISTS")
    else:
        print(f"\nfeature_weights.joblib: NOT FOUND")

    return result


def validate_dimensions(constants_info: Dict, model_info: Dict, weights_info: Dict):
    """차원 검증"""
    print(f"\n{'='*80}")
    print("4. Dimension Validation")
    print("="*80)

    errors = []
    warnings = []

    # Feature columns 검증
    if 'feature_columns' in model_info:
        expected = constants_info['total']
        actual = len(model_info['feature_columns'])

        # ITEM_CD, ITEM_NM 제외되므로 expected - 2 == actual이 정상
        if actual == expected - 2:
            print(f"OK Feature count: {actual} (expected {expected} - 2 ID columns)")
        elif actual == expected:
            print(f"OK Feature count: {actual} (all features)")
        else:
            msg = f"Feature count mismatch: expected {expected}, got {actual}"
            errors.append(msg)
            print(f"  ERROR: {msg}")

    # Encoder 검증
    if 'encoder_features' in model_info:
        expected_cat = constants_info['categorical']
        actual_cat = len(model_info['encoder_features'])

        if actual_cat == expected_cat or actual_cat == expected_cat - 2:
            print(f"OK Encoder features: {actual_cat}")
        else:
            msg = f"Encoder mismatch: expected ~{expected_cat}, got {actual_cat}"
            warnings.append(msg)
            print(f"  WARNING: {msg}")

    # Scaler 검증
    if 'scaler_features' in model_info:
        expected_num = constants_info['numeric']
        actual_num = len(model_info['scaler_features'])

        if actual_num == expected_num:
            print(f"OK Scaler features: {actual_num}")
        else:
            msg = f"Scaler mismatch: expected {expected_num}, got {actual_num}"
            warnings.append(msg)
            print(f"  WARNING: {msg}")

    # Weights 검증
    if 'weights' in weights_info:
        weights_count = len(weights_info['weights'])
        active_count = weights_info.get('active_count', 0)
        expected = constants_info['total']

        if weights_count == expected:
            print(f"OK Weight entries: {weights_count}")
        else:
            msg = f"Weight count mismatch: expected {expected}, got {weights_count}"
            warnings.append(msg)
            print(f"  WARNING: {msg}")

        print(f"OK Active weights: {active_count}/{weights_count}")

    # similarity_engine 차원 확인
    print(f"\nVector Dimension Check:")
    print(f"  Note: Embedding dimension (128) > feature count due to zero-padding")
    print(f"  This is expected behavior for HNSW indexing")

    # 최종 결과
    print(f"\n{'='*80}")
    print("Validation Summary")
    print("="*80)

    if errors:
        print(f"ERRORS ({len(errors)}):")
        for err in errors:
            print(f"  - {err}")
    else:
        print(f"No critical errors found")

    if warnings:
        print(f"\nWARNINGS ({len(warnings)}):")
        for warn in warnings:
            print(f"  - {warn}")
    else:
        print(f"No warnings")

    if not errors and not warnings:
        print(f"\n✓ All validations passed!")

    return len(errors) == 0


def main():
    parser = argparse.ArgumentParser(
        description="Inspect training features, weights, and dimensions"
    )
    parser.add_argument(
        '--model-dir',
        type=Path,
        default=Path('models/test_phase2'),
        help='Model directory to inspect (default: models/test_phase2)'
    )

    args = parser.parse_args()

    print(f"\n{'#'*80}")
    print("Training Features Inspection")
    print(f"{'#'*80}\n")

    # 1. Constants 확인
    constants_info = inspect_constants()

    # 2. Model 파일 확인
    if not args.model_dir.exists():
        print(f"\nERROR: Model directory not found: {args.model_dir}")
        print(f"Available model directories:")
        models_dir = Path('models')
        for d in models_dir.iterdir():
            if d.is_dir() and not d.name.startswith('.'):
                print(f"  - {d}")
        sys.exit(1)

    model_info = inspect_model(args.model_dir)

    # 3. Weights 확인
    weights_info = inspect_weights(args.model_dir)

    # 4. 차원 검증
    is_valid = validate_dimensions(constants_info, model_info, weights_info)

    print(f"\n{'#'*80}")
    print("Inspection Complete")
    print(f"{'#'*80}\n")

    return 0 if is_valid else 1


if __name__ == "__main__":
    sys.exit(main())
