import logging
import sys
import json
from logging.handlers import RotatingFileHandler
from pathlib import Path
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
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
        return json.dumps(log_data, ensure_ascii=False)

def get_logger(
    name="routing_ml",
    *,
    level=logging.DEBUG,
    log_to_file=True,
    log_dir="logs",
    max_bytes=10 * 1024 * 1024,  # 10MB
    backup_count=5,
    use_json=False,
):
    """
    상세 로그를 위한 로거 설정
    - 콘솔과 파일 출력 지원
    - JSON 포맷 옵션
    - 파일명, 줄 번호, 함수명, 스레드 정보 포함
    """
    logger = logging.getLogger(name)
    if logger.hasHandlers():
        logger.handlers.clear()

    logger.setLevel(level)

    # 콘솔 핸들러 (DEBUG 이상)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    if use_json:
        console_handler.setFormatter(JSONFormatter())
    else:
        console_handler.setFormatter(logging.Formatter(
            "%(asctime)s | %(name)s | %(levelname)-8s | [%(filename)s:%(lineno)d] | %(funcName)s | %(threadName)s | %(message)s",
            "%Y-%m-%d %H:%M:%S"
        ))
    logger.addHandler(console_handler)

    # 파일 핸들러 (INFO 이상)
    if log_to_file:
        Path(log_dir).mkdir(parents=True, exist_ok=True)
        log_file = Path(log_dir) / f"{name}_{datetime.now().strftime('%Y%m%d')}.log"
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding="utf-8",
        )
        file_handler.setLevel(logging.INFO)
        if use_json:
            file_handler.setFormatter(JSONFormatter())
        else:
            file_handler.setFormatter(logging.Formatter(
                "%(asctime)s | %(name)s | %(levelname)-8s | [%(filename)s:%(lineno)d] | %(funcName)s | %(threadName)s | %(message)s",
                "%Y-%m-%d %H:%M:%S"
            ))
        logger.addHandler(file_handler)

    # Windows 콘솔 한글 깨짐 방지
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

    return logger