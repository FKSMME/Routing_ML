"""FastAPI 애플리케이션 패키지 초기화."""
from __future__ import annotations


def create_app():
    """런타임에 FastAPI 앱을 생성한다."""

    from .app import create_app as _create_app  # 지연 로드

    return _create_app()


__all__ = ["create_app"]
