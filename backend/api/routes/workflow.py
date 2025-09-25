"""워크플로우 그래프 및 런타임 설정 API."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException, status

from backend.api.schemas import (
    PowerQueryProfileModel,
    PredictorRuntimeModel,
    SQLConfigModel,
    TrainerRuntimeModel,
    WorkflowConfigPatch,
    WorkflowConfigResponse,
    WorkflowGraphEdge,
    WorkflowGraphModel,
    WorkflowGraphNode,
)
from backend.predictor_ml import apply_runtime_config as apply_predictor_runtime_config
from backend.trainer_ml import apply_trainer_runtime_config
from common.config_store import (
    PowerQueryProfile,
    PredictorRuntimeConfig,
    SQLColumnConfig,
    TrainerRuntimeConfig,
    WorkflowGraphConfig,
    workflow_config_store,
)
from common.logger import get_logger

router = APIRouter(prefix="/api/workflow", tags=["workflow-graph"])
logger = get_logger("api.workflow")


def _build_response(snapshot: dict) -> WorkflowConfigResponse:
    graph_cfg = WorkflowGraphConfig.from_dict(snapshot.get("graph", {}))
    trainer_cfg = TrainerRuntimeConfig.from_dict(snapshot.get("trainer", {}))
    predictor_cfg = PredictorRuntimeConfig.from_dict(snapshot.get("predictor", {}))
    sql_cfg = SQLColumnConfig.from_dict(snapshot.get("sql", {}))

    return WorkflowConfigResponse(
        graph=WorkflowGraphModel(
            nodes=[WorkflowGraphNode(**node) for node in graph_cfg.nodes],
            edges=[WorkflowGraphEdge(**edge) for edge in graph_cfg.edges],
            design_refs=graph_cfg.design_refs,
            last_saved=graph_cfg.last_saved,
        ),
        trainer=TrainerRuntimeModel(**trainer_cfg.to_dict()),
        predictor=PredictorRuntimeModel(**predictor_cfg.to_dict()),
        sql=SQLConfigModel(
            output_columns=sql_cfg.output_columns,
            column_aliases=sql_cfg.column_aliases,
            available_columns=sql_cfg.available_columns,
            profiles=[PowerQueryProfileModel(**profile.to_dict()) for profile in sql_cfg.profiles],
            active_profile=sql_cfg.active_profile,
        ),
        updated_at=snapshot.get("updated_at", datetime.utcnow().isoformat()),
    )


@router.get("/graph", response_model=WorkflowConfigResponse)
async def get_workflow_graph() -> WorkflowConfigResponse:
    """현재 워크플로우 그래프 및 런타임 설정을 반환한다."""

    snapshot = workflow_config_store.load()
    return _build_response(snapshot)


@router.patch("/graph", response_model=WorkflowConfigResponse)
async def patch_workflow_graph(payload: WorkflowConfigPatch) -> WorkflowConfigResponse:
    """워크플로우 그래프와 런타임 설정을 갱신한다."""

    if payload is None or payload.dict(exclude_unset=True) == {}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="업데이트할 항목이 없습니다")

    snapshot = workflow_config_store.load()

    if payload.graph is not None:
        graph_cfg = WorkflowGraphConfig.from_dict(snapshot.get("graph", {}))
        if payload.graph.nodes is not None:
            graph_cfg.nodes = [node.dict() for node in payload.graph.nodes]
        if payload.graph.edges is not None:
            graph_cfg.edges = [edge.dict() for edge in payload.graph.edges]
        if payload.graph.design_refs is not None:
            graph_cfg.design_refs = payload.graph.design_refs
        graph_cfg.last_saved = datetime.utcnow().isoformat()
        snapshot = workflow_config_store.update_graph(graph_cfg)
        logger.info("워크플로우 그래프 업데이트: nodes=%d edges=%d", len(graph_cfg.nodes), len(graph_cfg.edges))

    if payload.trainer is not None:
        trainer_cfg = TrainerRuntimeConfig.from_dict(snapshot.get("trainer", {}))
        if payload.trainer.similarity_threshold is not None:
            trainer_cfg.similarity_threshold = payload.trainer.similarity_threshold
        if payload.trainer.trim_std_enabled is not None:
            trainer_cfg.trim_std_enabled = payload.trainer.trim_std_enabled
        if payload.trainer.trim_lower_percent is not None:
            trainer_cfg.trim_lower_percent = payload.trainer.trim_lower_percent
        if payload.trainer.trim_upper_percent is not None:
            trainer_cfg.trim_upper_percent = payload.trainer.trim_upper_percent
        snapshot = workflow_config_store.update_trainer_runtime(trainer_cfg)
        apply_trainer_runtime_config(trainer_cfg)
        logger.info("트레이너 런타임 설정 저장")

    if payload.predictor is not None:
        predictor_cfg = PredictorRuntimeConfig.from_dict(snapshot.get("predictor", {}))
        if payload.predictor.similarity_high_threshold is not None:
            predictor_cfg.similarity_high_threshold = payload.predictor.similarity_high_threshold
        if payload.predictor.max_routing_variants is not None:
            predictor_cfg.max_routing_variants = payload.predictor.max_routing_variants
        if payload.predictor.trim_std_enabled is not None:
            predictor_cfg.trim_std_enabled = payload.predictor.trim_std_enabled
        if payload.predictor.trim_lower_percent is not None:
            predictor_cfg.trim_lower_percent = payload.predictor.trim_lower_percent
        if payload.predictor.trim_upper_percent is not None:
            predictor_cfg.trim_upper_percent = payload.predictor.trim_upper_percent
        snapshot = workflow_config_store.update_predictor_runtime(predictor_cfg)
        apply_predictor_runtime_config(predictor_cfg)
        logger.info("예측기 런타임 설정 저장")

    if payload.sql is not None:
        sql_cfg = SQLColumnConfig.from_dict(snapshot.get("sql", {}))
        if payload.sql.output_columns is not None:
            sql_cfg.output_columns = payload.sql.output_columns
        if payload.sql.column_aliases is not None:
            sql_cfg.column_aliases = payload.sql.column_aliases
        if payload.sql.available_columns is not None:
            sql_cfg.available_columns = payload.sql.available_columns
        if payload.sql.profiles is not None:
            sql_cfg.profiles = [
                PowerQueryProfile(name=profile.name, description=profile.description, mapping=profile.mapping)
                for profile in payload.sql.profiles
            ]
        if payload.sql.active_profile is not None:
            sql_cfg.active_profile = payload.sql.active_profile
        snapshot = workflow_config_store.update_sql_column_config(sql_cfg)
        logger.info("SQL 컬럼 매핑 업데이트: active_profile=%s", sql_cfg.active_profile)

    return _build_response(snapshot)


__all__ = ["router"]
