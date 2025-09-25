"""FastAPI용 Pydantic 스키마 정의."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator


class PredictionRequest(BaseModel):
    """예측 요청 입력."""

    item_codes: List[str] = Field(..., min_length=1, description="예측 대상 품목 코드 목록")
    top_k: Optional[int] = Field(None, ge=1, le=50, description="Top-K 후보 수")
    similarity_threshold: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="후보 필터링 임계값"
    )
    mode: str = Field("summary", description="응답 구성 모드(summary|detailed)")

    @validator("item_codes", each_item=True)
    def _strip_item_code(cls, value: str) -> str:  # noqa: N805
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("빈 품목 코드는 허용되지 않습니다")
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
    """예측 응답."""

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


class WorkflowConfigPatch(BaseModel):
    graph: Optional[WorkflowGraphPatch] = None
    trainer: Optional[TrainerRuntimePatch] = None
    predictor: Optional[PredictorRuntimePatch] = None
    sql: Optional[SQLConfigPatch] = None


__all__ = [
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
]
