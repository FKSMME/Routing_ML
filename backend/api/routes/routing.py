"""라우팅 출력 프로파일 API."""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_auth
from common.logger import get_logger

router = APIRouter(prefix="/api/routing", tags=["routing"])
logger = get_logger("api.routing")

# 프로파일 저장 디렉토리
PROFILES_DIR = Path("data/output_profiles")
PROFILES_DIR.mkdir(parents=True, exist_ok=True)


class OutputProfileMapping(BaseModel):
    """출력 프로파일 컬럼 매핑"""
    source: str
    mapped: str
    type: str = "string"
    required: bool = False
    default_value: str | None = None


class CreateOutputProfileRequest(BaseModel):
    """출력 프로파일 생성 요청"""
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    format: str = "CSV"
    mappings: List[OutputProfileMapping] = []


def _load_all_profiles() -> List[Dict[str, Any]]:
    """모든 프로파일을 로드"""
    profiles = []

    # 기본 프로파일
    profiles.append({
        "id": "default",
        "name": "기본 프로파일",
        "description": "표준 라우팅 출력",
        "format": "CSV",
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    })

    # 파일 시스템에서 로드
    if PROFILES_DIR.exists():
        for profile_file in PROFILES_DIR.glob("*.json"):
            try:
                with open(profile_file, "r", encoding="utf-8") as f:
                    profile_data = json.load(f)
                    profiles.append({
                        "id": profile_data.get("id"),
                        "name": profile_data.get("name"),
                        "description": profile_data.get("description"),
                        "format": profile_data.get("format"),
                        "created_at": profile_data.get("created_at"),
                        "updated_at": profile_data.get("updated_at"),
                    })
            except Exception as e:
                logger.warning(f"프로파일 로드 실패: {profile_file}", extra={"error": str(e)})

    return profiles


@router.get("/output-profiles")
async def get_output_profiles(
    current_user: AuthenticatedUser = Depends(require_auth),
) -> List[Dict[str, Any]]:
    """라우팅 출력 프로파일 목록 조회"""
    logger.debug("출력 프로파일 조회", extra={"username": current_user.username})
    return _load_all_profiles()


def _load_profile(profile_id: str) -> Dict[str, Any] | None:
    """특정 프로파일을 로드"""
    # 기본 프로파일
    if profile_id == "default":
        return {
            "id": "default",
            "name": "기본 프로파일",
            "description": "표준 라우팅 출력",
            "format": "CSV",
            "mappings": [
                {"source": "ITEM_CD", "mapped": "ITEM_CD", "type": "string", "required": True, "default_value": None},
                {"source": "PROC_CD", "mapped": "PROC_CD", "type": "string", "required": True, "default_value": None},
                {"source": "SEQ_NO", "mapped": "SEQ_NO", "type": "number", "required": True, "default_value": None},
                {"source": "RUN_TIME", "mapped": "RUN_TIME", "type": "number", "required": False, "default_value": None},
            ],
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-01-01T00:00:00Z",
            "sample": [],
        }

    # 파일에서 로드
    profile_file = PROFILES_DIR / f"{profile_id}.json"
    if profile_file.exists():
        try:
            with open(profile_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"프로파일 로드 실패: {profile_id}", extra={"error": str(e)})
            return None

    return None


@router.get("/output-profiles/{profile_id}")
async def get_output_profile_detail(
    profile_id: str,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """라우팅 출력 프로파일 상세 조회"""
    logger.debug("출력 프로파일 상세 조회", extra={"username": current_user.username, "profile_id": profile_id})

    profile = _load_profile(profile_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"프로파일을 찾을 수 없습니다: {profile_id}"
        )

    return profile


@router.post("/output-profiles")
async def create_output_profile(
    request: CreateOutputProfileRequest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """새 출력 프로파일 생성"""
    logger.info("출력 프로파일 생성", extra={
        "username": current_user.username,
        "profile_name": request.name
    })

    # 프로파일 ID 생성
    profile_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"

    # 프로파일 데이터 구성
    profile_data = {
        "id": profile_id,
        "name": request.name,
        "description": request.description,
        "format": request.format,
        "mappings": [mapping.model_dump() for mapping in request.mappings],
        "created_by": current_user.username,
        "created_at": now,
        "updated_at": now,
        "sample": [],
    }

    # 파일로 저장
    profile_file = PROFILES_DIR / f"{profile_id}.json"
    try:
        with open(profile_file, "w", encoding="utf-8") as f:
            json.dump(profile_data, f, ensure_ascii=False, indent=2)

        logger.info(f"프로파일 생성 완료: {profile_id}", extra={
            "username": current_user.username,
            "profile_name": request.name,
            "profile_id": profile_id
        })

        return {
            "id": profile_id,
            "name": request.name,
            "description": request.description,
            "format": request.format,
            "created_at": now,
            "updated_at": now,
            "message": "프로파일이 성공적으로 생성되었습니다.",
        }

    except Exception as e:
        logger.error(f"프로파일 저장 실패: {request.name}", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"프로파일 저장 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/output-profiles/preview")
async def generate_output_preview(
    payload: Dict[str, Any],
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """라우팅 출력 미리보기 생성"""
    logger.debug("출력 미리보기 생성", extra={"username": current_user.username})

    # 매핑에서 컬럼 추출
    mappings = payload.get("mappings", [])
    columns = [m.get("mapped") or m.get("source") for m in mappings if m.get("mapped") or m.get("source")]

    # 샘플 데이터 생성
    rows = []
    if columns:
        for i in range(3):  # 3개 샘플 행 생성
            row = {}
            for col in columns:
                row[col] = f"Sample_{i+1}"
            rows.append(row)

    return {
        "rows": rows,
        "columns": columns,
        "row_count": len(rows),
        "column_count": len(columns),
    }


__all__ = ["router"]
