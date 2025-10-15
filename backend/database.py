from __future__ import annotations

import atexit
import time
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
import threading
from contextlib import contextmanager
import warnings
from typing import Any, Dict, List, Optional, Sequence, Tuple

from backend.demo_data import (
    demo_mode_enabled,
    get_demo_item,
    get_demo_routing,
    has_demo_routing,
)

import pandas as pd

# pyodbc를 optional로 import (ODBC 라이브러리가 없을 때 대비)
try:
    import pyodbc
    PYODBC_AVAILABLE = True
except ImportError:
    pyodbc = None
    PYODBC_AVAILABLE = False

from common.datetime_utils import utc_isoformat_z
from common.logger import get_logger
from backend.constants import TRAIN_FEATURES

logger = get_logger("database")

_DEMO_MODE = demo_mode_enabled()

# ════════════════════════════════════════════════
# 0) 경로 · 뷰 상수 (먼저 정의)
# ════════════════════════════════════════════════
BASE_DIR   = Path(__file__).resolve().parents[1]     # e.g., machine/

# DB 타입 선택 (환경 변수로 제어)
import os
DB_TYPE = os.getenv("DB_TYPE", "MSSQL").upper()  # MSSQL only

# MSSQL 연결 정보
MSSQL_CONFIG = {
    "server": os.getenv("MSSQL_SERVER", "K3-DB.ksm.co.kr,1433"),
    "database": os.getenv("MSSQL_DATABASE", "KsmErp"),
    "user": os.getenv("MSSQL_USER", "FKSM_BI"),
    "password": os.getenv("MSSQL_PASSWORD", ""),
    "encrypt": os.getenv("MSSQL_ENCRYPT", "False").lower() == "true",
    "trust_certificate": os.getenv("MSSQL_TRUST_CERTIFICATE", "True").lower() == "true",
}

# 뷰 이름 (MSSQL은 dbo. 스키마 사용)
VIEW_ITEM_MASTER = "dbo.BI_ITEM_INFO_VIEW"
VIEW_ROUTING     = "dbo.BI_ROUTING_HIS_VIEW"
VIEW_WORK_RESULT = "dbo.BI_WORK_ORDER_RESULTS"
VIEW_PURCHASE_ORDER = "dbo.BI_PUR_PO_VIEW"

# 제한된 컬럼 목록 (SELECT * 방지)
ITEM_MASTER_EXTRA_COLUMNS: List[str] = [
    "ITEM_GRP2",
    "ITEM_GRP2NM",
    "ITEM_GRP3",
    "ITEM_GRP3NM",
    "INSRT_DT",
    "MODI_DT",
]

# dict.fromkeys 로 순서를 유지하면서 중복 제거
ITEM_MASTER_VIEW_COLUMNS: Tuple[str, ...] = tuple(
    dict.fromkeys(list(TRAIN_FEATURES) + ITEM_MASTER_EXTRA_COLUMNS)
)

ROUTING_VIEW_COLUMNS: Tuple[str, ...] = (
    "ITEM_CD",
    "ROUT_NO",
    "PROC_SEQ",
    "INSRT_DT",
    "INSIDE_FLAG",
    "JOB_CD",
    "JOB_NM",
    "RES_CD",
    "RES_DIS",
    "TIME_UNIT",
    "MFG_LT",
    "QUEUE_TIME",
    "SETUP_TIME",
    "RUN_TIME",
    "RUN_TIME_UNIT",
    "MACH_WORKED_HOURS",
    "ACT_SETUP_TIME",
    "ACT_RUN_TIME",
    "WAIT_TIME",
    "MOVE_TIME",
    "RUN_TIME_QTY",
    "BATCH_OPER",
    "BP_CD",
    "CUST_NM",
    "CUR_CD",
    "SUBCONTRACT_PRC",
    "TAX_TYPE",
    "MILESTONE_FLG",
    "INSP_FLG",
    "ROUT_ORDER",
    "VALID_FROM_DT",
    "VALID_TO_DT",
    "VIEW_REMARK",
    "ROUT_DOC",
    "DOC_INSIDE",
    "DOC_NO",
    "NC_PROGRAM",
    "NC_PROGRAM_WRITER",
    "NC_WRITER_NM",
    "NC_WRITE_DATE",
    "NC_REVIEWER",
    "NC_REVIEWER_NM",
    "NC_REVIEW_DT",
    "RAW_MATL_SIZE",
    "JAW_SIZE",
    "VALIDITY",
    "PROGRAM_REMARK",
    "OP_DRAW_NO",
    "MTMG_NUMB",
)

WORK_RESULT_VIEW_COLUMNS: Tuple[str, ...] = (
    "ITEM_CD",
    "PROC_SEQ",
    "WORK_CENTER",
    "WORK_CENTER_NM",
    "OPERATION_CD",
    "OPERATION_NM",
    "REPORT_DT",
    "ACT_RUN_TIME",
    "ACT_SETUP_TIME",
    "GOOD_QTY",
    "BAD_QTY",
    "RUN_QTY",
)

# ════════════════════════════════════════════════
# 1) 기본 연결 함수
# ════════════════════════════════════════════════
def _create_mssql_connection_with_config(config: Optional[Dict[str, Any]] = None):
    """MSSQL 서버 연결 생성 (커스텀 설정 지원)

    Args:
        config: 연결 설정 딕셔너리. None이면 MSSQL_CONFIG 사용.
                필수 키: server, database, user, password
                선택 키: encrypt, trust_certificate

    Returns:
        pyodbc.Connection: MSSQL 연결 객체
    """
    if not PYODBC_AVAILABLE:
        raise ImportError("pyodbc is not available. Please install ODBC drivers.")

    # 설정 결정
    if config is None:
        config = MSSQL_CONFIG

    # FreeTDS 드라이버 우선 시도, 없으면 ODBC Driver 17 사용
    available_drivers = pyodbc.drivers()

    if "FreeTDS" in available_drivers:
        driver_name = "FreeTDS"
    elif "ODBC Driver 17 for SQL Server" in available_drivers:
        driver_name = "ODBC Driver 17 for SQL Server"
    elif "ODBC Driver 18 for SQL Server" in available_drivers:
        driver_name = "ODBC Driver 18 for SQL Server"
    else:
        raise ConnectionError(f"No suitable ODBC driver found. Available: {available_drivers}")

    conn_str = (
        f"DRIVER={{{driver_name}}};"
        f"SERVER={config['server']};"
        f"DATABASE={config['database']};"
        f"UID={config['user']};"
        f"PWD={config['password']};"
    )

    # FreeTDS는 Encrypt/TrustServerCertificate 옵션 불필요
    if driver_name != "FreeTDS":
        encrypt = config.get('encrypt', False)
        trust_cert = config.get('trust_certificate', True)
        conn_str += (
            f"Encrypt={'yes' if encrypt else 'no'};"
            f"TrustServerCertificate={'yes' if trust_cert else 'no'};"
        )

    logger.info(
        "MSSQL 연결 시도 (Driver: %s): %s/%s",
        driver_name,
        config["server"],
        config["database"],
    )
    try:
        return pyodbc.connect(conn_str, timeout=10)
    except pyodbc.Error as exc:
        raise ConnectionError(f"MSSQL DB 연결 실패 (Driver: {driver_name}): {exc}") from exc


def _create_mssql_connection():
    """MSSQL 서버 연결 생성 (기본 설정 사용)"""
    return _create_mssql_connection_with_config(None)

def _create_connection() -> pyodbc.Connection:
    """새로운 데이터베이스 연결 생성 (현재는 MSSQL만 지원)"""
    if DB_TYPE != "MSSQL":
        raise RuntimeError(f"Unsupported DB_TYPE '{DB_TYPE}'. Only MSSQL is supported.")
    return _create_mssql_connection()

def _connect() -> pyodbc.Connection:
    """데이터베이스에 연결 (기존 호환성)"""
    return _create_connection()

# ════════════════════════════════════════════════
# 3) 연결 풀링 클래스
# ════════════════════════════════════════════════
class ConnectionPool:
    """간단한 연결 풀"""
    def __init__(self, max_connections=5):
        self.max_connections = max_connections
        self.connections = []
        self.lock = threading.Lock()
    
    @contextmanager
    def get_connection(self):
        """연결 획득"""
        conn = None
        try:
            with self.lock:
                if self.connections:
                    conn = self.connections.pop()
                    # 연결 상태 확인
                    try:
                        conn.execute("SELECT 1")  # 간단한 테스트 쿼리
                    except Exception:
                        # 연결이 끊어졌으면 새로 생성
                        try:
                            conn.close()
                        except Exception:
                            pass
                        conn = None
                
                if conn is None:
                    conn = _create_connection()  # 새 연결 생성
            yield conn
        except Exception:
            # 연결에 문제가 있으면 닫기
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass
            raise
        finally:
            if conn:
                try:
                    with self.lock:
                        if len(self.connections) < self.max_connections:
                            self.connections.append(conn)
                        else:
                            conn.close()
                except Exception as e:
                    logger.warning(f"연결 반환 중 오류: {e}")
                    try:
                        conn.close()
                    except Exception:
                        pass

# 전역 연결 풀
_connection_pool = ConnectionPool()


class CacheStats:
    """단순 히트/미스 카운터."""

    def __init__(self) -> None:
        self.hits = 0
        self.misses = 0
        self._lock = threading.RLock()

    def record_hit(self) -> None:
        with self._lock:
            self.hits += 1

    def record_miss(self) -> None:
        with self._lock:
            self.misses += 1

    def reset(self) -> None:
        with self._lock:
            self.hits = 0
            self.misses = 0

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            total = self.hits + self.misses
            hit_rate = (self.hits / total) if total else 0.0
            return {
                "hits": self.hits,
                "misses": self.misses,
                "requests": total,
                "hit_rate": round(hit_rate, 4),
            }


_cache_lock = threading.RLock()
_item_master_cache_lock = threading.RLock()
_routing_cache_lock = threading.RLock()

_cache_versions: Dict[str, str] = {"item_master": "v0", "routing": "v0"}
_cache_counters: Dict[str, int] = {"item_master": 0, "routing": 0}
_cache_stats: Dict[str, CacheStats] = {
    "item_master": CacheStats(),
    "routing": CacheStats(),
}
_last_cache_fetch: Dict[str, Dict[str, Any]] = {"item_master": {}, "routing": {}}


def _snapshot_time() -> str:
    return utc_isoformat_z()


def _sanitize_columns(
    columns: Optional[Sequence[str]],
    allowed: Sequence[str],
) -> Tuple[str, ...]:
    allowed_lookup = {col.upper(): col for col in allowed}
    if columns:
        sanitized: List[str] = []
        unknown: List[str] = []
        for column in columns:
            key = str(column).strip().upper()
            if not key:
                continue
            actual = allowed_lookup.get(key)
            if actual:
                if actual not in sanitized:
                    sanitized.append(actual)
            else:
                unknown.append(column)
        if unknown:
            logger.warning("[DB] 허용되지 않은 컬럼 무시: %s", ", ".join(map(str, unknown)))
        if sanitized:
            return tuple(sanitized)
    return tuple(allowed)


def _build_select_query(
    view_name: str,
    columns: Sequence[str],
    *,
    where_clause: Optional[str] = None,
    order_clause: Optional[str] = None,
) -> str:
    column_clause = ", ".join(columns)
    query_parts = [f"SELECT {column_clause} FROM {view_name}"]
    if where_clause:
        query_parts.append(where_clause)
    if order_clause:
        query_parts.append(order_clause)
    return " \n".join(query_parts)


def _record_cache_event(
    dataset: str,
    *,
    cached: bool,
    columns: Sequence[str],
    context: Optional[Dict[str, Any]] = None,
) -> None:
    stats = _cache_stats.get(dataset)
    if stats is not None:
        if cached:
            stats.record_hit()
        else:
            stats.record_miss()

    with _cache_lock:
        _last_cache_fetch[dataset] = {
            "cached": cached,
            "columns": list(columns),
            "context": dict(context or {}),
            "timestamp": _snapshot_time(),
            "version": _cache_versions.get(dataset),
        }


def _next_version(dataset: str, tag: Optional[str]) -> str:
    with _cache_lock:
        if tag is not None:
            token = str(tag)
        else:
            _cache_counters[dataset] += 1
            token = f"v{_cache_counters[dataset]}"
        _cache_versions[dataset] = token
        return token

# ════════════════════════════════════════════════
# 4) 유틸리티 함수들
# ════════════════════════════════════════════════
def set_debug_mode(enabled: bool = True):
    """디버그 모드 설정"""
    import logging
    level = logging.DEBUG if enabled else logging.INFO
    
    # 모든 관련 로거의 레벨 변경
    loggers = ['database', 'predictor_ml_improved']
    for logger_name in loggers:
        try:
            target_logger = logging.getLogger(logger_name)
            target_logger.setLevel(level)
            for handler in target_logger.handlers:
                handler.setLevel(level)
        except Exception as e:
            logger.warning(f"로거 설정 실패 {logger_name}: {e}")
    
    print(f"디버그 모드: {'ON' if enabled else 'OFF'}")

def validate_system_requirements():
    """시스템 요구사항 검증"""
    issues = []
    
    # 1. 필수 라이브러리 확인
    try:
        __import__("pandas")
        __import__("numpy")
    except ImportError as e:
        issues.append(f"필수 라이브러리 누락: {e}")
    
    # 2. SQL Server ODBC 드라이버 확인
    try:
        drivers = pyodbc.drivers()
        sqlserver_drivers = [
            d for d in drivers if "SQL Server" in d or d == "FreeTDS"
        ]
        if not sqlserver_drivers:
            issues.append("MSSQL ODBC 드라이버를 찾을 수 없습니다 (예: ODBC Driver 17/18 for SQL Server)")
        else:
            logger.info("발견된 SQL Server 드라이버: %s", sqlserver_drivers)
    except Exception as e:
        issues.append(f"ODBC 드라이버 확인 실패: {e}")

    # 3. MSSQL 연결 확인
    try:
        with _create_mssql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception as e:
        issues.append(f"MSSQL 연결 실패: {e}")
    
    if issues:
        for issue in issues:
            logger.error(f"시스템 요구사항 문제: {issue}")
        return False, issues
    else:
        logger.info("시스템 요구사항 검증 완료")
        return True, []

# ════════════════════════════════════════════════
# 5) 쿼리 실행 함수들
# ════════════════════════════════════════════════
def _prepare_params(params: Sequence[Any] | None) -> Tuple[Any, ...]:
    if params is None:
        return tuple()
    if isinstance(params, tuple):
        return params
    return tuple(params)


def _run_query_optimized(query: str, params: Sequence[Any] | None = None, retries: int = 3, delay: float = 2.0) -> pd.DataFrame:
    """최적화된 쿼리 실행 (연결 풀 사용)"""
    for attempt in range(1, retries + 1):
        try:
            prepared_params = _prepare_params(params)
            if "?" in query and not prepared_params:
                raise ValueError("파라미터 플레이스홀더가 있는 쿼리에는 값이 필요합니다")
            with _connection_pool.get_connection() as conn:
                with warnings.catch_warnings():
                    warnings.filterwarnings('ignore', message='pandas only supports SQLAlchemy connectable')
                    df = pd.read_sql(query, conn, params=list(prepared_params))

            if df.empty:
                logger.debug("[DB] 빈 결과세트 반환 – %s", query[:80])
            return df
            
        except Exception as exc:
            if attempt < retries:
                logger.warning(f"[DB] 쿼리 재시도 {attempt}/{retries}: {exc}")
                time.sleep(delay)
                continue
            raise RuntimeError(f"[DB] 쿼리 실패: {exc}") from exc

def _run_query(
    query: str,
    params: Sequence[Any] | None = None,
    retries: int = 3,
    delay: float = 2.0,
) -> pd.DataFrame:
    """쿼리 실행 → DataFrame (기존 호환성 유지)"""
    for attempt in range(1, retries + 1):
        try:
            prepared_params = _prepare_params(params)
            if "?" in query and not prepared_params:
                raise ValueError("파라미터 플레이스홀더가 있는 쿼리에는 값이 필요합니다")
            with _connect() as conn:
                # pandas 경고 억제
                with warnings.catch_warnings():
                    warnings.filterwarnings('ignore',
                                          message='pandas only supports SQLAlchemy connectable')
                    df = pd.read_sql(query, conn, params=list(prepared_params))
            if df.empty:
                logger.warning("[DB] 빈 결과세트 반환 – %s", query[:80])
            return df
        except Exception as exc:
            if attempt < retries:
                logger.warning(f"[DB] 쿼리 재시도 {attempt}/{retries}: {exc}")
                time.sleep(delay)
                continue
            raise RuntimeError(f"[DB] 쿼리 실패: {exc}") from exc

def _load_item_master(columns_key: Tuple[str, ...]) -> pd.DataFrame:
    query = _build_select_query(VIEW_ITEM_MASTER, columns_key)
    return _run_query(query, ())


@lru_cache(maxsize=32)
def _fetch_item_master_cached(version: str, columns_key: Tuple[str, ...]) -> pd.DataFrame:
    return _load_item_master(columns_key)


def _load_single_item(item_cd_upper: str, columns_key: Tuple[str, ...]) -> pd.DataFrame:
    query = _build_select_query(
        VIEW_ITEM_MASTER,
        columns_key,
        where_clause="WHERE ITEM_CD = ?",
    )
    return _run_query(query, (item_cd_upper,))


@lru_cache(maxsize=512)
def _fetch_single_item_cached(
    version: str,
    item_cd_upper: str,
    columns_key: Tuple[str, ...],
) -> pd.DataFrame:
    return _load_single_item(item_cd_upper, columns_key)


def _load_routing_by_rout_no(
    item_cd_upper: str,
    rout_no: str,
    columns_key: Tuple[str, ...],
) -> pd.DataFrame:
    query = _build_select_query(
        VIEW_ROUTING,
        columns_key,
        where_clause="WHERE ITEM_CD = ? AND ROUT_NO = ?",
        order_clause="ORDER BY PROC_SEQ",
    )
    return _run_query(query, (item_cd_upper, rout_no))


def _load_all_routings(item_cd_upper: str, columns_key: Tuple[str, ...]) -> pd.DataFrame:
    query = _build_select_query(
        VIEW_ROUTING,
        columns_key,
        where_clause="WHERE ITEM_CD = ?",
        order_clause="ORDER BY ROUT_NO, PROC_SEQ",
    )
    return _run_query(query, (item_cd_upper,))


def _load_latest_routing(
    item_cd_upper: str,
    selection_mode: str,
    columns_key: Tuple[str, ...],
) -> pd.DataFrame:
    if selection_mode == "most_used":
        count_query = "\n".join(
            [
                "SELECT ROUT_NO, COUNT(*) as PROC_COUNT",
                f"FROM {VIEW_ROUTING}",
                "WHERE ITEM_CD = ?",
                "GROUP BY ROUT_NO",
                "ORDER BY COUNT(*) DESC, ROUT_NO DESC",
            ]
        )
        count_df = _run_query(count_query, (item_cd_upper,))
        if count_df.empty:
            logger.warning("[DB] ROUT_NO를 찾을 수 없음 – ITEM_CD: %s", item_cd_upper)
            return pd.DataFrame()
        most_used_rout_no = count_df.iloc[0]["ROUT_NO"]
        logger.info(
            "[DB] 최다 공정 ROUT_NO 선택: %s (%s개 공정)",
            most_used_rout_no,
            count_df.iloc[0]["PROC_COUNT"],
        )
        return _load_routing_by_rout_no(item_cd_upper, most_used_rout_no, columns_key)

    all_routing_query = "\n".join(
        [
            "SELECT DISTINCT ROUT_NO, INSRT_DT",
            f"FROM {VIEW_ROUTING}",
            "WHERE ITEM_CD = ?",
            "ORDER BY INSRT_DT DESC, ROUT_NO DESC",
        ]
    )
    rout_df = _run_query(all_routing_query, (item_cd_upper,))
    if rout_df.empty:
        logger.warning("[DB] ROUT_NO를 찾을 수 없음 – ITEM_CD: %s", item_cd_upper)
        return pd.DataFrame()

    if "INSRT_DT" in rout_df.columns:
        try:
            rout_df["INSRT_DT_SAFE"] = pd.to_datetime(rout_df["INSRT_DT"], errors="coerce")
            rout_df_sorted = rout_df.sort_values(
                ["INSRT_DT_SAFE", "ROUT_NO"],
                ascending=[False, False],
                na_position="last",
            )
            latest_rout_no = rout_df_sorted.iloc[0]["ROUT_NO"]
        except Exception as exc:
            logger.warning("[DB] INSRT_DT 정렬 실패, ROUT_NO로만 정렬: %s", exc)
            latest_rout_no = rout_df.sort_values("ROUT_NO", ascending=False).iloc[0]["ROUT_NO"]
    else:
        latest_rout_no = rout_df.sort_values("ROUT_NO", ascending=False).iloc[0]["ROUT_NO"]

    logger.info("[DB] 최신 ROUT_NO 선택: %s", latest_rout_no)
    return _load_routing_by_rout_no(item_cd_upper, latest_rout_no, columns_key)


@lru_cache(maxsize=512)
def _fetch_latest_routing_cached(
    version: str,
    item_cd_upper: str,
    selection_mode: str,
    columns_key: Tuple[str, ...],
) -> pd.DataFrame:
    return _load_latest_routing(item_cd_upper, selection_mode, columns_key)


# ════════════════════════════════════════════════
# 6) 공개 API - 단일 조회 (필수 함수들)
# ════════════════════════════════════════════════
def fetch_item_master(
    columns: Optional[List[str]] = None,
    *,
    use_cache: bool = True,
) -> pd.DataFrame:
    """전체 품목 마스터 조회"""

    columns_key = _sanitize_columns(columns, ITEM_MASTER_VIEW_COLUMNS)
    logger.info("[DB] ITEM_MASTER 조회…")

    if use_cache:
        with _item_master_cache_lock:
            before = _fetch_item_master_cached.cache_info()
            df = _fetch_item_master_cached(
                _cache_versions["item_master"],
                columns_key,
            )
            after = _fetch_item_master_cached.cache_info()
            cached = after.hits > before.hits
    else:
        df = _load_item_master(columns_key)
        cached = False

    _record_cache_event(
        "item_master",
        cached=cached,
        columns=columns_key,
        context={"mode": "bulk"},
    )
    return df.copy()


def fetch_single_item(
    item_cd: str,
    columns: Optional[List[str]] = None,
    *,
    use_cache: bool = True,
) -> pd.DataFrame:
    """단일 품목 정보 조회 - 대소문자 무시"""

    logger.debug("[DB] ITEM 단건 조회: %s", item_cd)
    item_cd_upper = item_cd.upper().strip()
    columns_key = _sanitize_columns(columns, ITEM_MASTER_VIEW_COLUMNS)

    cached = False
    fallback_used = False
    result = pd.DataFrame()

    try:
        if use_cache:
            with _item_master_cache_lock:
                before = _fetch_single_item_cached.cache_info()
                df = _fetch_single_item_cached(
                    _cache_versions["item_master"],
                    item_cd_upper,
                    columns_key,
                )
                after = _fetch_single_item_cached.cache_info()
                cached = after.hits > before.hits
        else:
            df = _load_single_item(item_cd_upper, columns_key)

        if df.empty:
            fallback_used = True
            like_query = _build_select_query(
                VIEW_ITEM_MASTER,
                columns_key,
                where_clause="WHERE ITEM_CD LIKE ?",
            )
            df = _run_query(like_query, (f"%{item_cd_upper}%",))
            if not df.empty and len(df) == 1:
                logger.info("[DB] LIKE 검색으로 품목 발견: %s", df["ITEM_CD"].iloc[0])
            cached = False

        result = df.copy()
        if result.empty and _DEMO_MODE:
            demo_df = get_demo_item(item_cd_upper)
            if not demo_df.empty:
                logger.info("[DB] 데모 데이터로 품목 응답: %s", item_cd_upper)
                result = demo_df
                fallback_used = True

    except Exception as exc:
        logger.error("[DB] 품목 조회 오류: %s", exc)
        result = pd.DataFrame()
        cached = False
        fallback_used = True
    finally:
        _record_cache_event(
            "item_master",
            cached=cached and not fallback_used,
            columns=columns_key,
            context={"mode": "single", "item_cd": item_cd_upper},
        )

    return result


def fetch_routing_for_item(
    item_cd: str,
    latest_only: bool = True,
    selection_mode: str = "latest",
    *,
    use_cache: bool = True,
) -> pd.DataFrame:
    """특정 품목의 라우팅 정보 조회 - 대소문자 무시"""

    logger.debug(
        "[DB] ROUTING 조회: %s (latest_only=%s, mode=%s)",
        item_cd,
        latest_only,
        selection_mode,
    )

    item_cd_upper = item_cd.upper().strip()
    columns_key = ROUTING_VIEW_COLUMNS
    cached = False
    result = pd.DataFrame()

    try:
        if latest_only:
            if use_cache:
                with _routing_cache_lock:
                    before = _fetch_latest_routing_cached.cache_info()
                    df = _fetch_latest_routing_cached(
                        _cache_versions["routing"],
                        item_cd_upper,
                        selection_mode,
                        columns_key,
                    )
                    after = _fetch_latest_routing_cached.cache_info()
                    cached = after.hits > before.hits
            else:
                df = _load_latest_routing(item_cd_upper, selection_mode, columns_key)

            if not df.empty:
                proc_seqs = df["PROC_SEQ"].unique()
                logger.info(
                    "[DB] 라우팅 조회 성공: ROUT_NO=%s, %s개 공정",
                    df["ROUT_NO"].iloc[0],
                    len(df),
                )
                logger.debug("[DB] PROC_SEQ 목록: %s", sorted(proc_seqs))

        else:
            df = _load_all_routings(item_cd_upper, columns_key)
            cached = False
            if df.empty:
                logger.warning("[DB] 빈 결과세트 반환 – ITEM_CD: %s", item_cd)
            else:
                rout_counts = df["ROUT_NO"].value_counts()
                logger.info(
                    "[DB] 라우팅 조회 성공: 총 %s개 공정, %s개 ROUT_NO",
                    len(df),
                    len(rout_counts),
                )
                for rout_no, count in rout_counts.items():
                    logger.debug("  - ROUT_NO: %s, 공정 수: %s", rout_no, count)

        result = df.copy()
        if result.empty and _DEMO_MODE:
            demo_df = get_demo_routing(item_cd_upper)
            if not demo_df.empty:
                logger.info("[DB] 데모 데이터 라우팅 사용: %s", item_cd_upper)
                result = demo_df
                cached = False

    except Exception as exc:
        logger.error("[DB] 라우팅 조회 오류: %s", exc)
        result = pd.DataFrame()
        cached = False

    finally:
        _record_cache_event(
            "routing",
            cached=cached,
            columns=columns_key,
            context={
                "item_cd": item_cd_upper,
                "latest_only": latest_only,
                "selection_mode": selection_mode,
            },
        )

    return result


def fetch_work_results_for_item(item_cd: str) -> pd.DataFrame:
    """단일 품목의 작업 결과 조회"""

    item_cd_upper = item_cd.upper().strip()
    query = _build_select_query(
        VIEW_WORK_RESULT,
        WORK_RESULT_VIEW_COLUMNS,
        where_clause="WHERE ITEM_CD = ?",
    )
    logger.debug("[DB] WORK_RESULT 조회: %s", item_cd_upper)
    return _run_query(query, (item_cd_upper,)).copy()

# ════════════════════════════════════════════════
# 7) 🚀 배치 쿼리 API (고속 성능 최적화용)
# ════════════════════════════════════════════════

def fetch_items_batch(item_codes: List[str]) -> Dict[str, pd.DataFrame]:
    """🚀 여러 품목의 마스터 정보를 한 번에 조회 - pandas 경고 억제"""
    if not item_codes:
        return {}

    item_codes = [code.upper() for code in item_codes]
    columns_key = ITEM_MASTER_VIEW_COLUMNS

    batch_size = 100
    all_results = {}

    for i in range(0, len(item_codes), batch_size):
        batch_codes = item_codes[i:i + batch_size]
        placeholders = ','.join('?' * len(batch_codes))

        query = _build_select_query(
            VIEW_ITEM_MASTER,
            columns_key,
            where_clause=f"WHERE ITEM_CD IN ({placeholders})",
        )

        logger.info("[DB] ITEM_MASTER 배치 조회: %s개 품목 (배치 %s)",
                   len(batch_codes), i // batch_size + 1)

        try:
            df = _run_query_optimized(query, batch_codes)
                
            if not df.empty:
                for item_cd in batch_codes:
                    item_data = df[df['ITEM_CD'] == item_cd].copy()
                    all_results[item_cd] = item_data
            else:
                for item_cd in batch_codes:
                    all_results[item_cd] = pd.DataFrame()
                    
        except Exception as exc:
            logger.error("[DB] 품목 배치 쿼리 실패 (배치 %s): %s", i // batch_size + 1, exc)
            for item_cd in batch_codes:
                all_results[item_cd] = pd.DataFrame()
    
    found_count = len([k for k, v in all_results.items() if not v.empty])
    logger.info("[DB] 품목 배치 조회 완료: %s개 요청, %s개 발견", 
               len(item_codes), found_count)
    
    return all_results

def fetch_routings_for_items(item_codes: List[str], latest_only: bool = True) -> Dict[str, pd.DataFrame]:
    """🚀 여러 품목의 라우팅 데이터를 한 번에 조회"""
    if not item_codes:
        return {}

    item_codes = [code.upper() for code in item_codes]
    columns_key = ROUTING_VIEW_COLUMNS

    if latest_only:
        # 개별 조회 방식 (최신 ROUT_NO 로직이 복잡하므로)
        all_results = {}

        for item_cd in item_codes:
            try:
                routing_df = fetch_routing_for_item(item_cd, latest_only=True)
                all_results[item_cd] = routing_df
            except Exception as e:
                logger.error(f"[DB] {item_cd} 라우팅 조회 실패: {e}")
                all_results[item_cd] = pd.DataFrame()
        
        found_count = len([k for k, v in all_results.items() if not v.empty])
        logger.info(f"[DB] 라우팅 개별 조회 완료 (latest_only): {len(item_codes)}개 요청, {found_count}개 발견")
        
        return all_results
    
    # 모든 라우팅 조회는 배치 처리
    batch_size = 100
    all_results = {}
    
    for i in range(0, len(item_codes), batch_size):
        batch_codes = item_codes[i:i + batch_size]
        placeholders = ','.join('?' * len(batch_codes))

        query = _build_select_query(
            VIEW_ROUTING,
            columns_key,
            where_clause=f"WHERE ITEM_CD IN ({placeholders})",
            order_clause="ORDER BY ITEM_CD, ROUT_NO, PROC_SEQ",
        )

        logger.debug("[DB] ROUTING 배치 조회: %s개 품목 (배치 %s)",
                    len(batch_codes), i // batch_size + 1)

        try:
            df = _run_query_optimized(query, batch_codes)
                
            if not df.empty:
                for item_cd in batch_codes:
                    item_routing = df[df['ITEM_CD'] == item_cd].copy()
                    if not item_routing.empty:
                        rout_counts = item_routing['ROUT_NO'].value_counts()
                        if len(rout_counts) > 1:
                            logger.debug(f"[DB] {item_cd}: {len(rout_counts)}개 ROUT_NO 발견")
                    all_results[item_cd] = item_routing
            else:
                for item_cd in batch_codes:
                    all_results[item_cd] = pd.DataFrame()
                    
        except Exception as exc:
            logger.error("[DB] 라우팅 배치 쿼리 실패 (배치 %s): %s", i // batch_size + 1, exc)
            for item_cd in batch_codes:
                all_results[item_cd] = pd.DataFrame()
    
    found_count = len([k for k, v in all_results.items() if not v.empty])
    logger.info("[DB] 라우팅 배치 조회 완료: %s개 요청, %s개 발견", 
               len(item_codes), found_count)
    
    return all_results

def fetch_work_results_batch(item_codes: List[str]) -> Dict[str, pd.DataFrame]:
    """🚀 여러 품목의 작업 결과 데이터를 한 번에 조회"""
    if not item_codes:
        return {}

    item_codes = [code.upper() for code in item_codes]
    columns_key = WORK_RESULT_VIEW_COLUMNS

    # Access DB의 IN 절 제한을 고려한 배치 처리
    batch_size = 100
    all_results = {}

    for i in range(0, len(item_codes), batch_size):
        batch_codes = item_codes[i:i + batch_size]
        placeholders = ','.join('?' * len(batch_codes))

        query = _build_select_query(
            VIEW_WORK_RESULT,
            columns_key,
            where_clause=f"WHERE ITEM_CD IN ({placeholders})",
        )
        
        logger.debug("[DB] WORK_RESULT 배치 조회: %s개 품목 (배치 %s)", 
                    len(batch_codes), i // batch_size + 1)
        
        try:
            df = _run_query_optimized(query, batch_codes)
                
            if not df.empty:
                # 품목별로 DataFrame 분리
                for item_cd in batch_codes:
                    item_results = df[df['ITEM_CD'] == item_cd].copy()
                    all_results[item_cd] = item_results
            else:
                # 빈 결과인 경우에도 품목별로 빈 DataFrame 생성
                for item_cd in batch_codes:
                    all_results[item_cd] = pd.DataFrame()
                    
        except Exception as exc:
            logger.error("[DB] 작업결과 배치 쿼리 실패 (배치 %s): %s", i // batch_size + 1, exc)
            # 실패한 배치의 품목들은 빈 DataFrame으로 처리
            for item_cd in batch_codes:
                all_results[item_cd] = pd.DataFrame()
    
    found_count = len([k for k, v in all_results.items() if not v.empty])
    logger.info("[DB] 작업결과 배치 조회 완료: %s개 요청, %s개 발견", 
               len(item_codes), found_count)
    
    return all_results

# ════════════════════════════════════════════════
# 8) 💡 고급 배치 조회 (필요시 사용)
# ════════════════════════════════════════════════

def fetch_all_data_batch(item_codes: List[str], latest_routing_only: bool = True) -> Dict[str, Dict[str, pd.DataFrame]]:
    """
    🚀 모든 관련 데이터를 한 번에 조회 - 최고 성능 최적화
    
    Args:
        item_codes: 품목 코드 리스트
        latest_routing_only: True일 경우 각 품목의 최신 라우팅만 포함 (기본값 True)
    
    Returns:
        Dict[str, Dict[str, pd.DataFrame]]: 품목별 모든 데이터
    """
    if not item_codes:
        return {}
    
    logger.info("[DB] 전체 데이터 배치 조회 시작: %s개 품목", len(item_codes))
    
    # 병렬로 모든 데이터 조회
    items_data = fetch_items_batch(item_codes)
    routings_data = fetch_routings_for_items(item_codes, latest_only=latest_routing_only)
    work_results_data = fetch_work_results_batch(item_codes)
    
    # 품목별로 모든 데이터 통합
    result = {}
    for item_cd in item_codes:
        item_cd_upper = item_cd.upper()
        result[item_cd_upper] = {
            'item_master': items_data.get(item_cd_upper, pd.DataFrame()),
            'routing': routings_data.get(item_cd_upper, pd.DataFrame()),
            'work_results': work_results_data.get(item_cd_upper, pd.DataFrame())
        }
    
    logger.info("[DB] 전체 데이터 배치 조회 완료: %s개 품목", len(item_codes))
    return result

# ════════════════════════════════════════════════
# 9) 🔧 연결 테스트 및 유틸리티
# ════════════════════════════════════════════════

def test_connection() -> bool:
    """데이터베이스 연결 테스트"""
    try:
        with _connect() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT TOP 1 ITEM_CD FROM " + VIEW_ITEM_MASTER)
            result = cursor.fetchone()
            logger.info("[DB] 연결 테스트 성공: %s", result[0] if result else "데이터 없음")
            return True
    except Exception as exc:
        logger.error("[DB] 연결 테스트 실패: %s", exc)
        return False

def get_database_info() -> Dict[str, Any]:
    """데이터베이스 정보 조회"""
    try:
        with _connect() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT @@SERVERNAME")
            server_name = cursor.fetchone()[0] if cursor.description else MSSQL_CONFIG["server"]

            cursor.execute("SELECT DB_NAME()")
            database_name = cursor.fetchone()[0] if cursor.description else MSSQL_CONFIG["database"]

            cursor.execute(
                """
                SELECT
                    CAST(SUM(size) * 8.0 / 1024 AS DECIMAL(18,2)) AS size_mb
                FROM sys.database_files
                """
            )
            size_row = cursor.fetchone()
            database_size_mb = float(size_row[0]) if size_row and size_row[0] is not None else 0.0

            tables_info: Dict[str, Any] = {}
            for view_name in [VIEW_ITEM_MASTER, VIEW_ROUTING, VIEW_WORK_RESULT]:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {view_name}")
                    count_row = cursor.fetchone()
                    tables_info[view_name] = int(count_row[0]) if count_row else 0
                except Exception as e:
                    tables_info[view_name] = f"조회 실패: {e}"

            return {
                "connection_status": "정상",
                "server": server_name,
                "database": database_name,
                "database_size_mb": float(database_size_mb),
                "tables_info": tables_info,
            }
    except Exception as exc:
        logger.error("[DB] 데이터베이스 정보 조회 실패: %s", exc)
        return {
            "connection_status": f"오류: {exc}",
            "server": MSSQL_CONFIG["server"],
            "database": MSSQL_CONFIG["database"],
            "database_size_mb": 0.0,
            "tables_info": {},
        }


def _split_table_identifier(identifier: str) -> Tuple[str, str]:
    """`schema.table` 형식의 식별자를 분리한다."""
    if not identifier:
        return "dbo", ""

    token = identifier.strip().strip("[]")
    if "." in token:
        schema, table = token.split(".", 1)
    else:
        schema, table = "dbo", token

    return schema.strip("[]"), table.strip("[]")


def describe_table(table_identifier: str) -> List[Dict[str, Any]]:
    """INFORMATION_SCHEMA 기반으로 컬럼 메타데이터를 조회한다."""

    schema, table = _split_table_identifier(table_identifier)
    query = """
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
    """

    with _connect() as conn:
        cursor = conn.cursor()
        cursor.execute(query, schema, table)
        rows = cursor.fetchall()

    if not rows:
        raise ValueError(f"No metadata returned for table '{schema}.{table}'")

    columns: List[Dict[str, Any]] = []
    for row in rows:
        column_name = getattr(row, "COLUMN_NAME", None) or row[0]
        data_type = getattr(row, "DATA_TYPE", None) or row[1]
        nullable_raw = getattr(row, "IS_NULLABLE", None) or row[2]
        if isinstance(nullable_raw, str):
            nullable = nullable_raw.strip().upper() in {"YES", "Y", "TRUE", "1"}
        else:
            nullable = bool(nullable_raw)
        columns.append(
            {
                "name": str(column_name),
                "type": str(data_type),
                "nullable": nullable,
            }
        )
    return columns


def list_tables(*, schema: Optional[str] = None) -> List[str]:
    """MSSQL 테이블/뷰 목록을 반환한다."""

    query = """
        SELECT TABLE_SCHEMA, TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW')
    """
    params: List[str] = []
    if schema:
        query += " AND TABLE_SCHEMA = ?"
        params.append(schema)
    query += " ORDER BY TABLE_SCHEMA, TABLE_NAME"

    with _connect() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()

    tables = [f"{getattr(row, 'TABLE_SCHEMA', row[0])}.{getattr(row, 'TABLE_NAME', row[1])}" for row in rows]
    return tables


# ════════════════════════════════════════════════
# 10) 추가 함수들
# ════════════════════════════════════════════════

def check_item_has_routing(item_cd: str) -> bool:
    """품목의 라우팅 존재 여부 확인 - 대소문자 무시"""
    item_cd_upper = item_cd.upper().strip()
    
    query = f"""
        SELECT COUNT(*) as cnt
        FROM {VIEW_ROUTING}
        WHERE ITEM_CD = ?
    """
    
    try:
        result = _run_query(query, [item_cd_upper])

        return result['cnt'].iloc[0] > 0 if not result.empty else False

    except Exception as e:
        logger.error(f"[DB] 라우팅 존재 확인 오류: {str(e)}")
        return has_demo_routing(item_cd_upper) if _DEMO_MODE else False

    if _DEMO_MODE and has_demo_routing(item_cd_upper):
        return True

def fetch_item_info_only(item_cd: str) -> pd.DataFrame:
    """
    품목 정보만 조회 (라우팅 없이)

    Args:
        item_cd: 품목 코드

    Returns:
        pd.DataFrame: 품목 정보
    """
    return fetch_single_item(item_cd, use_cache=True)

def fetch_routing_statistics(latest_only: bool = True) -> pd.DataFrame:
    """
    라우팅 통계 정보 조회 (품목별 공정 수, 평균 시간 등)
    
    Args:
        latest_only: True일 경우 각 품목의 최신 ROUT_NO만 사용 (기본값 True)
    
    Returns:
        pd.DataFrame: 통계 정보
    """
    if latest_only:
        # 최신 ROUT_NO만 사용한 통계
        query = f"""
        WITH LatestRouting AS (
            SELECT r1.*
            FROM {VIEW_ROUTING} r1
            INNER JOIN (
                SELECT ITEM_CD, MAX(INSRT_DT) as MAX_DT
                FROM {VIEW_ROUTING}
                GROUP BY ITEM_CD
            ) r2 ON r1.ITEM_CD = r2.ITEM_CD AND r1.INSRT_DT = r2.MAX_DT
        )
        SELECT 
            ITEM_CD,
            ROUT_NO,
            COUNT(DISTINCT PROC_SEQ) as PROCESS_COUNT,
            SUM(SETUP_TIME + RUN_TIME) as TOTAL_TIME,
            AVG(SETUP_TIME + RUN_TIME) as AVG_TIME_PER_PROCESS,
            MAX(PROC_SEQ) as MAX_PROC_SEQ
        FROM LatestRouting
        GROUP BY ITEM_CD, ROUT_NO
        """
    else:
        # 모든 ROUT_NO 포함 통계
        query = f"""
        SELECT 
            ITEM_CD,
            COUNT(DISTINCT ROUT_NO) as ROUT_NO_COUNT,
            COUNT(DISTINCT PROC_SEQ) as PROCESS_COUNT,
            SUM(SETUP_TIME + RUN_TIME) as TOTAL_TIME,
            AVG(SETUP_TIME + RUN_TIME) as AVG_TIME_PER_PROCESS,
            MAX(PROC_SEQ) as MAX_PROC_SEQ
        FROM {VIEW_ROUTING}
        GROUP BY ITEM_CD
        """
    
    return _run_query(query)

def get_distinct_rout_nos(item_cd: str) -> List[str]:
    """
    특정 품목의 모든 ROUT_NO 목록 조회
    
    Args:
        item_cd: 품목 코드
        
    Returns:
        List[str]: ROUT_NO 목록 (최신순)
    """
    query = f"""
        SELECT DISTINCT ROUT_NO, MAX(INSRT_DT) as LATEST_DT
        FROM {VIEW_ROUTING}
        WHERE ITEM_CD = ?
        GROUP BY ROUT_NO
        ORDER BY MAX(INSRT_DT) DESC
    """
    
    try:
        df = _run_query(query, [item_cd.upper()])
        return df['ROUT_NO'].tolist() if not df.empty else []
    except Exception as e:
        logger.error(f"[DB] ROUT_NO 목록 조회 오류: {str(e)}")
        return []

def fetch_routing_by_rout_no(item_cd: str, rout_no: str) -> pd.DataFrame:
    """
    특정 ROUT_NO의 라우팅 정보 조회

    Args:
        item_cd: 품목 코드
        rout_no: 라우팅 번호

    Returns:
        pd.DataFrame: 라우팅 정보
    """
    logger.debug("[DB] 특정 ROUT_NO 라우팅 조회: %s, %s", item_cd, rout_no)
    return _load_routing_by_rout_no(
        item_cd.upper().strip(),
        rout_no,
        ROUTING_VIEW_COLUMNS,
    ).copy()


def fetch_purchase_order_items() -> pd.DataFrame:
    """
    발주 품목 목록 조회 (BI_PUR_PO_VIEW)

    Returns:
        pd.DataFrame: 발주 품목 목록 (ITEM_CD, PO_NO, PO_DATE, QTY 등)
    """
    if VIEW_PURCHASE_ORDER is None:
        logger.warning("[DB] BI_PUR_PO_VIEW는 MSSQL 모드에서만 사용 가능합니다 - 데모 데이터 반환")
        # 데모 모드: 생산 접수된 품목 샘플 반환
        from datetime import datetime, timedelta
        demo_items = []
        base_date = datetime.now() - timedelta(days=7)

        for i, item_cd in enumerate(['ITEM-001', 'ITEM-002', 'ITEM-003', 'ITEM-004', 'ITEM-005']):
            demo_items.append({
                'ITEM_CD': item_cd,
                'PO_NO': f'PO-2024-{1000+i:04d}',
                'PO_DATE': (base_date + timedelta(days=i)).strftime('%Y-%m-%d'),
                'QTY': (i + 1) * 100,
                'UNIT_PRICE': 50000 + (i * 10000),
                'VENDOR_CD': f'V{i+1:03d}',
                'VENDOR_NM': f'공급업체{i+1}'
            })

        return pd.DataFrame(demo_items)

    query = f"""
        SELECT DISTINCT
            ITEM_CD,
            PO_NO,
            PO_DATE,
            QTY,
            UNIT_PRICE,
            VENDOR_CD,
            VENDOR_NM
        FROM {VIEW_PURCHASE_ORDER}
        WHERE ITEM_CD IS NOT NULL
        ORDER BY PO_DATE DESC
    """

    try:
        logger.info("[DB] 발주 품목 목록 조회 중...")
        return _run_query(query, ())
    except Exception as e:
        logger.error(f"[DB] 발주 품목 조회 오류: {str(e)}")
        return pd.DataFrame()


def fetch_item_with_purchase_info(item_cd: str) -> pd.DataFrame:
    """
    품목 정보 + 발주 정보 조회

    Args:
        item_cd: 품목 코드

    Returns:
        pd.DataFrame: 품목 정보와 발주 정보가 결합된 데이터
    """
    item_cd_upper = item_cd.upper().strip()

    # 품목 기본 정보
    item_info = fetch_single_item(item_cd_upper)

    if VIEW_PURCHASE_ORDER is None or item_info.empty:
        return item_info

    # 발주 정보
    query = f"""
        SELECT
            PO_NO,
            PO_DATE,
            QTY,
            UNIT_PRICE,
            VENDOR_CD,
            VENDOR_NM
        FROM {VIEW_PURCHASE_ORDER}
        WHERE ITEM_CD = ?
        ORDER BY PO_DATE DESC
    """

    try:
        po_info = _run_query(query, (item_cd_upper,))
        if not po_info.empty:
            # 가장 최근 발주 정보를 품목 정보에 추가
            latest_po = po_info.iloc[0]
            for col in po_info.columns:
                item_info[f'LATEST_{col}'] = latest_po[col]
            item_info['PO_COUNT'] = len(po_info)
    except Exception as e:
        logger.warning(f"[DB] 발주 정보 조회 실패: {e}")

    return item_info


def invalidate_item_master_cache(tag: Optional[str] = None) -> str:
    """품목 마스터 캐시 무효화 및 버전 갱신."""

    new_version = _next_version("item_master", tag)
    _fetch_item_master_cached.cache_clear()
    _fetch_single_item_cached.cache_clear()
    _cache_stats["item_master"].reset()
    with _cache_lock:
        _last_cache_fetch["item_master"] = {
            "cached": False,
            "columns": list(ITEM_MASTER_VIEW_COLUMNS),
            "context": {"action": "invalidate"},
            "timestamp": _snapshot_time(),
            "version": new_version,
        }
    return new_version


def invalidate_routing_cache(tag: Optional[str] = None) -> str:
    """라우팅 캐시 무효화 및 버전 갱신."""

    new_version = _next_version("routing", tag)
    _fetch_latest_routing_cached.cache_clear()
    _cache_stats["routing"].reset()
    with _cache_lock:
        _last_cache_fetch["routing"] = {
            "cached": False,
            "columns": list(ROUTING_VIEW_COLUMNS),
            "context": {"action": "invalidate"},
            "timestamp": _snapshot_time(),
            "version": new_version,
        }
    return new_version


def get_cache_versions() -> Dict[str, str]:
    """현재 캐시 버전 태그 스냅샷."""

    with _cache_lock:
        return dict(_cache_versions)


def get_cache_snapshot() -> Dict[str, Any]:
    """캐시 적중률 및 최근 조회 메타데이터 스냅샷."""

    snapshot: Dict[str, Any] = {}
    with _cache_lock:
        for dataset in ("item_master", "routing"):
            stats = _cache_stats[dataset].snapshot()
            last_fetch = dict(_last_cache_fetch.get(dataset) or {})
            snapshot[dataset] = {
                "version": _cache_versions.get(dataset),
                "stats": stats,
                "last_fetch": last_fetch or None,
            }
    return snapshot

# ════════════════════════════════════════════════
# 11) 정리 함수
# ════════════════════════════════════════════════

def cleanup_connections():
    """연결 풀 정리"""
    try:
        with _connection_pool.lock:
            for conn in _connection_pool.connections:
                try:
                    conn.close()
                except Exception:
                    pass
            _connection_pool.connections.clear()
        logger.info("데이터베이스 연결 풀 정리 완료")
    except Exception as e:
        logger.warning(f"연결 풀 정리 중 오류: {e}")

# 모듈 종료 시 자동 정리
atexit.register(cleanup_connections)

# ════════════════════════════════════════════════
# 12) FastAPI 의존성 함수
# ════════════════════════════════════════════════

def get_db_connection():
    """
    FastAPI 의존성으로 사용할 데이터베이스 연결 제공 (pyodbc).

    Yields:
        pyodbc.Connection: 데이터베이스 연결

    Example:
        @app.get("/items")
        def get_items(conn = Depends(get_db_connection)):
            df = pd.read_sql("SELECT * FROM ITEM_MASTER", conn)
            return df.to_dict('records')
    """
    with _connection_pool.get_connection() as conn:
        yield conn


def get_session():
    """
    FastAPI 의존성으로 사용할 SQLAlchemy Session 제공.

    RSL 데이터베이스의 session factory를 사용합니다.

    Yields:
        sqlalchemy.orm.Session: SQLAlchemy 세션

    Example:
        @app.get("/data-quality/metrics")
        async def get_metrics(session: Session = Depends(get_session)):
            return await data_quality_service.get_metrics(session)
    """
    from backend.database_rsl import get_session_factory

    session_factory = get_session_factory()
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
