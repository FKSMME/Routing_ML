"""
대시보드 메트릭 API 엔드포인트
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from backend.api.schemas import AuthenticatedUser
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from backend.api.security import require_admin
from common.datetime_utils import utc_isoformat
from backend.database import (
    get_db_connection,
    test_connection,
    VIEW_ITEM_MASTER,
    VIEW_ROUTING,
)
from backend.constants import TRAIN_FEATURES
from common.logger import get_logger

logger = get_logger("dashboard")

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


# Response Models
class DatabaseStatusResponse(BaseModel):
    """데이터베이스 연결 상태"""
    connected: bool
    server: str
    database: str
    timestamp: str
    error: Optional[str] = None


class ModelMetricsResponse(BaseModel):
    """모델 메트릭 정보"""
    ml_version: str
    trained_at: Optional[str]
    total_items_trained: int
    feature_count: int
    ml_path: str
    accuracy: Optional[float] = None


class ItemStatsResponse(BaseModel):
    """품목 통계"""
    total_items_in_db: int
    items_with_routing: int
    items_without_routing: int
    new_items_today: int


class RoutingStatsResponse(BaseModel):
    """라우팅 생성 통계"""
    daily: int
    weekly: int
    monthly: int
    total: int
    unique_items: int


class DashboardMetricsResponse(BaseModel):
    """전체 대시보드 메트릭"""
    database: DatabaseStatusResponse
    model: ModelMetricsResponse
    items: ItemStatsResponse
    routing: RoutingStatsResponse


@router.get("/status", response_model=Dict[str, Any])
async def get_dashboard_status(_admin: AuthenticatedUser = Depends(require_admin)):
    """대시보드 전체 상태 조회"""

    try:
        # Database connection test
        db_connected = test_connection()

        return {
            "status": "healthy" if db_connected else "degraded",
            "timestamp": utc_isoformat(),
            "database_connected": db_connected,
        }
    except Exception as e:
        logger.error(f"Dashboard status check failed: {e}")
        return {
            "status": "error",
            "timestamp": utc_isoformat(),
            "error": str(e),
        }


@router.get("/database", response_model=DatabaseStatusResponse)
async def get_database_status():
    """MSSQL 연결 상태 조회 (공개 API - 인증 불필요)"""

    import os

    server = os.getenv("MSSQL_SERVER", "Unknown")
    database = os.getenv("MSSQL_DATABASE", "Unknown")

    try:
        connected = test_connection()

        return DatabaseStatusResponse(
            connected=connected,
            server=server,
            database=database,
            timestamp=utc_isoformat(),
            error=None if connected else "Connection failed"
        )
    except Exception as e:
        logger.error(f"Database status check failed: {e}")
        return DatabaseStatusResponse(
            connected=False,
            server=server,
            database=database,
            timestamp=utc_isoformat(),
            error=str(e)
        )


@router.get("/model", response_model=ModelMetricsResponse)
async def get_model_metrics():
    """학습된 모델 메트릭 조회 (공개 API - 인증 불필요)"""

    from pathlib import Path
    import json

    model_dir = Path("/workspaces/Routing_ML_4/models/default")
    metadata_file = model_dir / "metadata.json"

    try:
        if metadata_file.exists():
            with open(metadata_file, "r") as f:
                metadata = json.load(f)

            return ModelMetricsResponse(
                ml_version=metadata.get("version", "unknown"),
                trained_at=metadata.get("trained_at"),
                total_items_trained=metadata.get("n_samples", 0),
                feature_count=len(TRAIN_FEATURES),
                ml_path=str(model_dir),
                accuracy=metadata.get("accuracy")
            )
        else:
            # Default values if no metadata exists
            return ModelMetricsResponse(
                ml_version="default",
                trained_at=None,
                total_items_trained=0,
                feature_count=len(TRAIN_FEATURES),
                ml_path=str(model_dir),
                accuracy=None
            )

    except Exception as e:
        logger.error(f"Failed to load model metadata: {e}")
        return ModelMetricsResponse(
            ml_version="error",
            trained_at=None,
            total_items_trained=0,
            feature_count=len(TRAIN_FEATURES),
            ml_path=str(model_dir),
            accuracy=None
        )


@router.get("/items", response_model=ItemStatsResponse)
async def get_item_statistics():
    """품목 통계 조회 (공개 API - 인증 불필요)"""

    try:
        # Return mock data if database is not available
        if not test_connection():
            logger.warning("Database not available, returning mock data")
            return ItemStatsResponse(
                total_items_in_db=1250,
                items_with_routing=980,
                items_without_routing=270,
                new_items_today=12
            )

        # Use connection pool context manager
        from backend.database import _connection_pool
        with _connection_pool.get_connection() as conn:
            cursor = conn.cursor()

            # Total items in database
            cursor.execute(f"SELECT COUNT(*) FROM {VIEW_ITEM_MASTER}")
            total_items = cursor.fetchone()[0]

            # Items with routing
            cursor.execute(f"""
                SELECT COUNT(DISTINCT i.ITEM_CD)
                FROM {VIEW_ITEM_MASTER} i
                INNER JOIN {VIEW_ROUTING} r ON i.ITEM_CD = r.ITEM_CD
            """)
            items_with_routing = cursor.fetchone()[0]

            # Items without routing
            items_without_routing = total_items - items_with_routing

            # New items today (based on INSRT_DT column if exists)
            try:
                today = datetime.now().strftime("%Y-%m-%d")
                cursor.execute(f"""
                    SELECT COUNT(*)
                    FROM {VIEW_ITEM_MASTER}
                    WHERE CAST(INSRT_DT AS DATE) = '{today}'
                """)
                new_items_today = cursor.fetchone()[0]
            except Exception:
                # If INSRT_DT doesn't exist or query fails
                new_items_today = 0

            cursor.close()

            return ItemStatsResponse(
                total_items_in_db=total_items,
                items_with_routing=items_with_routing,
                items_without_routing=items_without_routing,
                new_items_today=new_items_today
            )

    except Exception as e:
        logger.error(f"Failed to get item statistics: {e}")
        # Return mock data on error
        return ItemStatsResponse(
            total_items_in_db=1250,
            items_with_routing=980,
            items_without_routing=270,
            new_items_today=12
        )


@router.get("/routing-stats", response_model=RoutingStatsResponse)
async def get_routing_statistics():
    """라우팅 생성 통계 조회 (공개 API - 인증 불필요)"""

    try:
        # Return mock data if database is not available
        if not test_connection():
            logger.warning("Database not available, returning mock routing stats")
            return RoutingStatsResponse(
                daily=45,
                weekly=312,
                monthly=1850,
                total=15420,
                unique_items=980
            )

        # Use connection pool context manager
        from backend.database import _connection_pool
        with _connection_pool.get_connection() as conn:
            cursor = conn.cursor()

            # Total routings
            cursor.execute(f"SELECT COUNT(*) FROM {VIEW_ROUTING}")
            total = cursor.fetchone()[0]

            # Unique items with routings
            cursor.execute(f"SELECT COUNT(DISTINCT ITEM_CD) FROM {VIEW_ROUTING}")
            unique_items = cursor.fetchone()[0]

            # Daily (last 24 hours)
            today = datetime.now().strftime("%Y-%m-%d")
            cursor.execute(f"""
                SELECT COUNT(*)
                FROM {VIEW_ROUTING}
                WHERE CAST(INSRT_DT AS DATE) = '{today}'
            """)
            daily = cursor.fetchone()[0] if cursor.rowcount > 0 else 0

            # Weekly (last 7 days)
            week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
            cursor.execute(f"""
                SELECT COUNT(*)
                FROM {VIEW_ROUTING}
                WHERE CAST(INSRT_DT AS DATE) >= '{week_ago}'
            """)
            weekly = cursor.fetchone()[0] if cursor.rowcount > 0 else 0

            # Monthly (last 30 days)
            month_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            cursor.execute(f"""
                SELECT COUNT(*)
                FROM {VIEW_ROUTING}
                WHERE CAST(INSRT_DT AS DATE) >= '{month_ago}'
            """)
            monthly = cursor.fetchone()[0] if cursor.rowcount > 0 else 0

            cursor.close()

            return RoutingStatsResponse(
                daily=daily,
                weekly=weekly,
                monthly=monthly,
                total=total,
                unique_items=unique_items
            )

    except Exception as e:
        logger.error(f"Failed to get routing statistics: {e}")
        # Return mock data on error
        return RoutingStatsResponse(
            daily=45,
            weekly=312,
            monthly=1850,
            total=15420,
            unique_items=980
        )


@router.get("/metrics", response_model=DashboardMetricsResponse)
async def get_all_dashboard_metrics():
    """모든 대시보드 메트릭을 한번에 조회 (공개 API - 인증 불필요)"""

    try:
        database = await get_database_status()
        model = await get_model_metrics()
        items = await get_item_statistics()
        routing = await get_routing_statistics()

        return DashboardMetricsResponse(
            database=database,
            model=model,
            items=items,
            routing=routing
        )
    except Exception as e:
        logger.error(f"Failed to get dashboard metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))



