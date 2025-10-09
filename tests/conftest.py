import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.append(str(REPO_ROOT))

# Set test environment variables before importing config
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-pytest-only-do-not-use-in-production-min-32-chars-long"
os.environ["LOG_LEVEL"] = "WARNING"
os.environ["DB_TYPE"] = "SQLITE"
os.environ["RSL_DATABASE_URL"] = "sqlite:///:memory:"
os.environ["ROUTING_GROUPS_DATABASE_URL"] = "sqlite:///:memory:"
os.environ["ENABLE_CANDIDATE_PERSISTENCE"] = "false"

DEFAULT_MODEL_DIR = REPO_ROOT / "models" / "default"
os.environ["ROUTING_ML_MODEL_DIRECTORY"] = str(DEFAULT_MODEL_DIR)

from backend.api.config import get_settings

get_settings.cache_clear()
