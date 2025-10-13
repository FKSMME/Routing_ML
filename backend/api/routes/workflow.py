"""워크플로우 그래프 및 런타임 설정 API."""
from __future__ import annotations

from collections import Counter
import hashlib
from copy import deepcopy
from datetime import datetime
from pathlib import Path

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
    WorkflowCodeModule,
    WorkflowCodeSyncResponse,
    WorkflowConfigPatch,
    WorkflowConfigResponse,
    WorkflowGraphEdge,
    WorkflowGraphModel,
    WorkflowGraphNode,
)
from backend.api.security import require_auth
from backend.predictor_ml import apply_runtime_config as apply_predictor_runtime_config

# Access 파일 확장자 정의
ACCESS_FILE_SUFFIXES = {".mdb", ".accdb"}
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
from common.workflow_codegen import generate_workflow_modules
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
            exclusive_column_groups=sql_cfg.exclusive_column_groups,
            key_columns=sql_cfg.key_columns,
            training_output_mapping=sql_cfg.training_output_mapping,
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


@router.get("/config", response_model=WorkflowConfigResponse)
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


@router.patch("/config", response_model=WorkflowConfigResponse)
@router.patch("/graph", response_model=WorkflowConfigResponse)
async def patch_workflow_graph(
    payload: WorkflowConfigPatch,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> WorkflowConfigResponse:
    """워크플로우 그래프와 런타임 설정을 갱신한다."""

    if payload is None or payload.dict(exclude_unset=True) == {}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="업데이트할 항목이 없습니다")

    original_snapshot = workflow_config_store.load()
    working_snapshot = deepcopy(original_snapshot)
    pending_logs = []
    runtime_apply_tasks = []
    any_changes = False

    if payload.graph is not None:
        graph_cfg = WorkflowGraphConfig.from_dict(working_snapshot.get("graph", {}))
        if payload.graph.nodes is not None:
            graph_cfg.nodes = [node.dict() for node in payload.graph.nodes]
        if payload.graph.edges is not None:
            graph_cfg.edges = [edge.dict() for edge in payload.graph.edges]
        if payload.graph.design_refs is not None:
            graph_cfg.design_refs = payload.graph.design_refs
        graph_cfg.last_saved = datetime.utcnow().isoformat()
        working_snapshot["graph"] = graph_cfg.to_dict()
        any_changes = True
        pending_logs.append(
            (
                logger.info,
                "워크플로우 그래프 업데이트",
                {
                    "username": current_user.username,
                    "nodes": len(graph_cfg.nodes),
                    "edges": len(graph_cfg.edges),
                },
            )
        )

    if payload.trainer is not None:
        trainer_cfg = TrainerRuntimeConfig.from_dict(working_snapshot.get("trainer", {}))
        if payload.trainer.similarity_threshold is not None:
            trainer_cfg.similarity_threshold = payload.trainer.similarity_threshold
        if payload.trainer.trim_std_enabled is not None:
            trainer_cfg.trim_std_enabled = payload.trainer.trim_std_enabled
        if payload.trainer.trim_lower_percent is not None:
            trainer_cfg.trim_lower_percent = payload.trainer.trim_lower_percent
        if payload.trainer.trim_upper_percent is not None:
            trainer_cfg.trim_upper_percent = payload.trainer.trim_upper_percent
        if payload.trainer.time_profiles_enabled is not None:
            trainer_cfg.time_profiles_enabled = payload.trainer.time_profiles_enabled
        if payload.trainer.time_profile_strategy is not None:
            trainer_cfg.time_profile_strategy = payload.trainer.time_profile_strategy
        if payload.trainer.time_profile_optimal_sigma is not None:
            trainer_cfg.time_profile_optimal_sigma = payload.trainer.time_profile_optimal_sigma
        if payload.trainer.time_profile_safe_sigma is not None:
            trainer_cfg.time_profile_safe_sigma = payload.trainer.time_profile_safe_sigma
        working_snapshot["trainer"] = trainer_cfg.to_dict()
        any_changes = True
        runtime_apply_tasks.append(("trainer", apply_trainer_runtime_config, trainer_cfg))
        pending_logs.append(
            (
                logger.info,
                "트레이너 런타임 설정 저장",
                {"username": current_user.username},
            )
        )

    if payload.predictor is not None:
        predictor_cfg = PredictorRuntimeConfig.from_dict(working_snapshot.get("predictor", {}))
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
        working_snapshot["predictor"] = predictor_cfg.to_dict()
        any_changes = True
        runtime_apply_tasks.append(("predictor", apply_predictor_runtime_config, predictor_cfg))
        pending_logs.append(
            (
                logger.info,
                "예측기 런타임 설정 저장",
                {"username": current_user.username},
            )
        )

    if payload.sql is not None:
        sql_cfg = SQLColumnConfig.from_dict(working_snapshot.get("sql", {}))
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
            empty_alias_keys = [key for key in payload.sql.column_aliases if not key.strip()]
            if empty_alias_keys:
                message = "column_aliases에 빈 별칭 키가 포함되어 있습니다"
                logger.warning("SQL column_aliases 검증 실패", extra={"reason": "empty-key", "username": current_user.username})
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
            alias_key_counter = Counter(payload.sql.column_aliases.keys())
            duplicate_aliases = [alias for alias, count in alias_key_counter.items() if count > 1]
            if duplicate_aliases:
                message = "column_aliases에 중복된 별칭이 있습니다: " + ", ".join(sorted(duplicate_aliases))
                logger.warning(
                    "SQL column_aliases 검증 실패",
                    extra={"invalid_columns": duplicate_aliases, "username": current_user.username},
                )
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
            alias_targets = list(payload.sql.column_aliases.values())
            invalid_aliases = [alias for alias in alias_targets if alias not in allowed_columns]
            if invalid_aliases:
                message = "column_aliases가 허용되지 않은 컬럼을 참조합니다: " + ", ".join(sorted(invalid_aliases))
                logger.warning("SQL column_aliases 검증 실패", extra={"invalid_columns": invalid_aliases, "username": current_user.username})
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
            sql_cfg.column_aliases = ensure_default_aliases(payload.sql.column_aliases)

        if payload.sql.exclusive_column_groups is not None:
            normalized_groups = []
            for group in payload.sql.exclusive_column_groups:
                if not group:
                    continue
                invalid_group = sorted({column for column in group if column not in allowed_columns})
                if invalid_group:
                    message = "exclusive_column_groups에 허용되지 않은 컬럼이 포함되어 있습니다: " + ", ".join(invalid_group)
                    logger.warning(
                        "SQL exclusive_column_groups 검증 실패",
                        extra={"invalid_columns": invalid_group, "username": current_user.username},
                    )
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
                deduped_group: list[str] = []
                for column in group:
                    if column in allowed_columns and column not in deduped_group:
                        deduped_group.append(column)
                if len(deduped_group) > 1:
                    normalized_groups.append(deduped_group)
            sql_cfg.exclusive_column_groups = normalized_groups

        if payload.sql.key_columns is not None:
            if not payload.sql.key_columns:
                message = "key_columns는 최소 1개 이상의 컬럼을 포함해야 합니다"
                logger.warning("SQL key_columns 검증 실패", extra={"reason": "empty", "username": current_user.username})
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
            invalid_keys = sorted(set(payload.sql.key_columns) - allowed_columns)
            if invalid_keys:
                message = "key_columns에 허용되지 않은 컬럼이 포함되어 있습니다: " + ", ".join(invalid_keys)
                logger.warning("SQL key_columns 검증 실패", extra={"invalid_columns": invalid_keys, "username": current_user.username})
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
            sql_cfg.key_columns = payload.sql.key_columns

        if payload.sql.training_output_mapping is not None:
            empty_features = [key for key in payload.sql.training_output_mapping if not key.strip()]
            if empty_features:
                message = "training_output_mapping에 빈 피처명이 포함되어 있습니다"
                logger.warning(
                    "SQL training_output_mapping 검증 실패",
                    extra={"reason": "empty-feature", "username": current_user.username},
                )
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
            invalid_training_targets = sorted(
                {column for column in payload.sql.training_output_mapping.values() if column not in allowed_columns}
            )
            if invalid_training_targets:
                message = (
                    "training_output_mapping이 허용되지 않은 컬럼을 참조합니다: "
                    + ", ".join(invalid_training_targets)
                )
                logger.warning(
                    "SQL training_output_mapping 검증 실패",
                    extra={"invalid_columns": invalid_training_targets, "username": current_user.username},
                )
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
            sql_cfg.training_output_mapping = payload.sql.training_output_mapping

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


        working_snapshot["sql"] = sql_cfg.to_dict()
        any_changes = True
        pending_logs.append(
            (
                logger.info,
                "SQL 컬럼 매핑 업데이트",
                {
                    "username": current_user.username,
                    "active_profile": sql_cfg.active_profile,
                    "key_columns": sql_cfg.key_columns,
                },
            )
        )

    if payload.data_source is not None:
        data_cfg = DataSourceConfig.from_dict(working_snapshot.get("data_source", {}))
        if payload.data_source.access_path is not None:
            access_path = payload.data_source.access_path.strip()
            allowed_suffixes = sorted(ACCESS_FILE_SUFFIXES)
            if Path(access_path).suffix.lower() not in ACCESS_FILE_SUFFIXES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Access 데이터베이스 파일({', '.join(allowed_suffixes)})만 허용됩니다.",
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
        working_snapshot["data_source"] = data_cfg.to_dict()
        any_changes = True
        pending_logs.append(
            (
                logger.info,
                "데이터 소스 설정 업데이트",
                {
                    "username": current_user.username,
                    "access_path": data_cfg.access_path,
                    "default_table": data_cfg.default_table,
                },
            )
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
        working_snapshot["export"] = export_cfg.to_dict()
        any_changes = True
        pending_logs.append(
            (
                logger.info,
                "결과 내보내기 설정 업데이트",
                {
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
        working_snapshot["visualization"] = viz_cfg.to_dict()
        any_changes = True
        pending_logs.append(
            (
                logger.info,
                "시각화 설정 업데이트",
                {
                    "username": current_user.username,
                    "tensorboard": viz_cfg.tensorboard_projector_dir,
                    "neo4j": viz_cfg.neo4j_browser_url,
                },
            )
        )

    final_snapshot = original_snapshot
    if any_changes:
        try:
            final_snapshot = workflow_config_store.apply_patch_atomic(working_snapshot)
        except Exception as exc:  # pragma: no cover - unexpected I/O failure
            logger.exception(
                "워크플로우 설정 저장 실패",
                extra={"username": current_user.username},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="설정을 저장하지 못했습니다.",
            ) from exc

        if runtime_apply_tasks:
            runtime_name = "runtime"
            try:
                for runtime_name, apply_func, runtime_cfg in runtime_apply_tasks:
                    apply_func(runtime_cfg)
            except Exception as exc:  # pragma: no cover - runtime failure
                logger.exception(
                    "런타임 설정 적용 실패, 이전 스냅샷으로 복구합니다",
                    extra={
                        "username": current_user.username,
                        "runtime": runtime_name,
                    },
                )
                try:
                    workflow_config_store.apply_patch_atomic(original_snapshot)
                except Exception:  # pragma: no cover - rollback failure
                    logger.exception(
                        "런타임 롤백 실패",
                        extra={"username": current_user.username},
                    )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="런타임 설정 적용에 실패했습니다.",
                ) from exc

        for log_func, message, extra in pending_logs:
            log_func(message, extra=extra)

    payload_dict = payload.dict(exclude_none=True)
    audit_details: dict[str, object] = {
        "username": current_user.username,
        "updated_keys": list(payload_dict.keys()),
    }
    sql_payload = payload_dict.get("sql")
    if isinstance(sql_payload, dict):
        sql_summary: dict[str, object] = {}
        if "output_columns" in sql_payload:
            sql_summary["output_columns_count"] = len(sql_payload.get("output_columns", []))
        if "column_aliases" in sql_payload:
            alias_keys = list(sql_payload.get("column_aliases", {}).keys())
            sql_summary["column_aliases"] = sorted(alias_keys)
        if "active_profile" in sql_payload:
            sql_summary["active_profile"] = sql_payload.get("active_profile")
        if "key_columns" in sql_payload:
            sql_summary["key_columns"] = list(sql_payload.get("key_columns", []))
        if "training_output_mapping" in sql_payload:
            mapping_keys = list(sql_payload.get("training_output_mapping", {}).keys())
            sql_summary["training_mapping_keys"] = sorted(mapping_keys)
        if sql_summary:
            audit_details["sql_changes"] = sql_summary
    data_source_payload = payload_dict.get("data_source")
    if isinstance(data_source_payload, dict):
        data_source_summary: dict[str, object] = {}
        access_path = data_source_payload.get("access_path")
        if isinstance(access_path, str):
            access_path_name = Path(access_path).name or Path(access_path).stem or ""
            if not access_path_name:
                access_path_name = access_path.split("/")[-1].split("\\")[-1]
            hashed_path = hashlib.sha256(access_path.encode("utf-8")).hexdigest()[:12]
            data_source_summary["access_path_name"] = access_path_name
            data_source_summary["access_path_hash"] = hashed_path
        if "default_table" in data_source_payload:
            data_source_summary["default_table"] = data_source_payload.get("default_table")
        if "backup_paths" in data_source_payload:
            backup_paths = data_source_payload.get("backup_paths") or []
            if isinstance(backup_paths, list):
                data_source_summary["backup_count"] = len(backup_paths)
        if data_source_summary:
            audit_details["data_source_changes"] = data_source_summary
    audit_logger.info("workflow.graph.patch", extra=audit_details)
    return _build_response(final_snapshot)


@router.post("/code", response_model=WorkflowCodeSyncResponse)
async def regenerate_workflow_code(
    current_user: AuthenticatedUser = Depends(require_auth),
) -> WorkflowCodeSyncResponse:
    """재생성된 워크플로우 코드 모듈 목록과 TensorBoard 경로를 반환한다."""

    snapshot = workflow_config_store.load()
    graph_cfg = WorkflowGraphConfig.from_dict(snapshot.get("graph", {}))
    artifacts = generate_workflow_modules(graph_cfg, settings.workflow_code_dir)

    viz_cfg = VisualizationConfig.from_dict(snapshot.get("visualization", {}))
    projector_root = Path(viz_cfg.tensorboard_projector_dir)
    tensorboard_paths = {
        "projector_dir": str(projector_root),
        "projector_config": str(projector_root / "projector_config.json"),
        "vectors": str(projector_root / "vectors.tsv"),
        "metadata": str(projector_root / "metadata.tsv"),
    }

    audit_logger.info(
        "workflow.code.regenerate",
        extra={"username": current_user.username, "modules": len(artifacts)},
    )

    return WorkflowCodeSyncResponse(
        modules=[
            WorkflowCodeModule(
                node_id=artifact.node_id,
                label=artifact.label,
                path=str(artifact.path),
            )
            for artifact in artifacts
        ],
        tensorboard_paths=tensorboard_paths,
        updated_at=datetime.utcnow().isoformat(),
    )


__all__ = ["router"]
