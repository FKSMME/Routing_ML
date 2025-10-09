"""FastAPI 애플리케이션 엔트리포인트."""
from __future__ import annotations

from backend.api.pydantic_compat import ensure_forward_ref_compat


# NOTE: FastAPI/Pydantic import 전에 호환성 패치를 적용해 Python 3.12에서의
# ForwardRef 오류를 예방한다.

ensure_forward_ref_compat()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.config import get_settings
from backend.api.routes.access import router as access_router
from backend.api.routes.algorithm_viz import router as algorithm_viz_router
from backend.api.routes.anomaly import router as anomaly_router  # ✅ PyODBC 리팩토링 완료
from backend.api.routes.audit import router as audit_router
from backend.api.routes.auth import router as auth_router
from backend.api.routes.bulk_upload import router as bulk_upload_router
from backend.api.routes.data_quality import router as data_quality_router
from backend.api.routes.database_config import router as database_config_router
from backend.api.routes.drift import router as drift_router
from backend.api.routes.health import router as health_router
from backend.api.routes.items import router as items_router
from backend.api.routes.logs import router as logs_router
from backend.api.routes.master_data import router as master_data_router
from backend.api.routes.onprem_nlp import router as onprem_nlp_router
from backend.api.routes.prediction import router as prediction_router
from backend.api.routes.routing import router as routing_router
from backend.api.routes.rsl import router as rsl_router
from backend.api.routes.trainer import router as trainer_router
from backend.api.routes.training import router as training_router
# from backend.api.routes.weekly_report import router as weekly_report_router  # TODO: weekly_report_service 미구현
from backend.api.routes.workflow import router as workflow_router
from backend.api.routes.workspace import router as workspace_router
from backend.api.routing_groups import router as routing_groups_router
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
    app.include_router(health_router)
    app.include_router(drift_router)
    app.include_router(auth_router)
    app.include_router(logs_router)
    app.include_router(bulk_upload_router)
    app.include_router(data_quality_router)
    app.include_router(anomaly_router)  # ✅ PyODBC 리팩토링 완료
    # app.include_router(weekly_report_router)  # TODO: weekly_report_service 미구현
    app.include_router(database_config_router)
    app.include_router(items_router)
    app.include_router(onprem_nlp_router)
    app.include_router(prediction_router)
    app.include_router(workflow_router)
    app.include_router(trainer_router)
    app.include_router(training_router)
    app.include_router(workspace_router)
    app.include_router(audit_router)
    app.include_router(routing_groups_router)
    app.include_router(routing_router)
    app.include_router(master_data_router)
    app.include_router(access_router)
    app.include_router(rsl_router)
    app.include_router(algorithm_viz_router)

    get_logger("api.app").info("FastAPI 애플리케이션 초기화 완료")
    return app


app = create_app()

__all__ = ["app", "create_app"]
