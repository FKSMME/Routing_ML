from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional, Union

import pandas as pd

from backend import database
from backend.api.config import get_settings

ITEM_MASTER_COLUMNS: List[str] = [
    "ITEM_CD",
    "ITEM_NM",
    "ITEM_SPEC",
    "ADDITIONAL_SPEC",
    "ITEM_MATERIAL",
    "ITEM_GRP1",
    "ITEM_GRP1NM",
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

ACCESS_FILE_SUFFIXES = {".accdb", ".mdb"}


class MasterDataService:
    """Access 기준정보 데이터를 조회하는 서비스."""

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

    @staticmethod
    def _normalize_value(value: Any) -> str:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return ""
        if isinstance(value, (datetime, pd.Timestamp)):
            return value.strftime("%Y-%m-%d %H:%M:%S")
        return str(value)

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
        return {
            "id": item_code,
            "label": label,
            "type": "item",
            "meta": meta or None,
        }

    def _build_tree(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        if df.empty:
            return []

        group_col = next((col for col in TREE_GROUP_COLUMNS if col in df.columns), None)
        family_col = next((col for col in TREE_FAMILY_COLUMNS if col in df.columns), None)

        if group_col is None:
            df = df.assign(__group__="전체")
            group_col = "__group__"

        tree: List[Dict[str, Any]] = []

        for group_value, group_df in df.groupby(group_col, dropna=False):
            group_id = self._slugify(group_value, "group")
            group_label = self._normalize_value(group_value) or "미분류"

            children: List[Dict[str, Any]] = []
            if family_col and family_col in group_df.columns:
                for family_value, family_df in group_df.groupby(family_col, dropna=False):
                    family_id = self._slugify(family_value or group_id, "family")
                    family_label = self._normalize_value(family_value) or "미분류"
                    item_nodes = [self._build_item_node(row) for _, row in family_df.iterrows()]
                    children.append(
                        {
                            "id": family_id,
                            "label": family_label,
                            "type": "family",
                            "children": item_nodes,
                        }
                    )
            else:
                children = [self._build_item_node(row) for _, row in group_df.iterrows()]

            tree.append(
                {
                    "id": group_id,
                    "label": group_label,
                    "type": "group",
                    "children": children,
                }
            )

        return tree

    def get_tree(self, query: Optional[str] = None) -> Dict[str, Any]:
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
                if filtered_df.empty:
                    filtered_df = df
        tree = self._build_tree(filtered_df)
        default_item = filtered_df["ITEM_CD"].iloc[0] if not filtered_df.empty else None

        return {
            "nodes": tree,
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
            latest = database._latest_db(database.ACCESS_DIR)  # type: ignore[attr-defined]
            stat = latest.stat()
            last_sync = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
            return {
                "status": "connected",
                "path": str(latest),
                "last_sync": last_sync,
            }
        except Exception:
            return {
                "status": "disconnected",
                "path": str(database.ACCESS_DIR),
                "last_sync": None,
            }


    def _workspace_access_config(self) -> tuple[Optional[str], Optional[str]]:
        try:
            workspace_file = settings.audit_log_dir / "workspace_settings.json"
            if workspace_file.exists():
                data = json.loads(workspace_file.read_text(encoding="utf-8"))
                access_cfg = data.get("access") or {}
                options_cfg = data.get("options") or {}
                path_value = access_cfg.get("path") or options_cfg.get("access_path")
                table_value = access_cfg.get("table") or options_cfg.get("access_table")
                path_str = str(path_value).strip() if isinstance(path_value, str) else None
                table_str = str(table_value).strip() if isinstance(table_value, str) else None
                return (path_str or None, table_str or None)
        except Exception:
            pass
        return None, None

    @staticmethod
    def _resolve_access_path(value: Optional[str]) -> Optional[Path]:
        if not value:
            return None
        candidate = Path(value).expanduser()
        if candidate.exists():
            return candidate
        return None

    def validate_access_path(self, candidate: Union[str, Path]) -> Path:
        """Ensure the provided path points to an Access database file."""

        path = Path(candidate).expanduser()
        suffix = path.suffix.lower()
        if suffix not in ACCESS_FILE_SUFFIXES:
            raise ValueError("Access 파일은 .accdb 또는 .mdb 형식이어야 합니다.")
        if not path.exists():
            raise FileNotFoundError(f"Access 파일을 찾을 수 없습니다: {path}")
        if not path.is_file():
            raise ValueError(f"Access 경로가 파일이 아닙니다: {path}")
        return path

    @staticmethod
    def _list_access_tables(path: Path) -> List[str]:
        try:
            import pyodbc  # type: ignore
        except ImportError:
            return []
        try:
            with pyodbc.connect(
                r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};" f"DBQ={path}",
                timeout=5,
            ) as conn:
                cursor = conn.cursor()
                tables: List[str] = []
                for row in cursor.tables(tableType="TABLE"):
                    name = getattr(row, "table_name", None)
                    if not name:
                        continue
                    if str(name).startswith("MSys"):
                        continue
                    tables.append(str(name))
                return sorted(dict.fromkeys(tables))
        except Exception:
            return []

    def read_access_tables(self, candidate: Union[str, Path]) -> List[str]:
        """Return sorted Access table names for the validated path."""

        path = self.validate_access_path(candidate)
        tables = self._list_access_tables(path)
        unique_tables = sorted(dict.fromkeys(tables))
        if not unique_tables:
            raise RuntimeError(f"Access 파일에서 테이블 목록을 찾을 수 없습니다: {path}")
        return unique_tables

    @staticmethod
    def _introspect_access_columns(path: Path, table: str) -> List[Dict[str, Any]]:
        try:
            import pyodbc  # type: ignore
        except ImportError as exc:
            raise RuntimeError("pyodbc is not available") from exc
        columns: List[Dict[str, Any]] = []
        try:
            with pyodbc.connect(
                r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};" f"DBQ={path}",
                timeout=5,
            ) as conn:
                cursor = conn.cursor()
                for row in cursor.columns(table=table):
                    table_name = getattr(row, "table_name", "")
                    if table_name and table_name.lower() != table.lower():
                        continue
                    column_name = getattr(row, "column_name", None)
                    if not column_name:
                        continue
                    type_name = getattr(row, "type_name", None) or getattr(row, "data_type", "")
                    nullable_flag = getattr(row, "is_nullable", getattr(row, "nullable", None))
                    if nullable_flag is None:
                        nullable = True
                    elif isinstance(nullable_flag, str):
                        nullable = nullable_flag.upper() != "NO"
                    else:
                        nullable = bool(nullable_flag)
                    columns.append(
                        {
                            "name": str(column_name),
                            "type": str(type_name) if type_name else "TEXT",
                            "nullable": nullable,
                        }
                    )
        except Exception as exc:
            raise RuntimeError(f"Failed to inspect table '{table}': {exc}") from exc
        return columns

    def list_access_tables(self, path: Path) -> List[str]:
        try:
            return self.read_access_tables(path)
        except Exception:
            return []

    def get_access_metadata(self, table: Optional[str] = None, path: Optional[str] = None) -> Dict[str, Any]:
        """Inspect Access metadata using the provided path/table or fallbacks."""

        workspace_path, workspace_table = self._workspace_access_config()
        candidate_table = table or workspace_table or getattr(database, "VIEW_ITEM_MASTER", "dbo_BI_ITEM_INFO_VIEW")
        table_name = candidate_table.strip() if isinstance(candidate_table, str) else getattr(database, "VIEW_ITEM_MASTER", "dbo_BI_ITEM_INFO_VIEW")

        resolved_path = self._resolve_access_path(path) or self._resolve_access_path(workspace_path)
        if resolved_path is None:
            try:
                resolved_path = database._latest_db(database.ACCESS_DIR)  # type: ignore[attr-defined]
            except Exception:
                resolved_path = None

        columns: List[Dict[str, Any]] = []
        if resolved_path is not None and table_name:
            try:
                columns = self._introspect_access_columns(resolved_path, table_name)
            except Exception:
                columns = []

        if not columns:
            type_map = {
                "object": "TEXT",
                "float64": "DOUBLE",
                "int64": "LONG",
                "datetime64[ns]": "DATETIME",
                "bool": "YESNO",
            }
            try:
                df = self._load_item_master()
                for name in df.columns:
                    dtype = str(df[name].dtype)
                    mapped = type_map.get(dtype, dtype.upper())
                    nullable = bool(df[name].isna().any())
                    columns.append(
                        {
                            "name": name,
                            "type": mapped,
                            "nullable": nullable,
                        }
                    )
            except Exception:
                columns = [
                    {
                        "name": column,
                        "type": "TEXT",
                        "nullable": True,
                    }
                    for column in ITEM_MASTER_COLUMNS
                ]

        return {
            "table": table_name,
            "columns": columns,
            "path": str(resolved_path) if resolved_path else None,
            "updated_at": datetime.utcnow().isoformat(),
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
