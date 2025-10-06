#!/usr/bin/env python3
"""
Access DB → PostgreSQL 마이그레이션 ETL 스크립트

Usage:
    python migrate_access_to_postgres.py --table item_master --batch-size 1000
    python migrate_access_to_postgres.py --all --dry-run
"""

from __future__ import annotations

import argparse
import decimal
import json
import logging
import os
import sys
from datetime import datetime, date
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import pyodbc

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.constants import TRAIN_FEATURES

# ============================================================================
# Configuration
# ============================================================================

# Access DB 설정
ACCESS_DB_PATH = Path(__file__).resolve().parents[1] / "routing_data" / "routing.accdb"
ACCESS_DSN = f"DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={ACCESS_DB_PATH};"

# PostgreSQL 설정 (환경 변수 사용)
PG_CONFIG = {
    "host": os.getenv("PG_HOST", "localhost"),
    "port": int(os.getenv("PG_PORT", "5432")),
    "database": os.getenv("PG_DATABASE", "routing_ml"),
    "user": os.getenv("PG_USER", "postgres"),
    "password": os.getenv("PG_PASSWORD", "password"),
}

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(f"migration_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

# ============================================================================
# Data Type Conversion
# ============================================================================


def convert_access_to_postgres(value: Any, pg_type: str) -> Optional[Any]:
    """Access 값을 PostgreSQL 타입으로 변환"""

    # NULL 처리
    if value is None or (isinstance(value, str) and value.strip() == ""):
        return None

    try:
        # VARCHAR, TEXT, CHAR
        if pg_type.startswith("VARCHAR") or pg_type == "TEXT" or pg_type.startswith("CHAR"):
            return str(value).strip()

        # INTEGER, BIGINT, SMALLINT
        if pg_type in ("INTEGER", "BIGINT", "SMALLINT"):
            return int(float(value))  # Handle "123.0" → 123

        # NUMERIC, DECIMAL
        if pg_type.startswith("NUMERIC") or pg_type.startswith("DECIMAL"):
            return decimal.Decimal(str(value))

        # REAL, DOUBLE PRECISION
        if pg_type in ("REAL", "DOUBLE PRECISION"):
            return float(value)

        # BOOLEAN
        if pg_type == "BOOLEAN":
            if value in ("Yes", "TRUE", "True", True, -1, 1):
                return True
            elif value in ("No", "FALSE", "False", False, 0):
                return False
            return None

        # TIMESTAMP
        if pg_type == "TIMESTAMP":
            if isinstance(value, datetime):
                return value
            if isinstance(value, str):
                value = value.strip("#").strip()
                # Try multiple formats
                for fmt in ["%m/%d/%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
                    try:
                        return datetime.strptime(value, fmt)
                    except ValueError:
                        continue
            return None

        # DATE
        if pg_type == "DATE":
            if isinstance(value, (datetime, date)):
                return value if isinstance(value, date) else value.date()
            if isinstance(value, str):
                value = value.strip("#").strip()
                for fmt in ["%m/%d/%Y", "%Y-%m-%d"]:
                    try:
                        return datetime.strptime(value, fmt).date()
                    except ValueError:
                        continue
            return None

        # JSONB
        if pg_type == "JSONB":
            if isinstance(value, (dict, list)):
                return json.dumps(value)
            if isinstance(value, str):
                # Validate JSON
                json.loads(value)
                return value
            return None

        # UUID
        if pg_type == "UUID":
            return str(value)

    except Exception as e:
        logger.warning(f"Type conversion error: {value} → {pg_type}: {e}")
        return None

    # 기본값
    return value


# ============================================================================
# Database Connections
# ============================================================================


def get_access_connection() -> pyodbc.Connection:
    """Access DB 연결 생성"""
    try:
        conn = pyodbc.connect(ACCESS_DSN)
        logger.info(f"✅ Connected to Access DB: {ACCESS_DB_PATH}")
        return conn
    except Exception as e:
        logger.error(f"❌ Failed to connect to Access DB: {e}")
        raise


def get_postgres_connection() -> psycopg2.extensions.connection:
    """PostgreSQL 연결 생성"""
    try:
        conn = psycopg2.connect(**PG_CONFIG)
        logger.info(f"✅ Connected to PostgreSQL: {PG_CONFIG['database']}")
        return conn
    except Exception as e:
        logger.error(f"❌ Failed to connect to PostgreSQL: {e}")
        raise


# ============================================================================
# Table Mapping
# ============================================================================

# Access VIEW → PostgreSQL Table 매핑
TABLE_MAPPINGS = {
    "item_master": {
        "access_view": "dbo_BI_ITEM_INFO_VIEW",
        "pg_table": "routing.item_master",
        "columns": {
            "ITEM_CD": ("item_cd", "VARCHAR(100)"),
            "PART_TYPE": ("part_type", "VARCHAR(50)"),
            "PartNm": ("part_nm", "VARCHAR(255)"),
            "ITEM_SUFFIX": ("item_suffix", "VARCHAR(50)"),
            "ITEM_SPEC": ("item_spec", "TEXT"),
            "ITEM_NM": ("item_nm", "VARCHAR(500)"),
            "ADDITIONAL_SPEC": ("additional_spec", "TEXT"),
            "ITEM_MATERIAL": ("item_material", "VARCHAR(100)"),
            "MATERIAL_DESC": ("material_desc", "VARCHAR(255)"),
            "ITEM_ACCT": ("item_acct", "VARCHAR(50)"),
            "ITEM_TYPE": ("item_type", "VARCHAR(50)"),
            "ITEM_UNIT": ("item_unit", "VARCHAR(20)"),
            "ITEM_GRP1": ("item_grp1", "VARCHAR(50)"),
            "ITEM_GRP1NM": ("item_grp1nm", "VARCHAR(255)"),
            "ITEM_GRP2": ("item_grp2", "VARCHAR(50)"),
            "ITEM_GRP2NM": ("item_grp2nm", "VARCHAR(255)"),
            "ITEM_GRP3": ("item_grp3", "VARCHAR(50)"),
            "ITEM_GRP3NM": ("item_grp3nm", "VARCHAR(255)"),
            "STANDARD_YN": ("standard_yn", "CHAR(1)"),
            "GROUP1": ("group1", "VARCHAR(100)"),
            "GROUP2": ("group2", "VARCHAR(100)"),
            "GROUP3": ("group3", "VARCHAR(100)"),
            "DRAW_NO": ("draw_no", "VARCHAR(100)"),
            "DRAW_REV": ("draw_rev", "VARCHAR(50)"),
            "DRAW_SHEET_NO": ("draw_sheet_no", "VARCHAR(50)"),
            "DRAW_USE": ("draw_use", "VARCHAR(100)"),
            "ITEM_NM_ENG": ("item_nm_eng", "VARCHAR(500)"),
            "OUTDIAMETER": ("outdiameter", "NUMERIC(18, 4)"),
            "INDIAMETER": ("indiameter", "NUMERIC(18, 4)"),
            "OUTTHICKNESS": ("outthickness", "NUMERIC(18, 4)"),
            "OUTDIAMETER_UNIT": ("outdiameter_unit", "VARCHAR(20)"),
            "ROTATE_CLOCKWISE": ("rotate_clockwise", "INTEGER"),
            "ROTATE_CTRCLOCKWISE": ("rotate_ctrclockwise", "INTEGER"),
            "SealTypeGrup": ("sealtypegrup", "VARCHAR(100)"),
            "IN_SEALTYPE_CD": ("in_sealtype_cd", "VARCHAR(50)"),
            "IN_SEALSIZE": ("in_sealsize", "NUMERIC(18, 4)"),
            "IN_SEALSIZE_UOM": ("in_sealsize_uom", "VARCHAR(20)"),
            "MID_SEALTYPE_CD": ("mid_sealtype_cd", "VARCHAR(50)"),
            "MID_SEALSIZE": ("mid_sealsize", "NUMERIC(18, 4)"),
            "MID_SEALSIZE_UOM": ("mid_sealsize_uom", "VARCHAR(20)"),
            "OUT_SEALTYPE_CD": ("out_sealtype_cd", "VARCHAR(50)"),
            "OUT_SEALSIZE": ("out_sealsize", "NUMERIC(18, 4)"),
            "OUT_SEALSIZE_UOM": ("out_sealsize_uom", "VARCHAR(20)"),
            "RAW_MATL_KIND": ("raw_matl_kind", "VARCHAR(50)"),
            "RAW_MATL_KINDNM": ("raw_matl_kindnm", "VARCHAR(255)"),
            "INSRT_DT": ("insrt_dt", "TIMESTAMP"),
            "MODI_DT": ("modi_dt", "TIMESTAMP"),
        },
        "primary_key": "item_cd",
    },
    "routing_master": {
        "access_view": "dbo_BI_ROUTING_VIEW",
        "pg_table": "routing.routing_master",
        "columns": {
            "ITEM_CD": ("item_cd", "VARCHAR(100)"),
            "ROUT_NO": ("rout_no", "VARCHAR(50)"),
            "PROC_SEQ": ("proc_seq", "INTEGER"),
            "INSIDE_FLAG": ("inside_flag", "CHAR(1)"),
            "JOB_CD": ("job_cd", "VARCHAR(50)"),
            "JOB_NM": ("job_nm", "VARCHAR(255)"),
            "RES_CD": ("res_cd", "VARCHAR(50)"),
            "RES_DIS": ("res_dis", "VARCHAR(255)"),
            "TIME_UNIT": ("time_unit", "VARCHAR(20)"),
            "MFG_LT": ("mfg_lt", "NUMERIC(18, 4)"),
            "QUEUE_TIME": ("queue_time", "NUMERIC(18, 4)"),
            "SETUP_TIME": ("setup_time", "NUMERIC(18, 4)"),
            "RUN_TIME": ("run_time", "NUMERIC(18, 4)"),
            "RUN_TIME_UNIT": ("run_time_unit", "VARCHAR(20)"),
            "MACH_WORKED_HOURS": ("mach_worked_hours", "NUMERIC(18, 4)"),
            "ACT_SETUP_TIME": ("act_setup_time", "NUMERIC(18, 4)"),
            "ACT_RUN_TIME": ("act_run_time", "NUMERIC(18, 4)"),
            "WAIT_TIME": ("wait_time", "NUMERIC(18, 4)"),
            "MOVE_TIME": ("move_time", "NUMERIC(18, 4)"),
            "RUN_TIME_QTY": ("run_time_qty", "NUMERIC(18, 4)"),
            "BATCH_OPER": ("batch_oper", "CHAR(1)"),
            "BP_CD": ("bp_cd", "VARCHAR(50)"),
            "CUST_NM": ("cust_nm", "VARCHAR(255)"),
            "CUR_CD": ("cur_cd", "VARCHAR(20)"),
            "SUBCONTRACT_PRC": ("subcontract_prc", "NUMERIC(18, 4)"),
            "TAX_TYPE": ("tax_type", "VARCHAR(20)"),
            "MILESTONE_FLG": ("milestone_flg", "CHAR(1)"),
            "INSP_FLG": ("insp_flg", "CHAR(1)"),
            "ROUT_ORDER": ("rout_order", "INTEGER"),
            "VALID_FROM_DT": ("valid_from_dt", "DATE"),
            "VALID_TO_DT": ("valid_to_dt", "DATE"),
            "REMARK": ("remark", "TEXT"),
            "ROUT_DOC": ("rout_doc", "VARCHAR(500)"),
            "DOC_INSIDE": ("doc_inside", "VARCHAR(500)"),
            "DOC_NO": ("doc_no", "VARCHAR(100)"),
            "NC_PROGRAM": ("nc_program", "VARCHAR(500)"),
            "NC_PROGRAM_WRITER": ("nc_program_writer", "VARCHAR(50)"),
            "NC_WRITER_NM": ("nc_writer_nm", "VARCHAR(255)"),
            "NC_WRITE_DATE": ("nc_write_date", "DATE"),
            "NC_REVIEWER": ("nc_reviewer", "VARCHAR(50)"),
            "NC_REVIEWER_NM": ("nc_reviewer_nm", "VARCHAR(255)"),
            "NC_REVIEW_DT": ("nc_review_dt", "DATE"),
            "RAW_MATL_SIZE": ("raw_matl_size", "VARCHAR(100)"),
            "JAW_SIZE": ("jaw_size", "VARCHAR(100)"),
            "VALIDITY": ("validity", "CHAR(1)"),
            "PROGRAM_REMARK": ("program_remark", "TEXT"),
            "OP_DRAW_NO": ("op_draw_no", "VARCHAR(100)"),
            "MTMG_NUMB": ("mtmg_numb", "VARCHAR(100)"),
            "INSRT_DT": ("insrt_dt", "TIMESTAMP"),
        },
        "primary_key": None,  # 자동 생성 (routing_id BIGSERIAL)
    },
}

# ============================================================================
# Extract Data from Access
# ============================================================================


def extract_from_access(table_name: str, batch_size: int = 1000) -> pd.DataFrame:
    """Access DB에서 데이터 추출"""
    mapping = TABLE_MAPPINGS[table_name]
    access_view = mapping["access_view"]
    access_columns = list(mapping["columns"].keys())

    logger.info(f"📤 Extracting data from Access: {access_view}")

    conn = get_access_connection()
    cursor = conn.cursor()

    # 컬럼 목록 생성
    columns_str = ", ".join(f"[{col}]" for col in access_columns)
    query = f"SELECT {columns_str} FROM [{access_view}]"

    try:
        # pandas로 읽기 (메모리 효율적)
        df = pd.read_sql(query, conn, chunksize=batch_size)

        # Generator를 DataFrame으로 변환
        chunks = []
        for i, chunk in enumerate(df):
            logger.info(f"  Chunk {i + 1}: {len(chunk)} rows")
            chunks.append(chunk)

        result = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()

        logger.info(f"✅ Extracted {len(result)} rows from {access_view}")
        return result

    except Exception as e:
        logger.error(f"❌ Extraction failed: {e}")
        raise
    finally:
        conn.close()


# ============================================================================
# Transform Data
# ============================================================================


def transform_data(df: pd.DataFrame, table_name: str) -> pd.DataFrame:
    """데이터 변환 (Access → PostgreSQL 타입)"""
    mapping = TABLE_MAPPINGS[table_name]
    logger.info(f"🔄 Transforming data for: {table_name}")

    # 컬럼 이름 변경 + 타입 변환
    transformed_data = {}

    for access_col, (pg_col, pg_type) in mapping["columns"].items():
        if access_col in df.columns:
            # 타입 변환
            transformed_data[pg_col] = df[access_col].apply(
                lambda x: convert_access_to_postgres(x, pg_type)
            )
        else:
            logger.warning(f"  ⚠️  Column missing: {access_col}")
            transformed_data[pg_col] = None

    result_df = pd.DataFrame(transformed_data)

    # NULL 비율 체크
    null_ratios = (result_df.isnull().sum() / len(result_df) * 100).round(2)
    high_nulls = null_ratios[null_ratios > 50]
    if not high_nulls.empty:
        logger.warning(f"  ⚠️  High NULL ratio columns:\n{high_nulls}")

    logger.info(f"✅ Transformed {len(result_df)} rows")
    return result_df


# ============================================================================
# Load Data to PostgreSQL
# ============================================================================


def load_to_postgres(df: pd.DataFrame, table_name: str, batch_size: int = 1000) -> None:
    """PostgreSQL에 데이터 로드 (UPSERT)"""
    mapping = TABLE_MAPPINGS[table_name]
    pg_table = mapping["pg_table"]
    primary_key = mapping["primary_key"]

    logger.info(f"📥 Loading data to PostgreSQL: {pg_table}")

    conn = get_postgres_connection()
    cursor = conn.cursor()

    try:
        # 컬럼 목록
        columns = df.columns.tolist()
        columns_str = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))

        # UPSERT 쿼리 (ON CONFLICT DO UPDATE)
        if primary_key:
            update_set = ", ".join([f"{col} = EXCLUDED.{col}" for col in columns if col != primary_key])
            query = f"""
                INSERT INTO {pg_table} ({columns_str})
                VALUES %s
                ON CONFLICT ({primary_key})
                DO UPDATE SET {update_set}
            """
        else:
            # Primary key 없으면 단순 INSERT (중복 무시)
            query = f"""
                INSERT INTO {pg_table} ({columns_str})
                VALUES %s
                ON CONFLICT DO NOTHING
            """

        # Batch INSERT
        total_rows = len(df)
        for i in range(0, total_rows, batch_size):
            batch_df = df.iloc[i : i + batch_size]
            values = [tuple(row) for row in batch_df.values]

            execute_values(cursor, query, values, page_size=batch_size)
            conn.commit()

            logger.info(f"  Inserted batch {i // batch_size + 1}: {len(batch_df)} rows")

        logger.info(f"✅ Loaded {total_rows} rows to {pg_table}")

    except Exception as e:
        conn.rollback()
        logger.error(f"❌ Load failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


# ============================================================================
# Validation
# ============================================================================


def validate_migration(table_name: str) -> Dict[str, Any]:
    """마이그레이션 검증"""
    logger.info(f"✅ Validating migration: {table_name}")

    # Access 레코드 수
    access_conn = get_access_connection()
    access_cursor = access_conn.cursor()
    access_view = TABLE_MAPPINGS[table_name]["access_view"]
    access_cursor.execute(f"SELECT COUNT(*) FROM [{access_view}]")
    access_count = access_cursor.fetchone()[0]
    access_conn.close()

    # PostgreSQL 레코드 수
    pg_conn = get_postgres_connection()
    pg_cursor = pg_conn.cursor()
    pg_table = TABLE_MAPPINGS[table_name]["pg_table"]
    pg_cursor.execute(f"SELECT COUNT(*) FROM {pg_table}")
    pg_count = pg_cursor.fetchone()[0]

    # NULL 비율
    columns = [pg_col for pg_col, _ in TABLE_MAPPINGS[table_name]["columns"].values()]
    null_stats = {}
    for col in columns:
        pg_cursor.execute(
            f"SELECT COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM {pg_table}), 0) FROM {pg_table} WHERE {col} IS NULL"
        )
        null_ratio = pg_cursor.fetchone()[0]
        null_stats[col] = round(float(null_ratio) if null_ratio else 0, 2)

    pg_conn.close()

    result = {
        "table": table_name,
        "access_count": access_count,
        "postgres_count": pg_count,
        "match": access_count == pg_count,
        "null_stats": null_stats,
    }

    logger.info(f"  Access: {access_count} rows")
    logger.info(f"  PostgreSQL: {pg_count} rows")
    logger.info(f"  Match: {result['match']}")

    return result


# ============================================================================
# Main Migration Function
# ============================================================================


def migrate_table(table_name: str, batch_size: int = 1000, dry_run: bool = False) -> None:
    """단일 테이블 마이그레이션"""
    logger.info(f"{'[DRY RUN] ' if dry_run else ''}Starting migration: {table_name}")

    try:
        # 1. Extract
        df = extract_from_access(table_name, batch_size)

        if df.empty:
            logger.warning(f"⚠️  No data to migrate for {table_name}")
            return

        # 2. Transform
        df_transformed = transform_data(df, table_name)

        if not dry_run:
            # 3. Load
            load_to_postgres(df_transformed, table_name, batch_size)

            # 4. Validate
            validation = validate_migration(table_name)
            logger.info(f"Validation result: {validation}")
        else:
            logger.info(f"[DRY RUN] Would migrate {len(df_transformed)} rows")

        logger.info(f"✅ Migration completed: {table_name}")

    except Exception as e:
        logger.error(f"❌ Migration failed for {table_name}: {e}")
        raise


def migrate_all(batch_size: int = 1000, dry_run: bool = False) -> None:
    """모든 테이블 마이그레이션"""
    logger.info("🚀 Starting full migration (all tables)")

    for table_name in TABLE_MAPPINGS.keys():
        migrate_table(table_name, batch_size, dry_run)

    logger.info("✅ Full migration completed")


# ============================================================================
# CLI
# ============================================================================


def main():
    parser = argparse.ArgumentParser(description="Access DB → PostgreSQL Migration")
    parser.add_argument("--table", choices=list(TABLE_MAPPINGS.keys()), help="Single table to migrate")
    parser.add_argument("--all", action="store_true", help="Migrate all tables")
    parser.add_argument("--batch-size", type=int, default=1000, help="Batch size for INSERT (default: 1000)")
    parser.add_argument("--dry-run", action="store_true", help="Dry run (no actual INSERT)")
    parser.add_argument("--validate-only", action="store_true", help="Only run validation")

    args = parser.parse_args()

    if args.validate_only:
        if args.table:
            validate_migration(args.table)
        elif args.all:
            for table_name in TABLE_MAPPINGS.keys():
                validate_migration(table_name)
        return

    if args.all:
        migrate_all(args.batch_size, args.dry_run)
    elif args.table:
        migrate_table(args.table, args.batch_size, args.dry_run)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
