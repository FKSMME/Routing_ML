"""FastAPI 백엔드 설정 모듈."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """환경 변수 기반 설정."""

    model_config = SettingsConfigDict(
        env_prefix="",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow",
        protected_namespaces=("settings_",),
    )

    model_directory: Optional[Path] = Field(
        default=None,
        description="비상시 수동 지정할 모델 경로",
        env=("MODEL_DIRECTORY_OVERRIDE", "MODEL_DIRECTORY"),
    )
    model_registry_path: Path = Field(
        default=Path("models/registry.db"),
        description="모델 레지스트리 SQLite 파일 경로",
    )
    default_top_k: int = Field(default=10, ge=1, le=50)
    default_similarity_threshold: float = Field(default=0.8, ge=0.0, le=1.0)

    enable_candidate_persistence: bool = Field(default=True)
    candidate_store_dir: Path = Field(default=Path("logs/candidates"))
    workflow_code_dir: Path = Field(
        default=Path("scripts/generated_workflow"),
        description="워크플로우 노드 코드 자동 생성 출력 경로",
    )
    allowed_origins: List[str] = Field(
        default_factory=lambda: [
            # HTTP - Localhost
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5175",
            "http://localhost:5176",
            "http://127.0.0.1:5176",
            # HTTPS - Localhost
            "https://localhost:3000",
            "https://127.0.0.1:3000",
            "https://localhost:5173",
            "https://127.0.0.1:5173",
            "https://localhost:5174",
            "https://127.0.0.1:5174",
            # HTTP - IP Address
            "http://10.204.2.28:3000",
            "http://10.204.2.28:5173",
            "http://10.204.2.28:5174",
            # HTTPS - IP Address
            "https://10.204.2.28:3000",
            "https://10.204.2.28:5173",
            "https://10.204.2.28:5174",
            # HTTP - Production Domains
            # (deprecated) kept for backward compatibility if needed
            # HTTPS - Production Domains
            "https://rtml.ksm.co.kr:3000",
            "https://rtml.ksm.co.kr:5173",
            "https://rtml.ksm.co.kr:5174",
            "https://mcs.ksm.co.kr:3000",
            "https://mcs.ksm.co.kr:5173",
            "https://mcs.ksm.co.kr:5174",
        ],
    )

    sql_table_candidates: str = Field(default="routing_candidates")
    sql_table_operations: str = Field(default="routing_candidate_operations")
    sql_preview_row_limit: int = Field(default=20, ge=1, le=500)

    rsl_database_url: str = Field(default="sqlite:///logs/rsl_store.db")
    routing_groups_database_url: str = Field(
        default="sqlite:///logs/routing_groups.db",
        description="라우팅 그룹 저장소 SQLite 파일 경로",
    )


    # Windows 인증/LDAP 설정
    windows_auth_enabled: bool = Field(default=True)
    windows_domain: Optional[str] = Field(default=None, description="기본 Windows 도메인")
    windows_ldap_server: Optional[str] = Field(default=None, description="LDAP 서버 호스트 혹은 URI")
    windows_ldap_port: int = Field(default=636, ge=1, le=65535)
    windows_ldap_use_ssl: bool = Field(default=True)
    windows_ldap_verify_cert: bool = Field(default=True)
    windows_ldap_search_base: Optional[str] = Field(default=None)
    windows_auth_timeout: float = Field(default=5.0, gt=0)
    windows_fallback_users: Dict[str, str] = Field(default_factory=dict, description="SHA-256 해시 기반 폴백 사용자")

    audit_log_dir: Path = Field(default=Path("logs/audit"))
    session_ttl_seconds: int = Field(default=3600, ge=300)

    jwt_secret_key: str = Field(
        default="INSECURE-CHANGE-ME-IN-PRODUCTION",
        description="JWT 서명을 위한 비밀 키 (MUST be changed in production)",
    )

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret(cls, v):
        """Reject insecure default JWT secrets."""
        insecure_defaults = ["change-me", "INSECURE-CHANGE-ME-IN-PRODUCTION", "secret", ""]
        if v.lower() in [s.lower() for s in insecure_defaults]:
            import warnings
            warnings.warn(
                "⚠️  WARNING: JWT secret key is using insecure default! "
                "Set JWT_SECRET_KEY environment variable to a secure random value. "
                "Generate one with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )
            # Don't raise error, just warn for development
            return v
        if len(v) < 32:
            import warnings
            warnings.warn(
                f"⚠️  WARNING: JWT secret key too short ({len(v)} chars). "
                "Must be at least 32 characters for security. "
                "Generate secure key with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )
        return v
    jwt_algorithm: str = Field(default="HS256")
    jwt_access_token_ttl_seconds: int = Field(default=3600, ge=300)
    jwt_cookie_name: str = Field(default="routing_ml_session")
    jwt_cookie_secure: bool = Field(default=True)  # HTTPS 환경에서 True로 변경

    # Email notification settings (MS365 Outlook)
    email_enabled: bool = Field(default=False, description="이메일 알림 사용 여부")
    email_smtp_server: str = Field(default="smtp.office365.com", description="SMTP 서버 주소")
    email_smtp_port: int = Field(default=587, description="SMTP 포트")
    email_sender: Optional[str] = Field(default=None, description="발신자 이메일 주소")
    email_password: Optional[str] = Field(default=None, description="이메일 계정 비밀번호 또는 앱 비밀번호")
    email_admin: Optional[str] = Field(default=None, description="관리자 이메일 주소 (회원가입 알림 수신)")
    email_use_tls: bool = Field(default=True, description="TLS 사용 여부")

    # Database connection settings (from environment)
    db_type: str = Field(default="MSSQL", description="데이터베이스 타입 (현재는 MSSQL만 지원)")
    mssql_server: Optional[str] = Field(default=None, description="MSSQL 서버 주소")
    mssql_database: Optional[str] = Field(default=None, description="MSSQL 데이터베이스명")
    mssql_user: Optional[str] = Field(default=None, description="MSSQL 사용자명")
    mssql_password: Optional[str] = Field(default=None, description="MSSQL 비밀번호")
    mssql_encrypt: bool = Field(default=False, description="MSSQL 암호화 사용 여부")
    mssql_trust_certificate: bool = Field(default=True, description="MSSQL 인증서 신뢰 여부")

    # API server settings
    api_host: str = Field(default="0.0.0.0", description="API 서버 호스트")
    api_port: int = Field(default=8000, description="API 서버 포트")
    system_overview_public: bool = Field(
        default=True,
        description="Expose system overview API without authentication when True",
    )

    # Legacy model path
    model_path: Optional[str] = Field(
        default=None,
        description="레거시 모델 경로"
    )

    @field_validator(
        "model_directory",
        "candidate_store_dir",
        "audit_log_dir",
        "model_registry_path",
        "workflow_code_dir",
        mode="before",
    )
    @classmethod
    def _expand_path(cls, value: Optional[Path | str]) -> Optional[Path]:  # noqa: N805
        if value is None:
            return None
        return Path(value).expanduser().resolve()

    @field_validator("candidate_store_dir", "audit_log_dir", "workflow_code_dir")
    @classmethod
    def _ensure_dir(cls, value: Path) -> Path:  # noqa: N805
        value.mkdir(parents=True, exist_ok=True)
        return value

    @field_validator("rsl_database_url", "routing_groups_database_url")
    @classmethod
    def _prepare_sqlite_path(cls, value: str) -> str:  # noqa: N805
        if value.startswith("sqlite:///"):
            path = Path(value.replace("sqlite:///", "", 1)).expanduser().resolve()
            path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{path}"
        return value


    @field_validator("model_directory")
    @classmethod
    def _validate_override(cls, value: Optional[Path]) -> Optional[Path]:  # noqa: N805
        if value is None:
            return None
        return value

    @field_validator("model_directory")
    @classmethod
    def _ensure_manifest(cls, value: Path) -> Path:  # noqa: N805
        try:
            if value.exists():
                if value.is_dir():
                    from models.manifest import write_manifest

                    write_manifest(value, strict=False)
                elif value.suffix.lower() == ".json" and value.parent.exists():
                    from models.manifest import write_manifest

                    write_manifest(value.parent, strict=False)
        except Exception:
            # 설정 로딩 시 매니페스트 생성 실패는 무시하고 런타임에서 처리
            pass


        return value


@lru_cache
def get_settings() -> Settings:
    """싱글톤 설정 객체 반환."""

    return Settings()


__all__ = ["Settings", "get_settings"]
