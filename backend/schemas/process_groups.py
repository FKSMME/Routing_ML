"""Pydantic models for process group API endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator
from typing_extensions import Literal

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()


class ProcessGroupColumnDefinition(BaseModel):
    """Represents a column definition within a process group."""

    id: str = Field(..., description="컬럼 식별자")
    key: str = Field(..., min_length=1, max_length=128, description="컬럼 키 (DB 컬럼명)")
    label: str = Field(..., min_length=1, max_length=128, description="표시 이름")
    data_type: Literal["string", "number", "boolean", "date"] = Field(
        "string", description="데이터 타입"
    )
    description: Optional[str] = Field(default=None, description="컬럼 설명")

    @field_validator("key")
    @classmethod
    def _normalize_key(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("key는 빈 문자열일 수 없습니다")
        return cleaned


class ProcessGroupBase(BaseModel):
    """Base model for process group."""

    name: str = Field(..., min_length=2, max_length=128, description="그룹 이름")
    description: Optional[str] = Field(default=None, description="그룹 설명")
    type: Literal["machining", "post-process"] = Field(
        ..., description="그룹 유형 (대체 가공 경로 또는 후공정)"
    )
    default_columns: List[ProcessGroupColumnDefinition] = Field(
        default_factory=list, description="기본 컬럼 정의 목록"
    )
    fixed_values: Dict[str, Any] = Field(
        default_factory=dict, description="고정값 설정 (컬럼 키 → 값)"
    )
    is_active: bool = Field(default=True, description="활성화 여부")

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("name은 2자 이상이어야 합니다")
        return cleaned


class ProcessGroupCreate(ProcessGroupBase):
    """Payload for creating a process group."""


class ProcessGroupUpdate(BaseModel):
    """Payload for updating an existing process group."""

    name: Optional[str] = Field(default=None, min_length=2, max_length=128)
    description: Optional[str] = None
    type: Optional[Literal["machining", "post-process"]] = None
    default_columns: Optional[List[ProcessGroupColumnDefinition]] = None
    fixed_values: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    version: int = Field(..., ge=1, description="현재 저장된 그룹 버전 (낙관적 잠금)")

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("name은 2자 이상이어야 합니다")
        return cleaned


class ProcessGroupResponse(BaseModel):
    """Summary information returned after create/update operations."""

    group_id: str = Field(..., description="프로세스 그룹 식별자 (UUID)")
    name: str = Field(..., description="그룹 이름")
    owner: str = Field(..., description="그룹 소유자")
    version: int = Field(..., ge=1, description="현재 버전")
    updated_at: datetime = Field(..., description="최종 수정 시각")


class ProcessGroupSummary(BaseModel):
    """Item returned in list responses."""

    group_id: str = Field(..., description="프로세스 그룹 식별자")
    name: str = Field(..., description="그룹 이름")
    type: Literal["machining", "post-process"] = Field(..., description="그룹 유형")
    column_count: int = Field(..., ge=0, description="컬럼 수")
    is_active: bool = Field(..., description="활성화 여부")
    version: int = Field(..., ge=1, description="현재 버전")
    updated_at: datetime = Field(..., description="최종 수정 시각")


class PaginationMeta(BaseModel):
    """Metadata describing pagination state."""

    limit: int = Field(..., ge=1, description="페이지 크기")
    offset: int = Field(..., ge=0, description="페이지 시작 위치")
    total: int = Field(..., ge=0, description="총 레코드 수")


class ProcessGroupListResponse(BaseModel):
    """Response model for process group collections."""

    items: List[ProcessGroupSummary] = Field(..., description="프로세스 그룹 목록")
    pagination: PaginationMeta = Field(..., description="페이징 정보")


class ProcessGroupDetail(ProcessGroupResponse):
    """Detailed representation of a process group."""

    description: Optional[str] = Field(default=None, description="그룹 설명")
    type: Literal["machining", "post-process"] = Field(..., description="그룹 유형")
    default_columns: List[ProcessGroupColumnDefinition] = Field(
        ..., description="기본 컬럼 정의 목록"
    )
    fixed_values: Dict[str, Any] = Field(..., description="고정값 설정")
    is_active: bool = Field(..., description="활성화 여부")
    created_at: datetime = Field(..., description="생성 시각")
    deleted_at: Optional[datetime] = Field(
        default=None, description="삭제 시각 (소프트 삭제)"
    )
