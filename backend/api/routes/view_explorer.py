"""SQL View Explorer API - 뷰 탐색, 컬럼 설정, 체크리스트 관리."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend import database
from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_auth
from common.logger import get_logger

router = APIRouter(prefix="/api/view-explorer", tags=["view-explorer"])
logger = get_logger("api.view_explorer")


# ===== Pydantic Models =====

class ViewInfo(BaseModel):
    """뷰 정보."""
    schema_name: str
    view_name: str
    full_name: str
    definition: Optional[str] = None


class ColumnConfig(BaseModel):
    """컬럼 설정."""
    name: str
    display_name: str
    visible: bool = True
    order: int
    width: Optional[int] = None


class ViewConfigCreate(BaseModel):
    """뷰 설정 생성/업데이트."""
    view_name: str = Field(..., description="전체 뷰 이름 (스키마.뷰)")
    display_name: str = Field(..., description="표시 이름")
    columns: List[ColumnConfig] = Field(..., description="컬럼 설정")
    enable_checklist: bool = Field(False, description="체크리스트 활성화")
    checklist_column_name: str = Field("체크", description="체크리스트 컬럼 이름")


class ViewConfigResponse(BaseModel):
    """뷰 설정 응답."""
    id: int
    view_name: str
    display_name: str
    columns: List[ColumnConfig]
    enable_checklist: bool
    checklist_column_name: str
    created_at: str
    updated_at: str


class ChecklistUpdate(BaseModel):
    """체크리스트 업데이트."""
    row_id: str = Field(..., description="행 식별자 (첫 번째 컬럼 값)")
    checked: bool = Field(..., description="체크 상태")


# ===== Endpoints =====

@router.get("/views", response_model=List[ViewInfo])
async def list_views(
    schema: Optional[str] = Query(None, description="스키마 필터"),
) -> List[ViewInfo]:
    """MSSQL 뷰 목록을 조회한다."""
    logger.info(f"뷰 목록 조회: schema={schema}")

    try:
        query = """
        SELECT
            s.name AS schema_name,
            v.name AS view_name,
            CONCAT(s.name, '.', v.name) AS full_name,
            OBJECT_DEFINITION(v.object_id) AS definition
        FROM sys.views v
        INNER JOIN sys.schemas s ON v.schema_id = s.schema_id
        """

        params = []
        if schema:
            query += " WHERE s.name = ?"
            params.append(schema)

        query += " ORDER BY s.name, v.name"

        rows = database.execute_query(query, params)

        views = [
            ViewInfo(
                schema_name=row[0],
                view_name=row[1],
                full_name=row[2],
                definition=row[3][:500] if row[3] else None  # 처음 500자만
            )
            for row in rows
        ]

        logger.info(f"뷰 {len(views)}개 조회 완료")
        return views

    except Exception as exc:
        logger.error(f"뷰 목록 조회 실패: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"뷰 목록 조회 실패: {exc}")


@router.get("/views/{view_name}/sample")
async def get_view_sample_data(
    view_name: str,
    page: int = Query(1, ge=1, description="조회할 페이지 번호"),
    page_size: int = Query(30, ge=1, le=30, description="페이지 당 행 수"),
    search: Optional[str] = Query(None, description="검색 키워드"),
    search_column: Optional[str] = Query(None, description="검색 대상 컬럼"),
    limit: Optional[int] = Query(None, ge=1, le=5000, description="(Deprecated) 조회할 최대 행 수"),
) -> Dict[str, Any]:
    """뷰의 샘플 데이터를 페이지 단위로 조회한다."""
    logger.info(
        "뷰 샘플 데이터 조회: view=%s, page=%s, page_size=%s, search=%s, column=%s, limit=%s",
        view_name,
        page,
        page_size,
        search,
        search_column,
        limit,
    )

    try:
        # 컬럼 정보 조회
        columns_query = """
        SELECT
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.CHARACTER_MAXIMUM_LENGTH,
            c.NUMERIC_PRECISION,
            c.NUMERIC_SCALE
        FROM INFORMATION_SCHEMA.COLUMNS c
        WHERE c.TABLE_NAME = ?
        AND c.TABLE_SCHEMA = ?
        ORDER BY c.ORDINAL_POSITION
        """

        # 뷰 이름 파싱 (schema.view)
        parts = view_name.split(".")
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="뷰 이름은 'schema.view' 형식이어야 합니다")

        schema_name, table_name = parts
        columns_rows = database.execute_query(columns_query, [table_name, schema_name])

        columns = [
            {
                "name": row[0],
                "type": row[1],
                "max_length": row[2],
                "precision": row[3],
                "scale": row[4],
            }
            for row in columns_rows
        ]

        column_names = [column["name"] for column in columns]
        if not column_names:
            return {
                "view_name": view_name,
                "columns": columns,
                "data": [],
                "row_count": 0,
                "page": page,
                "page_size": limit if limit is not None else page_size,
                "total_pages": 0,
                "has_next": False,
            }

        if search_column and search_column not in column_names:
            raise HTTPException(status_code=400, detail=f"'{search_column}' 컬럼을 찾을 수 없습니다.")

        effective_page_size = limit if limit is not None else page_size
        if effective_page_size <= 0:
            raise HTTPException(status_code=400, detail="페이지 크기는 1 이상이어야 합니다.")

        offset = (page - 1) * effective_page_size
        where_clauses: List[str] = []
        query_params: List[Any] = []

        if search:
            keyword = f"%{search}%"
            if search_column:
                where_clauses.append(f"CAST([{search_column}] AS NVARCHAR(MAX)) LIKE ?")
                query_params.append(keyword)
            else:
                like_clauses = []
                for name in column_names:
                    like_clauses.append(f"CAST([{name}] AS NVARCHAR(MAX)) LIKE ?")
                    query_params.append(keyword)
                if like_clauses:
                    where_clauses.append("(" + " OR ".join(like_clauses) + ")")

        where_clause = ""
        if where_clauses:
            where_clause = "WHERE " + " AND ".join(where_clauses)

        order_column = search_column or column_names[0]
        order_clause = f"ORDER BY [{order_column}]"

        count_query = f"SELECT COUNT(*) FROM {view_name} {where_clause}"
        count_result = database.execute_query(count_query, query_params)
        total_count = int(count_result[0][0]) if count_result else 0

        data_query = f"""
        SELECT *
        FROM {view_name}
        {where_clause}
        {order_clause}
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """
        data_params = list(query_params)
        data_params.extend([offset, effective_page_size])
        data_rows = database.execute_query(data_query, data_params)

        data: List[Dict[str, Any]] = []
        for row in data_rows:
            row_dict: Dict[str, Any] = {}
            for i, col in enumerate(columns):
                value = row[i]
                if isinstance(value, datetime):
                    value = value.isoformat()
                row_dict[col["name"]] = value
            data.append(row_dict)

        total_pages = (total_count // effective_page_size) + (1 if total_count % effective_page_size else 0)
        has_next = offset + len(data_rows) < total_count

        return {
            "view_name": view_name,
            "columns": columns,
            "data": data,
            "row_count": total_count,
            "page": page,
            "page_size": effective_page_size,
            "total_pages": total_pages,
            "has_next": has_next,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"뷰 샘플 데이터 조회 실패: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"샘플 데이터 조회 실패: {exc}")


@router.post("/configs", response_model=ViewConfigResponse)
async def create_view_config(
    config: ViewConfigCreate,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> ViewConfigResponse:
    """뷰 설정을 생성하거나 업데이트한다."""
    logger.info(f"뷰 설정 저장: user={current_user.username}, view={config.view_name}")

    try:
        # view_configs 테이블에 저장
        columns_json = json.dumps([col.dict() for col in config.columns])
        now = datetime.now().isoformat()

        # 기존 설정 확인
        check_query = "SELECT id FROM view_configs WHERE view_name = ?"
        existing = database.execute_query(check_query, [config.view_name])

        if existing:
            # 업데이트
            config_id = existing[0][0]
            update_query = """
            UPDATE view_configs
            SET display_name = ?,
                columns_config = ?,
                enable_checklist = ?,
                checklist_column_name = ?,
                updated_at = ?,
                updated_by = ?
            WHERE id = ?
            """
            database.execute_query(update_query, [
                config.display_name,
                columns_json,
                config.enable_checklist,
                config.checklist_column_name,
                now,
                current_user.username,
                config_id
            ])
        else:
            # 신규 생성
            insert_query = """
            INSERT INTO view_configs
            (view_name, display_name, columns_config, enable_checklist, checklist_column_name, created_at, created_by, updated_at, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            database.execute_query(insert_query, [
                config.view_name,
                config.display_name,
                columns_json,
                config.enable_checklist,
                config.checklist_column_name,
                now,
                current_user.username,
                now,
                current_user.username
            ])

            # ID 조회
            config_id = database.execute_query("SELECT @@IDENTITY")[0][0]

        # 저장된 설정 조회
        return await get_view_config(config.view_name, current_user)

    except Exception as exc:
        logger.error(f"뷰 설정 저장 실패: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"뷰 설정 저장 실패: {exc}")


@router.get("/configs/{view_name}", response_model=ViewConfigResponse)
async def get_view_config(
    view_name: str,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> ViewConfigResponse:
    """뷰 설정을 조회한다."""
    logger.info(f"뷰 설정 조회: user={current_user.username}, view={view_name}")

    try:
        query = """
        SELECT id, view_name, display_name, columns_config, enable_checklist,
               checklist_column_name, created_at, updated_at
        FROM view_configs
        WHERE view_name = ?
        """

        rows = database.execute_query(query, [view_name])

        if not rows:
            raise HTTPException(status_code=404, detail="뷰 설정을 찾을 수 없습니다")

        row = rows[0]
        columns = json.loads(row[3])

        return ViewConfigResponse(
            id=row[0],
            view_name=row[1],
            display_name=row[2],
            columns=[ColumnConfig(**col) for col in columns],
            enable_checklist=row[4],
            checklist_column_name=row[5],
            created_at=row[6],
            updated_at=row[7]
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"뷰 설정 조회 실패: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"뷰 설정 조회 실패: {exc}")


@router.get("/configs")
async def list_view_configs() -> List[Dict[str, Any]]:
    """저장된 뷰 설정 목록을 조회한다 (공개 API - 인증 불필요)."""
    logger.info("뷰 설정 목록 조회 (public access)")

    try:
        query = """
        SELECT id, view_name, display_name, enable_checklist, created_at, updated_at
        FROM view_configs
        ORDER BY updated_at DESC
        """

        rows = database.execute_query(query)

        return [
            {
                "id": row[0],
                "view_name": row[1],
                "display_name": row[2],
                "enable_checklist": row[3],
                "created_at": row[4],
                "updated_at": row[5]
            }
            for row in rows
        ]

    except Exception as exc:
        # If table doesn't exist, return empty list instead of error
        if "view_configs" in str(exc) and ("유효하지 않습니다" in str(exc) or "Invalid object name" in str(exc)):
            logger.warning("view_configs 테이블이 존재하지 않음 - 빈 목록 반환")
            return []
        logger.error(f"뷰 설정 목록 조회 실패: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"뷰 설정 목록 조회 실패: {exc}")


@router.post("/checklist/{view_name}")
async def update_checklist(
    view_name: str,
    update: ChecklistUpdate,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """체크리스트를 업데이트한다."""
    logger.info(f"체크리스트 업데이트: user={current_user.username}, view={view_name}, row={update.row_id}")

    try:
        now = datetime.now().isoformat()

        if update.checked:
            # 체크 추가
            insert_query = """
            IF NOT EXISTS (SELECT 1 FROM view_checklists WHERE view_name = ? AND row_id = ? AND username = ?)
                INSERT INTO view_checklists (view_name, row_id, username, checked_at)
                VALUES (?, ?, ?, ?)
            """
            database.execute_query(insert_query, [
                view_name, update.row_id, current_user.username,
                view_name, update.row_id, current_user.username, now
            ])
        else:
            # 체크 제거
            delete_query = """
            DELETE FROM view_checklists
            WHERE view_name = ? AND row_id = ? AND username = ?
            """
            database.execute_query(delete_query, [view_name, update.row_id, current_user.username])

        return {
            "success": True,
            "view_name": view_name,
            "row_id": update.row_id,
            "checked": update.checked,
            "username": current_user.username
        }

    except Exception as exc:
        logger.error(f"체크리스트 업데이트 실패: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"체크리스트 업데이트 실패: {exc}")


@router.get("/data/{view_name}")
async def get_view_data_with_checklist(
    view_name: str,
    limit: int = Query(1000, ge=1, le=10000),
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """뷰 데이터와 체크리스트 정보를 함께 조회한다."""
    logger.info(f"뷰 데이터 조회: user={current_user.username}, view={view_name}")

    try:
        # 뷰 설정 조회
        config = await get_view_config(view_name, current_user)

        # 표시할 컬럼만 필터링
        visible_columns = [col for col in config.columns if col.visible]
        visible_columns.sort(key=lambda x: x.order)

        column_names = [col.name for col in visible_columns]

        # 데이터 조회 (첫 번째 컬럼은 row_id로 사용)
        first_column = column_names[0] if column_names else "*"
        columns_str = ", ".join(column_names) if column_names else "*"

        data_query = f"SELECT TOP {limit} {columns_str} FROM {view_name}"
        data_rows = database.execute_query(data_query)

        # 체크리스트 조회 (활성화된 경우)
        checklist_map = {}
        if config.enable_checklist:
            checklist_query = """
            SELECT row_id, username, checked_at
            FROM view_checklists
            WHERE view_name = ?
            """
            checklist_rows = database.execute_query(checklist_query, [view_name])

            for row in checklist_rows:
                row_id = str(row[0])
                if row_id not in checklist_map:
                    checklist_map[row_id] = []
                checklist_map[row_id].append({
                    "username": row[1],
                    "checked_at": row[2]
                })

        # 데이터 변환
        data = []
        for row in data_rows:
            row_dict = {}
            row_id = str(row[0])  # 첫 번째 컬럼을 row_id로 사용

            for i, col in enumerate(visible_columns):
                value = row[i]
                if isinstance(value, datetime):
                    value = value.isoformat()
                row_dict[col.display_name] = value

            # 체크리스트 정보 추가
            if config.enable_checklist:
                checkers = checklist_map.get(row_id, [])
                row_dict[config.checklist_column_name] = len(checkers) > 0
                row_dict["_checkers"] = checkers  # 체크한 사용자 목록

            row_dict["_row_id"] = row_id  # 내부 식별자
            data.append(row_dict)

        return {
            "view_name": view_name,
            "display_name": config.display_name,
            "columns": [
                {
                    "name": col.display_name,
                    "original_name": col.name,
                    "width": col.width
                }
                for col in visible_columns
            ],
            "enable_checklist": config.enable_checklist,
            "checklist_column_name": config.checklist_column_name,
            "data": data,
            "row_count": len(data)
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"뷰 데이터 조회 실패: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"뷰 데이터 조회 실패: {exc}")


__all__ = ["router"]
