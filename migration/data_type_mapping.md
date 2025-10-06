# Access DB → PostgreSQL 데이터 타입 매핑

**작성일**: 2025-10-06
**목적**: Access DB에서 PostgreSQL로 데이터 마이그레이션 시 타입 변환 가이드

---

## 📊 데이터 타입 매핑표

| Access 타입 | PostgreSQL 타입 | 비고 |
|------------|----------------|------|
| **Text** | | |
| Text (50) | VARCHAR(50) | 가변 길이 문자열 |
| Text (255) | VARCHAR(255) | 기본 텍스트 필드 |
| Text (>255) | TEXT | 긴 텍스트 |
| Memo | TEXT | 무제한 텍스트 |
| Hyperlink | VARCHAR(500) | URL 저장 |
| **Numeric** | | |
| Byte | SMALLINT | 0-255 → PostgreSQL은 음수 지원 |
| Integer | INTEGER | -2,147,483,648 ~ 2,147,483,647 |
| Long Integer | BIGINT | 큰 정수 |
| Single | REAL | 단정밀도 부동소수점 |
| Double | DOUBLE PRECISION | 배정밀도 부동소수점 |
| Decimal (p, s) | NUMERIC(p, s) | 정밀 소수 (권장) |
| Currency | NUMERIC(19, 4) | 통화 ($1234.5678) |
| **Date/Time** | | |
| Date/Time | TIMESTAMP | 날짜+시간 |
| Date (Only) | DATE | 날짜만 |
| Time (Only) | TIME | 시간만 |
| **Boolean** | | |
| Yes/No | BOOLEAN | TRUE/FALSE |
| Checkbox | BOOLEAN | 체크박스 |
| **Binary** | | |
| OLE Object | BYTEA | 바이너리 데이터 |
| Attachment | BYTEA | 파일 첨부 |
| **Auto Number** | | |
| AutoNumber | BIGSERIAL | 자동 증가 (1, 2, 3...) |
| AutoNumber (UUID) | UUID | gen_random_uuid() |
| **Special** | | |
| Lookup (Single) | VARCHAR + FK | 외래키 참조 |
| Lookup (Multi) | JSONB | 배열 저장 |

---

## 🔍 프로젝트별 구체적 매핑

### 1. ITEM_MASTER (품목 마스터)

| Access 컬럼명 | Access 타입 | PostgreSQL 타입 | Null 허용 | 비고 |
|-------------|-----------|----------------|---------|------|
| ITEM_CD | Text(100) | VARCHAR(100) | NOT NULL | PK |
| PART_TYPE | Text(50) | VARCHAR(50) | NULL | 부품 유형 |
| PartNm | Text(255) | VARCHAR(255) | NULL | 부품명 |
| ITEM_NM | Text(500) | VARCHAR(500) | NULL | 품목명 |
| ITEM_SPEC | Memo | TEXT | NULL | 사양 |
| OUTDIAMETER | Double | NUMERIC(18, 4) | NULL | 외경 (mm) |
| INDIAMETER | Double | NUMERIC(18, 4) | NULL | 내경 (mm) |
| ROTATE_CLOCKWISE | Integer | INTEGER | NULL | 시계방향 회전 |
| STANDARD_YN | Text(1) | CHAR(1) | NULL | 표준품 여부 (Y/N) |
| INSRT_DT | Date/Time | TIMESTAMP | NULL | 입력일시 |

### 2. ROUTING_MASTER (공정 마스터)

| Access 컬럼명 | Access 타입 | PostgreSQL 타입 | Null 허용 | 비고 |
|-------------|-----------|----------------|---------|------|
| ROUTING_ID | AutoNumber | BIGSERIAL | NOT NULL | PK (자동 생성) |
| ITEM_CD | Text(100) | VARCHAR(100) | NOT NULL | FK → item_master |
| ROUT_NO | Text(50) | VARCHAR(50) | NULL | 공정 번호 |
| PROC_SEQ | Integer | INTEGER | NOT NULL | 공정 순서 |
| JOB_CD | Text(50) | VARCHAR(50) | NULL | 작업 코드 |
| SETUP_TIME | Double | NUMERIC(18, 4) | NULL | 세팅 시간 |
| RUN_TIME | Double | NUMERIC(18, 4) | NULL | 가공 시간 |
| VALID_FROM_DT | Date | DATE | NULL | 유효 시작일 |
| VALID_TO_DT | Date | DATE | NULL | 유효 종료일 |
| INSIDE_FLAG | Text(1) | CHAR(1) | NULL | 내/외주 구분 |
| INSRT_DT | Date/Time | TIMESTAMP | NULL | 입력일시 |

### 3. ML_PREDICTIONS (ML 예측 결과)

| 컬럼명 | PostgreSQL 타입 | Null 허용 | 비고 |
|-------|----------------|---------|------|
| prediction_id | BIGSERIAL | NOT NULL | PK |
| source_item_cd | VARCHAR(100) | NOT NULL | 예측 요청 품목 |
| similarity_score | NUMERIC(10, 8) | NULL | 유사도 (0~1) |
| feature_importance | JSONB | NULL | SHAP values |
| matched_features | TEXT[] | NULL | PostgreSQL 배열 |
| created_at | TIMESTAMP | NOT NULL | 예측 시각 |

---

## ⚠️ 주의사항

### 1. NULL 값 처리
- Access: 빈 문자열 `""` vs NULL 혼용
- PostgreSQL: NULL과 빈 문자열 명확히 구분
- **권장**: 마이그레이션 시 빈 문자열 → NULL 변환

```python
# ETL 예시
if value == "" or value is None:
    return None
```

### 2. 날짜 형식
- Access: `#01/15/2025#` (미국 형식)
- PostgreSQL: `'2025-01-15'` (ISO 8601)
- **권장**: `YYYY-MM-DD` 형식으로 통일

```python
# ETL 예시
from datetime import datetime
access_date = "#01/15/2025#"
pg_date = datetime.strptime(access_date.strip("#"), "%m/%d/%Y").strftime("%Y-%m-%d")
```

### 3. Boolean 값
- Access: Yes/No, True/False, -1/0
- PostgreSQL: TRUE/FALSE
- **권장**: 명시적 변환

```python
# ETL 예시
def convert_boolean(value):
    if value in ("Yes", "TRUE", True, -1):
        return True
    elif value in ("No", "FALSE", False, 0):
        return False
    return None
```

### 4. 문자 인코딩
- Access: Windows-1252 (CP1252)
- PostgreSQL: UTF-8
- **권장**: 마이그레이션 시 UTF-8 변환

```python
# ETL 예시
text = text.encode('cp1252', errors='ignore').decode('utf-8', errors='ignore')
```

### 5. 자동 증가 ID
- Access: AutoNumber (1부터 시작, 중간 삭제 시 건너뜀)
- PostgreSQL: BIGSERIAL (Sequence 사용)
- **권장**: 기존 ID 보존, 새 데이터는 자동 증가

```sql
-- 기존 최대값 확인 후 시퀀스 조정
SELECT setval('routing_master_routing_id_seq', (SELECT MAX(routing_id) FROM routing_master));
```

### 6. JSONB vs JSON
- PostgreSQL: JSONB (권장) - 바이너리 형식, 인덱싱 가능
- JSON: 텍스트 형식, 느림
- **권장**: JSONB 사용

```sql
-- JSONB 인덱스 생성
CREATE INDEX idx_predictions_feature_importance ON ml_predictions USING gin(feature_importance);
```

---

## 🔧 타입 변환 함수 (Python)

```python
from typing import Any, Optional
from datetime import datetime
import decimal

def convert_access_to_postgres(value: Any, pg_type: str) -> Optional[Any]:
    """Access 값을 PostgreSQL 타입으로 변환"""

    # NULL 처리
    if value is None or value == "":
        return None

    # VARCHAR, TEXT, CHAR
    if pg_type.startswith("VARCHAR") or pg_type == "TEXT" or pg_type.startswith("CHAR"):
        return str(value).strip()

    # INTEGER, BIGINT, SMALLINT
    if pg_type in ("INTEGER", "BIGINT", "SMALLINT"):
        return int(value)

    # NUMERIC, DECIMAL
    if pg_type.startswith("NUMERIC") or pg_type.startswith("DECIMAL"):
        return decimal.Decimal(str(value))

    # REAL, DOUBLE PRECISION
    if pg_type in ("REAL", "DOUBLE PRECISION"):
        return float(value)

    # BOOLEAN
    if pg_type == "BOOLEAN":
        if value in ("Yes", "TRUE", True, -1):
            return True
        elif value in ("No", "FALSE", False, 0):
            return False
        return None

    # TIMESTAMP
    if pg_type == "TIMESTAMP":
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            # Access 날짜 형식: #01/15/2025 14:30:00#
            value = value.strip("#")
            return datetime.strptime(value, "%m/%d/%Y %H:%M:%S")
        return None

    # DATE
    if pg_type == "DATE":
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            value = value.strip("#")
            return datetime.strptime(value, "%m/%d/%Y").date()
        return None

    # JSONB (Python dict/list → JSON)
    if pg_type == "JSONB":
        import json
        if isinstance(value, (dict, list)):
            return json.dumps(value)
        return value

    # UUID
    if pg_type == "UUID":
        import uuid
        if isinstance(value, uuid.UUID):
            return str(value)
        return str(value)

    # 기본값
    return value
```

---

## 📋 체크리스트

마이그레이션 전 확인사항:

- [ ] Access DB 버전 확인 (.accdb vs .mdb)
- [ ] PostgreSQL 버전 확인 (14+)
- [ ] 문자 인코딩 확인 (UTF-8)
- [ ] 타임존 설정 확인 (KST = Asia/Seoul)
- [ ] 테이블 수 확인 (Access vs PostgreSQL)
- [ ] 레코드 수 확인 (Before vs After)
- [ ] NULL 값 비율 확인
- [ ] 외래키 제약조건 확인
- [ ] 인덱스 생성 확인
- [ ] 성능 테스트 (쿼리 속도)

---

## 🚀 마이그레이션 순서

1. **스키마 생성**: `schema.sql` 실행
2. **데이터 추출**: Access → CSV/Parquet
3. **데이터 변환**: Python ETL 스크립트
4. **데이터 로드**: PostgreSQL COPY 명령
5. **제약조건 활성화**: 외래키, UNIQUE 등
6. **인덱스 생성**: 성능 최적화
7. **검증**: 레코드 수, NULL 비율, 샘플 데이터 비교
8. **성능 테스트**: 쿼리 속도 비교

---

## 📚 참고 자료

- [PostgreSQL 공식 문서 - 데이터 타입](https://www.postgresql.org/docs/14/datatype.html)
- [Access to PostgreSQL Migration Guide](https://wiki.postgresql.org/wiki/Converting_from_other_Databases_to_PostgreSQL#Access)
- [pgloader - 자동 마이그레이션 도구](https://github.com/dimitri/pgloader)

---

**다음 단계**: `migrate_access_to_postgres.py` ETL 스크립트 작성
