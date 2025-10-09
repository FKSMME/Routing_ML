#!/bin/bash

cd /workspaces/Routing_ML_4

export PYTHONPATH=/workspaces/Routing_ML_4
export JWT_SECRET_KEY="test-key-min-32-chars-long-do-not-use-prod"

echo "🚀 Starting Backend Server with --reload..."
/workspaces/Routing_ML_4/venv-linux/bin/python -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000 --reload
