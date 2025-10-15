import json

from common.datetime_utils import utc_isoformat

# merged_sheet_columns.json 읽기
with open('merged_sheet_columns.json', 'r', encoding='utf-8') as f:
    sheet_data = json.load(f)

headers = sheet_data['headers']

# 데이터 소스 매핑 규칙
# ML 예측에서 나오는 필드들
ml_prediction_fields = {
    'seq', 'PROC_SEQ', 'process_code', 'processCode', 'description',
    'run_time', 'RUN_TIME', 'setup_time', 'SETUP_TIME', 'wait_time', 'WAIT_TIME',
    'move_time', 'MOVE_TIME', 'queue_time', 'QUEUE_TIME',
    'item_code', 'ITEM_CD', 'routing_no', 'ROUT_NO',
    'JOB_CD', 'JOB_NM', 'TIME_UNIT', 'MFG_LT',
    'ROUT_ORDER', 'MILESTONE_FLG', 'INSP_FLG', 'BATCH_OPER'
}

# 관리자 고정 입력 필드들 (회사코드, 공장코드 등)
admin_input_fields = {
    'ID', 'CoCd', 'PlantCd', 'COCD', 'PLANTCD',
    'BOM_NO', 'MAJOR_FLG', 'INSIDE_FLG',
    'VALID_FROM_DT', 'VALID_TO_DT',
    'INSRT_USER_ID', 'INSRT_DT', 'UPDT_USER_ID', 'UPDT_DT',
    'REV_NO', 'REV_DT'
}

# 외부 소스 연결 필드들 (공정그룹 관리 등)
external_source_fields = {
    'RES_CD': {'type': 'process_group', 'field': 'resource_code'},
    'WC_CD': {'type': 'process_group', 'field': 'work_center'},
    'RES_DIS': {'type': 'process_group', 'field': 'resource_description'},
}

def determine_source_type(col_name):
    """컬럼명에서 데이터 소스 타입 결정"""
    # 정확히 매칭되는지 확인
    if col_name in ml_prediction_fields:
        return 'ml_prediction', None

    # .1, .2, .3 제거하고 검사
    base_name = col_name.split('.')[0]
    if base_name in ml_prediction_fields:
        return 'ml_prediction', None

    if col_name in external_source_fields:
        return 'external_source', external_source_fields[col_name]

    if base_name in external_source_fields:
        return 'external_source', external_source_fields[base_name]

    if col_name in admin_input_fields or base_name in admin_input_fields:
        return 'admin_input', None

    # 기본값: admin_input (관리자가 설정 가능)
    return 'admin_input', None

def determine_data_type(col_name):
    """컬럼명에서 데이터 타입 결정"""
    base_name = col_name.split('.')[0]

    # 숫자 타입
    number_keywords = ['SEQ', 'TIME', 'QTY', 'RATE', 'HOUR', 'COST', 'PRICE', 'PRC', 'WEIGHT', 'LT']
    if any(kw in base_name.upper() for kw in number_keywords):
        return 'number'

    # 날짜 타입
    date_keywords = ['_DT', 'DATE', '_AT']
    if any(kw in base_name.upper() for kw in date_keywords):
        return 'date'

    # Boolean 타입
    bool_keywords = ['_FLG', '_YN', 'ENABLED', 'REQUIRED']
    if any(kw in base_name.upper() for kw in bool_keywords):
        return 'string'  # Y/N 문자열로 처리

    return 'string'

def get_default_value(col_name, source_type, data_type):
    """컬럼별 기본값 결정"""
    base_name = col_name.split('.')[0]

    if source_type == 'admin_input':
        # 회사/공장 코드
        if 'CoCd' in col_name or 'COCD' in col_name:
            return '1000'
        if 'PlantCd' in col_name or 'PLANTCD' in col_name:
            return 'FKSM'

        # Boolean 플래그
        if '_FLG' in base_name or '_YN' in base_name:
            if 'MAJOR' in base_name or 'INSIDE' in base_name:
                return 'Y'
            return 'N'

        # 날짜
        if data_type == 'date':
            if 'VALID_FROM' in base_name:
                return '2023-01-01 00:00:00'
            if 'VALID_TO' in base_name:
                return '2999-12-31 00:00:00'
            return ''

        # 숫자
        if data_type == 'number':
            return '0'

        return ''

    return None

def get_routing_field(col_name):
    """DB 컬럼에 대응하는 routing_field 결정"""
    base_name = col_name.split('.')[0]

    # 직접 매핑
    field_mapping = {
        'PROC_SEQ': 'seq',
        'JOB_CD': 'JOB_CD',
        'RES_CD': 'RES_CD',
        'WC_CD': 'WC_CD',
        'RUN_TIME': 'run_time',
        'SETUP_TIME': 'setup_time',
        'WAIT_TIME': 'wait_time',
        'MOVE_TIME': 'MOVE_TIME',
        'QUEUE_TIME': 'QUEUE_TIME',
        'ITEM_CD': 'item_code',
        'ROUT_NO': 'routing_no',
        'TIME_UNIT': 'TIME_UNIT',
        'MFG_LT': 'MFG_LT',
        'DESCRIPTION': 'description',
        'ROUT_ORDER': 'ROUT_ORDER',
        'MILESTONE_FLG': 'MILESTONE_FLG',
        'INSP_FLG': 'INSP_FLG',
        'INSIDE_FLG': 'INSIDE_FLG',
        'BATCH_OPER': 'BATCH_OPER',
    }

    if base_name in field_mapping:
        return field_mapping[base_name]

    # 기본값: 컬럼명을 그대로 사용
    return base_name

# 매핑 규칙 생성
mappings = []
for col_name in headers:
    source_type, source_config = determine_source_type(col_name)
    data_type = determine_data_type(col_name)
    default_value = get_default_value(col_name, source_type, data_type)
    routing_field = get_routing_field(col_name)

    mapping = {
        "routing_field": routing_field,
        "db_column": col_name,
        "display_name": col_name,
        "data_type": data_type,
        "is_required": False,
        "default_value": default_value,
        "source_type": source_type,
        "source_config": source_config,
        "transform_rule": None
    }

    mappings.append(mapping)

# 프로파일 생성
profile = {
    "id": "fksm-merged-181-profile",
    "name": "FKSM 병합1 전체 프로파일 (181개 컬럼)",
    "description": "FKSM 라우팅 데이터구조.xlsx의 병합1 시트 전체 형식 (MASTER + DETAIL + CHILD + RES 통합)",
    "mappings": mappings,
    "created_by": "system",
    "created_at": utc_isoformat(),
    "updated_at": utc_isoformat(),
    "is_active": True
}

# 저장
output_path = r'c:\Users\syyun\Documents\GitHub\Routing_ML_251014\config\data_mappings\fksm-merged-181-profile.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(profile, f, indent=2, ensure_ascii=False)

print(f'FKSM 181 column profile created!')
print(f'   File: {output_path}')
print(f'   Total: {len(mappings)} columns')
print(f'\nData source type distribution:')

# 통계
source_type_count = {}
for m in mappings:
    st = m['source_type']
    source_type_count[st] = source_type_count.get(st, 0) + 1

for st, count in sorted(source_type_count.items()):
    print(f'   - {st}: {count}개')
