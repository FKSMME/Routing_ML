"""인증 관련 API 라우터."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from backend.api.config import get_settings
from backend.api.schemas import AuthenticatedUser, LoginRequest, LoginResponse
from backend.api.security import get_session_manager, require_auth
from backend.api.services.auth_service import login as login_service
from common.logger import get_logger

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()
audit_logger = get_logger("auth.audit", log_dir=settings.audit_log_dir, use_json=True)


@router.post("/login", response_model=LoginResponse)
async def login(request: Request, payload: LoginRequest) -> LoginResponse:
    client_host = request.client.host if request.client else None
    try:
        response = login_service(payload, client_host)
        audit_logger.info(
            "로그인 성공",
            extra={
                "username": response.username,
                "client_host": client_host,
            },
        )
        return response
    except PermissionError as exc:
        audit_logger.warning(
            "로그인 실패",
            extra={
                "username": payload.username,
                "client_host": client_host,
            },
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(user: AuthenticatedUser = Depends(require_auth)) -> None:
    get_session_manager().revoke(user.session_id)
    audit_logger.info(
        "로그아웃",
        extra={"username": user.username, "client_host": user.client_host},
    )


__all__ = ["router"]
