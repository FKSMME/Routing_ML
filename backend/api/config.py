"""FastAPI 백엔드 설정 모듈."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import BaseSettings, Field, validator


class Settings(BaseSettings):
    """환경 변수 기반 설정."""

    model_directory: Path = Field(default=Path("models/latest"), description="학습된 모델 경로")
    default_top_k: int = Field(default=10, ge=1, le=50)

    default_similarity_threshold: float = Field(default=0.8, ge=0.0, le=1.0)
=======
    default_similarity_threshold: float = Field(default=0.3, ge=0.0, le=1.0)

    enable_candidate_persistence: bool = Field(default=True)
    candidate_store_dir: Path = Field(default=Path("logs/candidates"))
    allowed_origins: List[str] = Field(default_factory=lambda: ["*"])

    class Config:
        env_prefix = "ROUTING_ML_"
        env_file = ".env"
        env_file_encoding = "utf-8"

    @validator("model_directory", "candidate_store_dir", pre=True)
    def _expand_path(cls, value: Path | str) -> Path:  # noqa: N805
        return Path(value).expanduser().resolve()

    @validator("candidate_store_dir")
    def _ensure_candidate_dir(cls, value: Path) -> Path:  # noqa: N805
        value.mkdir(parents=True, exist_ok=True)
        return value


@lru_cache
def get_settings() -> Settings:
    """싱글톤 설정 객체 반환."""
    return Settings()


__all__ = ["Settings", "get_settings"]
