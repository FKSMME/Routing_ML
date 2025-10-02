"""모델 훈련 전용 FastAPI 애플리케이션."""
from __future__ import annotations

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.config import get_settings
from backend.api.routes.auth import router as auth_router
from backend.api.routes.database_config import router as database_config_router
from backend.api.routes.master_data import router as master_data_router
from backend.api.routes.trainer import router as trainer_router
from backend.api.routes.training import router as training_router
from backend.api.routes.workspace import router as workspace_router
from common.logger import get_logger


def create_training_app() -> FastAPI:
    """모델 훈련 전용 애플리케이션 생성"""
    settings = get_settings()

    app = FastAPI(
        title="Routing-ML Training Service",
        version="1.0.0",
        description="모델 훈련 및 데이터 관리 서비스"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 훈련 관련 라우터만 등록
    app.include_router(auth_router)
    app.include_router(database_config_router)
    app.include_router(master_data_router)
    app.include_router(trainer_router)
    app.include_router(training_router)
    app.include_router(workspace_router)

    get_logger("api.training_app").info("모델 훈련 서비스 초기화 완료")
    return app


app = create_training_app()

__all__ = ["app", "create_training_app"]
