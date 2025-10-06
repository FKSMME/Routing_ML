"""주간 데이터 품질 리포트 API 엔드포인트."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import get_session
from backend.api.services.weekly_report_service import (
    WeeklyReport,
    WeeklyReportService,
)
from common.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/weekly-report", tags=["weekly-report"])


# ============================================================================
# API Endpoints
# ============================================================================


@router.post("/generate", response_model=WeeklyReport, summary="주간 리포트 생성")
def generate_weekly_report(
    week_offset: int = Query(0, ge=-52, le=0, description="주 오프셋 (0=이번 주, -1=지난 주)"),
    background_tasks: BackgroundTasks = None,
    session: Session = Depends(get_session),
):
    """
    주간 데이터 품질 리포트를 생성합니다.

    **파라미터**:
    - `week_offset`: 주 오프셋 (0=이번 주, -1=지난 주, -2=2주 전...)

    **반환**:
    - 주간 리포트 (통계, 추세, 이슈, 권장사항)
    """
    try:
        logger.info(f"주간 리포트 생성 요청: week_offset={week_offset}")

        service = WeeklyReportService(session)
        report = service.generate_weekly_report(week_offset=week_offset)

        # 백그라운드에서 HTML 생성
        if background_tasks:
            background_tasks.add_task(service.export_html_report, report)

        return report

    except Exception as e:
        logger.error(f"주간 리포트 생성 중 오류: {e}")
        raise HTTPException(status_code=500, detail="리포트 생성 중 오류가 발생했습니다")


@router.get("/list", response_model=List[WeeklyReport], summary="리포트 목록 조회")
def list_weekly_reports(
    limit: int = Query(10, ge=1, le=100, description="조회 개수"),
    session: Session = Depends(get_session),
):
    """
    최근 주간 리포트 목록을 조회합니다.

    **파라미터**:
    - `limit`: 조회 개수 (기본값: 10, 최대: 100)

    **반환**:
    - 주간 리포트 목록 (최신순)
    """
    try:
        logger.info(f"주간 리포트 목록 조회: limit={limit}")

        service = WeeklyReportService(session)
        reports = service.get_recent_reports(limit=limit)

        return reports

    except Exception as e:
        logger.error(f"리포트 목록 조회 중 오류: {e}")
        raise HTTPException(status_code=500, detail="목록 조회 중 오류가 발생했습니다")


@router.get("/{report_id}", response_model=WeeklyReport, summary="리포트 조회")
def get_weekly_report(
    report_id: str,
    session: Session = Depends(get_session),
):
    """
    특정 주간 리포트를 조회합니다.

    **파라미터**:
    - `report_id`: 리포트 ID (예: WR-2025W40)

    **반환**:
    - 주간 리포트
    """
    try:
        logger.info(f"주간 리포트 조회: {report_id}")

        service = WeeklyReportService(session)
        reports = service.get_recent_reports(limit=100)

        report = next((r for r in reports if r.report_id == report_id), None)
        if not report:
            raise HTTPException(status_code=404, detail=f"리포트를 찾을 수 없습니다: {report_id}")

        return report

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"리포트 조회 중 오류: {e}")
        raise HTTPException(status_code=500, detail="조회 중 오류가 발생했습니다")


@router.get("/{report_id}/html", summary="HTML 리포트 다운로드")
def download_html_report(
    report_id: str,
    session: Session = Depends(get_session),
):
    """
    주간 리포트를 HTML 파일로 다운로드합니다.

    **파라미터**:
    - `report_id`: 리포트 ID (예: WR-2025W40)

    **반환**:
    - HTML 파일
    """
    try:
        logger.info(f"HTML 리포트 다운로드: {report_id}")

        service = WeeklyReportService(session)

        # 리포트 조회
        reports = service.get_recent_reports(limit=100)
        report = next((r for r in reports if r.report_id == report_id), None)
        if not report:
            raise HTTPException(status_code=404, detail=f"리포트를 찾을 수 없습니다: {report_id}")

        # HTML 생성
        html_path = service.export_html_report(report)

        return FileResponse(
            html_path,
            media_type="text/html",
            filename=f"{report_id}.html",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"HTML 다운로드 중 오류: {e}")
        raise HTTPException(status_code=500, detail="다운로드 중 오류가 발생했습니다")


@router.post("/schedule", summary="자동 생성 스케줄 설정")
def schedule_weekly_report(
    enabled: bool = Query(True, description="스케줄 활성화 여부"),
    day_of_week: int = Query(0, ge=0, le=6, description="요일 (0=월요일, 6=일요일)"),
    hour: int = Query(9, ge=0, le=23, description="시간 (0-23)"),
):
    """
    주간 리포트 자동 생성 스케줄을 설정합니다.

    **파라미터**:
    - `enabled`: 스케줄 활성화 여부
    - `day_of_week`: 실행 요일 (0=월요일, 6=일요일)
    - `hour`: 실행 시간 (0-23시)

    **반환**:
    - 스케줄 설정 정보
    """
    try:
        logger.info(f"스케줄 설정: enabled={enabled}, day={day_of_week}, hour={hour}")

        # 스케줄 정보 저장
        import json
        from pathlib import Path

        config_dir = Path("config")
        config_dir.mkdir(parents=True, exist_ok=True)

        schedule_config = {
            "enabled": enabled,
            "day_of_week": day_of_week,
            "hour": hour,
        }

        config_path = config_dir / "weekly_report_schedule.json"
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(schedule_config, f, indent=2)

        logger.info(f"스케줄 설정 저장: {config_path}")

        return {
            "success": True,
            "message": "스케줄이 설정되었습니다" if enabled else "스케줄이 비활성화되었습니다",
            "config": schedule_config,
            "next_run": f"매주 {'월화수목금토일'[day_of_week]}요일 {hour:02d}:00" if enabled else "비활성화",
        }

    except Exception as e:
        logger.error(f"스케줄 설정 중 오류: {e}")
        raise HTTPException(status_code=500, detail="설정 중 오류가 발생했습니다")


@router.get("/schedule/status", summary="스케줄 상태 조회")
def get_schedule_status():
    """
    주간 리포트 스케줄 상태를 조회합니다.

    **반환**:
    - 스케줄 설정 정보
    """
    try:
        import json
        from pathlib import Path

        config_path = Path("config/weekly_report_schedule.json")
        if not config_path.exists():
            return {
                "enabled": False,
                "message": "스케줄이 설정되지 않았습니다",
            }

        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)

        return {
            "enabled": config.get("enabled", False),
            "day_of_week": config.get("day_of_week", 0),
            "hour": config.get("hour", 9),
            "next_run": f"매주 {'월화수목금토일'[config.get('day_of_week', 0)]}요일 {config.get('hour', 9):02d}:00"
            if config.get("enabled")
            else "비활성화",
        }

    except Exception as e:
        logger.error(f"스케줄 상태 조회 중 오류: {e}")
        raise HTTPException(status_code=500, detail="조회 중 오류가 발생했습니다")
