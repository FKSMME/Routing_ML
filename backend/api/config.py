"""FastAPI 백엔드 설정 모듈."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import BaseSettings, Field, validator


class Settings(BaseSettings):
    """환경 변수 기반 설정."""

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
    allowed_origins: List[str] = Field(default_factory=lambda: ["*"])


    sql_table_candidates: str = Field(default="routing_candidates")
    sql_table_operations: str = Field(default="routing_candidate_operations")
    sql_preview_row_limit: int = Field(default=20, ge=1, le=500)

    rsl_database_url: str = Field(default="sqlite:///logs/rsl_store.db")


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

    class Config:
        env_prefix = "ROUTING_ML_"
        env_file = ".env"
        env_file_encoding = "utf-8"

    @validator("model_directory", "candidate_store_dir", "audit_log_dir", "model_registry_path", pre=True)
    def _expand_path(cls, value: Optional[Path | str]) -> Optional[Path]:  # noqa: N805
        if value is None:
            return None
        return Path(value).expanduser().resolve()

    @validator("candidate_store_dir", "audit_log_dir")
    def _ensure_dir(cls, value: Path) -> Path:  # noqa: N805
        value.mkdir(parents=True, exist_ok=True)
        return value

    @validator("rsl_database_url")
    def _prepare_rsl_path(cls, value: str) -> str:  # noqa: N805
        if value.startswith("sqlite:///"):
            path = Path(value.replace("sqlite:///", "", 1)).expanduser().resolve()
            path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{path}"


    @validator("model_directory", always=True)
    def _validate_override(cls, value: Optional[Path]) -> Optional[Path]:  # noqa: N805
        if value is None:
            return None

    @validator("model_directory")
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
