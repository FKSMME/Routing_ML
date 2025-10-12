# PostgreSQL 마이그레이션 가이드

**프로젝트**: Routing ML v4
**목적**: Access DB → PostgreSQL 14 마이그레이션
**작성일**: 2025-10-06

---

## 📋 목차

1. [준비사항](#준비사항)
2. [환경 구축](#환경-구축)
3. [스키마 생성](#스키마-생성)
4. [데이터 마이그레이션](#데이터-마이그레이션)
5. [검증](#검증)
6. [문제 해결](#문제-해결)

---

## 🛠️ 준비사항

### 1. 소프트웨어 요구사항

- **Docker** 20.10+
- **Docker Compose** 2.0+
- **Python** 3.9+
- **pyodbc** (Access DB 연결용)
- **psycopg2** (PostgreSQL 연결용)
- **pandas** (데이터 변환용)

### 2. Python 패키지 설치

```bash
pip install pyodbc psycopg2-binary pandas
```

### 3. Access DB 확인

```bash
# Access DB 경로 확인
ls -lh ../routing_data/routing.accdb

# 파일 크기 및 레코드 수 확인
```

---

## 🚀 환경 구축

### Step 1: PostgreSQL + pgAdmin 시작

```bash
cd migration

# Docker Compose로 PostgreSQL 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f postgres

# 서비스 상태 확인
docker-compose ps
```

**결과**:
- PostgreSQL: `localhost:5432`
- pgAdmin: `http://localhost:5050`
- Redis (선택): `localhost:6379`

### Step 2: pgAdmin 접속

1. 브라우저에서 `http://localhost:5050` 접속
2. 로그인 (기본값):
   - Email: `admin@routing.local`
   - Password: `admin_password_2025`
3. 서버 자동 등록 확인 (왼쪽 트리에서 "Routing ML PostgreSQL" 확인)

### Step 3: 연결 테스트

```bash
# PostgreSQL CLI로 접속
docker exec -it routing_ml_postgres psql -U routing_admin -d routing_ml

# 스키마 확인
\dn

# 테이블 목록 확인
\dt routing.*

# 종료
\q
```

---

## 📊 스키마 생성

### 자동 생성 (Docker Compose)

Docker Compose 시작 시 `schema.sql`이 자동 실행됩니다.

### 수동 생성

```bash
# SQL 파일 실행
docker exec -i routing_ml_postgres psql -U routing_admin -d routing_ml < schema.sql

# 또는 pgAdmin에서 Query Tool 사용
# schema.sql 내용 복사 → 붙여넣기 → F5 실행
```

### 스키마 확인

```sql
-- 테이블 목록
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'routing'
ORDER BY table_name;

-- 테이블별 레코드 수
SELECT
    schemaname,
    tablename,
    n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'routing'
ORDER BY n_live_tup DESC;

-- 인덱스 목록
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'routing'
ORDER BY tablename, indexname;
```

---

## 🔄 데이터 마이그레이션

### Step 1: 환경 변수 설정

```bash
# .env 파일 생성
cat > .env <<EOF
# Access DB
ACCESS_DB_PATH=../routing_data/routing.accdb

# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=routing_ml
PG_USER=routing_admin
PG_PASSWORD=routing_secure_password_2025
EOF
```

### Step 2: 단일 테이블 마이그레이션 (테스트)

```bash
# Dry run (실제 INSERT 없이 테스트)
python migrate_access_to_postgres.py --table item_master --dry-run

# 실제 마이그레이션
python migrate_access_to_postgres.py --table item_master --batch-size 1000

# 검증
python migrate_access_to_postgres.py --table item_master --validate-only
```

### Step 3: 전체 테이블 마이그레이션

```bash
# 전체 마이그레이션 (item_master, routing_master)
python migrate_access_to_postgres.py --all --batch-size 1000

# 로그 확인
tail -f migration_*.log
```

### Step 4: 진행 상황 모니터링

```sql
-- PostgreSQL에서 레코드 수 확인
SELECT
    'item_master' AS table_name,
    COUNT(*) AS row_count
FROM routing.item_master
UNION ALL
SELECT
    'routing_master',
    COUNT(*)
FROM routing.routing_master;
```

---

## ✅ 검증

### 1. 레코드 수 비교

```bash
# 자동 검증
python migrate_access_to_postgres.py --all --validate-only
```

**예상 결과**:
```
✅ Validating migration: item_master
  Access: 15,234 rows
  PostgreSQL: 15,234 rows
  Match: True

✅ Validating migration: routing_master
  Access: 87,456 rows
  PostgreSQL: 87,456 rows
  Match: True
```

### 2. NULL 비율 확인

```sql
-- item_master NULL 비율
SELECT
    column_name,
    (COUNT(*) - COUNT(column_name)) * 100.0 / COUNT(*) AS null_percent
FROM routing.item_master,
     information_schema.columns
WHERE table_schema = 'routing'
  AND table_name = 'item_master'
GROUP BY column_name
HAVING (COUNT(*) - COUNT(column_name)) * 100.0 / COUNT(*) > 0
ORDER BY null_percent DESC;
```

### 3. 샘플 데이터 비교

```sql
-- PostgreSQL에서 샘플 조회
SELECT *
FROM routing.item_master
LIMIT 10;

-- Access DB에서 동일 품목 조회하여 비교
```

### 4. 외래키 제약조건 확인

```sql
-- 외래키 위반 체크
SELECT
    r.item_cd,
    COUNT(*)
FROM routing.routing_master r
LEFT JOIN routing.item_master i ON r.item_cd = i.item_cd
WHERE i.item_cd IS NULL
GROUP BY r.item_cd;

-- 결과가 0이어야 함
```

### 5. 성능 테스트

```sql
-- 쿼리 속도 비교
EXPLAIN ANALYZE
SELECT
    i.item_cd,
    i.item_nm,
    COUNT(r.routing_id) AS routing_count
FROM routing.item_master i
LEFT JOIN routing.routing_master r ON i.item_cd = r.item_cd
WHERE i.item_grp1 = 'SEAL'
GROUP BY i.item_cd, i.item_nm
ORDER BY routing_count DESC
LIMIT 100;

-- Access DB 대비 10배+ 빠른 속도 기대
```

---

## 🔧 문제 해결

### 문제 1: Docker 컨테이너가 시작되지 않음

```bash
# 로그 확인
docker-compose logs postgres

# 일반적인 원인:
# - 포트 5432 이미 사용 중
# - 디스크 공간 부족
# - 권한 문제

# 해결:
docker-compose down -v  # 볼륨 삭제
docker-compose up -d    # 재시작
```

### 문제 2: Access DB 연결 실패

```python
# ODBC 드라이버 확인
import pyodbc
print(pyodbc.drivers())

# 결과에 'Microsoft Access Driver (*.mdb, *.accdb)' 있어야 함
# Windows가 아닌 경우: mdbtools 설치 필요
```

### 문제 3: 문자 인코딩 오류

```python
# migrate_access_to_postgres.py에서 인코딩 처리
if pg_type.startswith("VARCHAR") or pg_type == "TEXT":
    try:
        return str(value).encode('cp1252', errors='ignore').decode('utf-8', errors='ignore').strip()
    except:
        return str(value).strip()
```

### 문제 4: 메모리 부족 (대용량 데이터)

```bash
# batch-size 줄이기
python migrate_access_to_postgres.py --all --batch-size 100

# 또는 테이블별로 개별 실행
python migrate_access_to_postgres.py --table item_master --batch-size 500
python migrate_access_to_postgres.py --table routing_master --batch-size 500
```

### 문제 5: 외래키 위반

```sql
-- 외래키 임시 비활성화
ALTER TABLE routing.routing_master DISABLE TRIGGER ALL;

-- 마이그레이션 실행

-- 외래키 재활성화
ALTER TABLE routing.routing_master ENABLE TRIGGER ALL;

-- 위반 사항 확인
SELECT * FROM routing.routing_master r
LEFT JOIN routing.item_master i ON r.item_cd = i.item_cd
WHERE i.item_cd IS NULL;
```

---

## 📈 성능 최적화

### 1. 인덱스 생성 (마이그레이션 후)

```sql
-- 자주 조회하는 컬럼에 인덱스 추가
CREATE INDEX idx_item_master_item_nm ON routing.item_master(item_nm);
CREATE INDEX idx_routing_master_job_cd ON routing.routing_master(job_cd);

-- 복합 인덱스
CREATE INDEX idx_routing_master_item_proc ON routing.routing_master(item_cd, proc_seq);

-- Full-text search (한글)
CREATE INDEX idx_item_master_fts ON routing.item_master
USING gin(to_tsvector('korean', item_nm));
```

### 2. VACUUM & ANALYZE

```sql
-- 통계 정보 업데이트
ANALYZE routing.item_master;
ANALYZE routing.routing_master;

-- 디스크 공간 정리
VACUUM FULL routing.item_master;
VACUUM FULL routing.routing_master;
```

### 3. 파티셔닝 (선택)

```sql
-- 날짜별 파티셔닝 (대용량 로그 테이블용)
CREATE TABLE routing.audit_log_2025_10 PARTITION OF routing.audit_log
FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE routing.audit_log_2025_11 PARTITION OF routing.audit_log
FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
```

---

## 🔐 백업 & 복구

### 백업

```bash
# 전체 DB 백업
docker exec -t routing_ml_postgres pg_dump -U routing_admin routing_ml > backup_$(date +%Y%m%d).sql

# 스키마만 백업
docker exec -t routing_ml_postgres pg_dump -U routing_admin -s routing_ml > schema_only.sql

# 데이터만 백업
docker exec -t routing_ml_postgres pg_dump -U routing_admin -a routing_ml > data_only.sql

# 압축 백업
docker exec -t routing_ml_postgres pg_dump -U routing_admin routing_ml | gzip > backup.sql.gz
```

### 복구

```bash
# SQL 파일에서 복구
docker exec -i routing_ml_postgres psql -U routing_admin routing_ml < backup_20251006.sql

# 압축 파일에서 복구
gunzip -c backup.sql.gz | docker exec -i routing_ml_postgres psql -U routing_admin routing_ml
```

---

## 📊 모니터링

### 1. 연결 수 모니터링

```sql
-- 현재 연결 수
SELECT COUNT(*) FROM pg_stat_activity;

-- 연결 상세
SELECT
    datname,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    state_change
FROM pg_stat_activity
WHERE datname = 'routing_ml';
```

### 2. 쿼리 성능 모니터링

```sql
-- 느린 쿼리 확인
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 3. 테이블 크기 모니터링

```sql
-- 테이블별 디스크 사용량
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'routing'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🎯 다음 단계

1. ✅ PostgreSQL 환경 구축 완료
2. ✅ 스키마 생성 완료
3. ✅ 데이터 마이그레이션 완료
4. ✅ 검증 완료
5. ⏭️ **이중 쓰기 전략** 구현 (Access + PostgreSQL 병렬 운영)
6. ⏭️ **애플리케이션 코드 수정** (SQLAlchemy 연결 변경)
7. ⏭️ **성능 테스트** (부하 테스트, 동시 접속 테스트)
8. ⏭️ **운영 전환** (Access DB 읽기 전용 → PostgreSQL 메인)

---

## 📚 참고 자료

- [PostgreSQL 14 공식 문서](https://www.postgresql.org/docs/14/)
- [pgAdmin 4 사용 가이드](https://www.pgadmin.org/docs/pgadmin4/latest/)
- [Access to PostgreSQL Migration Best Practices](https://wiki.postgresql.org/wiki/Converting_from_other_Databases_to_PostgreSQL#Access)
- [Routing ML v4 마이그레이션 계획서](../docs/migration/PostgreSQL_마이그레이션_계획.md)

---

**작성자**: ML Team
**최종 업데이트**: 2025-10-06
**버전**: 1.0.0
