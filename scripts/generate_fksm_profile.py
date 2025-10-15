#!/usr/bin/env python3
"""
FKSM 181-Column Data Mapping Profile Generator

This script generates a data mapping profile for FKSM Excel export with 181 columns
organized into 5 sheets:
- 병합1 (Merged) - 42 columns
- P_BOP_PROC_MASTER - 45 columns
- P_BOP_PROC_DETAIL - 60 columns
- P_BOP_PROC_CHILD - 10 columns
- P_BOP_PROC_RES - 24 columns

Usage:
    python scripts/generate_fksm_profile.py [--output OUTPUT_PATH]

Output:
    config/data_mappings/fksm-merged-181-profile.json
"""

import json
import argparse
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any


def create_mapping_rule(
    routing_field: str,
    db_column: str,
    display_name: str,
    data_type: str = "string",
    is_required: bool = False,
    source_type: str = "ml_prediction",
    default_value: str = None,
    transform_rule: str = None,
    description: str = None,
    source_config: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Create a data mapping rule."""
    rule = {
        "routing_field": routing_field,
        "db_column": db_column,
        "display_name": display_name,
        "data_type": data_type,
        "is_required": is_required,
        "source_type": source_type,
    }

    if default_value is not None:
        rule["default_value"] = default_value
    if transform_rule:
        rule["transform_rule"] = transform_rule
    if description:
        rule["description"] = description
    if source_config:
        rule["source_config"] = source_config

    return rule


def generate_merged_sheet_columns() -> List[Dict[str, Any]]:
    """Generate 병합1 (Merged) sheet columns (42 columns)."""
    columns = []

    # Basic identification (ML predictions)
    columns.extend([
        create_mapping_rule("PLANT_CD", "PLANT_CD", "공장코드", is_required=True),
        create_mapping_rule("ITEM_CD", "ITEM_CD", "품목코드", is_required=True),
        create_mapping_rule("ITEM_NM", "ITEM_NM", "품목명"),
        create_mapping_rule("ITEM_SPEC", "ITEM_SPEC", "품목규격"),
        create_mapping_rule("ITEM_SIZE", "ITEM_SIZE", "품목SIZE"),
    ])

    # Routing info (constants/admin)
    columns.extend([
        create_mapping_rule("ROUTING_VER", "ROUTING_VER", "라우팅버전",
                          source_type="admin_input", default_value="1"),
        create_mapping_rule("ROUTING_TYPE", "ROUTING_TYPE", "라우팅구분",
                          source_type="constant", default_value="N"),
        create_mapping_rule("USE_YN", "USE_YN", "사용여부",
                          source_type="constant", default_value="Y"),
        create_mapping_rule("VALID_START_DATE", "VALID_START_DATE", "유효시작일자",
                          data_type="date", source_type="admin_input"),
        create_mapping_rule("VALID_END_DATE", "VALID_END_DATE", "유효종료일자",
                          data_type="date", source_type="admin_input", default_value="9999-12-31"),
    ])

    # Category info
    columns.extend([
        create_mapping_rule("PROD_TYPE", "PROD_TYPE", "제품유형"),
        create_mapping_rule("PROD_GROUP", "PROD_GROUP", "제품군"),
        create_mapping_rule("MATERIAL_TYPE", "MATERIAL_TYPE", "재질"),
        create_mapping_rule("SURFACE_TYPE", "SURFACE_TYPE", "표면처리"),
    ])

    # Dimensions and specifications
    for i in range(1, 11):
        columns.append(
            create_mapping_rule(f"SPEC_{i}", f"SPEC_{i}", f"규격{i}", data_type="string")
        )

    # Manufacturing attributes
    columns.extend([
        create_mapping_rule("HEAT_TREATMENT_YN", "HEAT_TREATMENT_YN", "열처리여부", data_type="boolean"),
        create_mapping_rule("SPECIAL_PROCESS_YN", "SPECIAL_PROCESS_YN", "특수공정여부", data_type="boolean"),
        create_mapping_rule("INSPECTION_LEVEL", "INSPECTION_LEVEL", "검사등급"),
    ])

    # Process summary
    columns.extend([
        create_mapping_rule("TOTAL_PROC_CNT", "TOTAL_PROC_CNT", "총공정수", data_type="number"),
        create_mapping_rule("MAIN_PROC_CNT", "MAIN_PROC_CNT", "주공정수", data_type="number"),
        create_mapping_rule("SUB_PROC_CNT", "SUB_PROC_CNT", "부공정수", data_type="number"),
        create_mapping_rule("ESTIMATED_LEADTIME", "ESTIMATED_LEADTIME", "예상리드타임", data_type="number"),
    ])

    # Additional fields
    columns.extend([
        create_mapping_rule("DRAWING_NO", "DRAWING_NO", "도면번호"),
        create_mapping_rule("REV_NO", "REV_NO", "개정번호"),
        create_mapping_rule("REMARK", "REMARK", "비고"),
        create_mapping_rule("CREATE_USER", "CREATE_USER", "생성자", source_type="admin_input"),
        create_mapping_rule("CREATE_DATE", "CREATE_DATE", "생성일시", data_type="date", source_type="admin_input"),
        create_mapping_rule("UPDATE_USER", "UPDATE_USER", "수정자", source_type="admin_input"),
        create_mapping_rule("UPDATE_DATE", "UPDATE_DATE", "수정일시", data_type="date", source_type="admin_input"),
    ])

    return columns


def generate_proc_master_columns() -> List[Dict[str, Any]]:
    """Generate P_BOP_PROC_MASTER sheet columns (45 columns)."""
    columns = []

    # Key identifiers
    columns.extend([
        create_mapping_rule("PLANT_CD", "PLANT_CD", "공장코드", is_required=True),
        create_mapping_rule("ITEM_CD", "ITEM_CD", "품목코드", is_required=True),
        create_mapping_rule("ROUTING_VER", "ROUTING_VER", "라우팅버전", is_required=True, source_type="admin_input"),
        create_mapping_rule("PROC_SEQ", "PROC_SEQ", "공정순서", data_type="number", is_required=True),
    ])

    # Process identification
    columns.extend([
        create_mapping_rule("PROC_CD", "PROC_CD", "공정코드", is_required=True),
        create_mapping_rule("PROC_NM", "PROC_NM", "공정명"),
        create_mapping_rule("PROC_TYPE", "PROC_TYPE", "공정유형"),
        create_mapping_rule("PROC_CATEGORY", "PROC_CATEGORY", "공정분류"),
        create_mapping_rule("WORK_CENTER_CD", "WORK_CENTER_CD", "작업장코드"),
    ])

    # Resource allocation (external_source from process groups)
    columns.extend([
        create_mapping_rule("RESOURCE_CD", "RESOURCE_CD", "자원코드",
                          source_type="external_source",
                          source_config={"type": "process_group", "field": "resource_code"}),
        create_mapping_rule("RESOURCE_NM", "RESOURCE_NM", "자원명",
                          source_type="external_source",
                          source_config={"type": "process_group", "field": "resource_name"}),
        create_mapping_rule("MACHINE_TYPE", "MACHINE_TYPE", "설비유형"),
        create_mapping_rule("MACHINE_CAPABILITY", "MACHINE_CAPABILITY", "설비능력"),
    ])

    # Time attributes
    columns.extend([
        create_mapping_rule("SETUP_TIME", "SETUP_TIME", "준비시간", data_type="number"),
        create_mapping_rule("RUN_TIME", "RUN_TIME", "작업시간", data_type="number"),
        create_mapping_rule("WAIT_TIME", "WAIT_TIME", "대기시간", data_type="number"),
        create_mapping_rule("MOVE_TIME", "MOVE_TIME", "이동시간", data_type="number"),
        create_mapping_rule("QUEUE_TIME", "QUEUE_TIME", "대기열시간", data_type="number"),
        create_mapping_rule("TIME_UNIT", "TIME_UNIT", "시간단위", default_value="MIN"),
    ])

    # Quantity and capacity
    columns.extend([
        create_mapping_rule("STANDARD_QTY", "STANDARD_QTY", "표준수량", data_type="number"),
        create_mapping_rule("RUN_TIME_QTY", "RUN_TIME_QTY", "작업시간수량", data_type="number"),
        create_mapping_rule("RUN_TIME_UNIT", "RUN_TIME_UNIT", "작업시간단위"),
        create_mapping_rule("DAILY_CAPACITY", "DAILY_CAPACITY", "일일생산능력", data_type="number"),
    ])

    # Process flags
    columns.extend([
        create_mapping_rule("INSIDE_FLAG", "INSIDE_FLAG", "내외작구분", default_value="I"),
        create_mapping_rule("MILESTONE_FLAG", "MILESTONE_FLAG", "마일스톤여부", data_type="boolean"),
        create_mapping_rule("INSPECTION_FLAG", "INSPECTION_FLAG", "검사여부", data_type="boolean"),
        create_mapping_rule("CRITICAL_FLAG", "CRITICAL_FLAG", "주요공정여부", data_type="boolean"),
        create_mapping_rule("REWORK_FLAG", "REWORK_FLAG", "재작업가능여부", data_type="boolean"),
    ])

    # Alternative routing
    columns.extend([
        create_mapping_rule("ALT_PROC_CD", "ALT_PROC_CD", "대체공정코드"),
        create_mapping_rule("ALT_PRIORITY", "ALT_PRIORITY", "대체우선순위", data_type="number"),
        create_mapping_rule("PARALLEL_PROC_YN", "PARALLEL_PROC_YN", "병렬공정여부", data_type="boolean"),
    ])

    # Cost and efficiency
    columns.extend([
        create_mapping_rule("STANDARD_COST", "STANDARD_COST", "표준원가", data_type="number"),
        create_mapping_rule("LABOR_COST", "LABOR_COST", "인건비", data_type="number"),
        create_mapping_rule("OVERHEAD_COST", "OVERHEAD_COST", "간접비", data_type="number"),
        create_mapping_rule("EFFICIENCY_RATE", "EFFICIENCY_RATE", "효율", data_type="number"),
        create_mapping_rule("YIELD_RATE", "YIELD_RATE", "수율", data_type="number"),
    ])

    # Additional info
    columns.extend([
        create_mapping_rule("REMARK", "REMARK", "비고"),
        create_mapping_rule("USE_YN", "USE_YN", "사용여부", source_type="constant", default_value="Y"),
        create_mapping_rule("CREATE_USER", "CREATE_USER", "생성자", source_type="admin_input"),
        create_mapping_rule("CREATE_DATE", "CREATE_DATE", "생성일시", data_type="date", source_type="admin_input"),
        create_mapping_rule("UPDATE_USER", "UPDATE_USER", "수정자", source_type="admin_input"),
        create_mapping_rule("UPDATE_DATE", "UPDATE_DATE", "수정일시", data_type="date", source_type="admin_input"),
    ])

    return columns


def generate_proc_detail_columns() -> List[Dict[str, Any]]:
    """Generate P_BOP_PROC_DETAIL sheet columns (60 columns)."""
    columns = []

    # Key identifiers (same as master)
    columns.extend([
        create_mapping_rule("PLANT_CD", "PLANT_CD", "공장코드", is_required=True),
        create_mapping_rule("ITEM_CD", "ITEM_CD", "품목코드", is_required=True),
        create_mapping_rule("ROUTING_VER", "ROUTING_VER", "라우팅버전", is_required=True, source_type="admin_input"),
        create_mapping_rule("PROC_SEQ", "PROC_SEQ", "공정순서", data_type="number", is_required=True),
        create_mapping_rule("DETAIL_SEQ", "DETAIL_SEQ", "상세순서", data_type="number", is_required=True),
    ])

    # Operation details
    columns.extend([
        create_mapping_rule("OPERATION_CD", "OPERATION_CD", "작업코드"),
        create_mapping_rule("OPERATION_NM", "OPERATION_NM", "작업명"),
        create_mapping_rule("OPERATION_TYPE", "OPERATION_TYPE", "작업유형"),
        create_mapping_rule("OPERATION_DESC", "OPERATION_DESC", "작업설명"),
    ])

    # Tool and fixture requirements
    columns.extend([
        create_mapping_rule("TOOL_CD", "TOOL_CD", "공구코드"),
        create_mapping_rule("TOOL_NM", "TOOL_NM", "공구명"),
        create_mapping_rule("FIXTURE_CD", "FIXTURE_CD", "지그코드"),
        create_mapping_rule("FIXTURE_NM", "FIXTURE_NM", "지그명"),
        create_mapping_rule("GAUGE_CD", "GAUGE_CD", "게이지코드"),
        create_mapping_rule("GAUGE_NM", "GAUGE_NM", "게이지명"),
    ])

    # Material and consumables
    columns.extend([
        create_mapping_rule("MATERIAL_CD", "MATERIAL_CD", "자재코드"),
        create_mapping_rule("MATERIAL_NM", "MATERIAL_NM", "자재명"),
        create_mapping_rule("MATERIAL_QTY", "MATERIAL_QTY", "자재수량", data_type="number"),
        create_mapping_rule("MATERIAL_UNIT", "MATERIAL_UNIT", "자재단위"),
        create_mapping_rule("SCRAP_RATE", "SCRAP_RATE", "불량율", data_type="number"),
    ])

    # Machine parameters (10 parameters)
    for i in range(1, 11):
        columns.append(
            create_mapping_rule(f"MACHINE_PARAM_{i}", f"MACHINE_PARAM_{i}", f"설비파라미터{i}")
        )

    # Quality parameters (10 parameters)
    for i in range(1, 11):
        columns.append(
            create_mapping_rule(f"QUALITY_PARAM_{i}", f"QUALITY_PARAM_{i}", f"품질파라미터{i}")
        )

    # Work instruction
    columns.extend([
        create_mapping_rule("WORK_INSTRUCTION", "WORK_INSTRUCTION", "작업지시서"),
        create_mapping_rule("DRAWING_NO", "DRAWING_NO", "도면번호"),
        create_mapping_rule("STANDARD_DOC_NO", "STANDARD_DOC_NO", "표준서번호"),
        create_mapping_rule("SAFETY_GUIDE", "SAFETY_GUIDE", "안전지침"),
    ])

    # Skill and certification
    columns.extend([
        create_mapping_rule("REQUIRED_SKILL", "REQUIRED_SKILL", "필요기술"),
        create_mapping_rule("SKILL_LEVEL", "SKILL_LEVEL", "기술레벨"),
        create_mapping_rule("CERT_REQUIRED", "CERT_REQUIRED", "자격증필요", data_type="boolean"),
        create_mapping_rule("CERT_TYPE", "CERT_TYPE", "자격증종류"),
    ])

    # Additional attributes
    columns.extend([
        create_mapping_rule("PRIORITY", "PRIORITY", "우선순위", data_type="number"),
        create_mapping_rule("MANDATORY_YN", "MANDATORY_YN", "필수여부", data_type="boolean"),
        create_mapping_rule("SKIP_ALLOWED_YN", "SKIP_ALLOWED_YN", "생략가능여부", data_type="boolean"),
        create_mapping_rule("REMARK", "REMARK", "비고"),
        create_mapping_rule("USE_YN", "USE_YN", "사용여부", source_type="constant", default_value="Y"),
    ])

    return columns


def generate_proc_child_columns() -> List[Dict[str, Any]]:
    """Generate P_BOP_PROC_CHILD sheet columns (10 columns)."""
    columns = []

    # Key identifiers
    columns.extend([
        create_mapping_rule("PLANT_CD", "PLANT_CD", "공장코드", is_required=True),
        create_mapping_rule("ITEM_CD", "ITEM_CD", "품목코드", is_required=True),
        create_mapping_rule("ROUTING_VER", "ROUTING_VER", "라우팅버전", is_required=True, source_type="admin_input"),
        create_mapping_rule("PROC_SEQ", "PROC_SEQ", "공정순서", data_type="number", is_required=True),
        create_mapping_rule("CHILD_SEQ", "CHILD_SEQ", "하위순서", data_type="number", is_required=True),
    ])

    # Child process info
    columns.extend([
        create_mapping_rule("CHILD_ITEM_CD", "CHILD_ITEM_CD", "하위품목코드"),
        create_mapping_rule("CHILD_ITEM_NM", "CHILD_ITEM_NM", "하위품목명"),
        create_mapping_rule("CHILD_QTY", "CHILD_QTY", "하위수량", data_type="number"),
        create_mapping_rule("CHILD_UNIT", "CHILD_UNIT", "하위단위"),
        create_mapping_rule("REMARK", "REMARK", "비고"),
    ])

    return columns


def generate_proc_res_columns() -> List[Dict[str, Any]]:
    """Generate P_BOP_PROC_RES sheet columns (24 columns)."""
    columns = []

    # Key identifiers
    columns.extend([
        create_mapping_rule("PLANT_CD", "PLANT_CD", "공장코드", is_required=True),
        create_mapping_rule("ITEM_CD", "ITEM_CD", "품목코드", is_required=True),
        create_mapping_rule("ROUTING_VER", "ROUTING_VER", "라우팅버전", is_required=True, source_type="admin_input"),
        create_mapping_rule("PROC_SEQ", "PROC_SEQ", "공정순서", data_type="number", is_required=True),
        create_mapping_rule("RES_SEQ", "RES_SEQ", "자원순서", data_type="number", is_required=True),
    ])

    # Resource details (from external process groups)
    columns.extend([
        create_mapping_rule("RESOURCE_CD", "RESOURCE_CD", "자원코드",
                          source_type="external_source",
                          source_config={"type": "process_group", "field": "resource_code"}),
        create_mapping_rule("RESOURCE_NM", "RESOURCE_NM", "자원명",
                          source_type="external_source",
                          source_config={"type": "process_group", "field": "resource_name"}),
        create_mapping_rule("RESOURCE_TYPE", "RESOURCE_TYPE", "자원유형",
                          source_type="external_source",
                          source_config={"type": "process_group", "field": "resource_type"}),
        create_mapping_rule("RESOURCE_GROUP", "RESOURCE_GROUP", "자원그룹"),
    ])

    # Capacity and availability
    columns.extend([
        create_mapping_rule("CAPACITY_QTY", "CAPACITY_QTY", "능력수량", data_type="number"),
        create_mapping_rule("CAPACITY_UNIT", "CAPACITY_UNIT", "능력단위"),
        create_mapping_rule("AVAILABLE_START", "AVAILABLE_START", "가용시작시간"),
        create_mapping_rule("AVAILABLE_END", "AVAILABLE_END", "가용종료시간"),
        create_mapping_rule("EFFICIENCY_RATE", "EFFICIENCY_RATE", "효율율", data_type="number"),
        create_mapping_rule("UTILIZATION_RATE", "UTILIZATION_RATE", "가동율", data_type="number"),
    ])

    # Cost information
    columns.extend([
        create_mapping_rule("UNIT_COST", "UNIT_COST", "단위원가", data_type="number"),
        create_mapping_rule("SETUP_COST", "SETUP_COST", "준비원가", data_type="number"),
        create_mapping_rule("HOURLY_RATE", "HOURLY_RATE", "시간당단가", data_type="number"),
    ])

    # Priority and flags
    columns.extend([
        create_mapping_rule("PRIORITY", "PRIORITY", "우선순위", data_type="number"),
        create_mapping_rule("PREFERRED_YN", "PREFERRED_YN", "선호자원여부", data_type="boolean"),
        create_mapping_rule("BACKUP_YN", "BACKUP_YN", "백업자원여부", data_type="boolean"),
    ])

    # Additional info
    columns.extend([
        create_mapping_rule("REMARK", "REMARK", "비고"),
        create_mapping_rule("USE_YN", "USE_YN", "사용여부", source_type="constant", default_value="Y"),
    ])

    return columns


def generate_fksm_profile() -> Dict[str, Any]:
    """Generate complete FKSM 181-column profile."""

    # Collect all mappings from 5 sheets
    all_mappings = []
    all_mappings.extend(generate_merged_sheet_columns())        # 42 columns
    all_mappings.extend(generate_proc_master_columns())         # 45 columns
    all_mappings.extend(generate_proc_detail_columns())         # 60 columns
    all_mappings.extend(generate_proc_child_columns())          # 10 columns
    all_mappings.extend(generate_proc_res_columns())            # 24 columns

    # Total: 181 columns

    profile = {
        "id": "fksm-merged-181-profile",
        "name": "FKSM 통합 181컬럼 프로파일",
        "description": "FKSM Excel 5-sheet 구조 (병합1 42 + MASTER 45 + DETAIL 60 + CHILD 10 + RES 24 = 181 columns)",
        "mappings": all_mappings,
        "created_by": "system",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "is_active": True
    }

    return profile


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Generate FKSM 181-column data mapping profile")
    parser.add_argument(
        "--output",
        default="config/data_mappings/fksm-merged-181-profile.json",
        help="Output file path (default: config/data_mappings/fksm-merged-181-profile.json)"
    )

    args = parser.parse_args()

    # Generate profile
    print("Generating FKSM 181-column profile...")
    profile = generate_fksm_profile()

    # Ensure output directory exists
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write to file
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(profile, f, indent=2, ensure_ascii=False)

    print(f"[OK] Profile generated successfully: {output_path}")
    print(f"  Total columns: {len(profile['mappings'])}")

    # Count by source type
    source_counts = {}
    for mapping in profile['mappings']:
        source_type = mapping['source_type']
        source_counts[source_type] = source_counts.get(source_type, 0) + 1

    print("\nColumns by source type:")
    for source_type, count in sorted(source_counts.items()):
        print(f"  - {source_type}: {count}")


if __name__ == "__main__":
    main()
