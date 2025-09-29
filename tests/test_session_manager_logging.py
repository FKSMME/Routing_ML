from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterator

import pytest

pytest.importorskip("jwt")
import jwt

from backend.api.config import get_settings
from backend.api.session_manager import JWTManager


@pytest.fixture(autouse=True)
def reset_settings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("ROUTING_ML_JWT_SECRET_KEY", "jwt-test-secret")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_jwt_manager_generates_signed_token() -> None:
    manager = JWTManager()
    bundle = manager.create_access_token(subject="tester", claims={"scope": "user"})

    assert bundle.token
    assert bundle.issued_at <= datetime.utcnow()
    assert bundle.expires_at > bundle.issued_at

    payload = manager.verify(bundle.token)
    assert payload["sub"] == "tester"
    assert payload["scope"] == "user"
    assert payload["jti"]


def test_jwt_manager_rejects_tampered_token() -> None:
    manager = JWTManager()
    bundle = manager.create_access_token(subject="tester")

    header, body, signature = bundle.token.split(".")
    forged = ".".join([header, body, "tampered"])

    with pytest.raises(PermissionError):
        manager.verify(forged)


def test_jwt_manager_rejects_expired_token(monkeypatch: pytest.MonkeyPatch) -> None:
    manager = JWTManager()
    now = datetime.utcnow()
    expired_payload = {
        "sub": "tester",
        "iat": now,
        "exp": now - timedelta(seconds=1),
        "jti": "dead-beef",
    }
    token = jwt.encode(expired_payload, get_settings().jwt_secret_key, algorithm=get_settings().jwt_algorithm)

    with pytest.raises(PermissionError):
        manager.verify(token)
