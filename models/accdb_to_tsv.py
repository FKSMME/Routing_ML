# -*- coding: utf-8 -*-
"""
Usage (PowerShell):
  python accdb_to_tsv.py

기능:
- Access(.accdb)에서 dbo_BI_ITEM_INFO_VIEW를 읽어
- Projector용 TSV(헤더 포함, 탭-구분)로 저장합니다.
"""

from pathlib import Path
import sys
import pyodbc
import pandas as pd

# ====== 사용자 환경 설정 ======
ACCDB_PATH = r"D:\routing\machine\routing_data\ROUTING AUTO TEST.accdb"
TABLE_NAME = "dbo_BI_ITEM_INFO_VIEW"
OUT_TSV    = r"D:\routing\machine\models\item_master.tsv"

# Projector에서 유용한 컬럼만 선별(없으면 자동 건너뜀). 최소 ITEM_CD는 꼭 있어야 합니다.
KEEP_COLS = [
    "ITEM_CD", "PART_TYPE", "ITEM_NM", "ITEM_SPEC",
    "ITEM_MATERIAL", "MATERIAL_DESC", "ITEM_TYPE",
    "ITEM_GRP1", "ITEM_GRP1NM", "STANDARD_YN",
    "DRAW_NO", "DRAW_REV",
    "OUTDIAMETER", "INDIAMETER", "OUTTHICKNESS", "OUTDIAMETER_UNIT",
    "RAW_MATL_KINDNM",
    "SALES_ITEM_GROUP", "STOCK_POLICY_NM", "ITEM_TYPE_NM"
]
# ===========================

def ensure_driver():
    drivers = [d.lower() for d in pyodbc.drivers()]
    if "microsoft access driver (*.mdb, *.accdb)".lower() not in drivers:
        raise RuntimeError("Access ODBC 드라이버가 보이지 않습니다. 'Microsoft Access Database Engine 2016 (x64)' 설치 필요.")
    return True

def read_table():
    conn_str = (
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        rf"DBQ={ACCDB_PATH};"
    )
    with pyodbc.connect(conn_str) as conn:
        # Access는 공백/특수문자 테이블명을 대괄호로 감싸야 안전합니다.
        query = f"SELECT * FROM [{TABLE_NAME}]"
        df = pd.read_sql(query, conn, dtype=str)
    return df.fillna("")

def sanitize_df(df: pd.DataFrame) -> pd.DataFrame:
    # 컬럼명 공백 제거
    df.columns = [c.strip() for c in df.columns]
    # 탭/개행/앞뒤공백 제거(표시·검색 안정화)
    for c in df.columns:
        df[c] = (
            df[c]
            .astype(str)
            .str.replace("\t", " ", regex=False)
            .str.replace("\r", " ", regex=False)
            .str.replace("\n", " ", regex=False)
            .str.strip()
        )
    return df

def select_columns(df: pd.DataFrame) -> pd.DataFrame:
    if "ITEM_CD" not in df.columns:
        raise RuntimeError("원본 데이터에 'ITEM_CD' 컬럼이 없습니다. 실제 컬럼명을 확인해주세요.")

    cols = ["ITEM_CD"] + [c for c in KEEP_COLS if c != "ITEM_CD" and c in df.columns]
    # ITEM_CD 기준 중복 제거(최초 1행 유지). 필요 시 도메인 규칙에 맞게 집계 로직 교체 가능.
    df = df.drop_duplicates(subset=["ITEM_CD"], keep="first")
    return df[cols]

def write_tsv(df: pd.DataFrame):
    out_path = Path(OUT_TSV)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, sep="\t", index=False, encoding="utf-8")
    return out_path

def main():
    print(f"[INFO] ACCDB: {ACCDB_PATH}")
    print(f"[INFO] TABLE: {TABLE_NAME}")
    print(f"[INFO] OUT  : {OUT_TSV}")

    ensure_driver()
    df = read_table()
    print(f"[INFO] Loaded rows={len(df)}, cols={len(df.columns)}")

    df = sanitize_df(df)
    df = select_columns(df)
    print(f"[INFO] After select -> rows={len(df)}, cols={len(df.columns)}: {list(df.columns)}")

    out_path = write_tsv(df)
    print(f"[OK] Wrote TSV → {out_path} (rows={len(df)})")

    # 미리보기
    with pd.option_context('display.max_columns', None, 'display.width', 200):
        print("[HEAD]")
        print(df.head(3))

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[ERR] {e}")
        sys.exit(1)
