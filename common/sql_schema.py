"""SQL 출력 기본 스키마 및 매핑 기본값."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

# 7.1 표준 구조에 맞춘 기본 컬럼 순서
DEFAULT_SQL_OUTPUT_COLUMNS: List[str] = [
    "ITEM_CD",
    "CANDIDATE_ID",
    "ROUTING_SIGNATURE",
    "PRIORITY",
    "SIMILARITY_TIER",
    "PROC_SEQ",
    "INSIDE_FLAG",
    "dbo_BI_ROUTING_VIEW_JOB_CD",
    "JOB_NM",
    "RES_CD",
    "RES_DIS",
    "TIME_UNIT",
    "MFG_LT",
    "QUEUE_TIME",
    "SETUP_TIME",
    "MACH_WORKED_HOURS",
    "ACT_SETUP_TIME",
    "ACT_RUN_TIME",
    "WAIT_TIME",
    "MOVE_TIME",
    "RUN_TIME_QTY",
    "RUN_TIME_UNIT",
    "BATCH_OPER",
    "BP_CD",
    "dbo_BI_ROUTING_VIEW_CUST_NM",
    "CUR_CD",
    "SUBCONTRACT_PRC",
    "TAX_TYPE",
    "MILESTONE_FLG",
    "INSP_FLG",
    "ROUT_ORDER",
    "VALID_FROM_DT",
    "VALID_TO_DT",
    "dbo_BI_ROUTING_VIEW_REMARK",
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
    "REFERENCE_ITEM_CD",
    "SIMILARITY_SCORE",
]

# Access VIEW와 내부 명칭 간 기본 별칭 매핑
DEFAULT_SQL_COLUMN_ALIASES: Dict[str, str] = {
    "JOB_CD": "dbo_BI_ROUTING_VIEW_JOB_CD",
    "CUST_NM": "dbo_BI_ROUTING_VIEW_CUST_NM",
    "VIEW_REMARK": "dbo_BI_ROUTING_VIEW_REMARK",
}


def ensure_default_aliases(mapping: Dict[str, str]) -> Dict[str, str]:
    """기본 별칭 누락 시 보완된 사본을 반환한다."""
    merged = dict(DEFAULT_SQL_COLUMN_ALIASES)
    merged.update(mapping)
    return merged


@dataclass
class DefaultPowerQueryProfile:
    """파워쿼리 스타일 매핑 프로필."""

    name: str
    description: str
    mapping: Dict[str, str]


DEFAULT_POWER_QUERY_PROFILES: List[DefaultPowerQueryProfile] = [
    DefaultPowerQueryProfile(
        name="Access 7.1 기본",
        description="dbo_BI_ROUTING_VIEW 7.1 구조를 그대로 따르는 기본 매핑",
        mapping=dict(DEFAULT_SQL_COLUMN_ALIASES),
    )
]


__all__ = [
    "DEFAULT_SQL_OUTPUT_COLUMNS",
    "DEFAULT_SQL_COLUMN_ALIASES",
    "DEFAULT_POWER_QUERY_PROFILES",
    "DefaultPowerQueryProfile",
    "ensure_default_aliases",
]
