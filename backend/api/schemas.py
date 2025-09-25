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
    process_sequence: int = Field(..., alias="PROC_SEQ")
    process_code: str = Field(..., alias="PROC_CD")
    description: Optional[str] = Field(None, alias="PROC_DESC")
    setup_time: Optional[float] = Field(None, alias="SETUP_TIME")
    run_time: Optional[float] = Field(None, alias="RUN_TIME")
    wait_time: Optional[float] = Field(None, alias="WAIT_TIME")

    class Config:
        allow_population_by_field_name = True


class CandidateRouting(BaseModel):
    candidate_item_code: str = Field(..., alias="CANDIDATE_ITEM_CD")
    similarity_score: float = Field(..., alias="SIMILARITY_SCORE")
    rank: int = Field(..., alias="RANK")
    has_routing: Optional[str] = Field(None, alias="HAS_ROUTING")
    process_count: Optional[int] = Field(None, alias="PROCESS_COUNT")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        allow_population_by_field_name = True


class RoutingSummary(BaseModel):
    item_code: str = Field(..., alias="ITEM_CD")
    candidate_id: Optional[str] = Field(None, alias="CANDIDATE_ID")
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


__all__ = [
    "PredictionRequest",
    "PredictionResponse",
    "RoutingSummary",
    "CandidateRouting",
    "CandidateSaveRequest",
    "CandidateSaveResponse",
    "HealthResponse",
]
