"""
공통 상수 정의 모듈
────────────────────────────────────────────────────────
• TRAIN_FEATURES       : 학습-전처리 단계에서 사용할 입력 컬럼
• NUMERIC_FEATURES     : 라벨 인코딩하지 않고 그대로 숫자로 쓰는 열
• ROUTING_OUTPUT_COLS  : 예측 결과 열 순서 고정
────────────────────────────────────────────────────────
※ 실제 View 에 없는 열을 추가하면 trainer / predictor 단계에서
  KeyError 가 발생하니 주의!
"""

# ────────────────────────────────────────────────
# ❶ 학습에 사용할 입력 특성
# ────────────────────────────────────────────────
TRAIN_FEATURES: list[str] = [
    # 기본 품목 정보
    "ITEM_CD", "PART_TYPE", "PartNm", "ITEM_SUFFIX",
    "ITEM_SPEC", "ITEM_NM", "ADDITIONAL_SPEC",

    # 소재·계정·단위
    "ITEM_MATERIAL", "MATERIAL_DESC", "ITEM_ACCT",
    "ITEM_TYPE", "ITEM_UNIT",

    # 그룹 & 커스텀 분류
    "ITEM_GRP1", "ITEM_GRP1NM", "STANDARD_YN",
    "GROUP1", "GROUP2", "GROUP3",

    # 도면 & 영문명
    "DRAW_NO", "DRAW_REV", "DRAW_SHEET_NO", "DRAW_USE",
    "ITEM_NM_ENG",

    # 치수 & 회전
    "OUTDIAMETER", "INDIAMETER", "OUTTHICKNESS", "OUTDIAMETER_UNIT",
    "ROTATE_CLOCKWISE", "ROTATE_CTRCLOCKWISE",

    # 씰 사양
    "SealTypeGrup",
    "IN_SEALTYPE_CD",  "IN_SEALSIZE",  "IN_SEALSIZE_UOM",
    "MID_SEALTYPE_CD", "MID_SEALSIZE", "MID_SEALSIZE_UOM",
    "OUT_SEALTYPE_CD", "OUT_SEALSIZE", "OUT_SEALSIZE_UOM",

    # 원소재 구분
    "RAW_MATL_KIND", "RAW_MATL_KINDNM",

]

# ────────────────────────────────────────────────
# ❶-1  **숫자형**으로 유지할 열
#       (여기에 포함된 컬럼은 OrdinalEncoder 를 거치지 않고
#        그대로 StandardScaler 만 적용됩니다)
# ────────────────────────────────────────────────
NUMERIC_FEATURES: set[str] = {
    # 치수 관련
    "OUTDIAMETER", "INDIAMETER", "OUTTHICKNESS",

    # 씰 사이즈
    "IN_SEALSIZE", "MID_SEALSIZE", "OUT_SEALSIZE",

    # 회전 여부 플래그가 정수(0/1)로 저장돼 있다면 포함
    "ROTATE_CLOCKWISE", "ROTATE_CTRCLOCKWISE",

    # 필요하면 여기서 자유롭게 추가
    # "LEADTIME", "REORDER_PNT", "STD_PRICE",
}

# ────────────────────────────────────────────────
# ❷ 예측 결과 출력 열 (GUI & CSV)
# ────────────────────────────────────────────────
ROUTING_OUTPUT_COLS: list[str] = [
    # ── 기본 메타 및 식별자
    "ITEM_CD", "CANDIDATE_ID", "ROUTING_SIGNATURE", "PRIORITY", "SIMILARITY_TIER",

    # ── Access 7.1 공정 컬럼
    "PROC_SEQ", "INSIDE_FLAG",
    "dbo_BI_ROUTING_VIEW_JOB_CD", "JOB_NM",
    "RES_CD", "RES_DIS", "TIME_UNIT",
    "MFG_LT", "QUEUE_TIME", "SETUP_TIME",
    "MACH_WORKED_HOURS", "ACT_SETUP_TIME", "ACT_RUN_TIME",
    "WAIT_TIME", "MOVE_TIME", "RUN_TIME_QTY", "RUN_TIME_UNIT",
    "BATCH_OPER", "BP_CD", "dbo_BI_ROUTING_VIEW_CUST_NM",
    "CUR_CD", "SUBCONTRACT_PRC", "TAX_TYPE",
    "MILESTONE_FLG", "INSP_FLG", "ROUT_ORDER",
    "VALID_FROM_DT", "VALID_TO_DT", "dbo_BI_ROUTING_VIEW_REMARK",
    "ROUT_DOC", "DOC_INSIDE", "DOC_NO",
    "NC_PROGRAM", "NC_PROGRAM_WRITER", "NC_WRITER_NM", "NC_WRITE_DATE",
    "NC_REVIEWER", "NC_REVIEWER_NM", "NC_REVIEW_DT",
    "RAW_MATL_SIZE", "JAW_SIZE", "VALIDITY",
    "PROGRAM_REMARK", "OP_DRAW_NO", "MTMG_NUMB",

    # ── predictor_ml 에서 추가되는 메타
    "REFERENCE_ITEM_CD",   # 벡터 기준으로 가장 유사한 품목
    "SIMILARITY_SCORE",    # cosine similarity (0~1)
]

# ────────────────────────────────────────────────
# (선택) 프로젝트 전역에서 공유할 기타 상수를
#        필요에 따라 이 아래에 추가하세요.
# ────────────────────────────────────────────────
