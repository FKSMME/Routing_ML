#!/usr/bin/env bash
set -euo pipefail
LOG_DIR="logs/compile"
mkdir -p "$LOG_DIR"
STAMP=$(date -u +"%Y%m%dT%H%M%SZ")
LOG_FILE="$LOG_DIR/compileall-$STAMP.log"
{
  echo "[compileall] $(date -u --iso-8601=seconds)"
  python -m compileall backend common
} &> "$LOG_FILE"
echo "$LOG_FILE"
