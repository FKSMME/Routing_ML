import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.append(str(REPO_ROOT))

DEFAULT_MODEL_DIR = REPO_ROOT / "models" / "default"
os.environ["ROUTING_ML_MODEL_DIRECTORY"] = str(DEFAULT_MODEL_DIR)

from backend.api.config import get_settings

get_settings.cache_clear()
