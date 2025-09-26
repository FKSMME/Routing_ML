"""로깅 유틸리티."""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Union


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
    level: int = logging.DEBUG,
    log_to_file: bool = True,
    log_dir: Union[str, Path] = "logs",
    max_bytes: int = 10 * 1024 * 1024,
    backup_count: int = 5,
    use_json: bool = False,
) -> logging.Logger:
    """공통 로거 팩토리.

    - 콘솔/파일 핸들러를 각각 1회만 등록한다.
    - JSON 포맷 옵션을 지원한다.
    - 로그 파일은 일자별 회전(RotatingFileHandler)로 관리한다.
    """

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


__all__ = ["get_logger", "JSONFormatter"]
