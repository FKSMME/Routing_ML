"""라우팅 생성 전용 FastAPI 애플리케이션."""
from __future__ import annotations

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.config import get_settings
from backend.api.routes.audit import router as audit_router
from backend.api.routes.auth import router as auth_router
from backend.api.routes.blueprint import router as blueprint_router
from backend.api.routes.data_mapping import router as data_mapping_router
from backend.api.routes.database_config import router as database_config_router
from backend.api.routes.items import router as items_router
from backend.api.routes.prediction import router as prediction_router
from backend.api.routes.routing import router as routing_router
from backend.api.routes.rsl import router as rsl_router
from backend.api.routes.workflow import router as workflow_router
from backend.api.routing_groups import router as routing_groups_router
from common.logger import get_logger


def create_prediction_app() -> FastAPI:
    """라우팅 생성 전용 애플리케이션 생성"""
    settings = get_settings()

    app = FastAPI(
        title="Routing-ML Prediction Service",
        version="1.0.0",
        description="라우팅 생성 및 예측 서비스"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 라우팅 생성 관련 라우터만 등록
    app.include_router(auth_router)
    app.include_router(blueprint_router)
    app.include_router(data_mapping_router)
    app.include_router(database_config_router)
    app.include_router(items_router)
    app.include_router(prediction_router)
    app.include_router(routing_router)
    app.include_router(routing_groups_router)
    app.include_router(workflow_router)
    app.include_router(rsl_router)
    app.include_router(audit_router)

    get_logger("api.prediction_app").info("라우팅 생성 서비스 초기화 완료")
    return app


app = create_prediction_app()

__all__ = ["app", "create_prediction_app"]
