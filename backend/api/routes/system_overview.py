"""Public endpoints that expose an end-to-end system overview graph."""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from sqlalchemy.engine import url as sa_url

from backend.api.config import get_settings
from backend.api.routes.dashboard import (
    get_database_status,
    get_item_statistics,
    get_model_metrics,
    get_routing_statistics,
)
from backend.api.services.auth_service import auth_service
from backend.api.security import get_current_user
from backend.database import execute_query, get_database_info
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


def _describe_db_connection(raw_url: str) -> Dict[str, Any]:
    """Return a sanitized summary of a SQLAlchemy connection URL."""

    if not raw_url:
        return {}
    try:
        parsed = sa_url.make_url(raw_url)
    except Exception:
        protocol = raw_url.split(":", 1)[0] if ":" in raw_url else raw_url
        return {"driver": protocol}

    summary: Dict[str, Any] = {"driver": parsed.drivername}
    if parsed.database:
        summary["database"] = parsed.database
    if parsed.host:
        summary["host"] = parsed.host
    if parsed.port:
        summary["port"] = parsed.port
    return summary


def _connection_protocol(raw_url: str) -> str:
    """Extract the protocol/driver portion of a SQLAlchemy URL."""

    if not raw_url:
        return "unknown"
    try:
        return sa_url.make_url(raw_url).drivername
    except Exception:
        return raw_url.split(":", 1)[0] if ":" in raw_url else raw_url


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
    frontend_shared_dir = project_root / "frontend-shared"
    electron_app_dir = project_root / "electron-app"
    scripts_dir = project_root / "scripts"
    models_dir = project_root / "models"
    workflow_settings_path = project_root / "config" / "workflow_settings.json"

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

    frontend_shared_meta = _load_package_metadata(frontend_shared_dir / "package.json")
    shared_metrics: Dict[str, Any] = dict(frontend_shared_meta)
    shared_metrics["workspace"] = "frontend-shared"
    shared_metrics["typescript"] = (frontend_shared_dir / "tsconfig.json").exists()
    shared_status = STATUS_OPERATIONAL if frontend_shared_meta else STATUS_DEGRADED
    if shared_status != STATUS_OPERATIONAL:
        _record_warning(warnings, "Shared frontend package (frontend-shared/package.json) is missing.")

    electron_pkg_meta = _load_package_metadata(electron_app_dir / "package.json")
    monitor_metrics: Dict[str, Any] = dict(electron_pkg_meta)
    monitor_metrics["entrypoint"] = "electron-app/main.js"
    if electron_app_dir.exists():
        dist_dir = electron_app_dir / "dist"
        if dist_dir.exists():
            monitor_metrics["dist_targets"] = len(list(dist_dir.iterdir()))
        build_dir = electron_app_dir / "build"
        if build_dir.exists():
            monitor_metrics["build_targets"] = len(list(build_dir.iterdir()))
    monitor_status = STATUS_OPERATIONAL if electron_pkg_meta else STATUS_DEGRADED
    if monitor_status != STATUS_OPERATIONAL:
        _record_warning(warnings, "Electron monitor package.json is missing or unreadable.")

    workflow_metrics: Dict[str, Any] = {"config": "config/workflow_settings.json"}
    workflow_status = STATUS_DEGRADED
    if workflow_settings_path.exists():
        try:
            with workflow_settings_path.open("r", encoding="utf-8") as handle:
                workflow_settings = json.load(handle)
            graph_info = workflow_settings.get("graph", {})
            workflow_metrics["graph_nodes"] = len(graph_info.get("nodes", []))
            workflow_metrics["graph_edges"] = len(graph_info.get("edges", []))
            modules = (workflow_settings.get("modules") or {}).get("items") or []
            workflow_metrics["modules"] = len(modules)
            workflow_status = STATUS_OPERATIONAL if workflow_metrics.get("graph_nodes", 0) else STATUS_DEGRADED
        except Exception as exc:
            _record_warning(warnings, "workflow_settings.json load failed", exc)
    else:
        _record_warning(warnings, "workflow_settings.json missing")

    batch_metrics: Dict[str, Any] = {}
    batch_status = STATUS_DEGRADED
    bat_paths = {path.resolve() for path in project_root.glob("*.bat")}
    if scripts_dir.exists():
        bat_paths.update(path.resolve() for path in scripts_dir.glob("*.bat"))
        sh_paths = {path.resolve() for path in scripts_dir.glob("*.sh")}
    else:
        sh_paths = set()
    sh_paths.update(path.resolve() for path in project_root.glob("*.sh"))
    if bat_paths or sh_paths:
        batch_metrics["bat_scripts"] = len(bat_paths)
        batch_metrics["shell_scripts"] = len(sh_paths)
        timestamps = []
        for candidate in bat_paths.union(sh_paths):
            try:
                timestamps.append(candidate.stat().st_mtime)
            except FileNotFoundError:
                continue
        if timestamps:
            batch_metrics["latest_updated"] = datetime.utcfromtimestamp(max(timestamps)).isoformat() + "Z"
        batch_status = STATUS_OPERATIONAL
    else:
        batch_metrics = {"bat_scripts": 0, "shell_scripts": 0}

    artifact_suffixes = {".json", ".pkl", ".onnx", ".db", ".bin"}
    artifact_files: List[Path] = []
    if models_dir.exists():
        for candidate in models_dir.rglob("*"):
            if candidate.is_file() and candidate.suffix.lower() in artifact_suffixes:
                artifact_files.append(candidate)
    model_metrics_snapshot = {"artifacts": len(artifact_files), "json_configs": sum(1 for p in artifact_files if p.suffix.lower() == ".json")}
    model_status = STATUS_OPERATIONAL if artifact_files else STATUS_DEGRADED
    if artifact_files:
        latest_model_ts = max(path.stat().st_mtime for path in artifact_files)
        model_metrics_snapshot["latest_updated"] = datetime.utcfromtimestamp(latest_model_ts).isoformat() + "Z"
    registry_summary = _describe_db_connection(settings.model_registry_url)
    if registry_summary:
        model_metrics_snapshot["registry_connection"] = registry_summary
    else:
        if model_status == STATUS_OPERATIONAL:
            model_status = STATUS_DEGRADED
        _record_warning(warnings, "Model registry URL missing or invalid")

    feature_metrics: Dict[str, Any] = {"config": "models/active_features.json"}
    feature_status = STATUS_DEGRADED
    active_features_path = models_dir / "active_features.json"
    feature_weights_path = models_dir / "feature_weights.json"
    try:
        if active_features_path.exists():
            with active_features_path.open("r", encoding="utf-8") as handle:
                active_data = json.load(handle)
            if isinstance(active_data, dict):
                feature_metrics["active_features"] = len(active_data)
            elif isinstance(active_data, list):
                feature_metrics["active_features"] = len(active_data)
            else:
                feature_metrics["active_features"] = 0
            feature_status = STATUS_OPERATIONAL
        if feature_weights_path.exists():
            with feature_weights_path.open("r", encoding="utf-8") as handle:
                weight_data = json.load(handle)
            if isinstance(weight_data, dict):
                feature_metrics["weighted"] = len(weight_data)
            feature_metrics["weights_updated"] = datetime.utcfromtimestamp(feature_weights_path.stat().st_mtime).isoformat() + "Z"
            feature_status = STATUS_OPERATIONAL
    except Exception as exc:
        _record_warning(warnings, "feature metadata load failed", exc)

    # ------------------------------------------------------------------
    # Data stores
    # ------------------------------------------------------------------
    rsl_status = STATUS_OPERATIONAL
    rsl_metrics = _describe_db_connection(settings.rsl_database_url)
    if not rsl_metrics:
        rsl_status = STATUS_CRITICAL
        _record_warning(warnings, "RSL database URL missing or invalid")

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

    view_total_count: Optional[int] = None
    if mssql_status == STATUS_OPERATIONAL:
        try:
            view_count_rows = execute_query("SELECT COUNT(*) FROM sys.views")
            if view_count_rows:
                view_total_count = int(view_count_rows[0][0])
        except Exception as exc:
            _record_warning(warnings, "Failed to count MSSQL views", exc)

    if view_total_count is not None:
        summary_metrics["views"] = {"total": view_total_count}

    summary_metrics["monitor_app"] = monitor_metrics
    summary_metrics["batch_scripts"] = batch_metrics
    summary_metrics["artifacts_snapshot"] = model_metrics_snapshot

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
                        "http://localhost:5176",
                        "http://localhost:5173",
                        "http://localhost:5174",
                    ]
                },
                details="최종 사용자가 접근하는 로컬 브라우저 환경.",
            ),
            SystemNode(
                id="monitor-client",
                label="Routing Monitor 앱",
                category="client",
                status=monitor_status,
                rank=1,
                metrics={
                    **monitor_metrics,
                    "spec_files": len(list(project_root.glob("RoutingMLMonitor*.spec"))),
                },
                details="electron-app 기반 Windows 데스크톱 모니터링 클라이언트.",
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
                    "server_port": 5176,
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
                id="view-explorer",
                label="View Explorer",
                category="home",
                status=STATUS_OPERATIONAL if (frontend_home_dir / "view-explorer.html").exists() and mssql_status == STATUS_OPERATIONAL else STATUS_DEGRADED,
                rank=2,
                metrics={
                    "fetches": [
                        "/api/view-explorer/views",
                        "/api/view-explorer/views/{name}/sample",
                    ],
                    "available_views": view_total_count,
                    "connected": mssql_metrics.get("connection_status"),
                },
                details="MSSQL VIEW_* 메타데이터를 탐색하고 샘플 데이터를 확인하는 도구.",
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
                id="shared-components",
                label="Frontend Shared",
                category="platform",
                status=STATUS_OPERATIONAL if shared_status == STATUS_OPERATIONAL else STATUS_DEGRADED,
                rank=0,
                metrics=shared_metrics,
                details="npm workspace(frontend-shared)에서 제공하는 공통 UI/유틸 라이브러리.",
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
                id="workflow-engine",
                label="Workflow Engine",
                category="platform",
                status=workflow_status,
                rank=1,
                metrics=workflow_metrics,
                details="workflow_settings.json 기반 FastAPI 워크플로우 그래프/블루프린트 엔진.",
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
                id="batch-orchestrator",
                label="Batch Orchestrator",
                category="service",
                status=batch_status,
                rank=2,
                metrics=batch_metrics,
                details="배치 스크립트(run_*.bat, scripts/*)로 서비스 재기동과 학습을 제어.",
            ),
            SystemNode(
                id="monitoring-dashboard",
                label="모니터링 엔드포인트",
                category="service",
                status=STATUS_OPERATIONAL if (item_stats_model or routing_stats_model) else STATUS_DEGRADED,
                rank=3,
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
                details="PostgreSQL (RSL_DATABASE_URL) 기반 Rule Set Library 및 사용자 저장소.",
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
            SystemNode(
                id="model-registry",
                label="Model Registry",
                category="data",
                status=model_status,
                rank=2,
                metrics=model_metrics_snapshot,
                details="PostgreSQL 모델 레지스트리(MODEL_REGISTRY_URL)로 학습 메타데이터 관리.",
            ),
            SystemNode(
                id="feature-library",
                label="Feature Library",
                category="data",
                status=feature_status,
                rank=3,
                metrics=feature_metrics,
                details="active_features.json 과 feature_weights.json 기반 특징 구성을 보관.",
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
                description="Node.js 프록시(포트 3000)로 홈 대시보드를 진입.",
            ),
            SystemEdge(
                id="edge-monitor-backend",
                source="monitor-client",
                target="backend-api",
                label="REST /api/dashboard/*",
                protocol="https",
                description="Routing Monitor 앱이 FastAPI로 상태 지표를 폴링.",
            ),
            SystemEdge(
                id="edge-monitor-auth",
                source="monitor-client",
                target="auth-service",
                label="POST /api/auth/login",
                protocol="https",
                description="모니터 앱 사용자 인증.",
            ),
            SystemEdge(
                id="edge-home-algorithms",
                source="home-frontend",
                target="algorithm-overview",
                label="Link /algorithm-map.html",
                protocol="internal",
                description="홈 대시보드에서 알고리즘 지도 페이지로 이동.",
            ),
            SystemEdge(
                id="edge-home-view-explorer",
                source="home-frontend",
                target="view-explorer",
                label="Link /view-explorer.html",
                protocol="internal",
                description="홈 패널에서 View Explorer 도구로 진입.",
            ),
            SystemEdge(
                id="edge-algo-backend",
                source="algorithm-overview",
                target="backend-api",
                label="GET /api/system-overview/graph",
                protocol="https",
                description="알고리즘 개요가 시스템 그래프 데이터를 요청.",
            ),
            SystemEdge(
                id="edge-view-backend",
                source="view-explorer",
                target="backend-api",
                label="GET /api/view-explorer/*",
                protocol="https",
                description="View Explorer가 FastAPI 엔드포인트에 메타데이터를 요청.",
            ),
            SystemEdge(
                id="edge-view-mssql",
                source="view-explorer",
                target="mssql-core",
                label="VIEW metadata",
                protocol="tds",
                description="sys.views 와 ERP VIEW_* 정보를 조회.",
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
                description="훈련 콘솔로 이동.",
            ),
            SystemEdge(
                id="edge-prediction-shared",
                source="prediction-frontend",
                target="shared-components",
                label="Imports @routing/shared",
                protocol="internal",
                description="예측 UI가 공통 컴포넌트 번들을 사용.",
            ),
            SystemEdge(
                id="edge-training-shared",
                source="training-frontend",
                target="shared-components",
                label="Imports @routing/shared",
                protocol="internal",
                description="훈련 콘솔도 공통 라이브러리를 의존.",
            ),
            SystemEdge(
                id="edge-prediction-auth",
                source="prediction-frontend",
                target="auth-service",
                label="POST /api/auth/login",
                protocol="https",
                description="JWT 기반 사용자 인증.",
            ),
            SystemEdge(
                id="edge-prediction-backend",
                source="prediction-frontend",
                target="backend-api",
                label="REST /api/prediction/*",
                protocol="https",
                description="예측/점수 산출 API 호출.",
            ),
            SystemEdge(
                id="edge-training-backend",
                source="training-frontend",
                target="backend-api",
                label="REST /api/workflow/*",
                protocol="https",
                description="워크플로우 편집/학습 설정 API.",
            ),
            SystemEdge(
                id="edge-backend-workflow",
                source="backend-api",
                target="workflow-engine",
                label="workflow API",
                protocol="internal",
                description="FastAPI 라우트가 워크플로우 엔진 코어를 호출.",
            ),
            SystemEdge(
                id="edge-backend-ml",
                source="backend-api",
                target="ml-runtime",
                label="Python call",
                protocol="internal",
                description="predictor_ml.py / trainer_ml.py 실행.",
            ),
            SystemEdge(
                id="edge-backend-mssql",
                source="backend-api",
                target="mssql-core",
                label="pyodbc pool",
                protocol="tds",
                description="비즈니스 조회를 위한 메인 DB 연결.",
            ),
            SystemEdge(
                id="edge-workflow-mssql",
                source="workflow-engine",
                target="mssql-core",
                label="Profile sync",
                protocol="tds",
                description="Workflow 설정이 ERP View 통계를 참조.",
            ),
            SystemEdge(
                id="edge-ml-mssql",
                source="ml-runtime",
                target="mssql-core",
                label="Feature pulls",
                protocol="tds",
                description="학습/예측에 필요한 ERP 데이터를 조회.",
            ),
            SystemEdge(
                id="edge-scheduler-backend",
                source="batch-orchestrator",
                target="backend-api",
                label="CLI restart",
                protocol="local",
                description="배치 스크립트가 FastAPI 서비스를 재기동.",
            ),
            SystemEdge(
                id="edge-scheduler-ml",
                source="batch-orchestrator",
                target="ml-runtime",
                label="Training trigger",
                protocol="local",
                description="배치 작업으로 모델 재학습을 기동.",
            ),
            SystemEdge(
                id="edge-ml-models",
                source="ml-runtime",
                target="model-registry",
                label="Model metadata",
                protocol=_connection_protocol(settings.model_registry_url),
                description="모델 러ntime이 PostgreSQL 레지스트리에서 활성 버전 메타데이터를 조회.",
            ),
            SystemEdge(
                id="edge-ml-features",
                source="ml-runtime",
                target="feature-library",
                label="Feature weights",
                protocol="file",
                description="특징 중요도/활성 목록을 참조.",
            ),
            SystemEdge(
                id="edge-auth-rsl",
                source="auth-service",
                target="rsl-database",
                label="SQLAlchemy session_scope()",
                protocol=_connection_protocol(settings.rsl_database_url),
                description="인증 서비스가 RSL 저장소를 조회/갱신.",
            ),
            SystemEdge(
                id="edge-approval-auth",
                source="approval-monitor",
                target="auth-service",
                label="POST /api/auth/admin/*",
                protocol="https",
                description="CLI 모니터가 관리자 API로 승인/거절을 수행.",
            ),
            SystemEdge(
                id="edge-dashboard-backend",
                source="monitoring-dashboard",
                target="backend-api",
                label="Depends on /api/dashboard/*",
                protocol="internal",
                description="대시보드가 FastAPI 통계 엔드포인트를 사용.",
            ),
            SystemEdge(
                id="edge-dashboard-mssql",
                source="monitoring-dashboard",
                target="mssql-core",
                label="VIEW_* counts",
                protocol="tds",
                description="모니터링 카드가 ERP View 집계를 조회.",
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
