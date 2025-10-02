"""감사 로그 조회 API."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.api.config import get_settings
from backend.api.schemas import AuditLogEntry, AuditLogsResponse, AuthenticatedUser
from backend.api.security import require_admin
from common.logger import get_logger

router = APIRouter(prefix="/api/logs", tags=["logs"])
settings = get_settings()
logger = get_logger("api.logs")


def parse_log_line(line: str) -> Optional[AuditLogEntry]:
    """JSON 로그 라인 파싱"""
    try:
        data = json.loads(line.strip())
        return AuditLogEntry(
            timestamp=data.get("timestamp", ""),
            level=data.get("level", "INFO"),
            name=data.get("name", ""),
            message=data.get("message", ""),
            username=data.get("username"),
            client_host=data.get("client_host"),
            action=data.get("action"),
            extra={
                k: v
                for k, v in data.items()
                if k
                not in {
                    "timestamp",
                    "level",
                    "name",
                    "message",
                    "username",
                    "client_host",
                    "action",
                    "filename",
                    "lineno",
                    "funcName",
                    "threadName",
                }
            },
        )
    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"로그 파싱 실패: {e}")
        return None


def get_latest_log_file(log_dir: Path, logger_name: str) -> Path:
    """가장 최근 로그 파일 찾기"""
    today = datetime.now().strftime("%Y%m%d")
    log_file = log_dir / f"{logger_name}_{today}.log"

    if log_file.exists():
        return log_file

    # 오늘 파일이 없으면 가장 최근 파일 찾기
    pattern = f"{logger_name}_*.log"
    log_files = sorted(log_dir.glob(pattern), reverse=True)

    if log_files:
        return log_files[0]

    # 로그 파일이 없으면 오늘 날짜 파일 반환 (생성 대기)
    return log_file


@router.get("/audit", response_model=AuditLogsResponse)
async def get_audit_logs(
    limit: int = Query(100, ge=1, le=1000, description="페이지 크기"),
    offset: int = Query(0, ge=0, description="오프셋"),
    level: Optional[str] = Query(None, description="로그 레벨 필터 (INFO, WARNING, ERROR)"),
    username: Optional[str] = Query(None, description="사용자명 필터"),
    action: Optional[str] = Query(None, description="액션 필터"),
    date: Optional[str] = Query(None, description="날짜 필터 (YYYYMMDD)"),
    admin: AuthenticatedUser = Depends(require_admin),
) -> AuditLogsResponse:
    """감사 로그 조회 (관리자 전용)"""
    log_dir = Path(settings.audit_log_dir).expanduser().resolve()
    log_dir.mkdir(parents=True, exist_ok=True)

    # 로그 파일 찾기
    if date:
        log_file = log_dir / f"auth.audit_{date}.log"
    else:
        log_file = get_latest_log_file(log_dir, "auth.audit")

    if not log_file.exists():
        return AuditLogsResponse(
            logs=[],
            total=0,
            limit=limit,
            offset=offset,
            log_file=str(log_file),
        )

    # 로그 파일 읽기
    all_logs: List[AuditLogEntry] = []

    try:
        with open(log_file, "r", encoding="utf-8") as f:
            for line in f:
                entry = parse_log_line(line)
                if not entry:
                    continue

                # 필터링
                if level and entry.level != level:
                    continue
                if username and entry.username != username:
                    continue
                if action and entry.action != action:
                    continue

                all_logs.append(entry)
    except Exception as e:
        logger.error(f"로그 파일 읽기 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"로그 파일 읽기 실패: {str(e)}",
        ) from e

    # 역순 정렬 (최신순)
    all_logs.reverse()

    total = len(all_logs)
    paginated_logs = all_logs[offset : offset + limit]

    logger.info(
        "감사 로그 조회",
        extra={
            "admin": admin.username,
            "total": total,
            "limit": limit,
            "offset": offset,
            "log_file": str(log_file),
        },
    )

    return AuditLogsResponse(
        logs=paginated_logs,
        total=total,
        limit=limit,
        offset=offset,
        log_file=str(log_file),
    )


@router.get("/files", response_model=List[str])
async def list_log_files(
    admin: AuthenticatedUser = Depends(require_admin),
) -> List[str]:
    """로그 파일 목록 조회 (관리자 전용)"""
    log_dir = Path(settings.audit_log_dir).expanduser().resolve()
    log_dir.mkdir(parents=True, exist_ok=True)

    log_files = sorted(log_dir.glob("*.log"), reverse=True)
    file_names = [f.name for f in log_files]

    logger.info(
        "로그 파일 목록 조회",
        extra={"admin": admin.username, "count": len(file_names)},
    )

    return file_names


__all__ = ["router"]
