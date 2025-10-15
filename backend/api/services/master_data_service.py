from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional

import pandas as pd

from backend import database
from backend.api.config import get_settings
from common.datetime_utils import utc_isoformat, utc_timestamp
from common.logger import get_logger

# Access 파일 확장자 (하위 호환성)
ACCESS_FILE_SUFFIXES = {".mdb", ".accdb"}

ITEM_MASTER_COLUMNS: List[str] = [
    "ITEM_CD",
    "ITEM_NM",
    "ITEM_SPEC",
    "ADDITIONAL_SPEC",
    "ITEM_MATERIAL",
    "ITEM_GRP1",
    "ITEM_GRP1NM",
    "ITEM_GRP2",
    "ITEM_GRP2NM",
    "GROUP1",
    "GROUP2",
    "GROUP3",
    "INSRT_DT",
    "MODI_DT",
]

ITEM_META_COLUMNS: List[str] = [
    "ITEM_NM",
    "ITEM_SPEC",
    "ITEM_MATERIAL",
    "ADDITIONAL_SPEC",
]

COLUMN_LABEL_MAP: Dict[str, str] = {
    "ITEM_CD": "품목코드",
    "ITEM_NM": "품목명",
    "ITEM_SPEC": "사양",
    "ADDITIONAL_SPEC": "추가 사양",
    "ITEM_MATERIAL": "재질",
    "ITEM_GRP1": "대분류",
    "ITEM_GRP1NM": "대분류명",
    "GROUP1": "1차 그룹",
    "GROUP2": "2차 그룹",
    "GROUP3": "3차 그룹",
    "INSRT_DT": "생성일",
    "MODI_DT": "수정일",
}

COLUMN_WIDTH_MAP: Dict[str, str] = {
    "ITEM_CD": "140px",
    "ITEM_MATERIAL": "140px",
    "INSRT_DT": "160px",
    "MODI_DT": "160px",
}

TREE_GROUP_COLUMNS: List[str] = ["ITEM_GRP1NM", "GROUP1", "ITEM_GRP1"]
TREE_FAMILY_COLUMNS: List[str] = ["GROUP2", "ITEM_GRP2", "ITEM_GRP2NM"]

settings = get_settings()
logger = get_logger("service.master_data")

class MasterDataService:
    """MSSQL 기준정보 데이터를 조회하는 서비스."""

    def __init__(self, cache_ttl_seconds: int = 300) -> None:
        self._cache_ttl = cache_ttl_seconds
        self._cache_lock = Lock()
        self._cache_df: Optional[pd.DataFrame] = None
        self._cache_timestamp: float = 0.0

    def _load_item_master(self) -> pd.DataFrame:
        with self._cache_lock:
            now = time.time()
            if self._cache_df is not None and now - self._cache_timestamp < self._cache_ttl:
                return self._cache_df

            df = database.fetch_item_master(columns=ITEM_MASTER_COLUMNS)
            self._cache_df = df
            self._cache_timestamp = now
            return df

    @staticmethod
    def _slugify(value: Any, prefix: str) -> str:
        text = str(value).strip() if value is not None else "미분류"
        if not text:
            text = "미분류"
        slug = text.replace(" ", "_")
        return f"{prefix}:{slug}"

    def _make_group_id(self, value: Any) -> str:
        return self._slugify(value, "group")

    def _make_family_id(self, group_id: str, value: Any) -> str:
        return f"{group_id}::{self._slugify(value, 'family')}"

    @staticmethod
    def _normalize_value(value: Any) -> str:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return ""
        if isinstance(value, (datetime, pd.Timestamp)):
            return value.strftime("%Y-%m-%d %H:%M:%S")
        return str(value)

    def _display_label(self, value: Any, fallback: str = "미분류") -> str:
        normalized = self._normalize_value(value)
        return normalized if normalized else fallback

    def _build_item_node(self, row: pd.Series) -> Dict[str, Any]:
        item_code = self._normalize_value(row.get("ITEM_CD"))
        name = row.get("ITEM_NM")
        label = item_code
        if isinstance(name, str) and name.strip():
            label = f"{item_code} · {name.strip()}"
        meta = {
            key: self._normalize_value(row.get(key))
            for key in ITEM_META_COLUMNS
            if key in row.index and pd.notna(row.get(key))
        }
        meta["item_code"] = item_code

        group_id = self._normalize_value(row.get("__group_id__"))
        if group_id:
            meta["group_id"] = group_id
            meta["group_label"] = self._display_label(row.get("__group_label__"))

        family_id = self._normalize_value(row.get("__family_id__"))
        if family_id:
            meta["family_id"] = family_id
            meta["family_label"] = self._display_label(row.get("__family_label__"))

        return {
            "id": item_code,
            "label": label,
            "type": "item",
            "meta": meta or None,
        }

    def _prepare_dataframe(self, df: pd.DataFrame) -> tuple[pd.DataFrame, str, Optional[str]]:
        working_df = df.copy()
        group_col = next((col for col in TREE_GROUP_COLUMNS if col in working_df.columns), None)
        if group_col is None:
            working_df = working_df.assign(__group__="전체")
            group_col = "__group__"

        family_col = next((col for col in TREE_FAMILY_COLUMNS if col in working_df.columns), None)
        return working_df, group_col, family_col

    def _annotate_dataframe(self, df: pd.DataFrame, group_col: str, family_col: Optional[str]) -> pd.DataFrame:
        annotated = df.copy()
        annotated["__group_id__"] = annotated[group_col].map(self._make_group_id)
        annotated["__group_label__"] = annotated[group_col].map(self._display_label)

        if family_col and family_col in annotated.columns:
            annotated["__family_label__"] = annotated[family_col].map(self._display_label)

            def build_family_id(row: pd.Series) -> str:
                return self._make_family_id(row.get("__group_id__", ""), row.get(family_col))

            annotated["__family_id__"] = annotated.apply(build_family_id, axis=1)
        else:
            annotated["__family_label__"] = ""
            annotated["__family_id__"] = ""

        return annotated

    def _build_group_nodes(self, df: pd.DataFrame, family_col: Optional[str]) -> List[Dict[str, Any]]:
        tree: List[Dict[str, Any]] = []
        for group_id, group_df in df.groupby("__group_id__", dropna=False):
            if group_df.empty:
                continue
            normalized_id = self._normalize_value(group_id)
            group_label = self._display_label(group_df.iloc[0].get("__group_label__"))
            item_count = len(group_df)
            family_count = 0
            if family_col and "__family_id__" in group_df.columns:
                family_count = int(group_df["__family_id__"].nunique())
            meta: Dict[str, str] = {
                "group_id": normalized_id,
                "group_label": group_label,
                "item_count": str(item_count),
                "family_count": str(family_count),
            }
            if family_col:
                meta["family_column"] = family_col

            tree.append(
                {
                    "id": normalized_id,
                    "label": group_label,
                    "type": "group",
                    "children": [],
                    "meta": meta,
                }
            )

        return tree

    def _build_family_nodes(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        nodes: List[Dict[str, Any]] = []
        for family_id, family_df in df.groupby("__family_id__", dropna=False):
            if family_df.empty:
                continue
            normalized_id = self._normalize_value(family_id)
            group_id = self._normalize_value(family_df.iloc[0].get("__group_id__"))
            group_label = self._display_label(family_df.iloc[0].get("__group_label__"))
            family_label = self._display_label(family_df.iloc[0].get("__family_label__"))
            meta: Dict[str, str] = {
                "group_id": group_id,
                "group_label": group_label,
                "family_id": normalized_id,
                "family_label": family_label,
                "item_count": str(len(family_df)),
            }
            nodes.append(
                {
                    "id": normalized_id,
                    "label": family_label,
                    "type": "family",
                    "children": [],
                    "meta": meta,
                }
            )
        return nodes

    def _build_item_nodes(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        return [self._build_item_node(row) for _, row in df.iterrows()]

    def get_tree(
        self,
        query: Optional[str] = None,
        *,
        parent_type: Optional[str] = None,
        parent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        df = self._load_item_master()
        total_items = len(df)

        filtered_df = df
        if query:
            keyword = query.strip().lower()
            if keyword:
                mask = pd.Series(False, index=df.index)
                for col in ["ITEM_CD", "ITEM_NM", "ITEM_SPEC", "ITEM_MATERIAL"]:
                    if col in df.columns:
                        mask |= df[col].astype(str).str.lower().str.contains(keyword, na=False)
                filtered_df = df.loc[mask]
                if filtered_df.empty():
                    filtered_df = df
        working_df, group_col, family_col = self._prepare_dataframe(filtered_df)
        annotated_df = self._annotate_dataframe(working_df, group_col, family_col)

        nodes: List[Dict[str, Any]]
        if parent_type == "group" and parent_id:
            subset = annotated_df.loc[annotated_df["__group_id__"] == parent_id]
            if family_col and not subset.empty and subset["__family_id__"].str.len().any():
                nodes = self._build_family_nodes(subset)
            else:
                nodes = self._build_item_nodes(subset)
        elif parent_type == "family" and parent_id:
            subset = annotated_df.loc[annotated_df["__family_id__"] == parent_id]
            nodes = self._build_item_nodes(subset)
        else:
            nodes = self._build_group_nodes(annotated_df, family_col)

        default_item = filtered_df["ITEM_CD"].iloc[0] if not filtered_df.empty else None

        return {
            "nodes": nodes,
            "total_items": total_items,
            "filtered_items": len(filtered_df),
            "default_item_code": default_item,
        }


    def get_item_matrix(self, item_code: str) -> Dict[str, Any]:
        df = database.fetch_single_item(item_code)
        if df.empty:
            raise ValueError(f"해당 품목을 찾을 수 없습니다: {item_code}")

        columns = [
            {
                "key": col,
                "label": COLUMN_LABEL_MAP.get(col, col),
                "width": COLUMN_WIDTH_MAP.get(col),
            }
            for col in df.columns
        ]

        rows = []
        for _, row in df.iterrows():
            values = {col: self._normalize_value(row[col]) for col in df.columns}
            rows.append(
                {
                    "key": self._normalize_value(row.get("ITEM_CD", "row")),
                    "values": values,
                }
            )

        return {
            "item_code": item_code,
            "columns": columns,
            "rows": rows,
            "record_count": len(rows),
        }

    def get_logs(self, limit: int = 5) -> Dict[str, Any]:
        log_file = self.readonly_log_file()
        if log_file.exists():
            lines = log_file.read_text(encoding="utf-8").splitlines()
            selected = lines[-limit:] if limit > 0 else lines
        else:
            selected = []

        logs: List[Dict[str, str]] = []
        for line in reversed(selected):
            entry = self._parse_log_line(line)
            if entry:
                logs.append(entry)

        connection = self._detect_connection_status()
        return {"logs": logs, "connection": connection}

    def _parse_log_line(self, line: str) -> Optional[Dict[str, str]]:
        text = line.strip()
        if not text:
            return None
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return {
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "ip": "-",
                "user": "-",
                "action": text[:120],
                "target": "",
            }

        return {
            "timestamp": str(data.get("timestamp", "")),
            "ip": str(data.get("client_host") or data.get("ip") or "-"),
            "user": str(data.get("username") or data.get("user") or "-"),
            "action": str(data.get("action") or data.get("message") or "-"),
            "target": str(data.get("target") or data.get("item_code") or data.get("item") or ""),
        }

    def _detect_connection_status(self) -> Dict[str, Optional[str]]:
        try:
            info = database.get_database_info()
            return {
                "status": "connected",
                "server": info.get("server") or database.MSSQL_CONFIG["server"],
                "database": info.get("database") or database.MSSQL_CONFIG["database"],
                "last_checked": utc_timestamp("%Y-%m-%d %H:%M:%S"),
            }
        except Exception as exc:
            logger.warning("MSSQL 연결 상태 확인 실패: %s", exc)
            return {
                "status": "disconnected",
                "server": database.MSSQL_CONFIG["server"],
                "database": database.MSSQL_CONFIG["database"],
                "last_checked": None,
            }


    def get_database_metadata(self, table: Optional[str] = None) -> Dict[str, Any]:
        """MSSQL 테이블/뷰 메타데이터를 조회한다."""

        target_table = table or getattr(database, "VIEW_ITEM_MASTER", "dbo.BI_ITEM_INFO_VIEW")
        columns: List[Dict[str, Any]] = []

        try:
            columns = database.describe_table(target_table)
        except Exception as exc:
            logger.warning("MSSQL 메타데이터 조회 실패 (%s), DataFrame 기반 추론 시도: %s", target_table, exc)
            type_map = {
                "object": "NVARCHAR",
                "float64": "FLOAT",
                "int64": "BIGINT",
                "datetime64[ns]": "DATETIME2",
                "bool": "BIT",
            }
            try:
                df = self._load_item_master()
                for name in df.columns:
                    dtype = str(df[name].dtype)
                    mapped = type_map.get(dtype, dtype.upper())
                    nullable = bool(df[name].isna().any())
                    columns.append({"name": name, "type": mapped, "nullable": nullable})
            except Exception as inner_exc:
                logger.error("DataFrame 추론도 실패하여 기본 컬럼 반환: %s", inner_exc)
                columns = [{"name": column, "type": "NVARCHAR", "nullable": True} for column in ITEM_MASTER_COLUMNS]

        return {
            "table": target_table,
            "columns": columns,
            "server": database.MSSQL_CONFIG["server"],
            "database": database.MSSQL_CONFIG["database"],
            "updated_at": utc_isoformat(),
        }

    def readonly_log_file(self) -> Path:
        log_dir = settings.audit_log_dir
        log_file = log_dir / "master_data.log"
        log_file.parent.mkdir(parents=True, exist_ok=True)
        if not log_file.exists():
            log_file.touch()
        return log_file

    def get_log_path(self) -> Path:
        return self.readonly_log_file()


master_data_service = MasterDataService()
