"""워크플로우 그래프 및 런타임 설정 API."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

from backend.api.config import get_settings
from backend.api.schemas import (
    AuthenticatedUser,
    BlueprintToggleModel,
    DataSourceConfigModel,
    DataSourceTableProfileModel,
    ExportConfigModel,
    PowerQueryProfileModel,
    PredictorRuntimeModel,
    SQLConfigModel,
    TrainerRuntimeModel,
    VisualizationConfigModel,
    WorkflowConfigPatch,
    WorkflowConfigResponse,
    WorkflowGraphEdge,
    WorkflowGraphModel,
    WorkflowGraphNode,
)
from backend.api.security import require_auth
from backend.predictor_ml import apply_runtime_config as apply_predictor_runtime_config
from backend.trainer_ml import apply_trainer_runtime_config
from common.config_store import (
    DataSourceConfig,
    ExportFormatConfig,
    PowerQueryProfile,
    PredictorRuntimeConfig,
    SQLColumnConfig,
    TrainerRuntimeConfig,
    VisualizationConfig,
    WorkflowGraphConfig,
    workflow_config_store,
)
from common.sql_schema import DEFAULT_SQL_OUTPUT_COLUMNS, ensure_default_aliases
from common.logger import get_logger

router = APIRouter(prefix="/api/workflow", tags=["workflow-graph"])
logger = get_logger("api.workflow")
settings = get_settings()
audit_logger = get_logger("workflow.audit", log_dir=settings.audit_log_dir, use_json=True)


def _build_response(snapshot: dict) -> WorkflowConfigResponse:
    graph_cfg = WorkflowGraphConfig.from_dict(snapshot.get("graph", {}))
    trainer_cfg = TrainerRuntimeConfig.from_dict(snapshot.get("trainer", {}))
    predictor_cfg = PredictorRuntimeConfig.from_dict(snapshot.get("predictor", {}))
    sql_cfg = SQLColumnConfig.from_dict(snapshot.get("sql", {}))
    data_source_cfg = DataSourceConfig.from_dict(snapshot.get("data_source", {}))
    export_cfg = ExportFormatConfig.from_dict(snapshot.get("export", {}))
    viz_cfg = VisualizationConfig.from_dict(snapshot.get("visualization", {}))

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
        data_source=DataSourceConfigModel(
            access_path=data_source_cfg.access_path,
            default_table=data_source_cfg.default_table,
            backup_paths=data_source_cfg.backup_paths,
            table_profiles=[
                DataSourceTableProfileModel(**profile)
                for profile in data_source_cfg.table_profiles
            ],
            column_overrides=data_source_cfg.column_overrides,
            allow_gui_override=data_source_cfg.allow_gui_override,
            shading_palette=data_source_cfg.shading_palette,
            blueprint_switches=[
                BlueprintToggleModel(**toggle.to_dict())
                for toggle in data_source_cfg.blueprint_switches
            ],
            version_hint=data_source_cfg.version_hint,
        ),
        export=ExportConfigModel(**export_cfg.to_dict()),
        visualization=VisualizationConfigModel(**viz_cfg.to_dict()),
        updated_at=snapshot.get("updated_at", datetime.utcnow().isoformat()),
    )


@router.get("/graph", response_model=WorkflowConfigResponse)
async def get_workflow_graph(
    current_user: AuthenticatedUser = Depends(require_auth),
) -> WorkflowConfigResponse:
    """현재 워크플로우 그래프 및 런타임 설정을 반환한다."""

    snapshot = workflow_config_store.load()
    audit_logger.info(
        "workflow.graph.read",
        extra={"username": current_user.username},
    )
    return _build_response(snapshot)


@router.patch("/graph", response_model=WorkflowConfigResponse)
async def patch_workflow_graph(
    payload: WorkflowConfigPatch,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> WorkflowConfigResponse:
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
        logger.info(
            "워크플로우 그래프 업데이트",
            extra={
                "username": current_user.username,
                "nodes": len(graph_cfg.nodes),
                "edges": len(graph_cfg.edges),
            },
        )

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
        logger.info("트레이너 런타임 설정 저장", extra={"username": current_user.username})

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
        logger.info("예측기 런타임 설정 저장", extra={"username": current_user.username})

    if payload.sql is not None:
        sql_cfg = SQLColumnConfig.from_dict(snapshot.get("sql", {}))
        allowed_columns = set(DEFAULT_SQL_OUTPUT_COLUMNS)

        if payload.sql.available_columns is not None:
            invalid_columns = sorted(set(payload.sql.available_columns) - allowed_columns)
            if invalid_columns:
                message = "허용되지 않은 컬럼이 포함되어 있습니다: " + ", ".join(invalid_columns)
                logger.warning("SQL available_columns 검증 실패", extra={"invalid_columns": invalid_columns, "username": current_user.username})
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
            sql_cfg.available_columns = payload.sql.available_columns

        if payload.sql.output_columns is not None:
            available_set = set(sql_cfg.available_columns)
            invalid_outputs = [col for col in payload.sql.output_columns if col not in available_set]
            if invalid_outputs:
                message = "output_columns에 허용되지 않은 컬럼이 포함되어 있습니다: " + ", ".join(sorted(invalid_outputs))
                logger.warning("SQL output_columns 검증 실패", extra={"invalid_columns": invalid_outputs, "username": current_user.username})
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
            sql_cfg.output_columns = payload.sql.output_columns

        if payload.sql.column_aliases is not None:
            alias_targets = list(payload.sql.column_aliases.values())
            invalid_aliases = [alias for alias in alias_targets if alias not in allowed_columns]
            if invalid_aliases:
                message = "column_aliases가 허용되지 않은 컬럼을 참조합니다: " + ", ".join(sorted(invalid_aliases))
                logger.warning("SQL column_aliases 검증 실패", extra={"invalid_columns": invalid_aliases, "username": current_user.username})
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
            sql_cfg.column_aliases = ensure_default_aliases(payload.sql.column_aliases)

        if payload.sql.profiles is not None:
            sql_cfg.profiles = [
                PowerQueryProfile(name=profile.name, description=profile.description, mapping=profile.mapping)
                for profile in payload.sql.profiles
            ]
        if payload.sql.active_profile is not None:
            sql_cfg.active_profile = payload.sql.active_profile
        try:
            sql_cfg.validate_columns(list(DEFAULT_SQL_OUTPUT_COLUMNS))
        except ValueError as exc:
            logger.warning(
                "SQL 설정 검증 실패",
                extra={"error": str(exc), "username": current_user.username},
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


        snapshot = workflow_config_store.update_sql_column_config(sql_cfg)
        logger.info(
            "SQL 컬럼 매핑 업데이트",
            extra={
                "username": current_user.username,
                "active_profile": sql_cfg.active_profile,
            },
        )

    if payload.data_source is not None:
        data_cfg = DataSourceConfig.from_dict(snapshot.get("data_source", {}))
        if payload.data_source.access_path is not None:
            access_path = payload.data_source.access_path.strip()
            if not access_path.lower().endswith(".accdb"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Access 데이터베이스 파일(.accdb)만 허용됩니다.",
                )
            data_cfg.access_path = access_path
        if payload.data_source.default_table is not None:
            data_cfg.default_table = payload.data_source.default_table
        if payload.data_source.backup_paths is not None:
            data_cfg.backup_paths = payload.data_source.backup_paths
        if payload.data_source.table_profiles is not None:
            data_cfg.table_profiles = [profile.dict() for profile in payload.data_source.table_profiles]
        if payload.data_source.column_overrides is not None:
            data_cfg.column_overrides = {
                key: list(values)
                for key, values in payload.data_source.column_overrides.items()
            }
        if payload.data_source.allow_gui_override is not None:
            data_cfg.allow_gui_override = payload.data_source.allow_gui_override
        if payload.data_source.blueprint_switches is not None:
            toggle_map = {toggle.id: toggle for toggle in data_cfg.blueprint_switches}
            for toggle_patch in payload.data_source.blueprint_switches:
                toggle = toggle_map.get(toggle_patch.id)
                if not toggle:
                    continue
                if toggle_patch.enabled is not None:
                    toggle.enabled = toggle_patch.enabled
                if toggle_patch.description is not None:
                    toggle.description = toggle_patch.description
            data_cfg.blueprint_switches = list(toggle_map.values())
        snapshot = workflow_config_store.update_data_source_config(data_cfg)
        logger.info(
            "데이터 소스 설정 업데이트",
            extra={
                "username": current_user.username,
                "access_path": data_cfg.access_path,
                "default_table": data_cfg.default_table,
            },
        )

    if payload.export is not None:
        export_cfg = ExportFormatConfig.from_dict(snapshot.get("export", {}))
        for field_name in [
            "enable_cache_save",
            "enable_excel",
            "enable_csv",
            "enable_txt",
            "enable_parquet",
            "enable_json",
            "erp_interface_enabled",
            "erp_protocol",
            "erp_endpoint",
            "default_encoding",
            "export_directory",
            "compress_on_save",
        ]:
            value = getattr(payload.export, field_name)
            if value is not None:
                setattr(export_cfg, field_name, value)
        snapshot = workflow_config_store.update_export_config(export_cfg)
        logger.info(
            "결과 내보내기 설정 업데이트",
            extra={
                "username": current_user.username,
                "formats": {
                    "excel": export_cfg.enable_excel,
                    "csv": export_cfg.enable_csv,
                    "txt": export_cfg.enable_txt,
                    "parquet": export_cfg.enable_parquet,
                    "json": export_cfg.enable_json,
                },
                "erp_enabled": export_cfg.erp_interface_enabled,
            },
        )

    if payload.visualization is not None:
        viz_cfg = VisualizationConfig.from_dict(snapshot.get("visualization", {}))
        for field_name in [
            "tensorboard_projector_dir",
            "projector_enabled",
            "projector_metadata_columns",
            "neo4j_enabled",
            "neo4j_browser_url",
            "neo4j_workspace",
            "publish_service_enabled",
            "publish_notes",
        ]:
            value = getattr(payload.visualization, field_name)
            if value is not None:
                setattr(viz_cfg, field_name, value)
        snapshot = workflow_config_store.update_visualization_config(viz_cfg)
        logger.info(
            "시각화 설정 업데이트",
            extra={
                "username": current_user.username,
                "tensorboard": viz_cfg.tensorboard_projector_dir,
                "neo4j": viz_cfg.neo4j_browser_url,
            },
        )

    audit_logger.info(
        "workflow.graph.patch",
        extra={"username": current_user.username, "updated_keys": list(payload.dict(exclude_none=True).keys())},
    )
    return _build_response(snapshot)


__all__ = ["router"]
