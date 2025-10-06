# Access DB → PostgreSQL 마이그레이션 계획

**작성일**: 2025-10-06
**목표 완료일**: 2025-12-15
**총 소요 기간**: 10주
**담당**: ML Team, Database Team

---

## 📋 Executive Summary

Access DB의 한계를 극복하고 확장성, 성능, 동시성을 개선하기 위해 PostgreSQL로 마이그레이션합니다.

### 주요 목표
- ✅ **확장성**: 수백만 건 데이터 처리
- ✅ **동시성**: 다중 사용자 동시 접근
- ✅ **성능**: 쿼리 속도 10배 향상
- ✅ **안정성**: 트랜잭션 지원, ACID 보장
- ✅ **표준화**: SQL 표준 준수, 다양한 도구 호환

### 예상 효과
| 항목 | Before (Access) | After (PostgreSQL) | 개선율 |
|------|----------------|-------------------|--------|
| 쿼리 속도 | 평균 500ms | 평균 50ms | 10배 |
| 동시 사용자 | 1-2명 | 100+ 명 | 50배+ |
| 데이터 크기 | 최대 2GB | 무제한 | ∞ |
| 백업/복구 | 수동, 느림 | 자동, 빠름 | 5배 |

---

## 🎯 마이그레이션 단계 (10주)

### Phase 1: 준비 및 분석 (2주) - Week 1-2

#### Week 1: 스키마 분석
**작업**:
1. Access DB 스키마 역공학
2. 테이블/컬럼/관계 문서화
3. 데이터 타입 매핑표 작성
4. 제약조건 확인

**산출물**:
- `schema_analysis.md`: 전체 스키마 문서
- `data_type_mapping.xlsx`: Access → PostgreSQL 타입 매핑

**담당**: Database Team

#### Week 2: PostgreSQL 환경 구축
**작업**:
1. PostgreSQL 14 설치 (Docker)
2. 개발/스테이징 DB 생성
3. 연결 테스트
4. pgAdmin 설정

**산출물**:
- `docker-compose.yml`: PostgreSQL 컨테이너
- `init.sql`: 초기 DB 설정

**담당**: DevOps Team

### Phase 2: 스키마 마이그레이션 (2주) - Week 3-4

#### Week 3: 스키마 변환
**작업**:
1. DDL 스크립트 작성 (테이블, 인덱스)
2. 외래키 제약조건 정의
3. 시퀀스 생성 (AutoNumber → SERIAL)
4. 뷰 재작성

**산출물**:
- `schema.sql`: PostgreSQL DDL 스크립트
- `constraints.sql`: 제약조건
- `indexes.sql`: 인덱스 정의

**담당**: Database Team

#### Week 4: 스키마 검증
**작업**:
1. 개발 DB에 스키마 적용
2. ERD 생성 및 검토
3. 누락된 제약조건 추가
4. 성능 테스트 (인덱스 튜닝)

**산출물**:
- `erd.png`: Entity-Relationship Diagram
- `schema_validation_report.md`: 검증 보고서

**담당**: Database Team, ML Team

### Phase 3: 데이터 이전 스크립트 개발 (2주) - Week 5-6

#### Week 5: ETL 스크립트 작성
**작업**:
1. Python ETL 스크립트 개발
2. 데이터 변환 로직 구현
3. NULL 값 처리
4. 데이터 정합성 검증

**산출물**:
- `scripts/migrate_access_to_postgres.py`: 메인 스크립트
- `scripts/data_transformers.py`: 변환 로직

**담당**: ML Team

#### Week 6: 테스트 및 최적화
**작업**:
1. 소규모 데이터 이전 테스트
2. 성능 최적화 (배치 처리)
3. 에러 핸들링 개선
4. 롤백 절차 작성

**산출물**:
- `migration_test_report.md`: 테스트 결과
- `rollback_procedure.md`: 롤백 절차

**담당**: ML Team, QA Team

### Phase 4: 병렬 운영 (4주) - Week 7-10

#### Week 7-8: 이중 쓰기 (Dual Write)
**작업**:
1. 백엔드 코드 수정 (Access + PostgreSQL 동시 쓰기)
2. 데이터 동기화 검증
3. 모니터링 대시보드 구축
4. 일관성 체크 스크립트

**산출물**:
- `backend/database_dual.py`: 이중 쓰기 로직
- `scripts/sync_check.py`: 동기화 검증

**담당**: Backend Team

#### Week 9: 읽기 전환 준비
**작업**:
1. PostgreSQL 읽기 성능 테스트
2. 쿼리 최적화
3. 캐싱 전략 수립
4. 피드백 수집

**산출물**:
- `performance_test_report.md`: 성능 테스트 결과

**담당**: ML Team, QA Team

#### Week 10: 완전 전환 및 모니터링
**작업**:
1. Access DB 읽기 중단
2. PostgreSQL만 사용
3. 7일간 집중 모니터링
4. Access DB 백업 및 보관

**산출물**:
- `migration_completion_report.md`: 완료 보고서

**담당**: 전체 팀

---

## 📊 스키마 매핑

### 주요 테이블

#### 1. ITEM_INFO_VIEW → items
```sql
-- Access DB
CREATE TABLE ITEM_INFO_VIEW (
    ITEM_CODE TEXT(50),
    ITEM_NAME TEXT(200),
    SPEC TEXT(500),
    UNIT TEXT(20),
    CATEGORY TEXT(50)
);

-- PostgreSQL
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    item_code VARCHAR(50) NOT NULL UNIQUE,
    item_name VARCHAR(200) NOT NULL,
    spec VARCHAR(500),
    unit VARCHAR(20),
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT items_item_code_check CHECK (item_code <> ''),
    CONSTRAINT items_item_name_check CHECK (item_name <> '')
);

CREATE INDEX idx_items_code ON items(item_code);
CREATE INDEX idx_items_category ON items(category);
```

#### 2. ROUTING_MASTER → routings
```sql
-- PostgreSQL
CREATE TABLE routings (
    id SERIAL PRIMARY KEY,
    routing_code VARCHAR(50) NOT NULL UNIQUE,
    routing_name VARCHAR(200) NOT NULL,
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT routings_status_check CHECK (status IN ('active', 'inactive', 'draft'))
);

CREATE INDEX idx_routings_code ON routings(routing_code);
CREATE INDEX idx_routings_item ON routings(item_id);
CREATE INDEX idx_routings_status ON routings(status);
```

#### 3. OPERATION_DETAIL → operations
```sql
-- PostgreSQL
CREATE TABLE operations (
    id SERIAL PRIMARY KEY,
    routing_id INTEGER REFERENCES routings(id) ON DELETE CASCADE,
    op_no VARCHAR(10) NOT NULL,
    op_name VARCHAR(200) NOT NULL,
    work_center VARCHAR(50),
    description TEXT,
    std_time_minutes DECIMAL(10, 2),
    sequence INTEGER NOT NULL,

    CONSTRAINT operations_routing_seq UNIQUE (routing_id, sequence)
);

CREATE INDEX idx_operations_routing ON operations(routing_id);
CREATE INDEX idx_operations_work_center ON operations(work_center);
```

### 데이터 타입 매핑

| Access | PostgreSQL | 예시 |
|--------|-----------|------|
| TEXT(n) | VARCHAR(n) | TEXT(50) → VARCHAR(50) |
| MEMO | TEXT | MEMO → TEXT |
| NUMBER (Integer) | INTEGER | NUMBER → INTEGER |
| NUMBER (Long) | BIGINT | NUMBER → BIGINT |
| NUMBER (Decimal) | DECIMAL(p,s) | NUMBER → DECIMAL(10,2) |
| CURRENCY | DECIMAL(19,4) | CURRENCY → DECIMAL(19,4) |
| DATE/TIME | TIMESTAMP | DATE/TIME → TIMESTAMP |
| YES/NO | BOOLEAN | YES/NO → BOOLEAN |
| AutoNumber | SERIAL | AutoNumber → SERIAL |
| OLE Object | BYTEA | OLE Object → BYTEA |

---

## 🔄 데이터 이전 스크립트

### migrate_access_to_postgres.py

```python
#!/usr/bin/env python3
"""
Access DB → PostgreSQL 마이그레이션 스크립트
"""
import pyodbc
import psycopg2
from psycopg2.extras import execute_batch
from tqdm import tqdm
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 연결 설정
ACCESS_CONN_STR = (
    r'DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};'
    r'DBQ=/mnt/data/routing_data/ROUTING AUTO TEST.accdb;'
)

POSTGRES_CONN_STR = (
    "host=localhost "
    "port=5432 "
    "dbname=routing_ml "
    "user=postgres "
    "password=your_password"
)

def migrate_table(access_table, postgres_table, transform_fn=None):
    """테이블 마이그레이션"""
    # Access 연결
    access_conn = pyodbc.connect(ACCESS_CONN_STR)
    access_cursor = access_conn.cursor()

    # PostgreSQL 연결
    pg_conn = psycopg2.connect(POSTGRES_CONN_STR)
    pg_cursor = pg_conn.cursor()

    try:
        # 데이터 읽기
        logger.info(f"Reading from {access_table}...")
        access_cursor.execute(f"SELECT * FROM {access_table}")
        rows = access_cursor.fetchall()
        columns = [desc[0] for desc in access_cursor.description]

        logger.info(f"Found {len(rows)} rows")

        # 데이터 변환
        if transform_fn:
            rows = [transform_fn(row, columns) for row in rows]

        # PostgreSQL에 삽입
        logger.info(f"Inserting into {postgres_table}...")
        placeholders = ','.join(['%s'] * len(columns))
        insert_sql = f"INSERT INTO {postgres_table} ({','.join(columns)}) VALUES ({placeholders})"

        execute_batch(pg_cursor, insert_sql, rows, page_size=1000)
        pg_conn.commit()

        logger.info(f"✅ Migration completed: {len(rows)} rows")

    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        pg_conn.rollback()
        raise
    finally:
        access_cursor.close()
        access_conn.close()
        pg_cursor.close()
        pg_conn.close()

def transform_item(row, columns):
    """ITEM_INFO_VIEW → items 변환"""
    # NULL 값 처리
    transformed = []
    for i, col in enumerate(columns):
        value = row[i]
        if value is None:
            if col in ['ITEM_CODE', 'ITEM_NAME']:
                raise ValueError(f"Required field {col} is NULL")
            transformed.append(None)
        else:
            # 문자열 trim
            if isinstance(value, str):
                value = value.strip()
            transformed.append(value)
    return transformed

if __name__ == "__main__":
    # 순서대로 마이그레이션
    tables = [
        ('ITEM_INFO_VIEW', 'items', transform_item),
        ('ROUTING_MASTER', 'routings', None),
        ('OPERATION_DETAIL', 'operations', None),
    ]

    for access_table, postgres_table, transform_fn in tables:
        migrate_table(access_table, postgres_table, transform_fn)

    logger.info("🎉 All migrations completed!")
```

---

## 🔀 병렬 운영 전략

### 이중 쓰기 (Dual Write)

```python
# backend/database_dual.py
class DualDatabaseManager:
    """Access + PostgreSQL 동시 쓰기"""

    def __init__(self):
        self.access_conn = connect_to_access()
        self.pg_conn = connect_to_postgres()
        self.sync_errors = []

    def insert_item(self, item_data):
        """품목 삽입 (양쪽 DB)"""
        try:
            # 1. PostgreSQL (Primary)
            pg_id = self._insert_to_postgres(item_data)

            # 2. Access (Fallback)
            access_id = self._insert_to_access(item_data)

            # 3. 동기화 검증
            if not self._verify_sync(pg_id, access_id):
                self.sync_errors.append({
                    'pg_id': pg_id,
                    'access_id': access_id,
                    'data': item_data
                })

            return pg_id

        except Exception as e:
            logger.error(f"Dual write failed: {e}")
            # PostgreSQL 실패 시 Access만 사용
            return self._insert_to_access(item_data)
```

### 읽기 전환 (Read Migration)

```python
# Phase 1: Access 읽기 (Week 7-8)
def get_item(item_code):
    return query_access("SELECT * FROM ITEM_INFO_VIEW WHERE ITEM_CODE = ?", item_code)

# Phase 2: 50/50 읽기 (Week 9)
def get_item(item_code):
    if random.random() < 0.5:
        return query_postgres("SELECT * FROM items WHERE item_code = $1", item_code)
    else:
        return query_access("SELECT * FROM ITEM_INFO_VIEW WHERE ITEM_CODE = ?", item_code)

# Phase 3: PostgreSQL 읽기 (Week 10+)
def get_item(item_code):
    return query_postgres("SELECT * FROM items WHERE item_code = $1", item_code)
```

---

## 📈 롤백 계획

### 롤백 트리거
1. PostgreSQL 응답 시간 > 500ms (10% 이상 요청)
2. 데이터 불일치 > 1%
3. Critical 에러 > 10건/시간
4. 사용자 불만 급증

### 롤백 절차

#### Step 1: 긴급 중단 (5분 이내)
```bash
# 1. PostgreSQL 읽기 중단
# backend/database.py에서 플래그 변경
USE_POSTGRES_READ = False

# 2. 서버 재시작
systemctl restart routing-ml-api
```

#### Step 2: 데이터 동기화 검증 (30분)
```bash
# 동기화 차이 확인
python scripts/sync_check.py --full-scan

# 불일치 데이터 보고서
cat reports/sync_diff_$(date +%Y%m%d).csv
```

#### Step 3: 데이터 복구 (필요 시)
```bash
# Access → PostgreSQL 재동기화
python scripts/migrate_access_to_postgres.py --incremental
```

---

## ✅ 체크리스트

### Phase 1: 준비 ✅
- [ ] Access DB 스키마 분석 완료
- [ ] PostgreSQL 14 설치 (Docker)
- [ ] 데이터 타입 매핑표 작성
- [ ] ERD 작성

### Phase 2: 스키마 마이그레이션
- [ ] DDL 스크립트 작성
- [ ] 제약조건 정의
- [ ] 인덱스 설계
- [ ] 스키마 검증

### Phase 3: 데이터 이전
- [ ] ETL 스크립트 개발
- [ ] 소규모 데이터 테스트
- [ ] 전체 데이터 이전
- [ ] 정합성 검증

### Phase 4: 병렬 운영
- [ ] 이중 쓰기 구현
- [ ] 동기화 검증 스크립트
- [ ] 읽기 전환 (0% → 50% → 100%)
- [ ] 7일간 모니터링

### 완료 및 정리
- [ ] Access DB 백업 및 보관
- [ ] 문서 업데이트
- [ ] 팀 교육
- [ ] 완료 보고서 작성

---

## 📚 참고 문서

- [PostgreSQL 공식 문서](https://www.postgresql.org/docs/)
- [pyodbc 문서](https://github.com/mkleehammer/pyodbc)
- [psycopg2 문서](https://www.psycopg.org/)
- [Access to PostgreSQL Migration Guide](https://wiki.postgresql.org/wiki/Converting_from_other_Databases_to_PostgreSQL)

---

**담당자**: Database Team, ML Team
**검토자**: CTO, DevOps Team
**다음 리뷰**: 2025-10-20 (Phase 1 완료 후)
