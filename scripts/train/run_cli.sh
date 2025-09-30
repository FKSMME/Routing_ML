#!/usr/bin/env bash
set -euo pipefail
python -m backend.cli.train_model "$@"
