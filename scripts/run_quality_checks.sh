#!/usr/bin/env bash
set -euo pipefail
python -m pip install --upgrade pip >/dev/null
pip install -r requirements.txt >/dev/null
pip install pytest ruff >/dev/null
ruff check backend common tests backend/maintenance
PYTHONPATH=. pytest
python scripts/check_schema_compatibility.py
