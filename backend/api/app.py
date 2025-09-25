"""FastAPI 애플리케이션 팩토리."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.config import get_settings
from backend.api.routes.prediction import router as prediction_router
from common.logger import get_logger


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Routing-ML API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(prediction_router)
    get_logger("api.app").info("FastAPI 애플리케이션 초기화 완료")
    return app


app = create_app()

__all__ = ["app", "create_app"]
