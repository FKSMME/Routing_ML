"""
Data Mapping Service - 라우팅 그룹 필드 ↔ DB 컬럼 매핑 관리.

관리자가 라우팅 그룹 데이터를 DB 컬럼 구조로 변환하는 매핑 규칙을 정의하고 관리합니다.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from backend.api.schemas import (
    DataMappingApplyRequest,
    DataMappingApplyResponse,
    DataMappingProfile,
    DataMappingProfileCreate,
    DataMappingProfileListResponse,
    DataMappingProfileUpdate,
    DataMappingRule,
)

logger = logging.getLogger(__name__)


class DataMappingService:
    """데이터 매핑 프로파일 관리 서비스."""

    def __init__(self, storage_path: Optional[Path] = None):
        """
        Args:
            storage_path: 매핑 프로파일 저장 경로 (기본값: config/data_mappings/)
        """
        self.storage_path = storage_path or Path("config/data_mappings")
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self._profiles: Dict[str, DataMappingProfile] = {}
        self._load_profiles()

    def _load_profiles(self) -> None:
        """저장된 모든 프로파일을 로드합니다."""
        try:
            for file_path in self.storage_path.glob("*.json"):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        profile = DataMappingProfile(**data)
                        self._profiles[profile.id] = profile
                except Exception as e:
                    logger.warning(f"Failed to load profile from {file_path}: {e}")
            logger.info(f"Loaded {len(self._profiles)} data mapping profiles")
        except Exception as e:
            logger.error(f"Failed to load profiles: {e}")

    def _save_profile(self, profile: DataMappingProfile) -> None:
        """프로파일을 파일로 저장합니다."""
        file_path = self.storage_path / f"{profile.id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(profile.model_dump(), f, indent=2, ensure_ascii=False, default=str)
        logger.info(f"Saved profile {profile.id} to {file_path}")

    def _delete_profile_file(self, profile_id: str) -> None:
        """프로파일 파일을 삭제합니다."""
        file_path = self.storage_path / f"{profile_id}.json"
        if file_path.exists():
            file_path.unlink()
            logger.info(f"Deleted profile file {file_path}")

    def list_profiles(self) -> DataMappingProfileListResponse:
        """모든 프로파일 목록을 반환합니다."""
        profiles = list(self._profiles.values())
        # 최신 수정 순으로 정렬
        profiles.sort(
            key=lambda p: p.updated_at or p.created_at or datetime.min,
            reverse=True,
        )
        return DataMappingProfileListResponse(
            profiles=profiles,
            total=len(profiles),
        )

    def get_profile(self, profile_id: str) -> Optional[DataMappingProfile]:
        """특정 프로파일을 조회합니다."""
        return self._profiles.get(profile_id)

    def create_profile(
        self,
        payload: DataMappingProfileCreate,
        created_by: str,
    ) -> DataMappingProfile:
        """새 프로파일을 생성합니다."""
        now = datetime.utcnow()
        profile_id = str(uuid4())

        profile = DataMappingProfile(
            id=profile_id,
            name=payload.name,
            description=payload.description,
            mappings=payload.mappings,
            created_by=created_by,
            created_at=now,
            updated_at=now,
            is_active=True,
        )

        self._profiles[profile_id] = profile
        self._save_profile(profile)

        logger.info(
            f"Created data mapping profile: {profile_id} by {created_by}",
            extra={"profile_id": profile_id, "created_by": created_by},
        )
        return profile

    def update_profile(
        self,
        profile_id: str,
        payload: DataMappingProfileUpdate,
    ) -> Optional[DataMappingProfile]:
        """기존 프로파일을 수정합니다."""
        profile = self._profiles.get(profile_id)
        if not profile:
            return None

        now = datetime.utcnow()

        # 수정할 필드만 업데이트
        if payload.name is not None:
            profile.name = payload.name
        if payload.description is not None:
            profile.description = payload.description
        if payload.mappings is not None:
            profile.mappings = payload.mappings
        if payload.is_active is not None:
            profile.is_active = payload.is_active

        profile.updated_at = now

        self._save_profile(profile)

        logger.info(
            f"Updated data mapping profile: {profile_id}",
            extra={"profile_id": profile_id},
        )
        return profile

    def delete_profile(self, profile_id: str) -> bool:
        """프로파일을 삭제합니다."""
        if profile_id not in self._profiles:
            return False

        del self._profiles[profile_id]
        self._delete_profile_file(profile_id)

        logger.info(
            f"Deleted data mapping profile: {profile_id}",
            extra={"profile_id": profile_id},
        )
        return True

    def apply_mapping(
        self,
        request: DataMappingApplyRequest,
        routing_group_data: List[Dict[str, Any]],
    ) -> DataMappingApplyResponse:
        """
        라우팅 그룹 데이터에 매핑 프로파일을 적용하여 변환합니다.

        Args:
            request: 매핑 적용 요청
            routing_group_data: 라우팅 그룹 데이터 (공정 단계 목록)

        Returns:
            DataMappingApplyResponse: 변환된 데이터 및 미리보기
        """
        profile = self.get_profile(request.profile_id)
        if not profile:
            raise ValueError(f"Profile not found: {request.profile_id}")

        # 매핑 규칙 적용
        transformed_rows: List[Dict[str, Any]] = []
        columns: List[str] = []

        # 컬럼명 추출 (매핑 규칙의 display_name 또는 db_column)
        for rule in profile.mappings:
            col_name = rule.display_name or rule.db_column
            if col_name not in columns:
                columns.append(col_name)

        # 각 행 변환
        for row_data in routing_group_data:
            transformed_row: Dict[str, Any] = {}

            for rule in profile.mappings:
                col_name = rule.display_name or rule.db_column
                # 라우팅 필드에서 값 추출
                value = row_data.get(rule.routing_field, rule.default_value)

                # 데이터 타입 변환
                if value is not None:
                    value = self._convert_value(value, rule.data_type)

                transformed_row[col_name] = value

            transformed_rows.append(transformed_row)

        # 미리보기는 최대 10행만
        preview_rows = transformed_rows[:10]

        csv_path: Optional[str] = None
        if not request.preview_only:
            # CSV 파일 생성
            csv_path = self._export_to_csv(
                columns=columns,
                rows=transformed_rows,
                routing_group_id=request.routing_group_id,
                profile_id=request.profile_id,
            )

        return DataMappingApplyResponse(
            profile_id=request.profile_id,
            routing_group_id=request.routing_group_id,
            columns=columns,
            preview_rows=preview_rows,
            total_rows=len(transformed_rows),
            csv_path=csv_path,
            message=(
                f"미리보기 생성 완료 ({len(transformed_rows)}행)"
                if request.preview_only
                else f"CSV 파일 생성 완료: {csv_path}"
            ),
        )

    def _convert_value(self, value: Any, data_type: str) -> Any:
        """값을 지정된 데이터 타입으로 변환합니다."""
        try:
            if data_type == "number":
                return float(value) if value not in (None, "", "nan") else None
            elif data_type == "boolean":
                if isinstance(value, bool):
                    return value
                if isinstance(value, str):
                    return value.lower() in ("true", "yes", "1", "y")
                return bool(value)
            elif data_type == "date":
                # 날짜 문자열을 그대로 반환 (추후 포맷 변환 가능)
                return str(value) if value not in (None, "", "nan") else None
            else:  # string
                return str(value) if value not in (None, "", "nan") else ""
        except Exception as e:
            logger.warning(f"Failed to convert value {value} to {data_type}: {e}")
            return value

    def _export_to_csv(
        self,
        columns: List[str],
        rows: List[Dict[str, Any]],
        routing_group_id: str,
        profile_id: str,
    ) -> str:
        """데이터를 CSV 파일로 내보냅니다."""
        import csv

        # 출력 디렉토리 생성
        output_dir = Path("output/comprehensive_routing")
        output_dir.mkdir(parents=True, exist_ok=True)

        # 파일명 생성
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"routing_{routing_group_id}_{timestamp}.csv"
        file_path = output_dir / filename

        # CSV 작성
        with open(file_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=columns)
            writer.writeheader()
            writer.writerows(rows)

        logger.info(
            f"Exported CSV: {file_path} ({len(rows)} rows)",
            extra={
                "routing_group_id": routing_group_id,
                "profile_id": profile_id,
                "rows": len(rows),
            },
        )
        return str(file_path)


# 싱글톤 인스턴스
_data_mapping_service: Optional[DataMappingService] = None


def get_data_mapping_service() -> DataMappingService:
    """DataMappingService 싱글톤 인스턴스를 반환합니다."""
    global _data_mapping_service
    if _data_mapping_service is None:
        _data_mapping_service = DataMappingService()
    return _data_mapping_service
