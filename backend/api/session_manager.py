"""JWT 관리 모듈."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict
from uuid import uuid4

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

from backend.api.config import Settings, get_settings
from common.datetime_utils import utc_now_naive


@dataclass(slots=True)
class TokenBundle:
    """JWT 발급 결과."""

    token: str
    issued_at: datetime
    expires_at: datetime
    jti: str


class JWTManager:
    """JWT 토큰을 생성하고 검증하는 헬퍼."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def create_access_token(
        self,
        *,
        subject: str,
        claims: Dict[str, Any] | None = None,
    ) -> TokenBundle:
        now = utc_now_naive()
        expires = now + timedelta(seconds=self.settings.jwt_access_token_ttl_seconds)
        payload: Dict[str, Any] = {
            "sub": subject,
            "iat": now,
            "exp": expires,
            "jti": uuid4().hex,
        }
        if claims:
            payload.update(claims)

        token = jwt.encode(
            payload,
            self.settings.jwt_secret_key,
            algorithm=self.settings.jwt_algorithm,
        )
        return TokenBundle(token=token, issued_at=now, expires_at=expires, jti=payload["jti"])

    def verify(self, token: str) -> Dict[str, Any]:
        try:
            payload = jwt.decode(
                token,
                self.settings.jwt_secret_key,
                algorithms=[self.settings.jwt_algorithm],
                options={"require": ["exp", "iat", "sub", "jti"]},
            )
        except ExpiredSignatureError as exc:  # pragma: no cover - PyJWT는 만료 시 예외만 던짐
            raise PermissionError("토큰이 만료되었습니다") from exc
        except InvalidTokenError as exc:  # pragma: no cover - 세부 유형은 PyJWT 내부에서 관리
            raise PermissionError("유효하지 않은 토큰입니다") from exc
        return payload


_jwt_manager: JWTManager | None = None


def get_jwt_manager() -> JWTManager:
    global _jwt_manager
    if _jwt_manager is None:
        _jwt_manager = JWTManager()
    return _jwt_manager


__all__ = ["JWTManager", "TokenBundle", "get_jwt_manager"]
