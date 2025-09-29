"""FastAPI??Pydantic ?ㅽ궎留??뺤쓽."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from typing_extensions import Literal

from pydantic import BaseModel, Field, validator

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()


class LoginRequest(BaseModel):
    """Windows ?몄쬆 濡쒓렇???붿껌."""

    username: str = Field(..., min_length=1, description="Windows ?ъ슜??ID")
    password: str = Field(..., min_length=1, description="Windows 鍮꾨?踰덊샇")


class LoginResponse(BaseModel):
    """濡쒓렇???묐떟."""

    username: str
    display_name: Optional[str] = None
    domain: Optional[str] = None
    token: str
    issued_at: datetime
    expires_at: datetime


class AuthenticatedUser(BaseModel):
    """?몄뀡 寃利???FastAPI ?쇱슦?곌? ?ъ슜?섎뒗 ?ъ슜???뺣낫."""

    username: str
    display_name: Optional[str] = None
    domain: Optional[str] = None
    issued_at: datetime
    expires_at: datetime
    session_id: str
    client_host: Optional[str] = None


class PredictionRequest(BaseModel):
    """Payload for routing prediction requests."""

    item_codes: List[str] = Field(
        ..., min_length=1, description="List of item codes to run predictions for"
    )
    top_k: Optional[int] = Field(
        None, ge=1, le=50, description="Maximum number of routing candidates"
    )
    similarity_threshold: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Minimum similarity score to keep a candidate"
    )
    mode: str = Field(
        "summary", description="Response aggregation mode (summary|detailed)"
    )
    feature_weights: Optional[Dict[str, float]] = Field(
        default=None,
        description="Explicit feature weight overrides keyed by master-data column",
    )
    weight_profile: Optional[str] = Field(
        default=None, description="Identifier of a predefined weight profile"
    )
    export_formats: Optional[List[str]] = Field(
        default=None,
        description="Optional export formats to generate immediately (csv|excel|txt|json|parquet)",
    )
    with_visualization: bool = Field(
        default=False,
        description="Whether to include visualization artifacts (TensorBoard, Neo4j)",
    )

    @validator("item_codes", each_item=True, allow_reuse=True)
    def _strip_item_code(cls, value: str) -> str:  # noqa: N805
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("item code cannot be empty")
        return cleaned



class OperationStep(BaseModel):
    proc_seq: int = Field(..., alias="PROC_SEQ")
    inside_flag: Optional[str] = Field(None, alias="INSIDE_FLAG")
    job_cd: Optional[str] = Field(None, alias="dbo_BI_ROUTING_VIEW_JOB_CD")
    job_nm: Optional[str] = Field(None, alias="JOB_NM")
    res_cd: Optional[str] = Field(None, alias="RES_CD")
    res_dis: Optional[str] = Field(None, alias="RES_DIS")
    time_unit: Optional[str] = Field(None, alias="TIME_UNIT")
    mfg_lt: Optional[float] = Field(None, alias="MFG_LT")
    queue_time: Optional[float] = Field(None, alias="QUEUE_TIME")
    setup_time: Optional[float] = Field(None, alias="SETUP_TIME")
    mach_worked_hours: Optional[float] = Field(None, alias="MACH_WORKED_HOURS")
    act_setup_time: Optional[float] = Field(None, alias="ACT_SETUP_TIME")
    act_run_time: Optional[float] = Field(None, alias="ACT_RUN_TIME")
    wait_time: Optional[float] = Field(None, alias="WAIT_TIME")
    move_time: Optional[float] = Field(None, alias="MOVE_TIME")
    run_time_qty: Optional[float] = Field(None, alias="RUN_TIME_QTY")
    run_time_unit: Optional[str] = Field(None, alias="RUN_TIME_UNIT")
    batch_oper: Optional[str] = Field(None, alias="BATCH_OPER")
    bp_cd: Optional[str] = Field(None, alias="BP_CD")
    cust_nm: Optional[str] = Field(None, alias="dbo_BI_ROUTING_VIEW_CUST_NM")
    cur_cd: Optional[str] = Field(None, alias="CUR_CD")
    subcontract_prc: Optional[float] = Field(None, alias="SUBCONTRACT_PRC")
    tax_type: Optional[str] = Field(None, alias="TAX_TYPE")
    milestone_flg: Optional[str] = Field(None, alias="MILESTONE_FLG")
    insp_flg: Optional[str] = Field(None, alias="INSP_FLG")
    rout_order: Optional[str] = Field(None, alias="ROUT_ORDER")
    valid_from_dt: Optional[str] = Field(None, alias="VALID_FROM_DT")
    valid_to_dt: Optional[str] = Field(None, alias="VALID_TO_DT")
    view_remark: Optional[str] = Field(None, alias="dbo_BI_ROUTING_VIEW_REMARK")
    rout_doc: Optional[str] = Field(None, alias="ROUT_DOC")
    doc_inside: Optional[str] = Field(None, alias="DOC_INSIDE")
    doc_no: Optional[str] = Field(None, alias="DOC_NO")
    nc_program: Optional[str] = Field(None, alias="NC_PROGRAM")
    nc_program_writer: Optional[str] = Field(None, alias="NC_PROGRAM_WRITER")
    nc_writer_nm: Optional[str] = Field(None, alias="NC_WRITER_NM")
    nc_write_date: Optional[str] = Field(None, alias="NC_WRITE_DATE")
    nc_reviewer: Optional[str] = Field(None, alias="NC_REVIEWER")
    nc_reviewer_nm: Optional[str] = Field(None, alias="NC_REVIEWER_NM")
    nc_review_dt: Optional[str] = Field(None, alias="NC_REVIEW_DT")
    raw_matl_size: Optional[str] = Field(None, alias="RAW_MATL_SIZE")
    jaw_size: Optional[str] = Field(None, alias="JAW_SIZE")
    validity: Optional[str] = Field(None, alias="VALIDITY")
    program_remark: Optional[str] = Field(None, alias="PROGRAM_REMARK")
    op_draw_no: Optional[str] = Field(None, alias="OP_DRAW_NO")
    mtmg_numb: Optional[str] = Field(None, alias="MTMG_NUMB")

    class Config:
        allow_population_by_field_name = True


class CandidateRouting(BaseModel):
    candidate_item_code: str = Field(..., alias="CANDIDATE_ITEM_CD")
    similarity_score: float = Field(..., alias="SIMILARITY_SCORE")
    routing_signature: Optional[str] = Field(None, alias="ROUTING_SIGNATURE")
    routing_summary: Optional[str] = Field(None, alias="ROUTING_SUMMARY")
    priority: Optional[str] = Field(None, alias="PRIORITY")
    similarity_tier: Optional[str] = Field(None, alias="SIMILARITY_TIER")
    has_routing: Optional[str] = Field(None, alias="HAS_ROUTING")
    process_count: Optional[int] = Field(None, alias="PROCESS_COUNT")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        allow_population_by_field_name = True


class RoutingSummary(BaseModel):
    item_code: str = Field(..., alias="ITEM_CD")
    candidate_id: Optional[str] = Field(None, alias="CANDIDATE_ID")
    routing_signature: Optional[str] = Field(None, alias="ROUTING_SIGNATURE")
    priority: Optional[str] = Field(None, alias="PRIORITY")
    similarity_tier: Optional[str] = Field(None, alias="SIMILARITY_TIER")
    similarity_score: Optional[float] = Field(None, alias="SIMILARITY_SCORE")
    reference_item_cd: Optional[str] = Field(None, alias="REFERENCE_ITEM_CD")
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    operations: List[OperationStep] = Field(default_factory=list)

    class Config:
        allow_population_by_field_name = True


class PredictionResponse(BaseModel):
    """?덉륫 ?묐떟."""

    items: List[RoutingSummary]
    candidates: List[CandidateRouting]
    metrics: Dict[str, Any] = Field(default_factory=dict)


class CandidateSaveRequest(BaseModel):
    item_code: str
    candidate_id: str
    payload: Dict[str, Any]


class CandidateSaveResponse(BaseModel):
    item_code: str
    candidate_id: str
    saved_path: str
    saved_at: datetime
    sql_preview: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    detail: Optional[str] = None


class WorkflowGraphNode(BaseModel):
    id: str
    label: str
    type: str
    category: Optional[str] = None
    status: Optional[str] = None
    position: Dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0})
    settings: Dict[str, Any] = Field(default_factory=dict)
    metrics: Dict[str, Any] = Field(default_factory=dict)
    doc_refs: List[str] = Field(default_factory=list)


class WorkflowGraphEdge(BaseModel):
    id: str
    source: str
    target: str
    kind: str
    label: Optional[str] = None


class PowerQueryProfileModel(BaseModel):
    name: str
    description: Optional[str] = None
    mapping: Dict[str, str] = Field(default_factory=dict)


class SQLConfigModel(BaseModel):
    output_columns: List[str] = Field(default_factory=list)
    column_aliases: Dict[str, str] = Field(default_factory=dict)
    available_columns: List[str] = Field(default_factory=list)
    profiles: List[PowerQueryProfileModel] = Field(default_factory=list)
    active_profile: Optional[str] = None


class BlueprintToggleModel(BaseModel):
    id: str
    label: str
    enabled: bool
    description: Optional[str] = None
    shade: Optional[str] = None
    accent: Optional[str] = None


class DataSourceTableProfileModel(BaseModel):
    name: str
    label: str
    role: Literal["features", "routing", "results", "aux"] = "features"
    required: bool = False
    columns: List[str] = Field(default_factory=list)
    description: Optional[str] = None


class DataSourceConfigModel(BaseModel):
    access_path: str
    default_table: str
    backup_paths: List[str] = Field(default_factory=list)
    table_profiles: List[DataSourceTableProfileModel] = Field(default_factory=list)
    column_overrides: Dict[str, List[str]] = Field(default_factory=dict)
    allow_gui_override: bool = True
    shading_palette: Dict[str, str] = Field(default_factory=dict)
    blueprint_switches: List[BlueprintToggleModel] = Field(default_factory=list)
    version_hint: Optional[str] = None


class ExportConfigModel(BaseModel):
    enable_cache_save: bool = False
    enable_excel: bool = True
    enable_csv: bool = True
    enable_txt: bool = True
    enable_parquet: bool = True
    enable_json: bool = True
    erp_interface_enabled: bool = False
    erp_protocol: Optional[str] = None
    erp_endpoint: Optional[str] = None
    default_encoding: str = "utf-8"
    export_directory: str
    compress_on_save: bool = True


class VisualizationConfigModel(BaseModel):
    tensorboard_projector_dir: str
    projector_enabled: bool = True
    projector_metadata_columns: List[str] = Field(default_factory=list)
    neo4j_enabled: bool = True
    neo4j_browser_url: Optional[str] = None
    neo4j_workspace: Optional[str] = None
    publish_service_enabled: bool = True
    publish_notes: Optional[str] = None


class TrainerRuntimeModel(BaseModel):
    similarity_threshold: float = Field(..., ge=0.0, le=1.0)
    trim_std_enabled: bool = True
    trim_lower_percent: float = Field(0.05, ge=0.0, le=1.0)
    trim_upper_percent: float = Field(0.95, ge=0.0, le=1.0)


class PredictorRuntimeModel(BaseModel):
    similarity_high_threshold: float = Field(..., ge=0.0, le=1.0)
    max_routing_variants: int = Field(..., ge=1, le=10)
    trim_std_enabled: bool = True
    trim_lower_percent: float = Field(0.05, ge=0.0, le=1.0)
    trim_upper_percent: float = Field(0.95, ge=0.0, le=1.0)


class WorkflowGraphModel(BaseModel):
    nodes: List[WorkflowGraphNode] = Field(default_factory=list)
    edges: List[WorkflowGraphEdge] = Field(default_factory=list)
    design_refs: List[str] = Field(default_factory=list)
    last_saved: Optional[str] = None


class WorkflowConfigResponse(BaseModel):
    graph: WorkflowGraphModel
    trainer: TrainerRuntimeModel
    predictor: PredictorRuntimeModel
    sql: SQLConfigModel
    data_source: DataSourceConfigModel
    export: ExportConfigModel
    visualization: VisualizationConfigModel
    updated_at: str


class WorkflowGraphPatch(BaseModel):
    nodes: Optional[List[WorkflowGraphNode]] = None
    edges: Optional[List[WorkflowGraphEdge]] = None
    design_refs: Optional[List[str]] = None


class TrainerRuntimePatch(BaseModel):
    similarity_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    trim_std_enabled: Optional[bool] = None
    trim_lower_percent: Optional[float] = Field(None, ge=0.0, le=1.0)
    trim_upper_percent: Optional[float] = Field(None, ge=0.0, le=1.0)


class PredictorRuntimePatch(BaseModel):
    similarity_high_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    max_routing_variants: Optional[int] = Field(None, ge=1, le=10)
    trim_std_enabled: Optional[bool] = None
    trim_lower_percent: Optional[float] = Field(None, ge=0.0, le=1.0)
    trim_upper_percent: Optional[float] = Field(None, ge=0.0, le=1.0)


class SQLConfigPatch(BaseModel):
    output_columns: Optional[List[str]] = None
    column_aliases: Optional[Dict[str, str]] = None
    available_columns: Optional[List[str]] = None
    profiles: Optional[List[PowerQueryProfileModel]] = None
    active_profile: Optional[str] = None


class BlueprintTogglePatch(BaseModel):
    id: str
    enabled: Optional[bool] = None
    description: Optional[str] = None


class DataSourceConfigPatch(BaseModel):
    access_path: Optional[str] = None
    default_table: Optional[str] = None
    backup_paths: Optional[List[str]] = None
    table_profiles: Optional[List[DataSourceTableProfileModel]] = None
    column_overrides: Optional[Dict[str, List[str]]] = None
    allow_gui_override: Optional[bool] = None
    blueprint_switches: Optional[List[BlueprintTogglePatch]] = None


class ExportConfigPatch(BaseModel):
    enable_cache_save: Optional[bool] = None
    enable_excel: Optional[bool] = None
    enable_csv: Optional[bool] = None
    enable_txt: Optional[bool] = None
    enable_parquet: Optional[bool] = None
    enable_json: Optional[bool] = None
    erp_interface_enabled: Optional[bool] = None
    erp_protocol: Optional[str] = None
    erp_endpoint: Optional[str] = None
    default_encoding: Optional[str] = None
    export_directory: Optional[str] = None
    compress_on_save: Optional[bool] = None


class VisualizationConfigPatch(BaseModel):
    tensorboard_projector_dir: Optional[str] = None
    projector_enabled: Optional[bool] = None
    projector_metadata_columns: Optional[List[str]] = None
    neo4j_enabled: Optional[bool] = None
    neo4j_browser_url: Optional[str] = None
    neo4j_workspace: Optional[str] = None
    publish_service_enabled: Optional[bool] = None
    publish_notes: Optional[str] = None


class WorkflowConfigPatch(BaseModel):
    graph: Optional[WorkflowGraphPatch] = None
    trainer: Optional[TrainerRuntimePatch] = None
    predictor: Optional[PredictorRuntimePatch] = None
    sql: Optional[SQLConfigPatch] = None
    data_source: Optional[DataSourceConfigPatch] = None
    export: Optional[ExportConfigPatch] = None
    visualization: Optional[VisualizationConfigPatch] = None


RslGroupStatus = Literal["draft", "ready", "pending_review", "released", "archived"]
RslStepStatus = Literal["draft", "ready", "released"]


class RslRuleRefModel(BaseModel):
    id: int
    rule_name: str
    rule_version: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    is_optional: bool = False
    created_at: datetime


class RslRuleRefCreate(BaseModel):
    rule_name: str = Field(..., min_length=1)
    rule_version: Optional[str] = Field(default=None, max_length=64)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    is_optional: bool = False


class RslStepModel(BaseModel):
    id: int
    sequence: int
    name: str
    description: Optional[str] = None
    status: RslStepStatus
    tags: List[str] = Field(default_factory=list)
    config: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    rules: List[RslRuleRefModel] = Field(default_factory=list)

    class Config:
        orm_mode = True


class RslStepCreate(BaseModel):
    sequence: Optional[int] = Field(default=None, ge=1)
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    status: Optional[RslStepStatus] = None
    tags: List[str] = Field(default_factory=list)
    config: Dict[str, Any] = Field(default_factory=dict)
    rules: List[RslRuleRefCreate] = Field(default_factory=list)

    @validator("tags", each_item=True)
    def _strip_tag(cls, value: str) -> str:  # noqa: N805
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("태그는 비어 있을 수 없습니다")
        return cleaned


class RslStepUpdate(BaseModel):
    sequence: Optional[int] = Field(default=None, ge=1)
    name: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = None
    status: Optional[RslStepStatus] = None
    tags: Optional[List[str]] = None
    config: Optional[Dict[str, Any]] = None


class RslGroupModel(BaseModel):
    id: int
    slug: str
    name: str
    description: Optional[str] = None
    owner: str
    tags: List[str] = Field(default_factory=list)
    status: RslGroupStatus
    validation_errors: List[str] = Field(default_factory=list)
    last_validated_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    released_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    steps: List[RslStepModel] = Field(default_factory=list)

    class Config:
        orm_mode = True


class RslGroupCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    slug: Optional[str] = Field(default=None, min_length=1, max_length=64)

    @validator("tags", each_item=True)
    def _validate_tag(cls, value: str) -> str:  # noqa: N805
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("태그는 비어 있을 수 없습니다")
        return cleaned


class RslGroupUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    slug: Optional[str] = Field(default=None, min_length=1, max_length=64)


class RslGroupListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[RslGroupModel]


class RslValidationResponse(BaseModel):
    group_id: int
    is_valid: bool
    errors: List[str]
    validated_at: datetime


class RslImportRequest(BaseModel):
    format: Literal["json", "csv"]
    payload: str


class RslImportResult(BaseModel):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: List[str] = Field(default_factory=list)


class RslExportBundle(BaseModel):
    format: Literal["json", "csv"]
    payload: str


__all__ = [
    "LoginRequest",
    "LoginResponse",
    "AuthenticatedUser",
    "PredictionRequest",
    "PredictionResponse",
    "RoutingSummary",
    "CandidateRouting",
    "CandidateSaveRequest",
    "CandidateSaveResponse",
    "HealthResponse",
    "WorkflowConfigResponse",
    "WorkflowConfigPatch",
    "WorkflowGraphModel",
    "WorkflowGraphNode",
    "WorkflowGraphEdge",
    "TrainerRuntimeModel",
    "PredictorRuntimeModel",
    "SQLConfigModel",
    "DataSourceConfigModel",
    "ExportConfigModel",
    "VisualizationConfigModel",
    "DataSourceConfigPatch",
    "ExportConfigPatch",
    "VisualizationConfigPatch",
    "RslGroupStatus",
    "RslStepStatus",
    "RslRuleRefModel",
    "RslRuleRefCreate",
    "RslStepModel",
    "RslStepCreate",
    "RslStepUpdate",
    "RslGroupModel",
    "RslGroupCreate",
    "RslGroupUpdate",
    "RslGroupListResponse",
    "RslValidationResponse",
    "RslImportRequest",
    "RslImportResult",
    "RslExportBundle",
]

class AccessMetadataColumn(BaseModel):
    name: str
    type: str
    nullable: Optional[bool] = True


class AccessMetadataResponse(BaseModel):
    table: str
    columns: List[AccessMetadataColumn]
    path: Optional[str] = None
    updated_at: Optional[str] = None




class MasterDataTreeNode(BaseModel):
    id: str
    label: str
    type: Literal["group", "family", "item"]
    children: List["MasterDataTreeNode"] = Field(default_factory=list)
    meta: Optional[Dict[str, str]] = None


class MasterDataTreeResponse(BaseModel):
    nodes: List[MasterDataTreeNode]
    total_items: int
    filtered_items: int
    default_item_code: Optional[str] = None


class MasterDataMatrixColumn(BaseModel):
    key: str
    label: str
    width: Optional[str] = None


class MasterDataMatrixRow(BaseModel):
    key: str
    values: Dict[str, str]


class MasterDataItemResponse(BaseModel):
    item_code: str
    columns: List[MasterDataMatrixColumn]
    rows: List[MasterDataMatrixRow]
    record_count: int


class MasterDataLogEntry(BaseModel):
    timestamp: str
    ip: str
    user: str
    action: str
    target: str


class MasterDataConnectionStatus(BaseModel):
    status: Literal["connected", "disconnected"]
    path: str
    last_sync: Optional[str] = None


class MasterDataLogsResponse(BaseModel):
    logs: List[MasterDataLogEntry]
    connection: MasterDataConnectionStatus

MasterDataTreeNode.update_forward_refs()

