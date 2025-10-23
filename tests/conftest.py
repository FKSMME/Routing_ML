import os
import sys
from pathlib import Path

# Get repo root for model directory configuration
REPO_ROOT = Path(__file__).resolve().parents[1]

# DO NOT add REPO_ROOT to sys.path - this causes numpy import errors
# pytest --import-mode=importlib handles imports correctly without it

# Set test environment variables before importing config
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-pytest-only-do-not-use-in-production-min-32-chars-long"
os.environ["LOG_LEVEL"] = "WARNING"
os.environ["DB_TYPE"] = "MSSQL"
TEST_DB_DIR = REPO_ROOT / ".pytest_dbs"
TEST_DB_DIR.mkdir(parents=True, exist_ok=True)
os.environ["RSL_DATABASE_URL"] = f"sqlite:///{(TEST_DB_DIR / 'rsl.db').as_posix()}"
os.environ["ROUTING_GROUPS_DATABASE_URL"] = f"sqlite:///{(TEST_DB_DIR / 'routing_groups.db').as_posix()}"
os.environ["MODEL_REGISTRY_URL"] = f"sqlite:///{(TEST_DB_DIR / 'registry.db').as_posix()}"
os.environ["ENABLE_CANDIDATE_PERSISTENCE"] = "false"

DEFAULT_MODEL_DIR = REPO_ROOT / "models" / "default"
os.environ["ROUTING_ML_MODEL_DIRECTORY"] = str(DEFAULT_MODEL_DIR)

from backend.api.config import get_settings

get_settings.cache_clear()

import pytest
from unittest.mock import MagicMock


@pytest.fixture
def mock_auth():
    """
    Provides a mock AuthService for individual tests.

    Use this fixture when you need a fresh mock instance per test.

    Example:
        def test_user_creation(mock_auth):
            user = mock_auth.create_user("newuser", "password")
            assert user["username"] == "newuser"
    """
    mock = MagicMock()

    # Configure default return values
    mock.create_user.return_value = {"id": 1, "username": "testuser", "status": "pending"}
    mock.authenticate.return_value = {"access_token": "mock-token", "token_type": "bearer"}
    mock.get_current_user.return_value = {"username": "testuser", "role": "admin"}
    mock.get_user_by_username.return_value = {"id": 1, "username": "testuser"}
    mock.update_user_status.return_value = True
    mock.delete_user.return_value = True
    mock.list_users.return_value = [
        {"id": 1, "username": "testuser", "status": "approved"},
        {"id": 2, "username": "testuser2", "status": "pending"}
    ]

    return mock
