"""데이터 품질 모니터링 API 엔드포인트."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_admin

from sqlalchemy.orm import Session

from backend.database import get_session
from backend.api.services.data_quality_service import (
    DataQualityMetrics,
    DataQualityReport,
    DataQualityService,
    HealthStatus,
    get_prometheus_metrics,
)

router = APIRouter(prefix="/api/data-quality", tags=["data-quality"])


# ============================================================================
# Routes
# ============================================================================


@router.get("/metrics", response_model=DataQualityMetrics)
async def get_quality_metrics(_admin: AuthenticatedUser = Depends(require_admin), session: Session = Depends(get_session)) -> DataQualityMetrics:
    """
    현재 데이터 품질 메트릭을 반환합니다.

    **측정 항목**:
    - 총 품목 수
    - 완전성 비율 (필수 필드가 모두 있는 품목 비율)
    - 필드별 결측치 (재질, 품목유형, 치수, 도면번호)
    - 중복 품목 수
    - 치수 이상치 수
    - 형식 오류 수
    - 최근 24시간 변경 사항
    - 전체 품질 점수 (0-100)

    **활용**:
    - 대시보드 KPI 표시
    - 알림 트리거 조건 확인
    - 품질 추세 분석
    """
    service = DataQualityService(session)
    metrics = service.collect_metrics()
    return metrics


@router.get("/report", response_model=DataQualityReport)
async def get_quality_report(_admin: AuthenticatedUser = Depends(require_admin), session: Session = Depends(get_session)) -> DataQualityReport:
    """
    데이터 품질 보고서를 생성합니다.

    **포함 내용**:
    - 품질 메트릭 (현재 상태)
    - 발견된 이슈 목록 (심각도별)
    - 이슈별 영향 품목 수 및 샘플 ID
    - 권장 조치사항
    - 추세 정보 (선택)

    **이슈 카테고리**:
    - missing: 결측치
    - duplicate: 중복
    - outlier: 이상치
    - invalid: 형식 오류

    **심각도**:
    - critical: 즉시 조치 필요
    - high: 우선 조치 필요
    - medium: 계획적 조치 필요
    - low: 모니터링 필요

    **활용**:
    - 주간/월간 품질 보고서
    - 데이터 정제 작업 계획
    - 경영진 보고
    """
    service = DataQualityService(session)
    report = service.generate_report()
    return report


@router.get("/prometheus")
async def get_prometheus_format(_admin: AuthenticatedUser = Depends(require_admin), session: Session = Depends(get_session)) -> Response:
    """
    Prometheus 형식으로 메트릭을 반환합니다.

    **Prometheus Scraping 설정**:
    ```yaml
    scrape_configs:
      - job_name: 'routing_ml_data_quality'
        scrape_interval: 5m  # 5분마다 수집
        static_configs:
          - targets: ['localhost:8000']
        metrics_path: '/api/data-quality/prometheus'
    ```

    **메트릭**:
    - data_quality_score: 품질 점수 (0-100)
    - data_completeness_rate: 완전성 비율 (0-1)
    - data_total_items: 총 품목 수
    - data_incomplete_items: 불완전 품목 수
    - data_duplicate_items: 중복 품목 수
    - data_outlier_dimensions: 치수 이상치 수
    - data_items_added_24h: 최근 24시간 추가 품목 수

    **Grafana 대시보드**:
    - 품질 점수 게이지
    - 완전성 비율 타임시리즈
    - 이슈 수 히트맵
    - 변경 사항 그래프
    """
    service = DataQualityService(session)
    metrics = service.collect_metrics()
    prometheus_text = get_prometheus_metrics(metrics)

    return Response(
        content=prometheus_text,
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@router.get("/health", response_model=HealthStatus)
async def health_check(_admin: AuthenticatedUser = Depends(require_admin), session: Session = Depends(get_session)) -> HealthStatus:
    """데이터 품질 서비스 헬스 체크."""
    service = DataQualityService(session)
    return service.get_health_status()



