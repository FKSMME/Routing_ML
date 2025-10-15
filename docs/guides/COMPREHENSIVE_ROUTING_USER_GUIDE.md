# 종합 라우팅 생성 기능 사용 가이드

## 개요

종합 라우팅 생성 기능은 프론트엔드에서 작성한 라우팅 타임라인 데이터를 관리자가 설정한 매핑 프로파일에 따라 DB 형식의 CSV 파일로 출력하는 기능입니다.

## 사전 준비

### 1. 서버 실행

#### 백엔드 서버
```bash
cd c:\Users\syyun\Documents\GitHub\Routing_ML_251014
.venv\Scripts\python.exe -m backend.main
```

- 기본 포트: `http://localhost:8000`
- API 문서: `http://localhost:8000/docs`

#### 프론트엔드 서버 (별도 터미널)
```bash
cd c:\Users\syyun\Documents\GitHub\Routing_ML_251014\frontend-prediction
npm run dev
```

- 기본 포트: `http://localhost:5173`

### 2. 테스트 계정

- **관리자**:
  - Username: `admin`
  - Password: (설정된 관리자 비밀번호)

- **일반 사용자**:
  - Username: `user`
  - Password: (설정된 사용자 비밀번호)

## 기능 설명

### 데이터 플로우

```
타임라인 생성 → 매핑 프로파일 선택 → 미리보기 → CSV 다운로드
```

### 주요 구성 요소

1. **타임라인 (Timeline)**:
   - 프론트엔드에서 생성한 공정 단계 시퀀스
   - 각 단계는 `processCode`, `seq`, `runTime` 등의 필드 포함

2. **매핑 프로파일 (Mapping Profile)**:
   - 타임라인 필드 → DB 컬럼 매핑 규칙 정의
   - 관리자가 생성/관리
   - 데이터 타입 변환, 기본값 설정 가능

3. **CSV 출력**:
   - 매핑 규칙에 따라 변환된 데이터
   - `output/comprehensive_routing/` 폴더에 저장
   - 파일명: `routing_{group_id}_{timestamp}.csv`

## 사용 방법

### Step 1: 매핑 프로파일 확인

시스템에는 2개의 테스트 프로파일이 미리 생성되어 있습니다:

#### 1) 기본 라우팅 프로파일 (`sample-profile-001`)
- **설명**: 공정 라우팅 데이터를 DB 형식으로 변환하는 기본 프로파일
- **포함 컬럼**:
  - 공정순번 (`seq` → `PROC_SEQ`)
  - 공정코드 (`process_code` → `PROC_CD`)
  - 공정설명 (`description` → `PROC_DESC`)
  - 가공시간 (`run_time` → `RUN_TIME_MIN`)
  - 준비시간 (`setup_time` → `SETUP_TIME_MIN`)
  - 대기시간 (`wait_time` → `WAIT_TIME_MIN`)
  - 라우팅셋코드, 변종코드, 품목코드
  - 작업명 (`JOB_NM` → `JOB_NAME`)
  - 자원코드 (`RES_CD` → `RESOURCE_CD`)

#### 2) 간단 라우팅 프로파일 (`simple-profile-002`)
- **설명**: 필수 필드만 포함한 간단한 라우팅 프로파일
- **포함 컬럼**:
  - 순번 (`seq` → `SEQ`)
  - 공정 (`process_code` → `PROCESS_CODE`)
  - 시간 (`run_time` → `TIME`)
  - 작업 (`JOB_NM` → `JOB`)

### Step 2: 라우팅 타임라인 생성

1. 프론트엔드 접속: `http://localhost:5173`
2. 로그인 (일반 사용자 또는 관리자)
3. **"라우팅 생성"** 메뉴 선택
4. 타임라인 생성:
   - "새 공정 추가" 버튼 클릭
   - 공정 정보 입력:
     - 공정코드: `CNC-100`
     - 설명: `CNC 가공`
     - 가공시간: `60.5`
     - 준비시간: `15.0`
   - 추가 공정 반복 입력
5. 타임라인 저장

### Step 3: 종합 라우팅 생성

1. 우측 **"시각화 & 전달물"** 패널로 이동
2. **"매핑 프로파일 선택"** 드롭다운 클릭
   - `기본 라우팅 프로파일` 또는 `간단 라우팅 프로파일` 선택
3. **"종합 라우팅 생성"** 버튼 클릭
4. 미리보기 모달 확인:
   - 컬럼명 확인
   - 데이터 샘플 확인 (최대 10행)
   - 전체 행 수 확인
   - 프로파일 정보 확인
5. **"CSV 다운로드"** 버튼 클릭
6. 성공 메시지 확인

### Step 4: CSV 파일 확인

1. 서버 폴더 이동:
   ```bash
   cd c:\Users\syyun\Documents\GitHub\Routing_ML_251014\output\comprehensive_routing
   ```

2. 생성된 CSV 파일 확인:
   ```bash
   dir /od
   ```

3. CSV 파일 열기:
   - Excel에서 열기
   - 텍스트 에디터에서 열기
   - UTF-8 인코딩으로 저장되어 있음

## 테스트 시나리오

### 시나리오 1: 기본 프로파일로 전체 데이터 출력

**목적**: 모든 필드를 포함한 전체 데이터를 CSV로 출력

**단계**:
1. 타임라인 생성 (3개 공정):
   ```
   공정1: CNC-100, 가공시간 60.5분, 준비시간 15분
   공정2: WASH-200, 가공시간 30분, 준비시간 5분
   공정3: ASSY-300, 가공시간 45분, 준비시간 10분
   ```

2. 매핑 프로파일: `기본 라우팅 프로파일` 선택

3. 종합 라우팅 생성 버튼 클릭

4. 미리보기 확인:
   - 총 3행, 11개 컬럼
   - 공정순번: 10, 20, 30
   - 공정코드: CNC-100, WASH-200, ASSY-300

5. CSV 다운로드

6. 출력 확인:
   - 파일명: `routing_current-timeline_YYYYMMDD_HHMMSS.csv`
   - 헤더: 공정순번, 공정코드, 공정설명, ...
   - 3행 데이터

**예상 결과**:
```csv
공정순번,공정코드,공정설명,가공시간(분),준비시간(분),대기시간(분),...
10,CNC-100,CNC 가공,60.5,15.0,0,...
20,WASH-200,세척,30.0,5.0,0,...
30,ASSY-300,조립,45.0,10.0,0,...
```

### 시나리오 2: 간단 프로파일로 핵심 데이터만 출력

**목적**: 필수 필드만 포함한 간단한 CSV 생성

**단계**:
1. 동일한 타임라인 사용 (시나리오 1)

2. 매핑 프로파일: `간단 라우팅 프로파일` 선택

3. 종합 라우팅 생성

4. 미리보기 확인:
   - 총 3행, 4개 컬럼만
   - 순번, 공정, 시간, 작업

5. CSV 다운로드

**예상 결과**:
```csv
순번,공정,시간,작업
10,CNC-100,60.5,-
20,WASH-200,30.0,-
30,ASSY-300,45.0,-
```

### 시나리오 3: SQL Values가 포함된 복잡한 데이터

**목적**: sqlValues 필드가 병합되어 출력되는지 확인

**단계**:
1. 타임라인 생성 시 sqlValues 추가:
   ```json
   {
     "processCode": "CNC-100",
     "runTime": 60.5,
     "sqlValues": {
       "JOB_NM": "CNC 가공 작업",
       "RES_CD": "RES-100",
       "INSIDE_FLAG": "Y"
     }
   }
   ```

2. 매핑 프로파일: `기본 라우팅 프로파일` 선택

3. 종합 라우팅 생성

4. 미리보기에서 확인:
   - 작업명 컬럼: "CNC 가공 작업"
   - 자원코드 컬럼: "RES-100"

5. CSV 다운로드 및 확인

**예상 결과**: sqlValues의 JOB_NM과 RES_CD가 올바르게 매핑됨

## 에러 처리

### 에러 1: "Timeline is empty"

**원인**: 타임라인에 공정이 하나도 없음

**해결 방법**:
1. 라우팅 생성 메뉴로 이동
2. "새 공정 추가" 버튼 클릭
3. 최소 1개 이상의 공정 추가

### 에러 2: "매핑 프로파일을 선택해주세요"

**원인**: 매핑 프로파일이 선택되지 않음

**해결 방법**:
1. "매핑 프로파일 선택" 드롭다운 클릭
2. 사용 가능한 프로파일 선택

### 에러 3: "사용 가능한 매핑 프로파일이 없습니다"

**원인**: 서버에 매핑 프로파일이 없음

**해결 방법**:
1. 백엔드 서버 재시작 (프로파일 자동 로딩)
2. 또는 관리자로 로그인하여 새 프로파일 생성

### 에러 4: "processCode is required"

**원인**: 타임라인의 일부 공정에 processCode가 누락됨

**해결 방법**:
1. 라우팅 타임라인 편집
2. 모든 공정에 processCode 입력 확인

## API 엔드포인트

### 매핑 프로파일 목록 조회
```http
GET /api/data-mapping/profiles
Authorization: Bearer {token}
```

**응답**:
```json
{
  "profiles": [
    {
      "id": "sample-profile-001",
      "name": "기본 라우팅 프로파일",
      "description": "...",
      "mappings": [...],
      "is_active": true
    }
  ],
  "total": 2
}
```

### 매핑 적용 (미리보기)
```http
POST /api/data-mapping/apply
Authorization: Bearer {token}
Content-Type: application/json

{
  "profile_id": "sample-profile-001",
  "routing_group_id": "current-timeline",
  "routing_group_data": [
    {
      "seq": 10,
      "processCode": "CNC-100",
      "process_code": "CNC-100",
      "runTime": 60.5,
      "run_time": 60.5,
      ...
    }
  ],
  "preview_only": true
}
```

**응답**:
```json
{
  "profile_id": "sample-profile-001",
  "routing_group_id": "current-timeline",
  "columns": ["공정순번", "공정코드", ...],
  "preview_rows": [
    {
      "공정순번": 10,
      "공정코드": "CNC-100",
      ...
    }
  ],
  "total_rows": 3,
  "csv_path": null,
  "message": "미리보기 생성 완료 (3행)"
}
```

### 매핑 적용 (CSV 생성)
```http
POST /api/data-mapping/apply
Authorization: Bearer {token}
Content-Type: application/json

{
  "profile_id": "sample-profile-001",
  "routing_group_id": "current-timeline",
  "routing_group_data": [...],
  "preview_only": false
}
```

**응답**:
```json
{
  "profile_id": "sample-profile-001",
  "routing_group_id": "current-timeline",
  "columns": [...],
  "preview_rows": [...],
  "total_rows": 3,
  "csv_path": "output/comprehensive_routing/routing_current-timeline_20250115_123456.csv",
  "message": "CSV 파일 생성 완료: ..."
}
```

## 관리자 기능 (추가)

### 새 매핑 프로파일 생성

관리자는 "데이터 관계 설정" 메뉴에서 새로운 매핑 프로파일을 생성할 수 있습니다.

**예시**:
```json
{
  "name": "커스텀 프로파일",
  "description": "특정 목적을 위한 커스텀 매핑",
  "mappings": [
    {
      "routing_field": "seq",
      "db_column": "SEQUENCE",
      "display_name": "SEQ",
      "data_type": "number",
      "is_required": true,
      "default_value": null
    },
    ...
  ]
}
```

## 트러블슈팅

### 문제: CSV 파일이 생성되지 않음

**확인 사항**:
1. 백엔드 서버 로그 확인
2. `output/comprehensive_routing/` 폴더 존재 여부
3. 파일 쓰기 권한 확인

### 문제: 한글이 깨져서 보임

**해결 방법**:
1. CSV 파일을 Excel에서 열 때:
   - "데이터" 탭 → "텍스트/CSV 가져오기"
   - 인코딩: `65001: Unicode (UTF-8)` 선택

2. 또는 메모장에서 열어서 "다른 이름으로 저장" → 인코딩: UTF-8 BOM

### 문제: 일부 필드가 누락됨

**원인**: 타임라인 데이터에 해당 필드가 없음

**해결 방법**:
1. 매핑 규칙에서 `default_value` 확인
2. 타임라인 데이터에 필드 추가
3. 또는 다른 매핑 프로파일 사용

## 참고 자료

- [종합 라우팅 구현 문서](../../COMPREHENSIVE_ROUTING_IMPLEMENTATION.md)
- [통합 테스트 스크립트](../../test_comprehensive_routing_integration.py)
- [데이터 매핑 서비스 코드](../../backend/api/services/data_mapping_service.py)
- [프론트엔드 데이터 추출 유틸리티](../../frontend-prediction/src/lib/routingDataExtractor.ts)

## 문의

구현 관련 문의사항은 개발팀에게 연락하세요.
