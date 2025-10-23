"""FastAPI dependencies for JWT 기반 인증."""
from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import Depends, Header, HTTPException, Request, status

from backend.api.config import get_settings
from backend.api.schemas import AuthenticatedUser
from backend.api.services.auth_service import auth_service

settings = get_settings()
logger = logging.getLogger(__name__)


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


async def require_admin(
    request: Request,
    user: AuthenticatedUser = Depends(require_auth),
) -> AuthenticatedUser:
    """Require admin role for access.

    Raises:
        HTTPException: 403 Forbidden if user is not an admin.

    Audit Log:
        Logs all 403 authorization failures with user info and requested resource.
    """
    if not user.is_admin:
        # Audit log for authorization failure
        try:
            client_ip = request.client.host if request and request.client else "unknown"
        except (AttributeError, TypeError):
            client_ip = "unknown"

        try:
            requested_path = request.url.path if request and request.url else "unknown"
        except (AttributeError, TypeError):
            requested_path = "unknown"

        try:
            requested_method = request.method if request else "unknown"
        except (AttributeError, TypeError):
            requested_method = "unknown"

        logger.warning(
            "Authorization denied: User '%s' (ID: %s, IP: %s) attempted to access admin-only resource: %s %s",
            user.username,
            user.user_id,
            client_ip,
            requested_method,
            requested_path,
            extra={
                "event": "authorization_denied",
                "user_id": user.user_id,
                "username": user.username,
                "client_ip": client_ip,
                "requested_path": requested_path,
                "requested_method": requested_method,
                "timestamp": datetime.now(UTC).isoformat(),
                "is_admin": user.is_admin,
            },
        )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다. 이 작업은 관리자만 수행할 수 있습니다.",
        )
    return user


__all__ = ["get_current_user", "require_auth", "require_admin"]
