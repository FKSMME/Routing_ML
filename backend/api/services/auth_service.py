"""로컬 사용자 인증 서비스."""
from __future__ import annotations

import secrets
import string
from datetime import datetime
from typing import List, Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError

from backend.api.config import Settings, get_settings
from backend.api.schemas import (
    AdminResetPasswordRequest,
    AdminResetPasswordResponse,
    AuthenticatedUser,
    BulkRegisterRequest,
    BulkRegisterResponse,
    BulkRegisterResult,
    ChangePasswordRequest,
    ChangePasswordResponse,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    UserListItem,
    UserListResponse,
    UserStatusResponse,
)
from backend.api.services.email_service import email_service, OutlookNotAvailableError
from backend.api.session_manager import JWTManager, get_jwt_manager
from backend.database_rsl import (
    UserAccount,
    bootstrap_schema,
    normalize_username,
    session_scope,
)
from common.datetime_utils import utc_now_naive
from common.logger import get_logger
from sqlalchemy import or_


_PASSWORD_ALPHABET = string.ascii_letters + string.digits


class AuthService:
    """로컬 사용자 스토어를 사용하는 인증 서비스."""

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        jwt_manager: JWTManager | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self._jwt_manager = jwt_manager or get_jwt_manager()
        self._hasher = PasswordHasher()
        self._logger = get_logger(
            "auth.service", log_dir=self.settings.audit_log_dir, use_json=True
        )
        bootstrap_schema()

    def _generate_temporary_password(self, length: int = 12) -> str:
        """임시 비밀번호 문자열 생성"""
        return "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(length))

    # ------------------------------------------------------------------
    # 사용자 등록/조회
    # ------------------------------------------------------------------
    def register(self, payload: RegisterRequest) -> RegisterResponse:
        username = payload.username.strip()
        if not username or not payload.password:
            raise ValueError("사용자명과 비밀번호가 필요합니다")

        normalized = normalize_username(username)
        with session_scope() as session:
            existing = (
                session.query(UserAccount)
                .filter(UserAccount.normalized_username == normalized)
                .one_or_none()
            )
            if existing:
                if existing.status == "rejected":
                    existing.password_hash = self._hasher.hash(payload.password)
                    existing.status = "pending"
                    existing.display_name = payload.display_name or existing.display_name
                    existing.full_name = payload.full_name or existing.full_name
                    existing.email = payload.email or existing.email
                    existing.rejected_at = None
                    session.add(existing)
                    self._logger.info(
                        "가입 재요청", extra={"username": existing.username}
                    )
                    # 관리자에게 재가입 알림 이메일 전송
                    try:
                        email_service.notify_admin_new_registration(
                            username=existing.username,
                            full_name=existing.full_name,
                            email=existing.email,
                        )
                    except OutlookNotAvailableError as e:
                        self._logger.info(
                            "Outlook이 실행되지 않아 이메일 알림을 건너뜁니다",
                            extra={"username": existing.username, "message": str(e)},
                        )
                    except Exception as e:
                        self._logger.warning(
                            "관리자 이메일 전송 실패",
                            extra={"username": existing.username, "error": str(e)},
                        )
                    return RegisterResponse(
                        username=existing.username,
                        status=existing.status,
                        is_admin=existing.is_admin,
                        message="가입 요청이 다시 접수되었습니다",
                    )
                raise ValueError("이미 등록된 사용자입니다")

            user = UserAccount(
                username=username,
                normalized_username=normalized,
                display_name=payload.display_name,
                full_name=payload.full_name,
                email=payload.email,
                password_hash=self._hasher.hash(payload.password),
                status="pending",
            )
            session.add(user)
            self._logger.info("가입 요청", extra={"username": username})

        # 관리자에게 신규 가입 알림 이메일 전송
        try:
            email_service.notify_admin_new_registration(
                username=username,
                full_name=payload.full_name,
                email=payload.email,
            )
        except OutlookNotAvailableError as e:
            self._logger.info(
                "Outlook이 실행되지 않아 이메일 알림을 건너뜁니다",
                extra={"username": username, "message": str(e)},
            )
        except Exception as e:
            self._logger.warning(
                "관리자 이메일 전송 실패",
                extra={"username": username, "error": str(e)},
            )

        return RegisterResponse(
            username=username,
            status="pending",
            is_admin=False,
            message="관리자 승인을 기다려 주세요",
        )

    def approve_user(self, username: str, *, make_admin: bool = False) -> UserStatusResponse:
        normalized = normalize_username(username)
        with session_scope() as session:
            user = (
                session.query(UserAccount)
                .filter(UserAccount.normalized_username == normalized)
                .one_or_none()
            )
            if not user:
                raise ValueError("사용자를 찾을 수 없습니다")
            user.status = "approved"
            user.approved_at = utc_now_naive()
            if make_admin:
                user.is_admin = True
            session.add(user)
            self._logger.info(
                "사용자 승인",
                extra={"username": user.username, "is_admin": user.is_admin},
            )

            # 사용자에게 승인 알림 이메일 전송
            if user.email:
                try:
                    email_service.notify_user_approved(
                        username=user.username,
                        email=user.email,
                        full_name=user.full_name,
                    )
                except OutlookNotAvailableError as e:
                    self._logger.info(
                        "Outlook이 실행되지 않아 승인 이메일을 건너뜁니다",
                        extra={"username": user.username, "message": str(e)},
                    )
                except Exception as e:
                    self._logger.warning(
                        "승인 이메일 전송 실패",
                        extra={"username": user.username, "error": str(e)},
                    )

            return self._to_status_response(user)

    def reject_user(self, username: str, *, reason: Optional[str] = None) -> UserStatusResponse:
        normalized = normalize_username(username)
        with session_scope() as session:
            user = (
                session.query(UserAccount)
                .filter(UserAccount.normalized_username == normalized)
                .one_or_none()
            )
            if not user:
                raise ValueError("사용자를 찾을 수 없습니다")
            user.status = "rejected"
            user.rejected_at = utc_now_naive()
            session.add(user)
            self._logger.info(
                "사용자 거절",
                extra={"username": user.username, "reason": reason},
            )

            # 사용자에게 거절 알림 이메일 전송
            if user.email:
                try:
                    email_service.notify_user_rejected(
                        username=user.username,
                        email=user.email,
                        full_name=user.full_name,
                        reason=reason,
                    )
                except OutlookNotAvailableError as e:
                    self._logger.info(
                        "Outlook이 실행되지 않아 거절 이메일을 건너뜁니다",
                        extra={"username": user.username, "message": str(e)},
                    )
                except Exception as e:
                    self._logger.warning(
                        "거절 이메일 전송 실패",
                        extra={"username": user.username, "error": str(e)},
                    )

            return self._to_status_response(user)

    def get_pending_users(self) -> list[dict]:
        """대기 중인 사용자 목록 조회"""
        with session_scope() as session:
            pending_users = (
                session.query(UserAccount)
                .filter(UserAccount.status == "pending")
                .order_by(UserAccount.created_at.desc())
                .all()
            )
            return [
                {
                    "username": user.username,
                    "full_name": user.full_name,
                    "email": user.email,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                    "status": user.status,
                }
                for user in pending_users
            ]

    # ------------------------------------------------------------------
    # 로그인/토큰 발급
    # ------------------------------------------------------------------
    def login(self, payload: LoginRequest, client_host: Optional[str]) -> LoginResponse:
        username = payload.username.strip()
        if not username or not payload.password:
            raise PermissionError("사용자명과 비밀번호가 필요합니다")

        normalized = normalize_username(username)
        with session_scope() as session:
            user = (
                session.query(UserAccount)
                .filter(UserAccount.normalized_username == normalized)
                .one_or_none()
            )
            if not user:
                raise PermissionError("등록되지 않은 사용자입니다")
            if user.status != "approved":
                raise PermissionError("관리자 승인이 필요합니다")

            try:
                self._hasher.verify(user.password_hash, payload.password)
            except VerificationError as exc:
                self._logger.warning(
                    "비밀번호 불일치", extra={"username": user.username, "client_host": client_host}
                )
                raise PermissionError("비밀번호가 일치하지 않습니다") from exc

            user.last_login_at = utc_now_naive()
            session.add(user)

        bundle = self._jwt_manager.create_access_token(
            subject=user.username,
            claims={
                "display_name": user.display_name,
                "status": user.status,
                "is_admin": user.is_admin,
            },
        )
        self._logger.info(
            "로그인 성공",
            extra={"username": user.username, "client_host": client_host},
        )
        return LoginResponse(
            username=user.username,
            display_name=user.display_name,
            status=user.status,
            is_admin=user.is_admin,
            token=bundle.token,
            issued_at=bundle.issued_at,
            expires_at=bundle.expires_at,
        )

    def validate_token(self, token: str) -> AuthenticatedUser:
        payload = self._jwt_manager.verify(token)
        username = payload.get("sub")
        if not username:
            raise PermissionError("토큰 정보가 올바르지 않습니다")

        normalized = normalize_username(username)
        with session_scope() as session:
            user = (
                session.query(UserAccount)
                .filter(UserAccount.normalized_username == normalized)
                .one_or_none()
            )
            if not user:
                raise PermissionError("사용자를 찾을 수 없습니다")
            if user.status != "approved":
                raise PermissionError("사용자 승인이 필요합니다")

        issued_at = _coerce_datetime(payload.get("iat"))
        expires_at = _coerce_datetime(payload.get("exp"))
        return AuthenticatedUser(
            username=user.username,
            display_name=payload.get("display_name"),
            status=user.status,
            is_admin=bool(payload.get("is_admin", False)),
            issued_at=issued_at,
            expires_at=expires_at,
            session_id=payload.get("jti"),
            client_host=None,
        )

    def get_user_status(self, username: str) -> UserStatusResponse:
        normalized = normalize_username(username)
        with session_scope() as session:
            user = (
                session.query(UserAccount)
                .filter(UserAccount.normalized_username == normalized)
                .one_or_none()
            )
            if not user:
                raise ValueError("사용자를 찾을 수 없습니다")
            return self._to_status_response(user)

    # ------------------------------------------------------------------
    # 비밀번호 변경
    # ------------------------------------------------------------------
    def change_password(
        self, username: str, payload: ChangePasswordRequest
    ) -> ChangePasswordResponse:
        """사용자 비밀번호 변경"""
        normalized = normalize_username(username)
        with session_scope() as session:
            user = (
                session.query(UserAccount)
                .filter(UserAccount.normalized_username == normalized)
                .one_or_none()
            )
            if not user:
                raise ValueError("사용자를 찾을 수 없습니다")

            # 현재 비밀번호 확인
            try:
                self._hasher.verify(user.password_hash, payload.current_password)
            except VerificationError as exc:
                self._logger.warning(
                    "비밀번호 변경 실패 - 현재 비밀번호 불일치",
                    extra={"username": user.username},
                )
                raise PermissionError("현재 비밀번호가 일치하지 않습니다") from exc

            # 새 비밀번호로 변경
            user.password_hash = self._hasher.hash(payload.new_password)
            user.must_change_password = False
            session.add(user)

            self._logger.info(
                "비밀번호 변경 성공", extra={"username": user.username}
            )

        return ChangePasswordResponse(
            username=user.username,
            changed_at=utc_now_naive(),
        )

    # ------------------------------------------------------------------
    # 사용자 목록 조회 (관리자용)
    # ------------------------------------------------------------------
    def reset_password_admin(
        self,
        payload: AdminResetPasswordRequest,
        *,
        admin_username: Optional[str] = None,
    ) -> AdminResetPasswordResponse:
        """Reset a user's password on behalf of an administrator."""

        temporary_password = payload.temp_password or self._generate_temporary_password()
        normalized = normalize_username(payload.username)
        now = utc_now_naive()

        with session_scope() as session:
            user = (
                session.query(UserAccount)
                .filter(UserAccount.normalized_username == normalized)
                .one_or_none()
            )
            if not user:
                raise ValueError("사용자를 찾을 수 없습니다")

            user.password_hash = self._hasher.hash(temporary_password)
            user.must_change_password = payload.force_change
            if payload.notify:
                user.initial_password_sent_at = now
            session.add(user)

            email = user.email
            display_name = user.display_name
            username = user.username

        notified = False
        if payload.notify and email:
            try:
                notified = email_service.notify_user_password_reset(
                    username=username,
                    email=email,
                    temporary_password=temporary_password,
                    force_change=payload.force_change,
                    display_name=display_name,
                )
            except OutlookNotAvailableError as exc:
                self._logger.info("Password reset email skipped: Outlook unavailable", extra={"username": username, "error": str(exc)})
            except Exception as exc:
                self._logger.warning("Password reset email failed", extra={"username": username, "error": str(exc)})
        elif payload.notify:
            self._logger.warning("Password reset email skipped: no email address", extra={"username": username})

        self._logger.info("Admin password reset", extra={"target": username, "admin": admin_username, "force_change": payload.force_change, "notified": notified})

        return AdminResetPasswordResponse(
            username=username,
            temporary_password=temporary_password,
            force_change=payload.force_change,
            notified=notified,
            updated_at=now,
        )

    def bulk_register(
        self,
        payload: BulkRegisterRequest,
        *,
        admin_username: Optional[str] = None,
    ) -> BulkRegisterResponse:
        """Create or update multiple users from a single request."""

        successes: List[BulkRegisterResult] = []
        failures: List[BulkRegisterResult] = []
        notification_queue: List[tuple[str, str, str, Optional[str]]] = []
        now = utc_now_naive()
        invited_by = payload.invited_by or admin_username

        with session_scope() as session:
            for record in payload.users:
                username_raw = (record.username or "").strip()
                if not username_raw:
                    failures.append(BulkRegisterResult(username=record.username or "", status="failed", message="username is required"))
                    continue

                username = username_raw
                normalized = normalize_username(username)
                temporary_password = record.password or self._generate_temporary_password()

                try:
                    user = (
                        session.query(UserAccount)
                        .filter(UserAccount.normalized_username == normalized)
                        .one_or_none()
                    )

                    if user and not payload.overwrite_existing:
                        failures.append(BulkRegisterResult(username=username, status="skipped", is_admin=user.is_admin, approved=user.status == "approved", message="existing user and overwrite disabled"))
                        continue

                    action = "created" if user is None else "updated"

                    if user is None:
                        user = UserAccount(
                            username=username,
                            normalized_username=normalized,
                            display_name=record.display_name,
                            full_name=record.full_name,
                            email=record.email,
                            password_hash=self._hasher.hash(temporary_password),
                            status="approved" if payload.auto_approve else "pending",
                            is_admin=record.make_admin,
                            must_change_password=payload.force_password_change,
                            invited_by=invited_by,
                            approved_at=now if payload.auto_approve else None,
                        )
                        if payload.notify:
                            user.initial_password_sent_at = now
                        session.add(user)
                    else:
                        user.display_name = record.display_name or user.display_name
                        user.full_name = record.full_name or user.full_name
                        user.email = record.email or user.email
                        user.password_hash = self._hasher.hash(temporary_password)
                        if payload.auto_approve:
                            user.status = "approved"
                            user.approved_at = now
                        user.is_admin = record.make_admin
                        user.must_change_password = payload.force_password_change
                        user.invited_by = invited_by
                        if payload.notify:
                            user.initial_password_sent_at = now
                        session.add(user)

                    approved = user.status == "approved"
                    result = BulkRegisterResult(
                        username=username,
                        status=action,
                        is_admin=user.is_admin,
                        approved=approved,
                        temporary_password=temporary_password,
                    )
                    successes.append(result)

                    if payload.notify:
                        if user.email:
                            notification_queue.append((user.email, username, temporary_password, user.display_name))
                        else:
                            result.message = "email address missing - notification skipped"
                except Exception as exc:
                    failures.append(BulkRegisterResult(username=username, status="failed", message=str(exc)))

        notified_users: set[str] = set()
        if payload.notify:
            for email_address, username, temporary_password, display_name in notification_queue:
                try:
                    email_service.notify_user_bulk_invited(
                        username=username,
                        email=email_address,
                        temporary_password=temporary_password,
                        display_name=display_name,
                        invited_by=admin_username or invited_by,
                    )
                    notified_users.add(username)
                except OutlookNotAvailableError as exc:
                    self._logger.info("Bulk register email skipped: Outlook unavailable", extra={"username": username, "error": str(exc)})
                except Exception as exc:
                    self._logger.warning("Bulk register email failed", extra={"username": username, "error": str(exc)})

            for result in successes:
                if result.username in notified_users:
                    result.message = ((result.message + "; ") if result.message else "") + "email notified"

        self._logger.info("Bulk user register", extra={"admin": admin_username, "requested": len(payload.users), "succeeded": len(successes), "failed": len(failures)})

        return BulkRegisterResponse(successes=successes, failures=failures, total=len(payload.users))

    def list_users(
        self,
        *,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> UserListResponse:
        """List users with optional status/search filters."""

        normalized_status = status.strip().lower() if status else None
        normalized_search = search.strip() if search else None

        with session_scope() as session:
            query = session.query(UserAccount)

            if normalized_status:
                query = query.filter(UserAccount.status == normalized_status)

            if normalized_search:
                keyword = f"%{normalized_search}%"
                query = query.filter(
                    or_(
                        UserAccount.username.ilike(keyword),
                        UserAccount.display_name.ilike(keyword),
                        UserAccount.full_name.ilike(keyword),
                        UserAccount.email.ilike(keyword),
                    )
                )

            total = query.count()

            users = (
                query.order_by(UserAccount.created_at.desc())
                .limit(limit)
                .offset(offset)
                .all()
            )

            user_items = [
                UserListItem(
                    username=user.username,
                    display_name=user.display_name,
                    status=user.status,
                    is_admin=user.is_admin,
                    must_change_password=user.must_change_password,
                    invited_by=user.invited_by,
                    created_at=user.created_at,
                    last_login_at=user.last_login_at,
                    approved_at=user.approved_at,
                    rejected_at=user.rejected_at,
                    initial_password_sent_at=user.initial_password_sent_at,
                )
                for user in users
            ]

        return UserListResponse(
            users=user_items,
            total=total,
            limit=limit,
            offset=offset,
        )

    # ------------------------------------------------------------------
    # 내부 헬퍼
    # ------------------------------------------------------------------
    def _to_status_response(self, user: UserAccount) -> UserStatusResponse:
        return UserStatusResponse(
            username=user.username,
            display_name=user.display_name,
            status=user.status,
            is_admin=user.is_admin,
        )


def _coerce_datetime(value: object) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        return datetime.utcfromtimestamp(value)
    raise PermissionError("토큰 시간 정보가 잘못되었습니다")


import os

# Only instantiate auth_service if not in testing mode
if os.getenv("TESTING") != "true":
    auth_service = AuthService()
else:
    from unittest.mock import MagicMock
    auth_service = MagicMock()


def login(payload: LoginRequest, client_host: Optional[str]) -> LoginResponse:
    return auth_service.login(payload, client_host)


__all__ = ["auth_service", "AuthService", "login"]







