"""Tests for JSON structured logging functionality."""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import pytest

from common.logger import JSONFormatter, get_logger


def test_json_formatter_basic():
    """Test JSONFormatter produces valid JSON."""
    formatter = JSONFormatter()
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname="test.py",
        lineno=42,
        msg="Test message",
        args=(),
        exc_info=None,
    )
    record.funcName = "test_function"
    record.threadName = "MainThread"

    output = formatter.format(record)

    # Should be valid JSON
    log_data = json.loads(output)

    # Verify required fields
    assert log_data["name"] == "test_logger"
    assert log_data["level"] == "INFO"
    assert log_data["message"] == "Test message"
    assert log_data["filename"] == "test.py"
    assert log_data["lineno"] == 42
    assert log_data["funcName"] == "test_function"
    assert log_data["threadName"] == "MainThread"
    assert "timestamp" in log_data


def test_json_formatter_with_extra_fields():
    """Test JSONFormatter includes extra fields."""
    formatter = JSONFormatter()
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname="test.py",
        lineno=42,
        msg="User action",
        args=(),
        exc_info=None,
    )
    record.funcName = "process_request"
    record.threadName = "Worker-1"

    # Add custom fields
    record.user_id = 123
    record.action = "login"
    record.request_id = "req-abc123"

    output = formatter.format(record)
    log_data = json.loads(output)

    # Verify custom fields are included
    assert log_data["user_id"] == 123
    assert log_data["action"] == "login"
    assert log_data["request_id"] == "req-abc123"


def test_json_formatter_with_exception():
    """Test JSONFormatter handles exceptions."""
    formatter = JSONFormatter()

    try:
        raise ValueError("Test error")
    except ValueError:
        import sys
        exc_info = sys.exc_info()

        record = logging.LogRecord(
            name="test_logger",
            level=logging.ERROR,
            pathname="test.py",
            lineno=42,
            msg="Error occurred",
            args=(),
            exc_info=exc_info,
        )
        record.funcName = "error_function"
        record.threadName = "MainThread"

        output = formatter.format(record)
        log_data = json.loads(output)

        # Verify exception is included
        assert "exception" in log_data
        assert "ValueError: Test error" in log_data["exception"]
        assert "Traceback" in log_data["exception"]


def test_get_logger_respects_log_format_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Test get_logger respects LOG_FORMAT environment variable."""
    log_dir = tmp_path / "logs"

    # Test JSON format
    monkeypatch.setenv("LOG_FORMAT", "json")
    monkeypatch.setenv("LOG_LEVEL", "INFO")

    logger = get_logger("test_json", log_to_file=False)

    # Check that formatter is JSONFormatter
    assert len(logger.handlers) > 0
    for handler in logger.handlers:
        assert isinstance(handler.formatter, JSONFormatter)


def test_get_logger_text_format(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Test get_logger uses text format by default."""
    monkeypatch.setenv("LOG_FORMAT", "text")

    logger = get_logger("test_text", log_to_file=False)

    # Check that formatter is NOT JSONFormatter
    assert len(logger.handlers) > 0
    for handler in logger.handlers:
        assert not isinstance(handler.formatter, JSONFormatter)


def test_get_logger_explicit_json_override(tmp_path: Path):
    """Test use_json parameter overrides environment variable."""
    logger = get_logger("test_override", log_to_file=False, use_json=True)

    # Should use JSON formatter regardless of env var
    assert len(logger.handlers) > 0
    for handler in logger.handlers:
        assert isinstance(handler.formatter, JSONFormatter)


def test_get_logger_respects_log_level_env(monkeypatch: pytest.MonkeyPatch):
    """Test get_logger respects LOG_LEVEL environment variable."""
    monkeypatch.setenv("LOG_LEVEL", "WARNING")

    logger = get_logger("test_level", log_to_file=False)

    assert logger.level == logging.WARNING


def test_get_logger_respects_log_to_file_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Test get_logger respects LOG_TO_FILE environment variable."""
    log_dir = tmp_path / "logs"

    # Disable file logging via env var
    monkeypatch.setenv("LOG_TO_FILE", "false")

    logger = get_logger("test_no_file", log_dir=str(log_dir))

    # Should only have console handler
    assert len(logger.handlers) == 1
    assert isinstance(logger.handlers[0], logging.StreamHandler)


def test_json_logging_integration(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Integration test: log messages and verify JSON output."""
    log_dir = tmp_path / "logs"
    log_dir.mkdir()

    monkeypatch.setenv("LOG_FORMAT", "json")
    monkeypatch.setenv("LOG_LEVEL", "INFO")

    logger = get_logger("test_integration", log_dir=str(log_dir), log_to_file=True)

    # Log some messages
    logger.info("Test message 1", extra={"user_id": 123})
    logger.warning("Test message 2", extra={"action": "test_action"})

    # Find log file
    log_files = list(log_dir.glob("test_integration_*.log"))
    assert len(log_files) == 1

    log_file = log_files[0]

    # Read and verify JSON log lines
    with log_file.open("r", encoding="utf-8") as f:
        lines = f.readlines()

    assert len(lines) >= 2

    # Parse first log line
    log1 = json.loads(lines[0])
    assert log1["name"] == "test_integration"
    assert log1["level"] == "INFO"
    assert log1["message"] == "Test message 1"
    assert log1["user_id"] == 123

    # Parse second log line
    log2 = json.loads(lines[1])
    assert log2["level"] == "WARNING"
    assert log2["message"] == "Test message 2"
    assert log2["action"] == "test_action"


def test_logger_singleton_behavior():
    """Test that get_logger returns same instance for same name."""
    logger1 = get_logger("singleton_test", log_to_file=False)
    logger2 = get_logger("singleton_test", log_to_file=False)

    assert logger1 is logger2


def test_json_formatter_unicode_support():
    """Test JSONFormatter handles Unicode characters."""
    formatter = JSONFormatter()
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname="test.py",
        lineno=42,
        msg="테스트 메시지 🎉",  # Korean + emoji
        args=(),
        exc_info=None,
    )
    record.funcName = "test_unicode"
    record.threadName = "MainThread"

    output = formatter.format(record)
    log_data = json.loads(output)

    assert log_data["message"] == "테스트 메시지 🎉"
    # ensure_ascii=False should preserve Unicode
    assert "테스트" in output
    assert "🎉" in output
