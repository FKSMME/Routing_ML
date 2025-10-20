# SQL View Explorer 가이드

## 개요

SQL View Explorer는 MSSQL 데이터베이스의 뷰(View)를 홈 대시보드에 실시간으로 표시하는 기능입니다.
Power BI나 Tableau 없이도 데이터를 시각화하고 사용자별 체크리스트를 관리할 수 있습니다.

## 주요 기능

### 1. **SQL View 탐색**
- MSSQL 데이터베이스의 모든 뷰 목록 조회
- 스키마별 필터링
- 뷰 정의 미리보기

### 2. **샘플 데이터 미리보기**
- 선택한 뷰의 샘플 데이터 (최대 1000행) 조회
- 컬럼 메타데이터 확인 (데이터 타입, 길이 등)

### 3. **Excel 스타일 컬럼 편집기**
- **드래그 앤 드롭**: 컬럼 순서 변경
- **표시/숨김**: 체크박스로 컬럼 선택
- **이름 변경**: 사용자 친화적인 표시 이름 지정
- **너비 조정**: 픽셀 단위로 컬럼 너비 설정

### 4. **사용자 체크리스트**
- 각 행에 체크박스 추가
- 체크한 사용자 이름 자동 기록
- 여러 사용자가 동시에 체크 가능
- 체크한 사용자 목록 표시

### 5. **실시간 홈 대시보드**
- 설정된 뷰 데이터를 홈 페이지에 자동 표시
- 1분마다 자동 새로고침
- 체크리스트 상태 실시간 반영

## 데이터베이스 설정

### Step 1: 테이블 생성

다음 SQL 스크립트를 실행하여 필요한 테이블을 생성합니다:

```sql
-- 파일 위치: database/migrations/create_view_explorer_tables.sql

USE [your_database_name];
GO

-- 1. 뷰 설정 테이블
CREATE TABLE view_configs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    view_name NVARCHAR(256) NOT NULL UNIQUE,
    display_name NVARCHAR(256) NOT NULL,
    columns_config NVARCHAR(MAX) NOT NULL,  -- JSON 형식
    enable_checklist BIT NOT NULL DEFAULT 0,
    checklist_column_name NVARCHAR(100) NOT NULL DEFAULT N'체크',
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    created_by NVARCHAR(100) NOT NULL,
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_by NVARCHAR(100) NOT NULL,
    CONSTRAINT CK_view_configs_columns_json CHECK (ISJSON(columns_config) = 1)
);

-- 2. 체크리스트 테이블
CREATE TABLE view_checklists (
    id INT IDENTITY(1,1) PRIMARY KEY,
    view_name NVARCHAR(256) NOT NULL,
    row_id NVARCHAR(500) NOT NULL,
    username NVARCHAR(100) NOT NULL,
    checked_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_view_checklists_unique UNIQUE (view_name, row_id, username)
);
```

### Step 2: 샘플 뷰 생성 (선택사항)

테스트용 샘플 뷰:

```sql
CREATE VIEW dbo.vw_sample_dashboard AS
SELECT
    CAST(1 AS INT) AS id,
    CAST('Task A' AS NVARCHAR(100)) AS task_name,
    CAST('진행중' AS NVARCHAR(50)) AS status,
    CAST('홍길동' AS NVARCHAR(50)) AS assignee,
    CAST('2025-01-15' AS DATE) AS due_date
UNION ALL
SELECT 2, 'Task B', '완료', '김철수', '2025-01-20'
UNION ALL
SELECT 3, 'Task C', '대기', '이영희', '2025-01-25';
```

## 사용 방법

### 1. 뷰 탐색 및 설정

1. **홈 페이지 접속**
   - `https://localhost:3000` 접속
   - 하단의 "SQL View Explorer" 카드 클릭

2. **뷰 목록 불러오기**
   - "뷰 목록 불러오기" 버튼 클릭
   - 데이터베이스의 모든 뷰 목록 표시

3. **뷰 선택**
   - 원하는 뷰 카드 클릭
   - 샘플 데이터 자동 미리보기 (10행)

4. **컬럼 설정**
   - **표시 이름**: 대시보드에 표시될 이름 입력
   - **컬럼 편집**:
     - ☰ 아이콘을 드래그하여 순서 변경
     - 체크박스로 표시/숨김 설정
     - 표시 이름 입력
     - 너비(px) 설정

5. **체크리스트 설정 (선택)**
   - "체크리스트 활성화" 체크
   - 체크리스트 컬럼 이름 입력 (예: "확인", "체크", "완료")

6. **설정 저장**
   - "설정 저장" 버튼 클릭
   - 성공 메시지 확인

### 2. 홈 대시보드에서 데이터 확인

1. **홈 페이지로 이동**
   - `https://localhost:3000` 접속
   - 설정한 뷰 데이터가 자동으로 표시됨

2. **체크리스트 사용**
   - 각 행의 체크박스 클릭
   - 체크한 사용자 이름이 자동 기록
   - 다른 사용자도 같은 행을 체크할 수 있음

3. **데이터 새로고침**
   - "🔄 새로고침" 버튼 클릭
   - 또는 1분마다 자동 새로고침

## API 엔드포인트

### 뷰 관리

```http
GET /api/view-explorer/views
GET /api/view-explorer/views/{view_name}/sample?limit=100
```

### 설정 관리

```http
GET /api/view-explorer/configs
GET /api/view-explorer/configs/{view_name}
POST /api/view-explorer/configs
```

### 데이터 조회

```http
GET /api/view-explorer/data/{view_name}?limit=1000
```

### 체크리스트

```http
POST /api/view-explorer/checklist/{view_name}
```

## 데이터 구조

### ViewConfigCreate (설정 저장)

```json
{
  "view_name": "dbo.vw_sample_dashboard",
  "display_name": "대시보드 작업 목록",
  "columns": [
    {
      "name": "id",
      "display_name": "ID",
      "visible": true,
      "order": 0,
      "width": 80
    },
    {
      "name": "task_name",
      "display_name": "작업명",
      "visible": true,
      "order": 1,
      "width": 200
    }
  ],
  "enable_checklist": true,
  "checklist_column_name": "확인"
}
```

### ChecklistUpdate

```json
{
  "row_id": "1",
  "checked": true
}
```

## 기술 스택

### 백엔드
- **FastAPI**: REST API 서버
- **PyODBC**: MSSQL 연결
- **Pydantic**: 데이터 검증

### 프런트엔드
- **Vanilla JavaScript**: 순수 JS (프레임워크 없음)
- **Fetch API**: HTTP 요청
- **HTML5 Drag and Drop API**: 컬럼 순서 변경

### 데이터베이스
- **MSSQL**: 뷰 데이터 및 설정 저장

## 주요 특징

### 1. **Office 데이터 연결 마법사 스타일**
- 뷰 선택 → 미리보기 → 설정 → 저장 워크플로우
- 직관적인 3단계 설정 프로세스

### 2. **Excel 파워쿼리 스타일 편집**
- 드래그 앤 드롭으로 컬럼 순서 변경
- 체크박스로 컬럼 표시/숨김
- 인라인 편집으로 즉시 수정

### 3. **실시간 협업**
- 여러 사용자가 동시에 체크리스트 사용
- 체크한 사용자 이름 실시간 표시
- 자동 새로고침으로 최신 데이터 유지

### 4. **유연한 커스터마이징**
- 컬럼별 너비 조정
- 사용자 친화적인 이름 변경
- 필요한 컬럼만 선택 표시

## 문제 해결

### 뷰 목록이 표시되지 않음
- MSSQL 연결 상태 확인
- 데이터베이스에 뷰가 존재하는지 확인
- 브라우저 콘솔에서 에러 메시지 확인

### 설정 저장 실패
- `view_configs` 테이블이 생성되었는지 확인
- JSON 형식이 올바른지 확인 (ISJSON 제약조건)
- 사용자 인증 상태 확인

### 체크리스트 동작 안 함
- `view_checklists` 테이블이 생성되었는지 확인
- 뷰 설정에서 체크리스트가 활성화되었는지 확인
- 로그인된 사용자 확인

### 홈 대시보드에 데이터 표시 안 됨
- 뷰 설정이 저장되었는지 확인
- 브라우저 콘솔에서 API 호출 에러 확인
- CORS 설정 확인

## 향후 개선 사항

- [ ] 여러 뷰 동시 표시
- [ ] 컬럼별 정렬 기능
- [ ] 검색/필터링 기능
- [ ] 데이터 엑셀 내보내기
- [ ] 체크리스트 통계/리포트
- [ ] 실시간 WebSocket 업데이트
- [ ] 댓글/메모 기능
- [ ] 권한 관리 (읽기/쓰기/관리)

## 참고 자료

- [FastAPI 공식 문서](https://fastapi.tiangolo.com/)
- [MSSQL Views 문서](https://docs.microsoft.com/en-us/sql/relational-databases/views/views)
- [HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)

