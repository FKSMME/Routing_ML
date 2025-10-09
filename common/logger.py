"""로깅 유틸리티."""
from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Mapping, MutableMapping, Union


class JSONFormatter(logging.Formatter):
    """로그 레코드를 JSON 문자열로 직렬화한다."""

    def format(self, record: logging.LogRecord) -> str:  # noqa: D401
        log_data = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "name": record.name,
            "level": record.levelname,
            "message": record.getMessage(),
            "filename": record.filename,
            "lineno": record.lineno,
            "funcName": record.funcName,
            "threadName": record.threadName,
        }
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        reserved = {
            "name",
            "msg",
            "args",
            "levelname",
            "levelno",
            "pathname",
            "filename",
            "module",
            "exc_info",
            "exc_text",
            "stack_info",
            "lineno",
            "funcName",
            "created",
            "msecs",
            "relativeCreated",
            "thread",
            "threadName",
            "processName",
            "process",
            "message",
        }
        for key, value in record.__dict__.items():
            if key not in log_data and key not in reserved:
                log_data[key] = value
        return json.dumps(log_data, ensure_ascii=False)


def _ensure_stream_encoding() -> None:
    """Windows 콘솔에서 UTF-8 출력을 보장한다."""

    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except AttributeError:  # pragma: no cover - Python<3.7
        pass


def get_logger(
    name: str = "routing_ml",
    *,
    level: int | None = None,
    log_to_file: bool = True,
    log_dir: Union[str, Path] = "logs",
    max_bytes: int = 10 * 1024 * 1024,
    backup_count: int = 5,
    use_json: bool | None = None,
) -> logging.Logger:
    """공통 로거 팩토리.

    - 콘솔/파일 핸들러를 각각 1회만 등록한다.
    - JSON 포맷 옵션을 지원한다 (환경 변수 LOG_FORMAT=json으로 제어)
    - 로그 파일은 일자별 회전(RotatingFileHandler)로 관리한다.
    - 기본 로그 레벨은 환경 변수 LOG_LEVEL로 제어 가능 (기본: INFO)
      유효한 값: DEBUG, INFO, WARNING, ERROR, CRITICAL

    Args:
        name: Logger name
        level: Log level (overrides LOG_LEVEL environment variable)
        log_to_file: Enable file logging
        log_dir: Log directory path
        max_bytes: Max log file size before rotation (default: 10MB)
        backup_count: Number of backup log files to keep
        use_json: Use JSON format (overrides LOG_FORMAT environment variable)
                  If None, reads from LOG_FORMAT env var (json/text, default: text)

    Returns:
        Configured logger instance

    Environment Variables:
        LOG_LEVEL: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        LOG_FORMAT: Log format (json, text) - default: text
        LOG_TO_FILE: Enable file logging (true, false) - default: true

    Examples:
        # Development (text format, DEBUG level)
        export LOG_LEVEL=DEBUG
        export LOG_FORMAT=text
        logger = get_logger("my_service")

        # Production (JSON format, INFO level)
        export LOG_LEVEL=INFO
        export LOG_FORMAT=json
        logger = get_logger("my_service")

        # Explicit JSON logging
        logger = get_logger("my_service", use_json=True)
    """

    # 환경 변수에서 로그 레벨 결정 (기본: INFO, 프로덕션 권장)
    if level is None:
        log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
        level_map = {
            "DEBUG": logging.DEBUG,
            "INFO": logging.INFO,
            "WARNING": logging.WARNING,
            "ERROR": logging.ERROR,
            "CRITICAL": logging.CRITICAL,
        }
        level = level_map.get(log_level_str, logging.INFO)

    # 환경 변수에서 JSON 포맷 결정 (기본: text, 프로덕션은 json 권장)
    if use_json is None:
        log_format = os.getenv("LOG_FORMAT", "text").lower()
        use_json = log_format == "json"

    # 환경 변수에서 파일 로깅 여부 결정
    log_to_file_env = os.getenv("LOG_TO_FILE", "true").lower()
    if log_to_file_env in ("false", "0", "no"):
        log_to_file = False

    logger = logging.getLogger(name)
    if getattr(logger, "_routing_ml_configured", False):
        return logger

    logger.setLevel(level)
    formatter: logging.Formatter
    if use_json:
        formatter = JSONFormatter()
    else:
        formatter = logging.Formatter(
            "%(asctime)s | %(name)s | %(levelname)-8s | [%(filename)s:%(lineno)d] | %(funcName)s | %(threadName)s | %(message)s",
            "%Y-%m-%d %H:%M:%S",
        )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    if log_to_file:
        log_dir_path = Path(log_dir).expanduser().resolve()
        log_dir_path.mkdir(parents=True, exist_ok=True)
        log_file = log_dir_path / f"{name}_{datetime.now().strftime('%Y%m%d')}.log"
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding="utf-8",
        )
        file_handler.setLevel(logging.INFO)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    _ensure_stream_encoding()

    logger._routing_ml_configured = True  # type: ignore[attr-defined]
    return logger


performance_logger = get_logger(
    "performance.training",
    log_dir=Path("logs/performance"),
    use_json=True,
)


def audit_routing_event(
    action: str,
    payload: Mapping[str, Any] | None = None,
    *,
    result: str = "success",
    username: str | None = None,
    client_host: str | None = None,
    request_id: str | None = None,
    correlation_id: str | None = None,
) -> None:
    """Emit a structured routing audit event to the ``routing.audit`` logger."""

    try:
        from backend.api.config import get_settings

        settings = get_settings()
        audit_logger = get_logger(
            "routing.audit",
            log_dir=settings.audit_log_dir,
            use_json=True,
        )
    except Exception:  # pragma: no cover - fallback when settings import fails
        audit_logger = get_logger("routing.audit", use_json=True)

    event_payload: MutableMapping[str, Any] = {
        "timestamp": datetime.utcnow().isoformat(),
        "action": action,
        "result": result,
    }
    if payload is not None:
        event_payload["payload"] = dict(payload)
    if username is not None:
        event_payload["username"] = username
    if client_host is not None:
        event_payload["client_host"] = client_host
    if request_id is not None:
        event_payload["request_id"] = request_id
    if correlation_id is not None:
        event_payload["correlation_id"] = correlation_id

    audit_logger.info(action, extra=event_payload)


__all__ = ["get_logger", "JSONFormatter", "performance_logger", "audit_routing_event"]
