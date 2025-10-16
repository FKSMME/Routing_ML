"""
Data Mapping Routes - 라우팅 그룹 ↔ DB 컬럼 매핑 API.

관리자가 데이터 관계를 설정하고, 사용자가 매핑을 적용할 수 있는 엔드포인트를 제공합니다.
"""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status

from backend.api.security import get_current_user, require_admin
from backend.api.schemas import (
    AuthenticatedUser,
    DataMappingApplyRequest,
    DataMappingApplyResponse,
    DataMappingProfile,
    DataMappingProfileCreate,
    DataMappingProfileListResponse,
    DataMappingProfileUpdate,
)
from backend.api.services.data_mapping_service import get_data_mapping_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/data-mapping", tags=["data-mapping"])


@router.get(
    "/profiles",
    response_model=DataMappingProfileListResponse,
    summary="데이터 매핑 프로파일 목록 조회",
)
def list_profiles(
    _user: AuthenticatedUser = Depends(get_current_user),
) -> DataMappingProfileListResponse:
    """
    모든 데이터 매핑 프로파일 목록을 반환합니다.

    - 모든 사용자가 조회 가능
    - 최신 수정 순으로 정렬
    """
    service = get_data_mapping_service()
    return service.list_profiles()


@router.get(
    "/profiles/{profile_id}",
    response_model=DataMappingProfile,
    summary="데이터 매핑 프로파일 상세 조회",
)
def get_profile(
    profile_id: str,
    _user: AuthenticatedUser = Depends(get_current_user),
) -> DataMappingProfile:
    """
    특정 프로파일의 상세 정보를 조회합니다.

    - 모든 사용자가 조회 가능
    """
    service = get_data_mapping_service()
    profile = service.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Profile not found: {profile_id}")
    return profile


@router.post(
    "/profiles",
    response_model=DataMappingProfile,
    status_code=201,
    summary="데이터 매핑 프로파일 생성 (관리자 전용)",
)
def create_profile(
    payload: DataMappingProfileCreate,
    user: AuthenticatedUser = Depends(require_admin),
) -> DataMappingProfile:
    """
    새 데이터 매핑 프로파일을 생성합니다.

    - 관리자만 생성 가능
    - 라우팅 그룹 필드 → DB 컬럼 매핑 규칙 정의
    """
    service = get_data_mapping_service()
    profile = service.create_profile(payload=payload, created_by=user.username)

    logger.info(
        f"Data mapping profile created: {profile.id}",
        extra={
            "profile_id": profile.id,
            "profile_name": profile.name,
            "created_by": user.username,
        },
    )
    return profile


@router.patch(
    "/profiles/{profile_id}",
    response_model=DataMappingProfile,
    summary="데이터 매핑 프로파일 수정 (관리자 전용)",
)
def update_profile(
    profile_id: str,
    payload: DataMappingProfileUpdate,
    user: AuthenticatedUser = Depends(require_admin),
) -> DataMappingProfile:
    """
    기존 프로파일을 수정합니다.

    - 관리자만 수정 가능
    - 부분 업데이트 지원
    """
    service = get_data_mapping_service()
    profile = service.update_profile(profile_id=profile_id, payload=payload)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Profile not found: {profile_id}")

    logger.info(
        f"Data mapping profile updated: {profile_id}",
        extra={
            "profile_id": profile_id,
            "updated_by": user.username,
        },
    )
    return profile


@router.delete(
    "/profiles/{profile_id}",
    status_code=204,
    summary="데이터 매핑 프로파일 삭제 (관리자 전용)",
)
def delete_profile(
    profile_id: str,
    user: AuthenticatedUser = Depends(require_admin),
) -> Response:
    """
    프로파일을 삭제합니다.

    - 관리자만 삭제 가능
    """
    service = get_data_mapping_service()
    success = service.delete_profile(profile_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Profile not found: {profile_id}")

    logger.info(
        f"Data mapping profile deleted: {profile_id}",
        extra={
            "profile_id": profile_id,
            "deleted_by": user.username,
        },
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/apply",
    response_model=DataMappingApplyResponse,
    summary="데이터 매핑 적용 (미리보기 또는 CSV 생성)",
)
def apply_mapping(
    request: DataMappingApplyRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> DataMappingApplyResponse:
    """
    라우팅 그룹 데이터에 매핑 프로파일을 적용합니다.

    - preview_only=True: 미리보기만 생성 (최대 10행)
    - preview_only=False: CSV 파일 생성

    라우팅 그룹 ID를 사용하여 실제 데이터베이스에서 그룹 데이터를 조회합니다.
    """
    service = get_data_mapping_service()

    # Load routing group data from database
    from backend.models.routing_groups import session_scope, RoutingGroup

    routing_group_data: List[dict] = []

    if request.routing_group_id:
        try:
            with session_scope() as session:
                group = session.get(RoutingGroup, request.routing_group_id)
                if group is None or group.deleted_at is not None:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Routing group not found: {request.routing_group_id}"
                    )

                # Check ownership
                if group.owner != user.username and not user.is_admin:
                    raise HTTPException(
                        status_code=403,
                        detail="Access denied to routing group"
                    )

                # Convert steps to routing_group_data format
                if group.steps:
                    routing_group_data = list(group.steps)

                logger.info(
                    f"Loaded routing group data: {len(routing_group_data)} steps",
                    extra={
                        "group_id": request.routing_group_id,
                        "step_count": len(routing_group_data),
                    },
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to load routing group: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail="Failed to load routing group data"
            )

    try:
        result = service.apply_mapping(
            request=request,
            routing_group_data=routing_group_data,
        )
        logger.info(
            f"Applied data mapping: profile={request.profile_id}, group={request.routing_group_id}",
            extra={
                "profile_id": request.profile_id,
                "routing_group_id": request.routing_group_id,
                "preview_only": request.preview_only,
                "data_rows": len(routing_group_data),
            },
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to apply mapping: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to apply data mapping")
