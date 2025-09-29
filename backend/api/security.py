"""FastAPI dependencies for JWT 기반 인증."""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException, Request, status

from backend.api.config import get_settings
from backend.api.schemas import AuthenticatedUser
from backend.api.services.auth_service import auth_service

settings = get_settings()


def _extract_token(request: Request, authorization: str | None) -> str:
    cookie_token = request.cookies.get(settings.jwt_cookie_name)
    if cookie_token:
        return cookie_token
    if authorization:
        scheme, _, param = authorization.partition(" ")
        if scheme.lower() == "bearer" and param:
            return param
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 토큰이 필요합니다",
    )


async def get_current_user(
    request: Request,
    authorization: str | None = Header(None, alias="Authorization"),
) -> AuthenticatedUser:
    token = _extract_token(request, authorization)
    try:
        user = auth_service.validate_token(token)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    client_host = request.client.host if request.client else None
    if client_host:
        user.client_host = client_host
    return user


async def require_auth(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    return user


async def require_admin(user: AuthenticatedUser = Depends(require_auth)) -> AuthenticatedUser:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다",
        )
    return user


__all__ = ["get_current_user", "require_auth", "require_admin"]
