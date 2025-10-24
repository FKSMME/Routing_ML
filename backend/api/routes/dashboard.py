"""
대시보드 메트릭 API 엔드포인트
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence, Tuple

from fastapi import APIRouter, Depends, HTTPException
from backend.api.schemas import AuthenticatedUser
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from backend.api.security import require_admin
from common.datetime_utils import utc_isoformat
from backend.database import (
    test_connection,
    VIEW_ITEM_MASTER,
    get_routing_history_view_name,
    get_routing_view_name,
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
    today_history_total: int = 0
    today_without_routing: int = 0


def _split_object_parts(name: str) -> List[str]:
    cleaned = name.replace("[", "").replace("]", "").replace("`", "").replace('"', "").strip()
    if not cleaned:
        return []
    parts = [part for part in cleaned.split(".") if part]
    if not parts:
        parts = [cleaned]
    return parts


def _parse_schema_table(name: str) -> Tuple[str, str]:
    parts = _split_object_parts(name)
    if len(parts) == 1:
        return "dbo", parts[0]
    return parts[-2], parts[-1]


def _qualify_table_name(name: str) -> str:
    parts = _split_object_parts(name)
    if not parts:
        raise ValueError(f"Invalid object name: {name}")
    return ".".join(f"[{part}]" for part in parts)


def _wrap_column(name: str) -> str:
    return f"[{name.strip('[]')}]"


def _fetch_view_column_map(connection, view_name: str) -> Dict[str, str]:
    schema, table = _parse_schema_table(view_name)
    cursor = connection.cursor()
    try:
        cursor.execute(
            """
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            """,
            schema,
            table,
        )
        rows = cursor.fetchall()
        return {row[0].upper(): row[0] for row in rows}
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Failed to fetch column metadata for %s: %s", view_name, exc)
        return {}
    finally:
        try:
            cursor.close()
        except Exception:
            pass


def _pick_column(column_map: Dict[str, str], candidates: Sequence[str]) -> Optional[str]:
    for candidate in candidates:
        value = column_map.get(candidate.upper())
        if value:
            return value
    return None


def _execute_scalar(cursor, sql: str, params: Optional[Sequence[Any]] = None) -> int:
    if params:
        cursor.execute(sql, params)
    else:
        cursor.execute(sql)
    row = cursor.fetchone()
    return int(row[0]) if row and row[0] is not None else 0


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
    import os

    # Use relative path from project root
    project_root = Path(__file__).parent.parent.parent.parent
    model_dir = project_root / "models" / "default"

    # Try to load from metrics.json first, then training_metadata.json
    metrics_file = model_dir / "metrics.json"
    training_metadata_file = model_dir / "training_metadata.json"

    try:
        metadata = {}

        # Load metrics.json (contains model_version, training_samples, training_date)
        if metrics_file.exists():
            with open(metrics_file, "r") as f:
                metrics_data = json.load(f)
                metadata.update(metrics_data)

        # Load training_metadata.json (contains total_items, training_date)
        if training_metadata_file.exists():
            with open(training_metadata_file, "r") as f:
                training_data = json.load(f)
                metadata.update(training_data)

        if metadata:
            return ModelMetricsResponse(
                ml_version=metadata.get("model_version", "default"),
                trained_at=metadata.get("training_date"),
                total_items_trained=metadata.get("training_samples") or metadata.get("total_items", 0),
                feature_count=metadata.get("total_features") or len(TRAIN_FEATURES),
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
            item_view = _qualify_table_name(VIEW_ITEM_MASTER)
            routing_view = _qualify_table_name(get_routing_view_name())

            cursor.execute(f"SELECT COUNT(*) FROM {item_view}")
            total_items = cursor.fetchone()[0]

            # Items with routing
            cursor.execute(
                f"""
                SELECT COUNT(DISTINCT i.ITEM_CD)
                FROM {item_view} i
                INNER JOIN {routing_view} r ON i.ITEM_CD = r.ITEM_CD
                """
            )
            items_with_routing = cursor.fetchone()[0]

            # Items without routing
            items_without_routing = total_items - items_with_routing

            # New items today (based on INSRT_DT column if exists)
            try:
                today = datetime.now().strftime("%Y-%m-%d")
                cursor.execute(
                    f"""
                    SELECT COUNT(*)
                    FROM {item_view}
                    WHERE CAST(INSRT_DT AS DATE) = '{today}'
                    """
                )
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
        if not test_connection():
            logger.warning("Database not available, returning mock routing stats")
            return RoutingStatsResponse(
                daily=45,
                weekly=312,
                monthly=1850,
                total=15420,
                unique_items=980,
                today_history_total=0,
                today_without_routing=0,
            )

        from backend.database import _connection_pool

        routing_view_name = get_routing_view_name()
        history_view_name = get_routing_history_view_name()

        total = unique_items = 0
        routing_daily = routing_weekly = routing_monthly = 0
        history_today_total = 0
        history_without_routing = 0
        history_filters_available = False

        with _connection_pool.get_connection() as conn:
            routing_table = _qualify_table_name(routing_view_name)
            history_table = _qualify_table_name(history_view_name)

            routing_columns = _fetch_view_column_map(conn, routing_view_name)
            history_columns = _fetch_view_column_map(conn, history_view_name)

            routing_item_column = _pick_column(
                routing_columns,
                ["ITEM_CD", "ITEM_CODE", "ITEM_NO", "PRODUCT_CD", "ITEMID"],
            ) or "ITEM_CD"
            routing_item_sql = _wrap_column(routing_item_column)

            routing_time_column = _pick_column(
                routing_columns,
                ["INSRT_DT", "CREATED_AT", "CREATE_DT", "REG_DT", "REG_DATE"],
            )

            today = datetime.now().date()
            week_ago = today - timedelta(days=7)
            month_ago = today - timedelta(days=30)

            cursor = conn.cursor()
            try:
                total = _execute_scalar(cursor, f"SELECT COUNT(*) FROM {routing_table}")
                unique_items = _execute_scalar(
                    cursor,
                    f"SELECT COUNT(DISTINCT {routing_item_sql}) FROM {routing_table}",
                )

                if routing_time_column:
                    time_expr = f"CAST({_wrap_column(routing_time_column)} AS DATE)"
                    routing_daily = _execute_scalar(
                        cursor,
                        f"SELECT COUNT(*) FROM {routing_table} WHERE {time_expr} = ?",
                        (today,),
                    )
                    routing_weekly = _execute_scalar(
                        cursor,
                        f"SELECT COUNT(*) FROM {routing_table} WHERE {time_expr} >= ?",
                        (week_ago,),
                    )
                    routing_monthly = _execute_scalar(
                        cursor,
                        f"SELECT COUNT(*) FROM {routing_table} WHERE {time_expr} >= ?",
                        (month_ago,),
                    )
                else:
                    logger.warning(
                        "Routing view %s missing timestamp column; daily/weekly/monthly metrics default to 0",
                        routing_view_name,
                    )

                history_created_column = _pick_column(
                    history_columns,
                    ["CREATED_AT", "CREATE_DT", "INSRT_DT", "REG_DT", "REG_DATE"],
                )
                history_received_column = _pick_column(
                    history_columns,
                    ["RECEIVED_AT", "RECEIVE_DT", "ACCEPT_DT", "APPROVED_DT", "RECVD_DT"],
                )
                history_item_column = _pick_column(
                    history_columns,
                    ["ITEM_CD", "ITEM_CODE", "ITEM_NO", "PRODUCT_CD", "ITEMID"],
                )

                history_item_sql = _wrap_column(history_item_column) if history_item_column else None
                history_created_sql = _wrap_column(history_created_column) if history_created_column else None
                history_received_sql = _wrap_column(history_received_column) if history_received_column else None

                history_filters: List[str] = []
                history_params: List[Any] = []

                if history_created_sql:
                    history_filters.append(f"CAST(h.{history_created_sql} AS DATE) = ?")
                    history_params.append(today)

                if history_received_sql:
                    history_filters.append(f"CAST(h.{history_received_sql} AS DATE) = ?")
                    history_params.append(today)

                history_filters_available = bool(history_filters)
                params_tuple: Optional[Sequence[Any]] = (
                    tuple(history_params) if history_filters_available else None
                )

                if history_filters_available:
                    history_condition = " OR ".join(history_filters)
                    total_expr = "COUNT(*)"
                    if history_item_sql:
                        total_expr = f"COUNT(DISTINCT h.{history_item_sql})"
                    history_today_total = _execute_scalar(
                        cursor,
                        f"SELECT {total_expr} FROM {history_table} AS h WHERE {history_condition}",
                        params_tuple,
                    )

                    if history_item_sql:
                        join_condition = f"r.{routing_item_sql} = h.{history_item_sql}"
                        history_without_routing = _execute_scalar(
                            cursor,
                            f"""
                            SELECT COUNT(DISTINCT h.{history_item_sql})
                            FROM {history_table} AS h
                            LEFT JOIN {routing_table} AS r
                                ON {join_condition}
                            WHERE ({history_condition}) AND r.{routing_item_sql} IS NULL
                            """,
                            params_tuple,
                        )
                    else:
                        logger.warning(
                            "Routing history view %s missing item column; WO-without-routing metric defaults to 0",
                            history_view_name,
                        )
                else:
                    logger.warning(
                        "Routing history view %s missing created/received date columns; history metrics default to 0",
                        history_view_name,
                    )
            finally:
                try:
                    cursor.close()
                except Exception:
                    pass

        effective_daily = history_today_total if history_filters_available else routing_daily

        return RoutingStatsResponse(
            daily=effective_daily,
            weekly=routing_weekly,
            monthly=routing_monthly,
            total=total,
            unique_items=unique_items,
            today_history_total=history_today_total,
            today_without_routing=history_without_routing,
        )
    except Exception as e:
        logger.error(f"Failed to get routing statistics: {e}")
        return RoutingStatsResponse(
            daily=45,
            weekly=312,
            monthly=1850,
            total=15420,
            unique_items=980,
            today_history_total=0,
            today_without_routing=0,
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



