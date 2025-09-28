"""FastAPI ?좏뵆由ъ??댁뀡 ?⑺넗由?"""
from __future__ import annotations

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.config import get_settings
from backend.api.routes.auth import router as auth_router
from backend.api.routes.prediction import router as prediction_router
from backend.api.routes.workflow import router as workflow_router
from backend.api.routes.trainer import router as trainer_router
from backend.api.routes.workspace import router as workspace_router
from backend.api.routes.master_data import router as master_data_router
from backend.api.routes.access import router as access_router
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
    app.include_router(auth_router)
    app.include_router(prediction_router)
    app.include_router(workflow_router)
    app.include_router(trainer_router)
    app.include_router(workspace_router)
    app.include_router(master_data_router)
    app.include_router(access_router)

    get_logger("api.app").info("FastAPI ?좏뵆由ъ??댁뀡 珥덇린???꾨즺")
    return app


app = create_app()

__all__ = ["app", "create_app"]



