"""FastAPI dependencies for session-based authentication."""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException, Request, status

from backend.api.schemas import AuthenticatedUser
from backend.api.session_manager import (
    SessionManager,
    SessionRecord,
    get_session_manager,
)


def _extract_token(authorization: str) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization 헤더가 필요합니다",
        )
    scheme, _, param = authorization.partition(" ")
    if scheme.lower() != "bearer" or not param:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer 토큰이 필요합니다",
        )
    return param


async def get_current_user(
    request: Request,
    authorization: str = Header(..., alias="Authorization"),
) -> AuthenticatedUser:
    token = _extract_token(authorization)
    session = get_session_manager().validate(token)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="세션이 유효하지 않습니다",
        )

    client_host = request.client.host if request.client else None
    if client_host and client_host != session.client_host:
        session.client_host = client_host
    return session.to_user()


async def require_auth(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    return user


__all__ = [
    "SessionManager",
    "SessionRecord",
    "get_session_manager",
    "get_current_user",
    "require_auth",
]
