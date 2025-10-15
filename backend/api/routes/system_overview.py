"""Public endpoints that expose an end-to-end system overview graph."""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from backend.api.config import get_settings
from backend.api.routes.dashboard import (
    get_database_status,
    get_item_statistics,
    get_model_metrics,
    get_routing_statistics,
)
from backend.api.services.auth_service import auth_service
from backend.api.security import get_current_user
from backend.database import get_database_info
from common.logger import get_logger

router = APIRouter(prefix="/api/system-overview", tags=["system-overview"])
logger = get_logger("api.system_overview")

STATUS_OPERATIONAL = "operational"
STATUS_DEGRADED = "degraded"
STATUS_CRITICAL = "critical"


class SystemNode(BaseModel):
    """Metadata for a node rendered on the frontend workflow canvas."""

    id: str
    label: str
    category: str
    status: str
    metrics: Dict[str, Any] = Field(default_factory=dict)
    details: str | None = None
    rank: int | None = None


class SystemEdge(BaseModel):
    """Connection metadata between two nodes on the canvas."""

    id: str
    source: str
    target: str
    label: str
    protocol: str | None = None
    description: str | None = None


class SystemGraphResponse(BaseModel):
    """Complete response returned to the frontend."""

    generated_at: str
    nodes: List[SystemNode]
    edges: List[SystemEdge]
    metrics: Dict[str, Any] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)


def _resolve_sqlite_path(url: str) -> Optional[Path]:
    """Return a filesystem path if the provided URL points to SQLite."""

    if url.startswith("sqlite:///"):
        raw = url.replace("sqlite:///", "", 1)
        return Path(raw).expanduser().resolve()
    return None


_PATH_PATTERNS = [
    re.compile(r"[A-Za-z]:\\[^\s\"']+"),  # Windows absolute paths
    re.compile(r"/[^/\s]+(?:/[^/\s]+)+"),  # Unix absolute paths with at least one '/'
]
_SECRET_PATTERN = re.compile(r"(?i)(password|secret|token|key)=([^\s;]+)")


def _sanitize_warning_message(message: str) -> str:
    """Remove sensitive fragments (paths, secrets) from warning text."""

    if not message:
        return ""

    sanitized = message
    for pattern in _PATH_PATTERNS:
        sanitized = pattern.sub("[path]", sanitized)
    sanitized = _SECRET_PATTERN.sub(lambda m: f"{m.group(1)}=[redacted]", sanitized)
    sanitized = sanitized.strip()
    if len(sanitized) > 220:
        sanitized = sanitized[:217] + "..."
    return sanitized


def _record_warning(
    collector: List[str],
    context: str,
    exc: Exception | None = None,
) -> None:
    """Append a sanitized warning entry."""

    base = context.strip()
    if exc is not None:
        base = f"{base} ({exc.__class__.__name__})"
    collector.append(_sanitize_warning_message(base))


def _finalize_warnings(raw_warnings: List[str]) -> List[str]:
    """Return de-duplicated, sanitized warnings limited to a reasonable count."""

    cleaned = [_sanitize_warning_message(entry) for entry in raw_warnings if entry]
    deduped: List[str] = []
    for entry in cleaned:
        if entry and entry not in deduped:
            deduped.append(entry)
        if len(deduped) >= 10:
            break
    return deduped


def _load_package_metadata(package_json: Path) -> Dict[str, Any]:
    """Read a package.json file and return a minimal metadata snapshot."""

    if not package_json.exists():
        return {}

    try:
        with package_json.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Failed to load package metadata: %s", exc)
        return {}

    scripts = data.get("scripts") or {}
    dependencies = data.get("dependencies") or {}
    dev_dependencies = data.get("devDependencies") or {}

    return {
        "scripts": list(scripts.keys()),
        "dependencies": len(dependencies),
        "dev_dependencies": len(dev_dependencies),
    }


@router.get("/graph", response_model=SystemGraphResponse)
async def get_system_graph(request: Request) -> SystemGraphResponse:
    """Aggregate a system-wide snapshot for the public algorithm overview page."""

    settings = get_settings()
    if not settings.system_overview_public:
        await get_current_user(request, request.headers.get("Authorization"))

    project_root = Path(__file__).resolve().parents[3]

    warnings: List[str] = []
    nodes: List[SystemNode] = []
    edges: List[SystemEdge] = []
    summary_metrics: Dict[str, Any] = {}

    # ------------------------------------------------------------------
    # User and authentication metrics
    # ------------------------------------------------------------------
    total_users = 0
    approved_users = 0
    pending_users_count = 0
    rejected_users = 0
    recent_registration_iso: Optional[str] = None
    recent_pending_iso: Optional[str] = None

    try:
        pending_users = auth_service.get_pending_users()
        pending_users_count = len(pending_users)
        pending_timestamps: List[datetime] = []
        for entry in pending_users:
            created_at = entry.get("created_at")
            if created_at:
                try:
                    pending_timestamps.append(datetime.fromisoformat(created_at))
                except ValueError:
                    continue
        if pending_timestamps:
            recent_pending_iso = max(pending_timestamps).isoformat()

        user_snapshot = auth_service.list_users(limit=500, offset=0)
        total_users = user_snapshot.total
        created_values: List[datetime] = []
        for user in user_snapshot.users:
            status = getattr(user, "status", None)
            if status == "approved":
                approved_users += 1
            elif status == "rejected":
                rejected_users += 1
            if getattr(user, "created_at", None):
                created_values.append(user.created_at)

        if created_values:
            recent_registration_iso = max(created_values).isoformat()
    except Exception as exc:  # pragma: no cover - defensive logging
        _record_warning(warnings, "Failed to load user directory information", exc)

    summary_metrics["users"] = {
        "total": total_users,
        "approved": approved_users,
        "pending": pending_users_count,
        "rejected": rejected_users,
        "recent_registration": recent_registration_iso,
        "recent_pending": recent_pending_iso,
    }

    # ------------------------------------------------------------------
    # Dashboard metrics (database/model/item/routing)
    # ------------------------------------------------------------------
    database_status_model = None
    model_metrics_model = None
    item_stats_model = None
    routing_stats_model = None

    async def _fetch(metric_name: str, func):
        nonlocal warnings
        try:
            return await func()
        except Exception as exc:  # pragma: no cover - defensive logging
            _record_warning(warnings, f"{metric_name} retrieval failed", exc)
            return None

    database_status_model = await _fetch("database status", get_database_status)
    model_metrics_model = await _fetch("model metrics", get_model_metrics)
    item_stats_model = await _fetch("item statistics", get_item_statistics)
    routing_stats_model = await _fetch("routing statistics", get_routing_statistics)

    if database_status_model is not None:
        summary_metrics["database"] = database_status_model.model_dump()
    if model_metrics_model is not None:
        summary_metrics["model"] = model_metrics_model.model_dump()
    if item_stats_model is not None:
        summary_metrics["items"] = item_stats_model.model_dump()
    if routing_stats_model is not None:
        summary_metrics["routing"] = routing_stats_model.model_dump()

    # ------------------------------------------------------------------
    # Filesystem-based health checks
    # ------------------------------------------------------------------
    frontend_home_dir = project_root / "frontend-home"
    frontend_prediction_dir = project_root / "frontend-prediction"
    frontend_training_dir = project_root / "frontend-training"

    home_pages = sorted(p.name for p in frontend_home_dir.glob("*.html"))
    algorithm_page = frontend_home_dir / "algorithm-map.html"
    home_status = STATUS_OPERATIONAL if (frontend_home_dir / "index.html").exists() else STATUS_CRITICAL
    algorithm_status = STATUS_OPERATIONAL if algorithm_page.exists() else STATUS_CRITICAL

    if home_status != STATUS_OPERATIONAL:
        _record_warning(warnings, "Home dashboard entry point (frontend-home/index.html) is missing.")
    if algorithm_status != STATUS_OPERATIONAL:
        _record_warning(warnings, "Algorithm overview page (frontend-home/algorithm-map.html) is missing.")

    prediction_pkg_meta = _load_package_metadata(frontend_prediction_dir / "package.json")
    training_pkg_meta = _load_package_metadata(frontend_training_dir / "package.json")

    prediction_status = STATUS_OPERATIONAL if prediction_pkg_meta else STATUS_DEGRADED
    training_status = STATUS_OPERATIONAL if training_pkg_meta else STATUS_DEGRADED

    if prediction_status != STATUS_OPERATIONAL:
        _record_warning(warnings, "Prediction frontend package.json unavailable or unreadable.")
    if training_status != STATUS_OPERATIONAL:
        _record_warning(warnings, "Training frontend package.json unavailable or unreadable.")

    # ------------------------------------------------------------------
    # Data stores
    # ------------------------------------------------------------------
    rsl_status = STATUS_OPERATIONAL
    rsl_metrics: Dict[str, Any] = {}
    rsl_path = _resolve_sqlite_path(settings.rsl_database_url)
    if rsl_path and rsl_path.exists():
        stats = rsl_path.stat()
        rsl_metrics = {
            "path": str(rsl_path),
            "size_mb": round(stats.st_size / (1024 * 1024), 2),
            "last_modified": datetime.utcfromtimestamp(stats.st_mtime).isoformat() + "Z",
        }
    else:
        rsl_status = STATUS_DEGRADED
        _record_warning(warnings, "RSL SQLite database file was not found")

    # Main MSSQL data source metrics
    mssql_status = STATUS_DEGRADED
    mssql_metrics: Dict[str, Any] = {}
    if database_status_model is not None:
        database_dump = database_status_model.model_dump()
        mssql_status = STATUS_OPERATIONAL if database_dump.get("connected") else STATUS_DEGRADED
        mssql_metrics.update(database_dump)
        if not database_dump.get("connected"):
            _record_warning(warnings, "MSSQL connectivity check failed")

    try:
        db_info = get_database_info()
        mssql_metrics.update(db_info)
    except Exception as exc:  # pragma: no cover - defensive logging
        _record_warning(warnings, "get_database_info failed", exc)

    # ------------------------------------------------------------------
    # Node definitions
    # ------------------------------------------------------------------
    nodes.extend(
        [
            SystemNode(
                id="user-browser",
                label="사용자 브라우저",
                category="client",
                status=STATUS_OPERATIONAL,
                rank=0,
                metrics={
                    "entrypoints": [
                        "http://localhost:3000",
                        "http://localhost:5173",
                        "http://localhost:5174",
                    ]
                },
                details="최종 사용자가 접근하는 로컬 브라우저 환경.",
            ),
            SystemNode(
                id="home-frontend",
                label="홈 대시보드",
                category="home",
                status=home_status,
                rank=0,
                metrics={
                    "page_count": len(home_pages),
                    "pages": home_pages,
                    "server_port": 3000,
                },
                details="frontend-home/index.html에서 제공되는 공개형 요약 대시보드.",
            ),
            SystemNode(
                id="algorithm-overview",
                label="알고리즘 오버뷰",
                category="home",
                status=algorithm_status,
                rank=1,
                metrics={
                    "fetches": [
                        "/api/system-overview/graph",
                        "/api/dashboard/metrics",
                    ],
                    "design_reference": "frontend-training/src/components/WorkflowGraphPanel.tsx",
                },
                details="전체 워크플로우와 상태를 시각화하는 신규 페이지.",
            ),
            SystemNode(
                id="prediction-frontend",
                label="예측 콘솔 (5173)",
                category="frontend",
                status=prediction_status,
                rank=0,
                metrics=prediction_pkg_meta,
                details="frontend-prediction React 앱. 로그인 이후 라우팅/예측 워크스페이스 제공.",
            ),
            SystemNode(
                id="training-frontend",
                label="트레이닝 콘솔 (5174)",
                category="frontend",
                status=training_status,
                rank=1,
                metrics=training_pkg_meta,
                details="frontend-training React 앱. Workflow Graph 편집 및 학습 설정 제공.",
            ),
            SystemNode(
                id="backend-api",
                label="FastAPI 백엔드",
                category="backend",
                status=STATUS_OPERATIONAL,
                rank=0,
                metrics={
                    "host": settings.api_host,
                    "port": settings.api_port,
                    "allowed_origins": len(settings.allowed_origins),
                },
                details="backend/api/app.py 에 정의된 주 API 게이트웨이.",
            ),
            SystemNode(
                id="auth-service",
                label="인증 서비스",
                category="backend",
                status=STATUS_OPERATIONAL if total_users > 0 else STATUS_DEGRADED,
                rank=1,
                metrics={
                    "total_users": total_users,
                    "approved_users": approved_users,
                    "pending_users": pending_users_count,
                    "rejected_users": rejected_users,
                    "recent_registration": recent_registration_iso,
                    "recent_pending": recent_pending_iso,
                    "jwt_cookie": settings.jwt_cookie_name,
                    "token_ttl_seconds": settings.jwt_access_token_ttl_seconds,
                },
                details="backend/api/services/auth_service.py 기반 JWT 발급 및 승인 로직.",
            ),
            SystemNode(
                id="approval-monitor",
                label="승인 스크립트",
                category="service",
                status=STATUS_OPERATIONAL if (project_root / "approve_user.py").exists() else STATUS_DEGRADED,
                rank=0,
                metrics={
                    "script": "approve_user.py",
                    "usage": "python approve_user.py approve <username>",
                },
                details="Server Monitor (RoutingML-Monitor) User-Agent 기반 관리용 승인 CLI.",
            ),
            SystemNode(
                id="ml-runtime",
                label="ML 런타임",
                category="service",
                status=STATUS_OPERATIONAL if model_metrics_model is not None else STATUS_DEGRADED,
                rank=1,
                metrics=(model_metrics_model.model_dump() if model_metrics_model is not None else {}),
                details="predictor_ml.py 및 trainer_ml.py 기반 모델 실행/학습 모듈.",
            ),
            SystemNode(
                id="monitoring-dashboard",
                label="모니터링 엔드포인트",
                category="service",
                status=STATUS_OPERATIONAL if (item_stats_model or routing_stats_model) else STATUS_DEGRADED,
                rank=2,
                metrics={
                    "items": (item_stats_model.model_dump() if item_stats_model is not None else {}),
                    "routing": (routing_stats_model.model_dump() if routing_stats_model is not None else {}),
                },
                details="/api/dashboard/* 경로에서 제공되는 정량 지표.",
            ),
            SystemNode(
                id="rsl-database",
                label="RSL 사용자 저장소",
                category="data",
                status=rsl_status,
                rank=0,
                metrics=rsl_metrics,
                details="logs/rsl_store.db SQLite. 사용자 계정 및 Rule Set Library 보관.",
            ),
            SystemNode(
                id="mssql-core",
                label="MSSQL (ERP 데이터)",
                category="data",
                status=mssql_status,
                rank=1,
                metrics=mssql_metrics,
                details="주 ERP 데이터 소스. VIEW_* 를 통해 라우팅/아이템 데이터 제공.",
            ),
        ]
    )

    # ------------------------------------------------------------------
    # Edges describing request flow
    # ------------------------------------------------------------------
    edges.extend(
        [
            SystemEdge(
                id="edge-user-home",
                source="user-browser",
                target="home-frontend",
                label="GET /",
                protocol="https",
                description="Node.js 서버 (포트 3000)를 통한 정적 페이지 응답.",
            ),
            SystemEdge(
                id="edge-home-algorithms",
                source="home-frontend",
                target="algorithm-overview",
                label="Link /algorithm-map.html",
                protocol="internal",
                description="홈 대시보드에서 신규 알고리즘 페이지로 이동.",
            ),
            SystemEdge(
                id="edge-algo-backend",
                source="algorithm-overview",
                target="backend-api",
                label="GET /api/system-overview/graph",
                protocol="https",
                description="알고리즘 페이지가 시스템 스냅샷 데이터를 요청.",
            ),
            SystemEdge(
                id="edge-home-prediction",
                source="home-frontend",
                target="prediction-frontend",
                label="Link http://localhost:5173",
                protocol="http",
                description="예측 콘솔로 이동 (로그인 필요).",
            ),
            SystemEdge(
                id="edge-home-training",
                source="home-frontend",
                target="training-frontend",
                label="Link http://localhost:5174",
                protocol="http",
                description="트레이닝 콘솔로 이동.",
            ),
            SystemEdge(
                id="edge-prediction-auth",
                source="prediction-frontend",
                target="auth-service",
                label="POST /api/auth/login",
                protocol="https",
                description="JWT 발급을 위한 로그인 요청.",
            ),
            SystemEdge(
                id="edge-auth-rsl",
                source="auth-service",
                target="rsl-database",
                label="SQLAlchemy session_scope()",
                protocol="sqlite",
                description="사용자 상태 및 승인 내역 조회/수정.",
            ),
            SystemEdge(
                id="edge-approval-auth",
                source="approval-monitor",
                target="auth-service",
                label="POST /api/auth/admin/*",
                protocol="https",
                description="RoutingML-Monitor User-Agent 기반 승인/거절.",
            ),
            SystemEdge(
                id="edge-prediction-backend",
                source="prediction-frontend",
                target="backend-api",
                label="REST /api/prediction/*",
                protocol="https",
                description="예측 결과, 라우팅 데이터 요청.",
            ),
            SystemEdge(
                id="edge-training-backend",
                source="training-frontend",
                target="backend-api",
                label="REST /api/workflow/*",
                protocol="https",
                description="Workflow Graph 및 학습 설정 저장.",
            ),
            SystemEdge(
                id="edge-backend-ml",
                source="backend-api",
                target="ml-runtime",
                label="Python call",
                protocol="internal",
                description="predictor_ml.py / trainer_ml.py 모듈 호출.",
            ),
            SystemEdge(
                id="edge-backend-mssql",
                source="backend-api",
                target="mssql-core",
                label="pyodbc pool",
                protocol="tds",
                description="데이터 조회 및 저장을 위한 주요 쿼리.",
            ),
            SystemEdge(
                id="edge-ml-mssql",
                source="ml-runtime",
                target="mssql-core",
                label="Feature pulls",
                protocol="tds",
                description="학습/예측 시 ERP 데이터 조회.",
            ),
            SystemEdge(
                id="edge-dashboard-backend",
                source="monitoring-dashboard",
                target="backend-api",
                label="Depends on /api/dashboard/*",
                protocol="internal",
                description="대시보드 집계를 위해 FastAPI 라우터 사용.",
            ),
            SystemEdge(
                id="edge-dashboard-mssql",
                source="monitoring-dashboard",
                target="mssql-core",
                label="VIEW_* counts",
                protocol="tds",
                description="지표 산출을 위해 ERP View 조회.",
            ),
        ]
    )

    return SystemGraphResponse(
        generated_at=datetime.utcnow().isoformat() + "Z",
        nodes=nodes,
        edges=edges,
        metrics=summary_metrics,
        warnings=_finalize_warnings(warnings),
    )


__all__ = ["router"]
