"""인증 관련 API 라우터."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from backend.api.config import get_settings
from backend.api.schemas import (
    AdminApproveRequest,
    AdminRejectRequest,
    AuthenticatedUser,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    UserStatusResponse,
)
from backend.api.security import require_admin, require_auth
from backend.api.services.auth_service import auth_service, login as login_service
from common.logger import get_logger

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()
audit_logger = get_logger("auth.audit", log_dir=settings.audit_log_dir, use_json=True)


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest) -> RegisterResponse:
    try:
        response = auth_service.register(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    audit_logger.info("가입 요청", extra={"username": response.username})
    return response


@router.post("/login", response_model=LoginResponse)
async def login(request: Request, payload: LoginRequest, response: Response) -> LoginResponse:
    client_host = request.client.host if request.client else None
    try:
        login_response = login_service(payload, client_host)
    except PermissionError as exc:
        audit_logger.warning(
            "로그인 실패",
            extra={"username": payload.username, "client_host": client_host},
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    response.set_cookie(
        key=settings.jwt_cookie_name,
        value=login_response.token,
        httponly=True,
        samesite="lax",
        secure=settings.jwt_cookie_secure,
        max_age=settings.jwt_access_token_ttl_seconds,
    )
    audit_logger.info(
        "로그인 성공",
        extra={"username": login_response.username, "client_host": client_host},
    )
    return login_response


@router.get("/me", response_model=AuthenticatedUser)
async def read_current_user(user: AuthenticatedUser = Depends(require_auth)) -> AuthenticatedUser:
    return user


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def logout(user: AuthenticatedUser = Depends(require_auth)) -> Response:
    audit_logger.info(
        "로그아웃",
        extra={"username": user.username, "client_host": user.client_host},
    )
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.set_cookie(
        key=settings.jwt_cookie_name,
        value="",
        httponly=True,
        samesite="lax",
        secure=settings.jwt_cookie_secure,
        path="/",
        max_age=0,
        expires=0,
    )
    return response


@router.post("/admin/approve", response_model=UserStatusResponse)
async def approve_user(
    payload: AdminApproveRequest,
    admin: AuthenticatedUser = Depends(require_admin),
) -> UserStatusResponse:
    try:
        result = auth_service.approve_user(payload.username, make_admin=payload.make_admin)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    audit_logger.info(
        "사용자 승인",
        extra={
            "target": payload.username,
            "approved_by": admin.username,
            "make_admin": payload.make_admin,
        },
    )
    return result


@router.post("/admin/reject", response_model=UserStatusResponse)
async def reject_user(
    payload: AdminRejectRequest,
    admin: AuthenticatedUser = Depends(require_admin),
) -> UserStatusResponse:
    try:
        result = auth_service.reject_user(payload.username, reason=payload.reason)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    audit_logger.info(
        "사용자 거절",
        extra={
            "target": payload.username,
            "rejected_by": admin.username,
            "reason": payload.reason,
        },
    )
    return result


__all__ = ["router"]
