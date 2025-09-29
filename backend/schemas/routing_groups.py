"""Pydantic models for routing group API endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, root_validator, validator

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()


class RoutingStep(BaseModel):
    """Represents an individual routing step within a group."""

    seq: int = Field(..., ge=1, description="1부터 시작하는 실행 순서")
    process_code: str = Field(..., min_length=1, max_length=128, description="공정 코드")
    duration_min: Optional[float] = Field(
        default=None,
        ge=0,
        description="예상 가공 시간(분)",
    )
    metadata: Dict[str, Any] | None = Field(
        default=None, description="추가 파라미터(JSON)"
    )

    @validator("process_code")
    def _normalize_process_code(cls, value: str) -> str:  # noqa: D401, N805
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("process_code는 빈 문자열일 수 없습니다")
        return cleaned


class RoutingGroupBase(BaseModel):
    group_name: str = Field(
        ..., min_length=2, max_length=64, description="사용자 정의 그룹명"
    )
    item_codes: List[str] = Field(
        ..., min_items=1, description="라우팅 대상 품목 코드 목록"
    )
    steps: List[RoutingStep] = Field(
        default_factory=list, description="라우팅 공정 단계 목록"
    )
    erp_required: bool = Field(
        default=False, description="ERP 인터페이스 필요 여부"
    )
    metadata: Dict[str, Any] | None = Field(
        default=None, description="추가 메타데이터"
    )

    @validator("group_name")
    def _normalize_group_name(cls, value: str) -> str:  # noqa: D401, N805
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("group_name은 2자 이상이어야 합니다")
        return cleaned

    @validator("item_codes", each_item=True)
    def _normalize_item_code(cls, value: str) -> str:  # noqa: D401, N805
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("item_codes에는 빈 문자열을 포함할 수 없습니다")
        return cleaned

    @root_validator
    def _deduplicate_item_codes(cls, values: Dict[str, Any]) -> Dict[str, Any]:  # noqa: D401, N805
        item_codes = values.get("item_codes") or []
        seen: List[str] = []
        normalized: List[str] = []
        for code in item_codes:
            lowered = code.lower()
            if lowered in seen:
                continue
            seen.append(lowered)
            normalized.append(code)
        values["item_codes"] = normalized
        steps: List[RoutingStep] = values.get("steps") or []
        seen_seq: set[int] = set()
        for step in steps:
            if step.seq in seen_seq:
                raise ValueError("steps 내 seq 값은 고유해야 합니다")
            seen_seq.add(step.seq)
        return values


class RoutingGroupCreate(RoutingGroupBase):
    """Payload for creating a routing group."""


class RoutingGroupUpdate(BaseModel):
    """Payload for updating an existing routing group."""

    group_name: Optional[str] = Field(
        default=None, min_length=2, max_length=64, description="새 그룹명"
    )
    item_codes: Optional[List[str]] = Field(
        default=None, min_items=1, description="새 품목 코드 목록"
    )
    steps: Optional[List[RoutingStep]] = Field(
        default=None, description="새 라우팅 공정 단계 목록"
    )
    erp_required: Optional[bool] = Field(
        default=None, description="ERP 인터페이스 필요 여부"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, description="추가 메타데이터"
    )
    version: int = Field(
        ..., ge=1, description="현재 저장된 그룹 버전(낙관적 잠금)"
    )

    @validator("group_name")
    def _normalize_group_name(cls, value: Optional[str]) -> Optional[str]:  # noqa: D401, N805
        if value is None:
            return value
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("group_name은 2자 이상이어야 합니다")
        return cleaned

    @validator("item_codes", each_item=True)
    def _normalize_item_code(cls, value: str) -> str:  # noqa: D401, N805
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("item_codes에는 빈 문자열을 포함할 수 없습니다")
        return cleaned

    @root_validator
    def _deduplicate_and_validate(cls, values: Dict[str, Any]) -> Dict[str, Any]:  # noqa: D401, N805
        item_codes = values.get("item_codes")
        if item_codes is not None:
            seen: List[str] = []
            normalized: List[str] = []
            for code in item_codes:
                lowered = code.lower()
                if lowered in seen:
                    continue
                seen.append(lowered)
                normalized.append(code)
            values["item_codes"] = normalized
        steps: Optional[List[RoutingStep]] = values.get("steps")
        if steps is not None:
            seen_seq: set[int] = set()
            for step in steps:
                if step.seq in seen_seq:
                    raise ValueError("steps 내 seq 값은 고유해야 합니다")
                seen_seq.add(step.seq)
        return values


class RoutingGroupResponse(BaseModel):
    """Summary information returned after create/update operations."""

    group_id: str = Field(..., description="라우팅 그룹 식별자(UUID)")
    group_name: str = Field(..., description="그룹명")
    owner: str = Field(..., description="그룹 소유자")
    version: int = Field(..., ge=1, description="현재 버전")
    updated_at: datetime = Field(..., description="최종 수정 시각")


class RoutingGroupSummary(BaseModel):
    """Item returned in list responses."""

    group_id: str = Field(..., description="라우팅 그룹 식별자")
    group_name: str = Field(..., description="그룹명")
    item_codes: List[str] = Field(..., description="품목 코드 목록")
    step_count: int = Field(..., ge=0, description="공정 단계 수")
    version: int = Field(..., ge=1, description="현재 버전")
    updated_at: datetime = Field(..., description="최종 수정 시각")


class PaginationMeta(BaseModel):
    """Metadata describing pagination state."""

    limit: int = Field(..., ge=1, description="페이지 크기")
    offset: int = Field(..., ge=0, description="페이지 시작 위치")
    total: int = Field(..., ge=0, description="총 레코드 수")


class RoutingGroupListResponse(BaseModel):
    """Response model for routing group collections."""

    items: List[RoutingGroupSummary] = Field(..., description="라우팅 그룹 목록")
    pagination: PaginationMeta = Field(..., description="페이징 정보")


class RoutingGroupDetail(RoutingGroupResponse):
    """Detailed representation of a routing group."""

    item_codes: List[str] = Field(..., description="품목 코드 목록")
    steps: List[RoutingStep] = Field(..., description="라우팅 공정 단계 목록")
    erp_required: bool = Field(..., description="ERP 인터페이스 필요 여부")
    metadata: Dict[str, Any] | None = Field(
        default=None, description="추가 메타데이터"
    )
    created_at: datetime = Field(..., description="생성 시각")
    deleted_at: datetime | None = Field(
        default=None, description="삭제 시각 (소프트 삭제)"
    )
