"""세션 매니저 감사 로그 동작을 검증한다."""

import json
import logging
from pathlib import Path
from typing import Iterator

import pytest

from backend.api.config import get_settings
from backend.api.session_manager import SessionManager


@pytest.fixture(autouse=True)
def reset_settings() -> Iterator[None]:
    """각 테스트 전후 get_settings 캐시와 로거 상태를 초기화한다."""

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()

    logger = logging.getLogger("auth.session")
    for handler in list(logger.handlers):
        handler.close()
        logger.removeHandler(handler)
    if hasattr(logger, "_routing_ml_configured"):
        delattr(logger, "_routing_ml_configured")


def _read_json_lines(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def test_session_manager_emits_json_audit_log(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """세션 발급/종료시 감사 로그 파일이 생성되고 JSON 구조를 갖는지 확인한다."""
    audit_dir = tmp_path / "audit"
    monkeypatch.setenv("ROUTING_ML_AUDIT_LOG_DIR", str(audit_dir))

    # 새로운 설정을 반영하도록 캐시를 초기화한다.
    get_settings.cache_clear()

    manager = SessionManager(ttl_seconds=60)
    record = manager.create_session(
        username="DOMAIN\\tester",
        display_name="테스트 사용자",
        domain="DOMAIN",
        client_host="127.0.0.1",
    )
    manager.revoke(record.token)

    log_files = list(audit_dir.glob("auth.session_*.log"))
    assert log_files, "감사 로그 파일이 생성되어야 한다."

    entries = []
    for log_file in log_files:
        entries.extend(_read_json_lines(log_file))

    messages = {entry.get("message") for entry in entries}
    assert {"세션 발급", "세션 종료"}.issubset(messages)

    for entry in entries:
        assert entry.get("username") == "DOMAIN\\tester"
        assert entry.get("level") in {"INFO", "DEBUG"}
        assert entry.get("timestamp"), "타임스탬프가 기록되어야 한다."
