from __future__ import annotations

import atexit
import time
from pathlib import Path
import threading
from contextlib import contextmanager
import warnings
from typing import Any, Dict, List, Sequence

import pandas as pd
import pyodbc

from common.logger import get_logger

logger = get_logger("database")

# ════════════════════════════════════════════════
# 0) 경로 · 뷰 상수 (먼저 정의)
# ════════════════════════════════════════════════
BASE_DIR   = Path(__file__).resolve().parents[1]     # e.g., machine/
ACCESS_DIR = BASE_DIR / "routing_data"               # Access DB 폴더

VIEW_ITEM_MASTER = "dbo_BI_ITEM_INFO_VIEW"
VIEW_ROUTING     = "dbo_BI_ROUTING_VIEW"
VIEW_WORK_RESULT = "dbo_BI_WORK_ORDER_RESULTS"

# ════════════════════════════════════════════════
# 1) "가장 최근 Access DB" 경로 계산
# ════════════════════════════════════════════════
def _latest_db(path: Path | str) -> Path:
    """<routing_data> 안에서 최신 *.accdb / *.mdb 파일 반환"""
    p = Path(path).expanduser()
    if not p.exists():
        raise FileNotFoundError(f"폴더가 존재하지 않습니다 ➔ {p}")
    files = sorted(
        list(p.glob("*.accdb")) + list(p.glob("*.mdb")),
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )
    if not files:
        raise FileNotFoundError(f"*.accdb / *.mdb 파일을 찾지 못했습니다 ➔ {p}")
    latest = files[0]
    logger.debug("[DB] 최신 Access 선택: %s", latest.name)
    return latest

# ════════════════════════════════════════════════
# 2) 기본 연결 함수
# ════════════════════════════════════════════════
def _create_connection() -> pyodbc.Connection:
    """새로운 데이터베이스 연결 생성"""
    db_path = _latest_db(ACCESS_DIR)
    conn_str = (
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        fr"DBQ={db_path}"
    )
    try:
        return pyodbc.connect(conn_str, timeout=10)
    except pyodbc.Error as exc:
        raise ConnectionError(f"Access DB 연결 실패: {exc}") from exc

def _connect() -> pyodbc.Connection:
    """가장 최신 Access DB에 연결 (기존 호환성)"""
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
    
    # 2. Access 드라이버 확인
    try:
        drivers = pyodbc.drivers()
        access_drivers = [d for d in drivers if 'Access' in d]
        if not access_drivers:
            issues.append("Microsoft Access ODBC 드라이버를 찾을 수 없습니다")
        else:
            logger.info(f"발견된 Access 드라이버: {access_drivers}")
    except Exception as e:
        issues.append(f"ODBC 드라이버 확인 실패: {e}")
    
    # 3. 데이터베이스 경로 확인
    try:
        db_path = _latest_db(ACCESS_DIR)
        if not db_path.exists():
            issues.append(f"데이터베이스 파일 없음: {db_path}")
        else:
            logger.info(f"데이터베이스 파일 확인: {db_path}")
    except Exception as e:
        issues.append(f"데이터베이스 경로 확인 실패: {e}")
    
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
def _run_query_optimized(query: str, params: Sequence[Any] | None = None, retries: int = 3, delay: float = 2.0) -> pd.DataFrame:
    """최적화된 쿼리 실행 (연결 풀 사용)"""
    for attempt in range(1, retries + 1):
        try:
            with _connection_pool.get_connection() as conn:
                with warnings.catch_warnings():
                    warnings.filterwarnings('ignore', message='pandas only supports SQLAlchemy connectable')
                    df = pd.read_sql(query, conn, params=params or [])
            
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
            with _connect() as conn:
                # pandas 경고 억제
                with warnings.catch_warnings():
                    warnings.filterwarnings('ignore', 
                                          message='pandas only supports SQLAlchemy connectable')
                    df = pd.read_sql(query, conn, params=params or [])
            if df.empty:
                logger.warning("[DB] 빈 결과세트 반환 – %s", query[:80])
            return df
        except Exception as exc:
            if attempt < retries:
                logger.warning(f"[DB] 쿼리 재시도 {attempt}/{retries}: {exc}")
                time.sleep(delay)
                continue
            raise RuntimeError(f"[DB] 쿼리 실패: {exc}") from exc

# ════════════════════════════════════════════════
# 6) 공개 API - 단일 조회 (필수 함수들)
# ════════════════════════════════════════════════
def fetch_item_master(columns: list[str] | None = None) -> pd.DataFrame:
    """전체 품목 마스터 조회"""
    col_clause = ", ".join(columns) if columns else "*"
    query = f"SELECT {col_clause} FROM {VIEW_ITEM_MASTER}"
    logger.info("[DB] ITEM_MASTER 조회…")
    return _run_query(query)

def fetch_single_item(item_cd: str) -> pd.DataFrame:
    """단일 품목 정보 조회 - 대소문자 무시"""
    logger.debug(f"[DB] ITEM 단건 조회: {item_cd}")
    
    # 대문자로 통일하여 조회
    item_cd_upper = item_cd.upper().strip()
    
    query = f"""
        SELECT *
        FROM {VIEW_ITEM_MASTER}
        WHERE ITEM_CD = ?
    """
    
    try:
        df = _run_query(query, [item_cd_upper])
        
        if df.empty:
            # LIKE 검색으로 재시도
            query_like = f"""
                SELECT *
                FROM {VIEW_ITEM_MASTER}
                WHERE ITEM_CD LIKE ?
            """
            df = _run_query(query_like, [f'%{item_cd_upper}%'])
            
            if not df.empty and len(df) == 1:
                logger.info(f"[DB] LIKE 검색으로 품목 발견: {df['ITEM_CD'].iloc[0]}")
                
        return df
        
    except Exception as e:
        logger.error(f"[DB] 품목 조회 오류: {str(e)}")
        return pd.DataFrame()

def fetch_routing_for_item(item_cd: str, latest_only: bool = True, selection_mode: str = "latest") -> pd.DataFrame:
    """
    특정 품목의 라우팅 정보 조회 - 대소문자 무시
    
    Args:
        item_cd: 품목 코드
        latest_only: True일 경우 하나의 ROUT_NO만 반환 (기본값 True)
        selection_mode: "latest" (최신) 또는 "most_used" (최다 사용)
    
    Returns:
        pd.DataFrame: 라우팅 정보
    """
    logger.debug(f"[DB] ROUTING 조회: {item_cd} (latest_only={latest_only}, mode={selection_mode})")
    
    # 대문자로 통일하여 조회
    item_cd_upper = item_cd.upper().strip()
    
    if latest_only:
        try:
            if selection_mode == "most_used":
                # 가장 많이 사용된 ROUT_NO 찾기
                count_query = f"""
                    SELECT ROUT_NO, COUNT(*) as PROC_COUNT
                    FROM {VIEW_ROUTING}
                    WHERE ITEM_CD = ?
                    GROUP BY ROUT_NO
                    ORDER BY COUNT(*) DESC, ROUT_NO DESC
                """
                
                count_df = _run_query(count_query, [item_cd_upper])
                
                if count_df.empty:
                    logger.warning(f"[DB] ROUT_NO를 찾을 수 없음 – ITEM_CD: {item_cd}")
                    return pd.DataFrame()
                
                # 가장 많은 공정을 가진 ROUT_NO 선택
                most_used_rout_no = count_df.iloc[0]['ROUT_NO']
                
                logger.info(f"[DB] 최다 공정 ROUT_NO 선택: {most_used_rout_no} ({count_df.iloc[0]['PROC_COUNT']}개 공정)")
                
                # 디버깅: 모든 ROUT_NO와 공정 수 출력
                logger.debug(f"[DB] {item_cd}의 ROUT_NO별 공정 수:")
                for idx, row in count_df.iterrows():
                    logger.debug(f"  - ROUT_NO: {row['ROUT_NO']}, 공정 수: {row['PROC_COUNT']}")
                
                # 해당 ROUT_NO의 모든 공정 조회
                query = f"""
                    SELECT *
                    FROM {VIEW_ROUTING}
                    WHERE ITEM_CD = ? AND ROUT_NO = ?
                    ORDER BY PROC_SEQ
                """
                
                df = _run_query(query, [item_cd_upper, most_used_rout_no])
                
            else:  # latest 모드 (기존 로직)
                # 먼저 해당 품목의 모든 라우팅 정보를 가져옴
                all_routing_query = f"""
                    SELECT DISTINCT ROUT_NO, INSRT_DT
                    FROM {VIEW_ROUTING}
                    WHERE ITEM_CD = ?
                    ORDER BY INSRT_DT DESC, ROUT_NO DESC
                """
                
                rout_df = _run_query(all_routing_query, [item_cd_upper])
                
                if rout_df.empty:
                    logger.warning(f"[DB] ROUT_NO를 찾을 수 없음 – ITEM_CD: {item_cd}")
                    return pd.DataFrame()
                
                # Python에서 최신 ROUT_NO 선택
                if 'INSRT_DT' in rout_df.columns:
                    try:
                        # INSRT_DT로 정렬 시도
                        rout_df['INSRT_DT_SAFE'] = pd.to_datetime(rout_df['INSRT_DT'], errors='coerce')
                        rout_df_sorted = rout_df.sort_values(['INSRT_DT_SAFE', 'ROUT_NO'], 
                                                            ascending=[False, False], 
                                                            na_position='last')
                        latest_rout_no = rout_df_sorted.iloc[0]['ROUT_NO']
                        
                        # 디버깅: 모든 ROUT_NO 출력
                        logger.debug(f"[DB] {item_cd}의 ROUT_NO 목록 (최신순):")
                        for idx, row in rout_df_sorted.iterrows():
                            date_str = row['INSRT_DT'] if pd.notna(row['INSRT_DT']) else 'N/A'
                            logger.debug(f"  - ROUT_NO: {row['ROUT_NO']}, INSRT_DT: {date_str}")
                            
                    except Exception as e:
                        logger.warning(f"[DB] INSRT_DT 정렬 실패, ROUT_NO로만 정렬: {e}")
                        # ROUT_NO로만 정렬 (알파벳/숫자 내림차순)
                        latest_rout_no = rout_df.sort_values('ROUT_NO', ascending=False).iloc[0]['ROUT_NO']
                else:
                    # INSRT_DT 컬럼이 없으면 ROUT_NO로만 정렬
                    latest_rout_no = rout_df.sort_values('ROUT_NO', ascending=False).iloc[0]['ROUT_NO']
                
                logger.info(f"[DB] 최신 ROUT_NO 선택: {latest_rout_no}")
                
                # 해당 ROUT_NO의 모든 공정 조회
                query = f"""
                    SELECT *
                    FROM {VIEW_ROUTING}
                    WHERE ITEM_CD = ? AND ROUT_NO = ?
                    ORDER BY PROC_SEQ
                """
                
                df = _run_query(query, [item_cd_upper, latest_rout_no])
            
            if not df.empty:
                # PROC_SEQ 확인
                proc_seqs = df['PROC_SEQ'].unique()
                logger.info(f"[DB] 라우팅 조회 성공: ROUT_NO={df['ROUT_NO'].iloc[0]}, {len(df)}개 공정")
                logger.debug(f"[DB] PROC_SEQ 목록: {sorted(proc_seqs)}")
            
            return df
            
        except Exception as e:
            logger.error(f"[DB] 라우팅 조회 오류: {str(e)}")
            return pd.DataFrame()
    
    else:
        # 기존 로직: 모든 라우팅 조회
        query = f"""
            SELECT *
            FROM {VIEW_ROUTING}
            WHERE ITEM_CD = ?
            ORDER BY ROUT_NO, PROC_SEQ
        """
        
        try:
            df = _run_query(query, [item_cd_upper])
            
            if df.empty:
                logger.warning(f"[DB] 빈 결과세트 반환 – ITEM_CD: {item_cd}")
            else:
                # ROUT_NO별 통계 로깅
                rout_counts = df['ROUT_NO'].value_counts()
                logger.info(f"[DB] 라우팅 조회 성공: 총 {len(df)}개 공정, {len(rout_counts)}개 ROUT_NO")
                for rout_no, count in rout_counts.items():
                    logger.debug(f"  - ROUT_NO: {rout_no}, 공정 수: {count}")
                
        except Exception as e:
            logger.error(f"[DB] 라우팅 조회 오류: {str(e)}")
            return pd.DataFrame()
    
    return df

def fetch_work_results_for_item(item_cd: str) -> pd.DataFrame:
    """단일 품목의 작업 결과 조회"""
    query = f"SELECT * FROM {VIEW_WORK_RESULT} WHERE ITEM_CD = ?"
    logger.debug("[DB] WORK_RESULT 조회: %s", item_cd)
    return _run_query(query, [item_cd.upper()])  # 대문자 변환 추가

# ════════════════════════════════════════════════
# 7) 🚀 배치 쿼리 API (고속 성능 최적화용)
# ════════════════════════════════════════════════

def fetch_items_batch(item_codes: List[str]) -> Dict[str, pd.DataFrame]:
    """🚀 여러 품목의 마스터 정보를 한 번에 조회 - pandas 경고 억제"""
    if not item_codes:
        return {}
    
    item_codes = [code.upper() for code in item_codes]
    
    batch_size = 100
    all_results = {}
    
    for i in range(0, len(item_codes), batch_size):
        batch_codes = item_codes[i:i + batch_size]
        placeholders = ','.join('?' * len(batch_codes))
        
        query = f'''
            SELECT *
            FROM {VIEW_ITEM_MASTER}
            WHERE ITEM_CD IN ({placeholders})
        '''
        
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
        
        query = f'''
            SELECT *
            FROM {VIEW_ROUTING}
            WHERE ITEM_CD IN ({placeholders})
            ORDER BY ITEM_CD, ROUT_NO, PROC_SEQ
        '''
        
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
    
    # Access DB의 IN 절 제한을 고려한 배치 처리
    batch_size = 100
    all_results = {}
    
    for i in range(0, len(item_codes), batch_size):
        batch_codes = item_codes[i:i + batch_size]
        placeholders = ','.join('?' * len(batch_codes))
        
        query = f'''
            SELECT *
            FROM {VIEW_WORK_RESULT}
            WHERE ITEM_CD IN ({placeholders})
        '''
        
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
        db_path = _latest_db(ACCESS_DIR)
        with _connect() as conn:
            cursor = conn.cursor()
            
            # 테이블 정보 조회
            tables_info = {}
            for view_name in [VIEW_ITEM_MASTER, VIEW_ROUTING, VIEW_WORK_RESULT]:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {view_name}")
                    count = cursor.fetchone()[0]
                    tables_info[view_name] = count
                except Exception as e:
                    tables_info[view_name] = f"조회 실패: {e}"
            
            return {
                'database_path': str(db_path),
                'database_size_mb': round(db_path.stat().st_size / 1024 / 1024, 2),
                'tables_info': tables_info,
                'connection_status': '정상'
            }
    except Exception as exc:
        logger.error("[DB] 데이터베이스 정보 조회 실패: %s", exc)
        return {
            'connection_status': f'오류: {exc}',
            'database_path': '알 수 없음',
            'database_size_mb': 0,
            'tables_info': {}
        }

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
        return False
    
def fetch_item_info_only(item_cd: str) -> pd.DataFrame:
    """
    품목 정보만 조회 (라우팅 없이)
    
    Args:
        item_cd: 품목 코드
        
    Returns:
        pd.DataFrame: 품목 정보
    """
    query = f"""
    SELECT *
    FROM {VIEW_ITEM_MASTER}
    WHERE ITEM_CD = ?
    """
    return _run_query(query, [item_cd.upper()])  # 대문자 변환 추가

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
    query = f"""
        SELECT *
        FROM {VIEW_ROUTING}
        WHERE ITEM_CD = ? AND ROUT_NO = ?
        ORDER BY PROC_SEQ
    """
    
    logger.debug(f"[DB] 특정 ROUT_NO 라우팅 조회: {item_cd}, {rout_no}")
    return _run_query(query, [item_cd.upper(), rout_no])

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
