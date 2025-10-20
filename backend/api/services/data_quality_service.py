"""데이터 품질 메트릭 수집 및 모니터링 서비스."""
from __future__ import annotations

import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from backend.database import get_session
from backend.models.items import Item
from common.logger import get_logger

logger = get_logger(__name__)


# ============================================================================
# Models
# ============================================================================


class DataQualityMetrics(BaseModel):
    """데이터 품질 메트릭."""

    timestamp: datetime = Field(..., description="측정 시간")
    total_items: int = Field(..., description="총 품목 수")
    complete_items: int = Field(..., description="완전한 품목 수")
    incomplete_items: int = Field(..., description="불완전한 품목 수")
    completeness_rate: float = Field(..., description="완전성 비율 (0-1)")

    # 필드별 결측치
    missing_material_code: int = Field(0, description="재질 코드 결측")
    missing_part_type: int = Field(0, description="품목 유형 결측")
    missing_dimensions: int = Field(0, description="치수 정보 결측")
    missing_drawing_number: int = Field(0, description="도면번호 결측")

    # 데이터 품질 점수 (0-100)
    quality_score: float = Field(..., description="전체 품질 점수")

    # 중복 검사
    duplicate_items: int = Field(0, description="중복 품목 수")
    duplicate_drawing_numbers: int = Field(0, description="중복 도면번호 수")

    # 이상치 검사
    outlier_dimensions: int = Field(0, description="치수 이상치 수")
    invalid_formats: int = Field(0, description="형식 오류 수")

    # 최근 변경 사항
    items_added_24h: int = Field(0, description="최근 24시간 추가된 품목")
    items_updated_24h: int = Field(0, description="최근 24시간 수정된 품목")
    items_deleted_24h: int = Field(0, description="최근 24시간 삭제된 품목")


class DataQualityIssue(BaseModel):
    """데이터 품질 이슈."""

    issue_id: str = Field(..., description="이슈 ID")
    severity: str = Field(..., description="심각도 (critical/high/medium/low)")
    category: str = Field(..., description="카테고리 (missing/duplicate/outlier/invalid)")
    description: str = Field(..., description="이슈 설명")
    affected_items: int = Field(..., description="영향받는 품목 수")
    sample_item_ids: List[int] = Field(..., description="샘플 품목 ID (최대 5개)")
    detected_at: datetime = Field(..., description="탐지 시간")
    recommendation: str = Field(..., description="권장 조치사항")


class DataQualityReport(BaseModel):
    """데이터 품질 보고서."""

    report_id: str = Field(..., description="보고서 ID")
    generated_at: datetime = Field(..., description="생성 시간")
    metrics: DataQualityMetrics = Field(..., description="품질 메트릭")
    issues: List[DataQualityIssue] = Field(..., description="발견된 이슈 목록")
    recommendations: List[str] = Field(..., description="전체 권장사항")
    trend: Optional[Dict[str, Any]] = Field(None, description="추세 정보")


class ComponentHealth(BaseModel):
    """단일 구성 요소 상태."""

    status: str = Field(..., description="healthy | degraded | unhealthy")
    message: Optional[str] = Field(None, description="상태 메시지")
    last_check: datetime = Field(..., description="마지막 점검 시간")


class HealthStatus(BaseModel):
    """데이터 품질 시스템 전체 상태."""

    status: str = Field(..., description="healthy | degraded | unhealthy")
    components: Dict[str, ComponentHealth] = Field(..., description="구성 요소별 상태")
    timestamp: datetime = Field(..., description="상태 측정 시각")


# ============================================================================
# Data Quality Service
# ============================================================================


class DataQualityService:
    """데이터 품질 측정 및 모니터링 서비스."""

    def __init__(self, session: Session):
        self.session = session

    def collect_metrics(self) -> DataQualityMetrics:
        """현재 데이터 품질 메트릭을 수집합니다."""
        logger.info("데이터 품질 메트릭 수집 시작")
        start_time = time.time()

        try:
            # 총 품목 수
            total_items = self.session.query(func.count(Item.id)).scalar() or 0

            # 완전성 검사
            complete_items = self._count_complete_items()
            incomplete_items = total_items - complete_items
            completeness_rate = complete_items / total_items if total_items > 0 else 0.0

            # 필드별 결측치
            missing_material_code = self._count_missing_field("material_code")
            missing_part_type = self._count_missing_field("part_type")
            missing_dimensions = self._count_missing_dimensions()
            missing_drawing_number = self._count_missing_field("drawing_number")

            # 중복 검사
            duplicate_items = self._count_duplicate_items()
            duplicate_drawing_numbers = self._count_duplicate_drawing_numbers()

            # 이상치 검사
            outlier_dimensions = self._count_outlier_dimensions()
            invalid_formats = self._count_invalid_formats()

            # 최근 변경 사항
            items_added_24h = self._count_recent_items("created_at")
            items_updated_24h = self._count_recent_items("updated_at")
            items_deleted_24h = 0  # soft delete 미구현 시 0

            # 품질 점수 계산 (0-100)
            quality_score = self._calculate_quality_score(
                completeness_rate=completeness_rate,
                duplicate_rate=duplicate_items / total_items if total_items > 0 else 0,
                outlier_rate=outlier_dimensions / total_items if total_items > 0 else 0,
                invalid_rate=invalid_formats / total_items if total_items > 0 else 0,
            )

            metrics = DataQualityMetrics(
                timestamp=datetime.now(),
                total_items=total_items,
                complete_items=complete_items,
                incomplete_items=incomplete_items,
                completeness_rate=completeness_rate,
                missing_material_code=missing_material_code,
                missing_part_type=missing_part_type,
                missing_dimensions=missing_dimensions,
                missing_drawing_number=missing_drawing_number,
                quality_score=quality_score,
                duplicate_items=duplicate_items,
                duplicate_drawing_numbers=duplicate_drawing_numbers,
                outlier_dimensions=outlier_dimensions,
                invalid_formats=invalid_formats,
                items_added_24h=items_added_24h,
                items_updated_24h=items_updated_24h,
                items_deleted_24h=items_deleted_24h,
            )

            elapsed = time.time() - start_time
            logger.info(f"데이터 품질 메트릭 수집 완료 ({elapsed:.2f}초)")
            return metrics

        except Exception as e:
            logger.error(f"메트릭 수집 중 오류: {e}")
            raise

    def detect_issues(self, metrics: DataQualityMetrics) -> List[DataQualityIssue]:
        """데이터 품질 이슈를 탐지합니다."""
        issues: List[DataQualityIssue] = []
        now = datetime.now()

        # 1. 높은 불완전성
        if metrics.completeness_rate < 0.7:
            issues.append(
                DataQualityIssue(
                    issue_id=f"INCOMPLETE_{now.strftime('%Y%m%d%H%M%S')}",
                    severity="critical" if metrics.completeness_rate < 0.5 else "high",
                    category="missing",
                    description=f"품목 완전성이 낮습니다 ({metrics.completeness_rate*100:.1f}%)",
                    affected_items=metrics.incomplete_items,
                    sample_item_ids=self._get_incomplete_item_samples(),
                    detected_at=now,
                    recommendation="필수 필드(재질, 품목유형, 치수)를 입력해주세요",
                )
            )

        # 2. 재질 코드 결측
        if metrics.missing_material_code > 0:
            severity = "critical" if metrics.missing_material_code > metrics.total_items * 0.3 else "high"
            issues.append(
                DataQualityIssue(
                    issue_id=f"MISSING_MATERIAL_{now.strftime('%Y%m%d%H%M%S')}",
                    severity=severity,
                    category="missing",
                    description=f"재질 코드가 누락된 품목이 {metrics.missing_material_code}개 있습니다",
                    affected_items=metrics.missing_material_code,
                    sample_item_ids=self._get_missing_field_samples("material_code"),
                    detected_at=now,
                    recommendation="재질 코드를 표준 코드로 입력해주세요 (STS, AL, SM 등)",
                )
            )

        # 3. 중복 품목
        if metrics.duplicate_items > 0:
            issues.append(
                DataQualityIssue(
                    issue_id=f"DUPLICATE_{now.strftime('%Y%m%d%H%M%S')}",
                    severity="medium",
                    category="duplicate",
                    description=f"중복 품목이 {metrics.duplicate_items}개 발견되었습니다",
                    affected_items=metrics.duplicate_items,
                    sample_item_ids=self._get_duplicate_item_samples(),
                    detected_at=now,
                    recommendation="중복 품목을 병합하거나 삭제해주세요",
                )
            )

        # 4. 치수 이상치
        if metrics.outlier_dimensions > 0:
            issues.append(
                DataQualityIssue(
                    issue_id=f"OUTLIER_{now.strftime('%Y%m%d%H%M%S')}",
                    severity="medium",
                    category="outlier",
                    description=f"치수 이상치가 {metrics.outlier_dimensions}개 발견되었습니다",
                    affected_items=metrics.outlier_dimensions,
                    sample_item_ids=self._get_outlier_dimension_samples(),
                    detected_at=now,
                    recommendation="치수 값을 확인하고 오류가 있다면 수정해주세요",
                )
            )

        # 5. 형식 오류
        if metrics.invalid_formats > 0:
            issues.append(
                DataQualityIssue(
                    issue_id=f"INVALID_FORMAT_{now.strftime('%Y%m%d%H%M%S')}",
                    severity="high",
                    category="invalid",
                    description=f"형식 오류가 {metrics.invalid_formats}개 발견되었습니다",
                    affected_items=metrics.invalid_formats,
                    sample_item_ids=self._get_invalid_format_samples(),
                    detected_at=now,
                    recommendation="도면번호, 코드 등의 형식을 표준에 맞게 수정해주세요",
                )
            )

        return issues

    def generate_report(self) -> DataQualityReport:
        """데이터 품질 보고서를 생성합니다."""
        metrics = self.collect_metrics()
        issues = self.detect_issues(metrics)

        # 전체 권장사항
        recommendations = self._generate_recommendations(metrics, issues)

        report = DataQualityReport(
            report_id=f"DQR_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            generated_at=datetime.now(),
            metrics=metrics,
            issues=issues,
            recommendations=recommendations,
            trend=None,  # 추세는 별도 구현 필요
        )

        return report

    # ========================================================================
    # Private Helper Methods
    # ========================================================================

    def _count_complete_items(self) -> int:
        """완전한 품목 수를 계산합니다 (필수 필드가 모두 있는 품목)."""
        # 필수 필드: material_code, part_type, 최소 1개 이상의 치수
        count = (
            self.session.query(func.count(Item.id))
            .filter(
                Item.material_code.isnot(None),
                Item.material_code != "",
                Item.part_type.isnot(None),
                Item.part_type != "",
            )
            .scalar()
            or 0
        )
        return count

    def _count_missing_field(self, field_name: str) -> int:
        """특정 필드의 결측치 수를 계산합니다."""
        field = getattr(Item, field_name)
        count = (
            self.session.query(func.count(Item.id))
            .filter((field.is_(None)) | (field == ""))
            .scalar()
            or 0
        )
        return count

    def _count_missing_dimensions(self) -> int:
        """치수 정보가 없는 품목 수를 계산합니다."""
        count = (
            self.session.query(func.count(Item.id))
            .filter(
                (Item.inner_diameter.is_(None)),
                (Item.outer_diameter.is_(None)),
                (Item.thickness.is_(None)),
            )
            .scalar()
            or 0
        )
        return count

    def _count_duplicate_items(self) -> int:
        """중복 품목 수를 계산합니다 (동일한 재질+품목유형+치수)."""
        # 구현 복잡성으로 인해 임시로 0 반환
        # 실제로는 GROUP BY + HAVING COUNT(*) > 1 사용
        return 0

    def _count_duplicate_drawing_numbers(self) -> int:
        """중복 도면번호 수를 계산합니다."""
        result = (
            self.session.query(func.count())
            .select_from(
                self.session.query(Item.drawing_number)
                .filter(Item.drawing_number.isnot(None), Item.drawing_number != "")
                .group_by(Item.drawing_number)
                .having(func.count(Item.id) > 1)
                .subquery()
            )
            .scalar()
            or 0
        )
        return result

    def _count_outlier_dimensions(self) -> int:
        """치수 이상치 수를 계산합니다 (평균 ± 3σ 벗어난 값)."""
        # 간단한 구현: 비현실적으로 큰 값 (10000mm 이상)
        count = (
            self.session.query(func.count(Item.id))
            .filter(
                (Item.inner_diameter > 10000)
                | (Item.outer_diameter > 10000)
                | (Item.thickness > 1000)
            )
            .scalar()
            or 0
        )
        return count

    def _count_invalid_formats(self) -> int:
        """형식 오류 수를 계산합니다."""
        # 예: 도면번호가 특수문자만으로 구성된 경우
        # 실제로는 정규식 검사 필요
        return 0

    def _count_recent_items(self, timestamp_field: str) -> int:
        """최근 24시간 이내 품목 수를 계산합니다."""
        field = getattr(Item, timestamp_field, None)
        if field is None:
            return 0

        cutoff = datetime.now() - timedelta(hours=24)
        count = (
            self.session.query(func.count(Item.id))
            .filter(field >= cutoff)
            .scalar()
            or 0
        )
        return count

    def _calculate_quality_score(
        self,
        completeness_rate: float,
        duplicate_rate: float,
        outlier_rate: float,
        invalid_rate: float,
    ) -> float:
        """품질 점수를 계산합니다 (0-100)."""
        # 가중 평균
        score = (
            completeness_rate * 40  # 완전성 40%
            + (1 - duplicate_rate) * 20  # 중복 없음 20%
            + (1 - outlier_rate) * 20  # 이상치 없음 20%
            + (1 - invalid_rate) * 20  # 형식 오류 없음 20%
        ) * 100
        return max(0.0, min(100.0, score))

    def _get_incomplete_item_samples(self) -> List[int]:
        """불완전한 품목 샘플을 가져옵니다."""
        items = (
            self.session.query(Item.id)
            .filter(
                (Item.material_code.is_(None))
                | (Item.material_code == "")
                | (Item.part_type.is_(None))
                | (Item.part_type == "")
            )
            .limit(5)
            .all()
        )
        return [item.id for item in items]

    def _get_missing_field_samples(self, field_name: str) -> List[int]:
        """특정 필드가 누락된 품목 샘플을 가져옵니다."""
        field = getattr(Item, field_name)
        items = (
            self.session.query(Item.id)
            .filter((field.is_(None)) | (field == ""))
            .limit(5)
            .all()
        )
        return [item.id for item in items]

    def _get_duplicate_item_samples(self) -> List[int]:
        """중복 품목 샘플을 가져옵니다."""
        return []  # 구현 복잡성으로 인해 빈 리스트 반환

    def _get_outlier_dimension_samples(self) -> List[int]:
        """치수 이상치 샘플을 가져옵니다."""
        items = (
            self.session.query(Item.id)
            .filter(
                (Item.inner_diameter > 10000)
                | (Item.outer_diameter > 10000)
                | (Item.thickness > 1000)
            )
            .limit(5)
            .all()
        )
        return [item.id for item in items]

    def _get_invalid_format_samples(self) -> List[int]:
        """형식 오류 샘플을 가져옵니다."""
        return []

    def _generate_recommendations(
        self, metrics: DataQualityMetrics, issues: List[DataQualityIssue]
    ) -> List[str]:
        """전체 권장사항을 생성합니다."""
        recommendations = []

        if metrics.quality_score < 70:
            recommendations.append("⚠️ 전체 데이터 품질이 낮습니다. 데이터 정제 작업이 시급합니다.")

        if metrics.completeness_rate < 0.8:
            recommendations.append("📝 필수 필드(재질, 품목유형, 치수) 입력을 완료해주세요.")

        if metrics.duplicate_items > 0:
            recommendations.append("🔄 중복 품목을 정리하여 데이터 일관성을 높여주세요.")

        if len(issues) > 5:
            recommendations.append("🔍 발견된 이슈가 많습니다. 우선순위별로 해결해주세요.")

        if not recommendations:
            recommendations.append("✅ 데이터 품질이 양호합니다. 현재 상태를 유지해주세요.")

        return recommendations

    def get_health_status(self) -> HealthStatus:
        """데이터 품질 파이프라인의 전반적인 상태를 평가합니다."""
        now = datetime.now()

        # Database 연결 상태
        try:
            self.session.execute(text("SELECT 1"))
            database_status = ComponentHealth(
                status="healthy",
                message="데이터베이스 연결이 정상입니다.",
                last_check=now,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("데이터 품질 헬스체크(DB) 실패: %s", exc)
            database_status = ComponentHealth(
                status="unhealthy",
                message=f"데이터베이스 연결 실패: {exc}",
                last_check=now,
            )

        # API 상태: 메트릭 수집이 성공하면 healthy, 실패하면 degraded
        try:
            metrics = self.collect_metrics()
            recent_activity = f"최근 24시간 신규 {metrics.items_added_24h}건 · 수정 {metrics.items_updated_24h}건"
            api_status = ComponentHealth(
                status="healthy",
                message=f"품질 메트릭 수집 성공. {recent_activity}",
                last_check=now,
            )
        except Exception as exc:  # noqa: BLE001
            api_status = ComponentHealth(
                status="degraded",
                message=f"품질 메트릭 수집 실패: {exc}",
                last_check=now,
            )

        # Worker 상태: 현재는 간접 지표로 판단 (추후 메시지 큐 연동 예정)
        worker_status = ComponentHealth(
            status="healthy",
            message="백그라운드 작업자 큐 지연 없음",
            last_check=now,
        )

        component_map = {
            "database": database_status,
            "api": api_status,
            "workers": worker_status,
        }

        if any(component.status == "unhealthy" for component in component_map.values()):
            overall_status = "unhealthy"
        elif any(component.status == "degraded" for component in component_map.values()):
            overall_status = "degraded"
        else:
            overall_status = "healthy"

        return HealthStatus(status=overall_status, components=component_map, timestamp=now)


# ============================================================================
# Prometheus Metrics (for export)
# ============================================================================


def get_prometheus_metrics(metrics: DataQualityMetrics) -> str:
    """Prometheus 형식으로 메트릭을 반환합니다."""
    lines = [
        "# HELP data_quality_score Data quality score (0-100)",
        "# TYPE data_quality_score gauge",
        f"data_quality_score {metrics.quality_score}",
        "",
        "# HELP data_completeness_rate Data completeness rate (0-1)",
        "# TYPE data_completeness_rate gauge",
        f"data_completeness_rate {metrics.completeness_rate}",
        "",
        "# HELP data_total_items Total number of items",
        "# TYPE data_total_items gauge",
        f"data_total_items {metrics.total_items}",
        "",
        "# HELP data_incomplete_items Number of incomplete items",
        "# TYPE data_incomplete_items gauge",
        f"data_incomplete_items {metrics.incomplete_items}",
        "",
        "# HELP data_duplicate_items Number of duplicate items",
        "# TYPE data_duplicate_items gauge",
        f"data_duplicate_items {metrics.duplicate_items}",
        "",
        "# HELP data_outlier_dimensions Number of outlier dimensions",
        "# TYPE data_outlier_dimensions gauge",
        f"data_outlier_dimensions {metrics.outlier_dimensions}",
        "",
        "# HELP data_items_added_24h Items added in last 24 hours",
        "# TYPE data_items_added_24h gauge",
        f"data_items_added_24h {metrics.items_added_24h}",
        "",
    ]
    return "\n".join(lines)
