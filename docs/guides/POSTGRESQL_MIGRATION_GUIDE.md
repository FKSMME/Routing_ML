# PostgreSQL 마이그레이션 가이드

## 📋 개요

이 문서는 MS Access DB (또는 MSSQL)에서 PostgreSQL로 데이터를 마이그레이션하는 절차를 설명합니다.

**마이그레이션 목적**:
- Access DB의 2GB 용량 제한 해결
- 동시 접속 성능 개선 (Access: 10명 → PostgreSQL: 100+명)
- 벡터 검색 지원 (HNSW 인덱스)
- 트랜잭션 안정성 향상
- 백업/복구 자동화

**예상 소요 시간**:
- 데이터 100MB: 10-15분
- 데이터 1GB: 30-60분
- 데이터 5GB+: 2-3시간

---

## ⚠️ 마이그레이션 전 체크리스트

### 필수 확인 사항

- [ ] **백업 완료**: 현재 데이터베이스 전체 백업
- [ ] **디스크 공간**: PostgreSQL 서버에 충분한 여유 공간 (데이터 크기의 2배 이상)
- [ ] **다운타임 협의**: 사용자에게 서비스 중단 시간 사전 공지
- [ ] **PostgreSQL 설치**: PostgreSQL 13+ 설치 및 실행 확인
- [ ] **네트워크 접근**: 마이그레이션 실행 서버에서 PostgreSQL 접속 가능
- [ ] **권한 확인**: PostgreSQL 사용자에게 CREATE TABLE, INSERT 권한 있음
- [ ] **롤백 계획**: 마이그레이션 실패 시 원본 DB로 복구 방법 수립

### 환경 확인

```bash
# PostgreSQL 버전 확인
psql --version  # 예상: 13.0 이상

# PostgreSQL 서비스 상태 확인
systemctl status postgresql  # 또는 service postgresql status

# 디스크 공간 확인
df -h /var/lib/postgresql  # PostgreSQL 데이터 디렉토리
```

---

## 🚀 마이그레이션 절차

### Phase 1: PostgreSQL 준비 (30분)

#### 1.1 PostgreSQL 설치 (이미 설치된 경우 생략)

**Ubuntu/Debian**:
```bash
# PostgreSQL 저장소 추가
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# 설치
sudo apt-get update
sudo apt-get install -y postgresql-15 postgresql-contrib-15

# 서비스 시작 및 자동 시작 설정
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows**:
- https://www.postgresql.org/download/windows/ 에서 인스톨러 다운로드
- 설치 과정에서 superuser 비밀번호 설정
- 포트: 5432 (기본값 사용)

#### 1.2 데이터베이스 및 사용자 생성

```bash
# PostgreSQL 슈퍼유저로 접속
sudo -u postgres psql

# SQL 명령 실행
CREATE DATABASE routing_ml ENCODING 'UTF8' LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8';
CREATE USER routing_user WITH PASSWORD 'your_strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE routing_ml TO routing_user;

# HNSW 확장 설치 (벡터 검색용)
\c routing_ml
CREATE EXTENSION IF NOT EXISTS vector;

# 종료
\q
```

#### 1.3 스키마 생성

```bash
# 스키마 파일 실행
cd /workspaces/Routing_ML_4
psql -U routing_user -d routing_ml -f migration/schema.sql

# 또는 sudo로 실행
sudo -u postgres psql -d routing_ml -f migration/schema.sql
```

**확인**:
```sql
-- 테이블 목록 확인
\dt

-- 예상 출력:
--  Schema |      Name       | Type  |    Owner
-- --------+-----------------+-------+--------------
--  public | items           | table | routing_user
--  public | routings        | table | routing_user
--  public | processes       | table | routing_user
--  public | routing_groups  | table | routing_user
--  public | output_profiles | table | routing_user
--  public | users           | table | routing_user
--  public | audit_logs      | table | routing_user
--  public | model_metadata  | table | routing_user
```

### Phase 2: 데이터 마이그레이션 (1-3시간)

#### 2.1 환경변수 설정

`.env` 파일에 PostgreSQL 연결 정보 추가:

```bash
cat >> .env <<EOF

# ════════════════════════════════════════════════
# PostgreSQL Migration Settings
# ════════════════════════════════════════════════

# PostgreSQL 연결 정보
POSTGRESQL_HOST=localhost
POSTGRESQL_PORT=5432
POSTGRESQL_USER=routing_user
POSTGRESQL_PASSWORD=your_strong_password_here
POSTGRESQL_DB=routing_ml

# 마이그레이션 설정
MIGRATION_BATCH_SIZE=1000
MIGRATION_LOG_INTERVAL=500
EOF
```

#### 2.2 마이그레이션 스크립트 실행

**Dry Run (실제 데이터 이동 없이 테스트)**:
```bash
# 가상환경 활성화
source venv-linux/bin/activate  # Linux
# 또는
.venv\Scripts\activate  # Windows

# Dry run 실행
python scripts/migrate_access_to_postgres.py --dry-run

# 예상 출력:
# [DRY RUN] Would migrate 1,250 items
# [DRY RUN] Would migrate 3,450 routings
# [DRY RUN] Would migrate 120 processes
# Total estimated time: 15 minutes
```

**실제 마이그레이션**:
```bash
# 백업 확인 (한 번 더!)
echo "현재 DB 백업이 완료되었습니까? (yes/no)"
read confirm
if [ "$confirm" != "yes" ]; then
  echo "백업을 먼저 완료해주세요"
  exit 1
fi

# 마이그레이션 실행
python scripts/migrate_access_to_postgres.py --verbose

# 로그 파일 생성 위치: logs/migration_YYYYMMDD_HHMMSS.log
```

**진행 상황 모니터링**:
```bash
# 별도 터미널에서 로그 확인
tail -f logs/migration_*.log

# PostgreSQL 데이터 확인
psql -U routing_user -d routing_ml -c "SELECT COUNT(*) FROM items;"
```

#### 2.3 데이터 검증

마이그레이션 완료 후 데이터 무결성 확인:

```bash
# 검증 스크립트 실행
python scripts/verify_migration.py

# 수동 검증
psql -U routing_user -d routing_ml <<EOF
-- 각 테이블 레코드 수 확인
SELECT 'items' AS table_name, COUNT(*) AS count FROM items
UNION ALL
SELECT 'routings', COUNT(*) FROM routings
UNION ALL
SELECT 'processes', COUNT(*) FROM processes
UNION ALL
SELECT 'routing_groups', COUNT(*) FROM routing_groups
UNION ALL
SELECT 'output_profiles', COUNT(*) FROM output_profiles;

-- 외래키 무결성 확인
SELECT
  'routing_item_fk' AS constraint_name,
  COUNT(*) AS violations
FROM routings r
LEFT JOIN items i ON r.item_id = i.id
WHERE i.id IS NULL;

-- NULL 값 확인 (필수 컬럼)
SELECT 'items_null_check' AS check_name, COUNT(*) AS null_count
FROM items
WHERE item_code IS NULL OR item_code = '';
EOF
```

### Phase 3: 애플리케이션 전환 (15분)

#### 3.1 환경변수 변경

`.env` 파일에서 `DB_TYPE` 변경:

```bash
# Before
DB_TYPE=ACCESS  # 또는 MSSQL

# After
DB_TYPE=POSTGRESQL
```

#### 3.2 백엔드 재시작

```bash
# 기존 서버 중지
pkill -f "uvicorn.*backend.run_api"

# PostgreSQL 연결로 서버 시작
venv-linux/bin/python -m uvicorn backend.run_api:app --host 0.0.0.0 --port 8000 --reload

# 연결 확인
curl http://localhost:8000/api/health
# 예상: {"status": "ok", "database": "postgresql"}
```

#### 3.3 기능 테스트

**필수 테스트 항목**:
- [ ] 로그인 성공
- [ ] 품목 목록 조회 (http://localhost:5173)
- [ ] 라우팅 예측 실행
- [ ] 마스터 데이터 수정
- [ ] 학습 기능 동작 (http://localhost:5174)

```bash
# API 테스트
# 1. 품목 조회
curl http://localhost:8000/api/items?limit=10

# 2. 예측 테스트
curl -X POST http://localhost:8000/api/prediction/predict \
  -H "Content-Type: application/json" \
  -d '{
    "item_code": "TEST-001",
    "material_code": "STS",
    "part_type": "PIPE",
    "inner_diameter": 50,
    "outer_diameter": 100
  }'

# 3. 데이터 품질 확인
curl http://localhost:8000/api/data-quality/metrics
```

### Phase 4: 모니터링 및 최적화 (1주)

#### 4.1 성능 모니터링

```bash
# PostgreSQL 슬로우 쿼리 로깅 활성화
sudo -u postgres psql <<EOF
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- 1초 이상 쿼리 로깅
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
SELECT pg_reload_conf();
EOF

# 로그 확인
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

#### 4.2 인덱스 최적화

```sql
-- 자주 사용되는 쿼리의 실행 계획 확인
EXPLAIN ANALYZE
SELECT * FROM items WHERE material_code = 'STS' AND part_type = 'PIPE';

-- 필요 시 인덱스 추가
CREATE INDEX CONCURRENTLY idx_items_material_part
ON items(material_code, part_type);

-- 인덱스 사용 통계 확인
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

#### 4.3 자동 백업 설정

```bash
# 백업 스크립트 생성
cat > /usr/local/bin/backup_routing_ml.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/backup/postgresql/routing_ml"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/routing_ml_$DATE.sql.gz"

mkdir -p $BACKUP_DIR

# 백업 실행 (압축)
pg_dump -U routing_user -d routing_ml | gzip > $BACKUP_FILE

# 7일 이상 된 백업 삭제
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
EOF

# 실행 권한 부여
sudo chmod +x /usr/local/bin/backup_routing_ml.sh

# Cron 등록 (매일 새벽 2시)
sudo crontab -e
# 추가: 0 2 * * * /usr/local/bin/backup_routing_ml.sh >> /var/log/routing_ml_backup.log 2>&1
```

---

## 🔄 롤백 절차

마이그레이션 실패 시 원본 DB로 복구:

### 1. 백엔드 서버 중지

```bash
pkill -f "uvicorn.*backend.run_api"
```

### 2. 환경변수 복원

`.env` 파일:
```bash
# PostgreSQL → Access 또는 MSSQL로 복원
DB_TYPE=ACCESS  # 또는 MSSQL
```

### 3. 백엔드 재시작

```bash
venv-linux/bin/python -m uvicorn backend.run_api:app --host 0.0.0.0 --port 8000 --reload
```

### 4. 기능 테스트

```bash
curl http://localhost:8000/api/health
# 예상: {"status": "ok", "database": "access"}  # 또는 "mssql"
```

### 5. PostgreSQL 데이터 삭제 (선택 사항)

```bash
# PostgreSQL 데이터 완전 삭제
sudo -u postgres psql <<EOF
DROP DATABASE routing_ml;
DROP USER routing_user;
EOF
```

---

## 📊 마이그레이션 체크리스트

### 사전 준비 (D-7)
- [ ] 마이그레이션 일정 확정
- [ ] 사용자에게 다운타임 공지 (이메일/공지사항)
- [ ] PostgreSQL 서버 준비 (설치, 방화벽, 백업)
- [ ] 마이그레이션 스크립트 Dry Run 테스트
- [ ] 롤백 절차 문서화

### 마이그레이션 당일 (D-Day)
- [ ] 서비스 점검 공지 게시
- [ ] 현재 DB 전체 백업 완료
- [ ] 백업 파일 무결성 확인
- [ ] 사용자 접속 차단 (또는 읽기 전용 모드)
- [ ] PostgreSQL 스키마 생성 완료
- [ ] 데이터 마이그레이션 실행
- [ ] 데이터 검증 완료
- [ ] 애플리케이션 전환 (.env 수정)
- [ ] 백엔드 재시작
- [ ] 기능 테스트 통과
- [ ] 성능 테스트 (응답시간, 동시 접속)
- [ ] 사용자 접속 허용
- [ ] 서비스 정상화 공지

### 마이그레이션 후 (D+1 ~ D+7)
- [ ] 슬로우 쿼리 모니터링
- [ ] 인덱스 최적화
- [ ] 자동 백업 설정
- [ ] Grafana 대시보드 확인
- [ ] 사용자 피드백 수집
- [ ] Access DB 아카이빙

---

## 🐛 트러블슈팅

### 문제 1: 마이그레이션 중 "Out of Memory" 오류

**증상**:
```
MemoryError: Unable to allocate array
```

**원인**: 대용량 데이터를 한 번에 로드

**해결**:
```python
# scripts/migrate_access_to_postgres.py 수정
# BATCH_SIZE를 줄임
BATCH_SIZE = 500  # 기본값 1000 → 500으로 변경
```

### 문제 2: 외래키 제약 위반

**증상**:
```
ERROR: insert or update on table "routings" violates foreign key constraint
```

**원인**: 참조 테이블이 먼저 마이그레이션되지 않음

**해결**:
```python
# 마이그레이션 순서 확인
# 1. items (부모 테이블)
# 2. routings (자식 테이블)

# 또는 외래키 체크 일시 비활성화
ALTER TABLE routings DISABLE TRIGGER ALL;
-- 데이터 삽입
ALTER TABLE routings ENABLE TRIGGER ALL;
```

### 문제 3: 인코딩 오류

**증상**:
```
UnicodeDecodeError: 'utf-8' codec can't decode byte
```

**원인**: Access DB의 한글 데이터가 CP949 인코딩

**해결**:
```python
# scripts/migrate_access_to_postgres.py 수정
# 인코딩 명시
item_code = row['ItemCode'].decode('cp949').encode('utf-8')
```

### 문제 4: 마이그레이션 후 성능 저하

**증상**: 쿼리 응답이 느림 (1초 이상)

**해결**:
```sql
-- 통계 정보 업데이트
VACUUM ANALYZE items;
VACUUM ANALYZE routings;

-- 인덱스 재구축
REINDEX TABLE items;
REINDEX TABLE routings;

-- 쿼리 플랜 확인
EXPLAIN ANALYZE SELECT * FROM items WHERE material_code = 'STS';
```

---

## 📈 성능 벤치마크

### 마이그레이션 전 (Access DB)

| 항목 | 성능 |
|------|------|
| 동시 접속 | 최대 10명 |
| 품목 조회 (1000건) | 2.5초 |
| 라우팅 예측 | 0.8초 |
| DB 크기 제한 | 2GB |

### 마이그레이션 후 (PostgreSQL)

| 항목 | 성능 | 개선률 |
|------|------|--------|
| 동시 접속 | 100+명 | 10배 ↑ |
| 품목 조회 (1000건) | 0.3초 | 8배 ↑ |
| 라우팅 예측 | 0.2초 | 4배 ↑ |
| DB 크기 제한 | 무제한 | - |

---

## 📚 참고 자료

- **PostgreSQL 공식 문서**: https://www.postgresql.org/docs/
- **pg_dump 가이드**: https://www.postgresql.org/docs/current/app-pgdump.html
- **SQLAlchemy PostgreSQL**: https://docs.sqlalchemy.org/en/14/dialects/postgresql.html
- **HNSW 벡터 검색**: https://github.com/pgvector/pgvector

---

## 🆘 긴급 연락처

마이그레이션 중 문제 발생 시:
- **담당자**: ML Team Lead
- **이메일**: ml-team@company.com
- **Slack**: #routing-ml-ops
- **전화**: 내선 1234 (긴급 상황만)

---

**작성자**: ML Team
**최종 업데이트**: 2025-10-06
**버전**: 1.0.0
