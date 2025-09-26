"""Windows 인증 서비스."""
from __future__ import annotations

import hashlib
import ssl
from dataclasses import dataclass
from typing import Optional

from ldap3 import ALL, Connection, NTLM, Server, Tls
from ldap3.core.exceptions import LDAPException

from backend.api.config import get_settings
from backend.api.schemas import LoginRequest, LoginResponse
from backend.api.security import SessionRecord, get_session_manager
from common.logger import get_logger


@dataclass
class AuthResult:
    success: bool
    message: str
    session: Optional[SessionRecord] = None


class WindowsAuthService:
    """Windows/LDAP 인증을 담당한다."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.logger = get_logger("auth.windows", log_dir=self.settings.audit_log_dir, use_json=True)

    def authenticate(self, payload: LoginRequest, client_host: Optional[str]) -> AuthResult:
        username = payload.username.strip()
        if not username or not payload.password:
            return AuthResult(False, "사용자명과 비밀번호가 필요합니다")

        if self.settings.windows_auth_enabled and self.settings.windows_ldap_server:
            try:
                if self._authenticate_with_ldap(username, payload.password):
                    session = self._create_session(username, client_host)
                    self.logger.info(
                        "Windows 인증 성공",
                        extra={
                            "username": username,
                            "client_host": client_host,
                            "domain": session.domain,
                        },
                    )
                    return AuthResult(True, "로그인 성공", session=session)
            except LDAPException as exc:
                self.logger.warning(
                    "LDAP 인증 실패",
                    extra={
                        "username": username,
                        "client_host": client_host,
                        "error": str(exc),
                    },
                )
            except Exception as exc:  # pragma: no cover - 예외 안전장치
                self.logger.error(
                    "LDAP 인증 중 예외",
                    exc_info=exc,
                    extra={"username": username, "client_host": client_host},
                )

        fallback_result = self._authenticate_with_fallback(username, payload.password)
        if fallback_result:
            session = self._create_session(username, client_host)
            self.logger.info(
                "폴백 인증 성공",
                extra={"username": username, "client_host": client_host, "domain": session.domain},
            )
            return AuthResult(True, "로그인 성공", session=session)

        self.logger.info(
            "인증 실패",
            extra={"username": username, "client_host": client_host},
        )
        return AuthResult(False, "인증에 실패했습니다")

    def _create_session(self, username: str, client_host: Optional[str]) -> SessionRecord:
        domain = self.settings.windows_domain
        display_name = username
        if domain and "\\" not in username and "@" not in username:
            qualified_username = f"{domain}\\{username}"
        else:
            qualified_username = username
        session = get_session_manager().create_session(
            username=qualified_username,
            display_name=display_name,
            domain=self.settings.windows_domain,
            client_host=client_host,
        )
        return session

    def _authenticate_with_ldap(self, username: str, password: str) -> bool:
        server = self._build_server()
        user_dn = self._build_user_dn(username)
        authentication = NTLM if "\\" in user_dn else None
        connection = Connection(
            server,
            user=user_dn,
            password=password,
            authentication=authentication or "SIMPLE",
            receive_timeout=self.settings.windows_auth_timeout,
            raise_exceptions=True,
        )
        try:
            return connection.bind()
        finally:
            connection.unbind()

    def _build_server(self) -> Server:
        tls_context = None
        if self.settings.windows_ldap_use_ssl:
            validate = ssl.CERT_REQUIRED if self.settings.windows_ldap_verify_cert else ssl.CERT_NONE
            tls_context = Tls(validate=validate)
        return Server(
            self.settings.windows_ldap_server,
            port=self.settings.windows_ldap_port,
            get_info=ALL,
            use_ssl=self.settings.windows_ldap_use_ssl,
            tls=tls_context,
        )

    def _build_user_dn(self, username: str) -> str:
        if "@" in username or "\\" in username:
            return username
        if self.settings.windows_domain:
            return f"{self.settings.windows_domain}\\{username}"
        if self.settings.windows_ldap_search_base:
            return f"cn={username},{self.settings.windows_ldap_search_base}"
        return username

    def _authenticate_with_fallback(self, username: str, password: str) -> bool:
        if not self.settings.windows_fallback_users:
            return False
        stored = self.settings.windows_fallback_users.get(username.lower())
        if stored is None:
            return False
        password_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
        if stored.startswith("sha256$"):
            stored = stored.split("$", 1)[1]
        return stored == password_hash


windows_auth_service = WindowsAuthService()


def login(payload: LoginRequest, client_host: Optional[str]) -> LoginResponse:
    result = windows_auth_service.authenticate(payload, client_host)
    if not result.success or result.session is None:
        raise PermissionError(result.message)

    session = result.session
    return LoginResponse(
        username=session.username,
        display_name=session.display_name,
        domain=session.domain,
        token=session.token,
        issued_at=session.issued_at,
        expires_at=session.expires_at,
    )


__all__ = ["windows_auth_service", "login", "WindowsAuthService", "AuthResult"]
