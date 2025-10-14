"""FastAPI??Pydantic ?ㅽ궎留??뺤쓽."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from typing_extensions import Literal

from pydantic import BaseModel, Field, validator

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()


class LoginRequest(BaseModel):
    """로그인 요청 페이로드."""

    username: str = Field(..., min_length=1, description="로그인 ID")
    password: str = Field(..., min_length=1, description="비밀번호")


class RegisterRequest(BaseModel):
    """신규 사용자 등록 요청."""

    username: str = Field(..., min_length=1, description="로그인 ID")
    password: str = Field(..., min_length=1, description="비밀번호")
    display_name: Optional[str] = Field(
        default=None, description="사용자에게 표시할 이름"
    )
    full_name: Optional[str] = Field(
        default=None, description="사용자 전체 이름"
    )
    email: Optional[str] = Field(
        default=None, description="사용자 이메일 주소 (알림 수신용)"
    )


class RegisterResponse(BaseModel):
    """가입 요청 결과."""

    username: str
    status: Literal["pending", "approved", "rejected"]
    is_admin: bool = False
    message: str


class LoginResponse(BaseModel):
    """로그인 응답."""

    username: str
    display_name: Optional[str] = None
    status: Literal["pending", "approved", "rejected"]
    is_admin: bool = False
    token: str
    issued_at: datetime
    expires_at: datetime


class AuthenticatedUser(BaseModel):
    """JWT 인증을 통해 확인된 사용자."""

    username: str
    display_name: Optional[str] = None
    status: Literal["pending", "approved", "rejected"]
    is_admin: bool = False
    issued_at: datetime
    expires_at: datetime
    session_id: Optional[str] = None
    client_host: Optional[str] = None


class AdminApproveRequest(BaseModel):
    username: str = Field(..., min_length=1)
    make_admin: bool = False


class AdminRejectRequest(BaseModel):
    username: str = Field(..., min_length=1)
    reason: Optional[str] = None


class UserStatusResponse(BaseModel):
    username: str
    display_name: Optional[str] = None
    status: Literal["pending", "approved", "rejected"]
    is_admin: bool = False


class ChangePasswordRequest(BaseModel):
    """비밀번호 변경 요청."""

    current_password: str = Field(..., min_length=1, description="현재 비밀번호")
    new_password: str = Field(..., min_length=6, description="새 비밀번호 (최소 6자)")

    @validator("new_password")
    def _validate_password_strength(cls, value: str) -> str:  # noqa: N805
        if len(value) < 6:
            raise ValueError("비밀번호는 최소 6자 이상이어야 합니다")
        return value


class ChangePasswordResponse(BaseModel):
    """비밀번호 변경 응답."""

    username: str
    message: str = "비밀번호가 성공적으로 변경되었습니다"
    changed_at: datetime


class UserListItem(BaseModel):
    """사용자 목록 아이템."""

    username: str
    display_name: Optional[str] = None
    status: Literal["pending", "approved", "rejected"]
    is_admin: bool = False
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None


class UserListResponse(BaseModel):
    """사용자 목록 응답."""

    users: List[UserListItem] = Field(default_factory=list)
    total: int = Field(..., ge=0, description="전체 사용자 수")
    limit: int = Field(..., ge=1, description="페이지 크기")
    offset: int = Field(..., ge=0, description="오프셋")


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

    model_config = {"populate_by_name": True}

    @validator("*", pre=True)
    def _convert_nan_to_none(cls, value):  # noqa: N805
        """Convert NaN/nan values from MSSQL to None for all fields."""
        import math
        if value is None:
            return None
        # Handle float NaN
        if isinstance(value, float) and math.isnan(value):
            return None
        # Handle string 'nan'
        if isinstance(value, str) and value.lower() == 'nan':
            return None
        return value


class CandidateRouting(BaseModel):
    candidate_item_code: str = Field(..., alias="CANDIDATE_ITEM_CD")
    similarity_score: float = Field(..., alias="SIMILARITY_SCORE")
    routing_signature: Optional[str] = Field(None, alias="ROUTING_SIGNATURE")
    routing_summary: Optional[str] = Field(None, alias="ROUTING_SUMMARY")
    priority: Optional[str] = Field(None, alias="PRIORITY")
    similarity_tier: Optional[str] = Field(None, alias="SIMILARITY_TIER")
    has_routing: Optional[str] = Field(None, alias="HAS_ROUTING")
    process_count: Optional[int] = Field(None, alias="PROCESS_COUNT")
    source_item_code: Optional[str] = Field(
        None, alias="ITEM_CD", description="추천이 계산된 대상 품목"
    )
    feature_importance: Optional[Dict[str, float]] = Field(
        None, description="Feature importance scores showing which attributes contributed to the match"
    )
    matched_features: Optional[List[str]] = Field(
        None, description="List of features that matched between source and candidate items"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


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

    model_config = {"populate_by_name": True}


class PredictionResponse(BaseModel):
    """?덉륫 ?묐떟."""

    items: List[RoutingSummary]
    candidates: List[CandidateRouting]
    metrics: Dict[str, Any] = Field(default_factory=dict)


class RoutingInterfaceRequest(BaseModel):
    """ERP 인터페이스 트리거 요청 페이로드."""

    group_id: str = Field(..., min_length=1, description="ERP 내보내기를 수행할 라우팅 그룹 ID")
    export_formats: Optional[List[str]] = Field(
        default=None,
        description="추가로 요청할 내보내기 포맷 목록 (기본값: ERP 전용)",
    )
    reason: Optional[str] = Field(
        default=None,
        description="감사 로깅용 트리거 사유(예: save, interface)",
    )


class RoutingInterfaceResponse(BaseModel):
    """ERP 인터페이스 트리거 결과."""

    group_id: str = Field(..., description="ERP 내보내기를 수행한 라우팅 그룹 ID")
    exported_files: List[str] = Field(
        default_factory=list, description="생성된 모든 내보내기 파일 경로"
    )
    erp_path: Optional[str] = Field(
        default=None, description="생성된 ERP 페이로드 파일 경로"
    )
    message: str = Field(
        default="ERP 내보내기가 완료되었습니다.",
        description="사용자에게 표시할 상태 메시지",
    )


class SimilarItem(BaseModel):
    item_code: str = Field(..., description="유사 품목 코드")
    similarity_score: float = Field(..., ge=0.0, le=1.0, description="유사도 점수")
    source: Literal["prediction", "manifest"] = Field(
        "prediction", description="유사도 정보 출처"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="매니페스트에서 제공되는 부가 메타데이터"
    )


class SimilaritySearchResult(BaseModel):
    item_code: str = Field(..., description="조회 대상 품목 코드")
    matches: List[SimilarItem] = Field(default_factory=list)
    manifest_revision: Optional[str] = Field(
        None, description="매니페스트 버전/리비전 정보"
    )


class SimilaritySearchRequest(BaseModel):
    item_codes: List[str] = Field(
        ..., min_length=1, description="유사 후보를 조회할 품목 코드 목록"
    )
    top_k: Optional[int] = Field(
        None, ge=1, le=50, description="후보로 반환할 최대 품목 수"
    )
    min_similarity: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="후보 필터링에 사용할 최소 유사도"
    )
    feature_weights: Optional[Dict[str, float]] = Field(
        default=None, description="예측 시 적용할 수동 가중치"
    )
    weight_profile: Optional[str] = Field(
        default=None, description="적용할 사전 정의된 가중치 프로파일"
    )
    include_manifest_metadata: bool = Field(
        False, description="매니페스트의 추가 메타데이터 포함 여부"
    )

    @validator("item_codes", each_item=True)
    def _strip_search_codes(cls, value: str) -> str:  # noqa: N805
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("item code cannot be empty")
        return cleaned


class SimilaritySearchResponse(BaseModel):
    results: List[SimilaritySearchResult] = Field(default_factory=list)
    metrics: Dict[str, Any] = Field(default_factory=dict)


class GroupRecommendation(BaseModel):
    group_id: str = Field(..., description="그룹 식별자")
    score: float = Field(..., ge=0.0, description="우선 순위/점수")
    source: Literal["manifest", "prediction", "inference"] = Field(
        ..., description="추천 근거"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)


class GroupRecommendationRequest(BaseModel):
    item_code: str = Field(..., description="추천을 요청할 품목 코드")
    candidate_limit: Optional[int] = Field(
        5, ge=1, le=20, description="반환할 최대 추천 개수"
    )
    similarity_threshold: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="관련 유사 품목 필터링 기준"
    )


class GroupRecommendationResponse(BaseModel):
    item_code: str
    recommendations: List[GroupRecommendation] = Field(default_factory=list)
    inspected_candidates: int = Field(
        0, description="추천 산출 시 참고한 후보 품목 수"
    )
    manifest_revision: Optional[str] = None


class TimeBreakdown(BaseModel):
    proc_seq: Optional[int] = Field(None, description="공정 순번")
    setup_time: float = Field(..., ge=0.0, description="세팅 시간 합계")
    run_time: float = Field(..., ge=0.0, description="가공/운전 시간 합계")
    queue_time: float = Field(..., ge=0.0, description="대기 시간 합계")
    wait_time: float = Field(..., ge=0.0, description="정지/대기 시간 합계")
    move_time: float = Field(..., ge=0.0, description="이동 시간 합계")
    total_time: float = Field(..., ge=0.0, description="공정별 총 리드타임")


class TimeSummaryRequest(BaseModel):
    item_code: str
    operations: List[OperationStep] = Field(
        default_factory=list, description="리드타임 계산에 사용할 공정 데이터"
    )
    include_breakdown: bool = Field(
        False, description="공정별 상세 합계를 포함할지 여부"
    )


class TimeSummaryResponse(BaseModel):
    item_code: str
    totals: Dict[str, float] = Field(default_factory=dict)
    process_count: int = Field(0, ge=0)
    breakdown: Optional[List[TimeBreakdown]] = None


class RuleViolation(BaseModel):
    rule_id: str
    message: str
    severity: Literal["info", "warning", "error"] = "error"


class RuleValidationRequest(BaseModel):
    item_code: str
    operations: List[OperationStep] = Field(default_factory=list)
    rule_ids: Optional[List[str]] = Field(
        default=None, description="검증할 규칙 ID 목록 (None이면 전체)"
    )
    context: Dict[str, Any] = Field(
        default_factory=dict, description="검증 시 참고할 추가 컨텍스트"
    )


class RuleValidationResponse(BaseModel):
    item_code: str
    passed: bool
    violations: List[RuleViolation] = Field(default_factory=list)
    evaluated_rules: int = Field(0, ge=0)


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
    version: Optional[str] = None
    uptime_seconds: Optional[float] = None
    timestamp: Optional[str] = None


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
    exclusive_column_groups: List[List[str]] = Field(default_factory=list)
    key_columns: List[str] = Field(default_factory=list)
    training_output_mapping: Dict[str, str] = Field(default_factory=dict)


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
    offline_dataset_path: Optional[str] = None
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
    enable_xml: bool = True
    enable_database_export: bool = False
    database_target_table: Optional[str] = None
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
    time_profiles_enabled: bool = False
    time_profile_strategy: str = Field("sigma_profile", min_length=1)
    time_profile_optimal_sigma: float = Field(0.67, ge=0.0)
    time_profile_safe_sigma: float = Field(1.28, ge=0.0)


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


class WorkflowCodeModule(BaseModel):
    node_id: str
    label: str
    path: str


class WorkflowCodeSyncResponse(BaseModel):
    modules: List[WorkflowCodeModule] = Field(default_factory=list)
    tensorboard_paths: Dict[str, str] = Field(default_factory=dict)
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
    time_profiles_enabled: Optional[bool] = None
    time_profile_strategy: Optional[str] = Field(None, min_length=1)
    time_profile_optimal_sigma: Optional[float] = Field(None, ge=0.0)
    time_profile_safe_sigma: Optional[float] = Field(None, ge=0.0)


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
    exclusive_column_groups: Optional[List[List[str]]] = None
    key_columns: Optional[List[str]] = None
    training_output_mapping: Optional[Dict[str, str]] = None


class BlueprintTogglePatch(BaseModel):
    id: str
    enabled: Optional[bool] = None
    description: Optional[str] = None


class DataSourceConfigPatch(BaseModel):
    offline_dataset_path: Optional[str] = None
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
    enable_xml: Optional[bool] = None
    enable_database_export: Optional[bool] = None
    database_target_table: Optional[str] = None
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

    model_config = {"from_attributes": True}


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
    erp_required: bool = Field(default=False, description="ERP 인터페이스 필요 여부")
    status: RslGroupStatus
    validation_errors: List[str] = Field(default_factory=list)
    last_validated_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    released_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    steps: List[RslStepModel] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class RslGroupCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    slug: Optional[str] = Field(default=None, min_length=1, max_length=64)
    erp_required: bool = Field(
        default=False,
        description="ERP 인터페이스 필요 여부",
    )

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
    erp_required: Optional[bool] = Field(
        default=None,
        description="ERP 인터페이스 필요 여부",
    )


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
    "RegisterRequest",
    "RegisterResponse",
    "AuthenticatedUser",
    "AdminApproveRequest",
    "AdminRejectRequest",
    "UserStatusResponse",
    "ChangePasswordRequest",
    "ChangePasswordResponse",
    "UserListItem",
    "UserListResponse",
    "PredictionRequest",
    "PredictionResponse",
    "RoutingInterfaceRequest",
    "RoutingInterfaceResponse",
    "SimilarItem",
    "SimilaritySearchResult",
    "SimilaritySearchRequest",
    "SimilaritySearchResponse",
    "GroupRecommendation",
    "GroupRecommendationRequest",
    "GroupRecommendationResponse",
    "TimeBreakdown",
    "TimeSummaryRequest",
    "TimeSummaryResponse",
    "RuleViolation",
    "RuleValidationRequest",
    "RuleValidationResponse",
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
    "DataRelationshipMapping",
    "DataMappingRule",
    "DataMappingProfile",
    "DataMappingProfileCreate",
    "DataMappingProfileUpdate",
    "DataMappingProfileListResponse",
    "DataMappingApplyRequest",
    "DataMappingApplyResponse",
]

class DatabaseMetadataColumn(BaseModel):
    name: str
    type: str
    nullable: Optional[bool] = True


class DatabaseMetadataResponse(BaseModel):
    table: str
    columns: List[DatabaseMetadataColumn]
    server: Optional[str] = None
    database: Optional[str] = None
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
    server: Optional[str] = None
    database: Optional[str] = None
    last_checked: Optional[str] = None


class MasterDataLogsResponse(BaseModel):
    logs: List[MasterDataLogEntry]
    connection: MasterDataConnectionStatus


class AuditLogEntry(BaseModel):
    """감사 로그 항목."""

    timestamp: str = Field(..., description="로그 발생 시각")
    level: str = Field(..., description="로그 레벨")
    name: str = Field(..., description="로거 이름")
    message: str = Field(..., description="로그 메시지")
    username: Optional[str] = Field(None, description="사용자명")
    client_host: Optional[str] = Field(None, description="클라이언트 IP")
    action: Optional[str] = Field(None, description="액션")
    extra: Dict[str, Any] = Field(default_factory=dict, description="추가 필드")


class AuditLogsResponse(BaseModel):
    """로그 조회 응답."""

    logs: List[AuditLogEntry] = Field(default_factory=list)
    total: int = Field(..., ge=0, description="전체 로그 수")
    limit: int = Field(..., ge=1, description="페이지 크기")
    offset: int = Field(..., ge=0, description="오프셋")
    log_file: str = Field(..., description="로그 파일 경로")


class BulkUploadValidationError(BaseModel):
    """대량 업로드 검증 오류."""

    row: int = Field(..., description="오류 발생 행 번호")
    column: Optional[str] = Field(None, description="오류 발생 컬럼")
    error: str = Field(..., description="오류 메시지")
    value: Optional[str] = Field(None, description="문제가 된 값")


class BulkUploadPreviewRow(BaseModel):
    """대량 업로드 미리보기 행."""

    routing_code: str = Field(..., description="라우팅 코드")
    item_codes: List[str] = Field(default_factory=list, description="품목 코드 목록")
    step_count: int = Field(..., ge=0, description="공정 단계 수")
    has_errors: bool = Field(default=False, description="검증 오류 존재 여부")
    errors: List[str] = Field(default_factory=list, description="오류 메시지 목록")


class BulkUploadPreviewResponse(BaseModel):
    """대량 업로드 미리보기 응답."""

    total_rows: int = Field(..., ge=0, description="전체 행 수")
    valid_rows: int = Field(..., ge=0, description="유효한 행 수")
    error_rows: int = Field(..., ge=0, description="오류 행 수")
    preview: List[BulkUploadPreviewRow] = Field(default_factory=list, description="미리보기 데이터")
    errors: List[BulkUploadValidationError] = Field(default_factory=list, description="검증 오류 목록")
    column_mapping: Dict[str, str] = Field(default_factory=dict, description="컬럼 매핑 정보")


class BulkUploadResponse(BaseModel):
    """대량 업로드 결과."""

    created: int = Field(..., ge=0, description="생성된 라우팅 수")
    updated: int = Field(..., ge=0, description="업데이트된 라우팅 수")
    skipped: int = Field(..., ge=0, description="건너뛴 라우팅 수")
    errors: List[BulkUploadValidationError] = Field(default_factory=list, description="오류 목록")
    created_ids: List[str] = Field(default_factory=list, description="생성된 라우팅 ID 목록")


MasterDataTreeNode.update_forward_refs()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Data Relationship Mapping (학습 데이터 ↔ 예측 데이터 ↔ 출력 데이터 관계 설정)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class DataRelationshipMapping(BaseModel):
    """3단계 데이터 관계 매핑 (학습 → 예측 → 출력)."""

    # 1단계: 학습 데이터 (TRAIN_FEATURES)
    training_column: str = Field(
        ..., min_length=1, description="학습 데이터 컬럼명 (예: ITEM_CD, PART_TYPE)"
    )

    # 2단계: 예측 결과 컬럼 (Prediction Output)
    prediction_column: Optional[str] = Field(
        None, description="예측 결과 컬럼명 (예: JOB_NM, RES_CD) - 없으면 학습 컬럼 사용"
    )

    # 3단계: 최종 출력 컬럼 (Output CSV/Excel)
    output_column: str = Field(
        ..., min_length=1, description="출력 파일 컬럼명 (예: 공정명, 자원코드)"
    )

    # 메타데이터
    data_type: Literal["string", "number", "boolean", "date"] = Field(
        "string", description="데이터 타입"
    )
    is_required: bool = Field(False, description="필수 필드 여부")
    default_value: Optional[str] = Field(None, description="기본값 (값이 없을 때)")
    transform_rule: Optional[str] = Field(
        None, description="변환 규칙 (예: uppercase, lowercase, trim)"
    )
    description: Optional[str] = Field(None, description="매핑 설명")


class DataMappingRule(BaseModel):
    """
    하위 호환성을 위한 기존 매핑 규칙.

    Deprecated: DataRelationshipMapping 사용 권장.
    """

    routing_field: str = Field(..., min_length=1, description="라우팅 그룹 필드명 (예: 공정명)")
    db_column: str = Field(..., min_length=1, description="DB 컬럼명 (예: JOB_NM)")
    display_name: Optional[str] = Field(None, description="사용자에게 표시할 이름")
    data_type: Literal["string", "number", "boolean", "date"] = Field(
        "string", description="데이터 타입"
    )
    is_required: bool = Field(False, description="필수 필드 여부")
    default_value: Optional[str] = Field(None, description="기본값")
    description: Optional[str] = Field(None, description="매핑 설명")


class DataMappingProfile(BaseModel):
    """데이터 매핑 프로파일 (여러 규칙의 집합)."""

    id: Optional[str] = Field(None, description="프로파일 ID")
    name: str = Field(..., min_length=1, description="프로파일 이름")
    description: Optional[str] = Field(None, description="프로파일 설명")

    # 새로운 3단계 관계 매핑 (학습 → 예측 → 출력)
    relationships: List[DataRelationshipMapping] = Field(
        default_factory=list, description="데이터 관계 매핑 목록 (학습-예측-출력)"
    )

    # 하위 호환성을 위한 기존 매핑
    mappings: List[DataMappingRule] = Field(
        default_factory=list, description="레거시 매핑 규칙 목록 (Deprecated)"
    )

    created_by: Optional[str] = Field(None, description="생성자")
    created_at: Optional[datetime] = Field(None, description="생성 시각")
    updated_at: Optional[datetime] = Field(None, description="수정 시각")
    is_active: bool = Field(True, description="활성화 여부")


class DataMappingProfileCreate(BaseModel):
    """데이터 매핑 프로파일 생성 요청."""

    name: str = Field(..., min_length=1, description="프로파일 이름")
    description: Optional[str] = Field(None, description="프로파일 설명")
    mappings: List[DataMappingRule] = Field(
        default_factory=list, description="매핑 규칙 목록"
    )


class DataMappingProfileUpdate(BaseModel):
    """데이터 매핑 프로파일 수정 요청."""

    name: Optional[str] = Field(None, min_length=1, description="프로파일 이름")
    description: Optional[str] = Field(None, description="프로파일 설명")
    mappings: Optional[List[DataMappingRule]] = Field(None, description="매핑 규칙 목록")
    is_active: Optional[bool] = Field(None, description="활성화 여부")


class DataMappingProfileListResponse(BaseModel):
    """데이터 매핑 프로파일 목록 응답."""

    profiles: List[DataMappingProfile] = Field(default_factory=list)
    total: int = Field(..., ge=0, description="전체 프로파일 수")


class DataMappingApplyRequest(BaseModel):
    """데이터 매핑 적용 요청 (라우팅 그룹 데이터 → CSV 변환)."""

    profile_id: str = Field(..., min_length=1, description="적용할 매핑 프로파일 ID")
    routing_group_id: str = Field(..., min_length=1, description="라우팅 그룹 ID")
    preview_only: bool = Field(True, description="미리보기만 할지 여부")


class DataMappingApplyResponse(BaseModel):
    """데이터 매핑 적용 결과."""

    profile_id: str = Field(..., description="적용한 매핑 프로파일 ID")
    routing_group_id: str = Field(..., description="라우팅 그룹 ID")
    columns: List[str] = Field(default_factory=list, description="출력 컬럼명 목록")
    preview_rows: List[Dict[str, Any]] = Field(
        default_factory=list, description="미리보기 데이터 (최대 10행)"
    )
    total_rows: int = Field(..., ge=0, description="전체 데이터 행 수")
    csv_path: Optional[str] = Field(None, description="생성된 CSV 파일 경로")
    message: str = Field(default="매핑 적용 완료", description="결과 메시지")
