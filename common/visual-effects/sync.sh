#!/bin/bash
# Ballpit 동기화 스크립트
# 공통 소스를 각 프로젝트로 복사

SOURCE="common/visual-effects/Ballpit.tsx"
DEST_PREDICTION="frontend-prediction/src/components/effects/Ballpit.tsx"
DEST_TRAINING="frontend-training/src/components/effects/Ballpit.tsx"

echo "=== Ballpit Sync Script ==="

if [ ! -f "$SOURCE" ]; then
  echo "Error: Source file not found: $SOURCE"
  exit 1
fi

# Prediction
cp "$SOURCE" "$DEST_PREDICTION"
echo "✓ Synced to frontend-prediction"

# Training  
cp "$SOURCE" "$DEST_TRAINING"
echo "✓ Synced to frontend-training"

echo ""
echo "✓ Sync completed successfully"
echo "Modified: 2 files"
