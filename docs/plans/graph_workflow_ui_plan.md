> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 36 | Completed 5 | Blockers 0

# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

# 블루스크린형 워크플로우 그래프 UI 세부 계획

## 개요
- 목적: 학습/예측 파이프라인의 모듈과 함수 로직을 그래프 형태로 시각화하여 주니어 사용자도 전체 흐름을 직관적으로 이해하고, 노드를 더블클릭하면 관련 설정을 팝업으로 수정·검토할 수 있도록 한다.
- 범위: Stage 3 예측 서비스의 API 확장, Stage 4 프런트엔드 UI 확장, Stage 5 SQL 로그 연계 여부 검토.
- 의존성: 기존 FastAPI/React 코드베이스, 7.1 SQL 출력 규격, Access 3뷰 기반 절대 조건.

## Gate Review Checklist
- [x] 절대 지령 준수 상태와 승인 로그 확보 (`logs/task_execution_20250925.log`에 기록)
- [x] Stage 3~4 산출물 오류 재점검 및 그래프 기능 추가 시 영향 범위 확인
- [x] 외부 라이브러리 도입 시 라이선스/사내망 정책 검토
- [x] 문서/웹뷰어 접근 승인 후 UI 프로토타입 검토 진행 (디자인 레퍼런스 `main/1.jpg`~`main/4.jpg`)

## UX 시나리오
1. 기본 화면에서 "워크플로우" 탭 선택 시 파란색 계열 배경의 그래프 뷰가 표시된다(디자인 레퍼런스 `main/1.jpg`~`main/4.jpg` 기반 컬러 톤 적용).
2. 노드 유형
   - 데이터 소스(사각형): ITEM_INFO, ROUTING_VIEW, WORK_ORDER_RESULTS
   - 학습 모듈(둥근 사각형): 임베딩 생성, 가중치 조정, HNSW 빌드
   - 예측 모듈(팔각형): 후보 검색, 메타-앙상블, SQL 직렬화
   - 서비스 노드(육각형): FastAPI 라우터, React 훅, Deliverables export
3. 에지 유형
   - 실선: 데이터 흐름 (예: ITEM_INFO → 임베딩)
   - 점선: 설정/메타 연계 (예: HNSW 빌드 → TensorBoard Projector export)
   - 화살표는 방향성 표시, 마우스오버 시 간단 설명 툴팁 표시.
4. 상호작용 플로우
   - 노드 드래그: 레이아웃 조정 가능, 자동 스냅백 옵션 제공
   - 더블클릭: 설정 팝업 열림 → 설정 항목(예: 유사도 임계, 트림 표준편차, SQL 출력 컬럼/별칭 리스트)을 폼으로 표시
   - 노드 선택 시 우측 패널에 메트릭/로그 요약 표시
   - 배경 더블클릭: 전체 레이아웃 자동 정렬(Dagre 레이아웃)
   - SAVE 버튼: `/api/workflow/graph` PATCH 호출 → `config/workflow_settings.json` 업데이트 → trainer/predictor 런타임 즉시 적용

## 기술 선택
- 후보 라이브러리 비교
  - React Flow: TypeScript 지원, 커스텀 노드/에지, 인터랙션 편의성, 라이선스 MIT
  - Cytoscape.js + React wrapper: 대규모 그래프 성능 우수, 스타일 유연, 더블클릭 이벤트 지원
  - D3 + Custom: 최대 유연성, 그러나 유지보수 부담
- 평가 기준: 사내망에서의 번들 크기, TypeScript 호환성, 커뮤니티 안정성, SAVE 후 설정 반영 시 상태 동기화 용이성
- 최종 결정: **React Flow** 채택 — React Query와 쉽게 연계되고, SAVE 시 `/api/workflow/graph` PATCH를 호출해도 노드 상태 관리가 단순하며 Vite 번들 크기 요건(디자인 레퍼런스 적용 후 300KB 이하)을 충족한다.

## 컴포넌트 구조
- `WorkflowGraphPage`
  - 게이트 체크리스트 결과 표시 영역
  - `WorkflowGraphCanvas` 포함
  - 우측 `WorkflowNodeInspector` (선택 노드 요약)
- `WorkflowGraphCanvas`
  - React Flow Provider, 노드/에지 데이터 주입
  - 레이아웃 제어 버튼(자동정렬, 확대/축소 초기화)
- `WorkflowNode`
  - 노드 타입별 색상/아이콘
  - 더블클릭 이벤트에서 `useWorkflowSettings` 훅 호출
- `WorkflowSettingsDialog`
  - 팝업 패널, 노드별 설정 편집 폼
  - 저장 시 `/api/workflow/graph` PATCH 호출(설정 업데이트)
- `useWorkflowGraph` 훅
  - 초기 데이터 fetch, polling/수동 리프레시, 에러 처리, 절대 지령 기반 승인 체크 로그 출력

## 백엔드 데이터 모델
- 엔드포인트: `GET /api/workflow/graph`
- 응답 스키마 (최종)
  ```json
  {
    "nodes": [
      {
        "id": "trainer_embedding",
        "type": "module",
        "label": "임베딩 생성",
        "category": "trainer",
        "status": "active",
        "metrics": {"last_duration_sec": 122.4},
        "settings": {
          "similarity_threshold": 0.8,
          "trim_ratio": 0.05
        },
        "doc_refs": ["docs/trainer_service_plan.md#embedding"]
      }
    ],
    "edges": [
      {"id": "e1", "source": "item_info", "target": "trainer_embedding", "kind": "data"}
    ],
    "runtime": {
      "trainer": {
        "similarity_threshold": 0.8,
        "trim_std_enabled": true,
        "trim_lower_percent": 0.05,
        "trim_upper_percent": 0.95
      },
      "predictor": {
        "similarity_high_threshold": 0.8,
        "max_routing_variants": 4,
        "trim_std_enabled": true,
        "trim_lower_percent": 0.05,
        "trim_upper_percent": 0.95
      }
    },
    "sql": {
      "output_columns": ["ITEM_CD", "CANDIDATE_ID", "ROUTING_SIGNATURE", "PRIORITY", "SIMILARITY_TIER", "PROC_SEQ", "INSIDE_FLAG", "dbo_BI_ROUTING_VIEW_JOB_CD", "JOB_NM", "RES_CD", "RES_DIS", "TIME_UNIT", "MFG_LT", "QUEUE_TIME", "SETUP_TIME", "MACH_WORKED_HOURS", "ACT_SETUP_TIME", "ACT_RUN_TIME", "WAIT_TIME", "MOVE_TIME", "RUN_TIME_QTY", "RUN_TIME_UNIT", "BATCH_OPER", "BP_CD", "dbo_BI_ROUTING_VIEW_CUST_NM", "CUR_CD", "SUBCONTRACT_PRC", "TAX_TYPE", "MILESTONE_FLG", "INSP_FLG", "ROUT_ORDER", "VALID_FROM_DT", "VALID_TO_DT", "dbo_BI_ROUTING_VIEW_REMARK", "ROUT_DOC", "DOC_INSIDE", "DOC_NO", "NC_PROGRAM", "NC_PROGRAM_WRITER", "NC_WRITER_NM", "NC_WRITE_DATE", "NC_REVIEWER", "NC_REVIEWER_NM", "NC_REVIEW_DT", "RAW_MATL_SIZE", "JAW_SIZE", "VALIDITY", "PROGRAM_REMARK", "OP_DRAW_NO", "MTMG_NUMB", "REFERENCE_ITEM_CD", "SIMILARITY_SCORE"],
      "column_aliases": {"JOB_CD": "dbo_BI_ROUTING_VIEW_JOB_CD", "CUST_NM": "dbo_BI_ROUTING_VIEW_CUST_NM", "VIEW_REMARK": "dbo_BI_ROUTING_VIEW_REMARK"},
      "profiles": [
        {
          "name": "Access 7.1 기본",
          "description": "dbo_BI_ROUTING_VIEW 7.1 구조를 그대로 따르는 기본 매핑",
          "mapping": {"JOB_CD": "dbo_BI_ROUTING_VIEW_JOB_CD", "CUST_NM": "dbo_BI_ROUTING_VIEW_CUST_NM", "VIEW_REMARK": "dbo_BI_ROUTING_VIEW_REMARK"}
        }
      ],
      "active_profile": "Access 7.1 기본"
    },
    "last_updated": "2025-09-25T15:30:00Z"
  }
  ```
- 설정 업데이트: `PATCH /api/workflow/graph` → 설정 값 검증 후 `config/workflow_settings.json` 업데이트, trainer/predictor 런타임 즉시 갱신
- 데이터 소스: trainer/predictor 메타데이터(JSON) + PRD/Tasklist 링크 매핑

## 백엔드 엔드포인트 설계
- FastAPI 라우터 `workflow.py`
  - `GET /api/workflow/graph`: 노드/에지/런타임/SQL 매핑 정보 반환
  - `PATCH /api/workflow/graph`: 설정 업데이트, trainer/predictor 런타임 및 SQL 매핑 프로파일 즉시 반영
- 서비스 계층
  - `workflow_config_store` → JSON 파일 로드, 설정 검증, 응답 캐싱
  - Access 테이블 명칭 변경 대응: 중앙 매핑(`common/sql_schema.py`) 참조
- 로깅
  - 요청 ID, 사용자, 변경 항목, 절대 지령 준수 여부(승인 로그 체크)
  - 변경 시 `logs/task_execution_YYYYMMDD.log`에 자동 기록

## 설정 패널
- 노드 유형별 편집 항목
  - 데이터 소스: 컬럼 매핑, ODBC 연결명, Power Query 프로파일 선택/저장
  - 학습 모듈: 유사도 임계값, 표준편차 트림 비율, TensorBoard export 경로
  - 예측 모듈: Top-K, 후보 개수 제한, SQL 저장 테이블명(alias 지원), 후보 최대 4개 제한
  - 서비스 노드: API 라우트 경로, 타임아웃, 캐시 만료 시간, SAVE 성공 로그
- UI 구성
  - 탭 구조(기본, 고급, 로그)
  - 저장 시 승인 체크박스(“승인 로그 첨부 완료”) 필수, SAVE 클릭 시 즉시 PATCH 요청 및 성공 토스트
  - 취소 시 변경사항 폐기, 이전 값 복원

## UX 플로우(더블클릭)
1. 사용자 노드 더블클릭 → `onNodeDoubleClick`에서 설정 상태 열기
2. `WorkflowSettingsDialog` 표시, 백엔드에서 최신 설정 fetch
3. 사용자 편집 후 저장 → PATCH 요청, 성공 시 토스트 알림 + trainer/predictor 런타임/SQL 매핑 재적용 후 그래프 데이터 재요청
4. 모든 변경은 Tasklist Stage 3/4 로그에 기록 → 자동 로그 API 호출

## 데이터 동기화 전략
- 초기 로드: 페이지 진입 시 `GET /api/workflow/graph`
- 업데이트: PATCH 성공 시 React Query `invalidateQueries('workflow')` → 재로드
- 설정 파일: `config/workflow_settings.json` 저장, Stage 7 운영 문서와 연계한 접근 제어
- 오프라인 대응: fetch 실패 시 캐싱된 그래프 JSON 렌더 + 경고 배지 표시

## 테스트 전략
- 단위 테스트
  - 노드 데이터 파서: 빈 값/누락 필드 처리
  - 설정 검증기: 임계값 범위, 트림 비율 합(0.05) 고정, 프로파일 이름 중복 검증
- 통합 테스트
  - GET → UI 렌더 → 더블클릭 → PATCH → trainer/predictor 런타임 로그 확인 → 재렌더 (Cypress/Playwright)
  - 드래그/줌/선택 이벤트 시 그래프 상태 유지 확인
- 회귀 테스트
  - 기존 후보 테이블/타임라인과의 상호작용 충돌 여부 검증
- 접근성 테스트
  - 키보드 포커스 이동, 스크린리더 ARIA 라벨 지정

## 배포 전략
- 기능 플래그: `.env`의 `ENABLE_WORKFLOW_GRAPH=true`로 제어
- 라우팅: `/workflow` 별도 페이지, 기존 `/` 대시보드와 라우팅 분리
- 점진적 롤아웃: 내부 QA → 생산 10% → 전체
- 모니터링: 그래프 API 호출량, 오류율, 팝업 저장 실패율, 설정 파일 변경 이력(`logs/task_execution_*.log`) 추적
- 보안: `config/workflow_settings.json` 접근 제어 및 백업 절차를 Stage 7 운영/배포 문서에 연동

## 로드맵 & 일정
| 단계 | 작업 | 담당 | 선행조건 | 산출물 |
| --- | --- | --- | --- | --- |
| Stage 3 | API 스키마/서비스 설계 | Backend | Tasklist Stage3 그래프 항목 승인 | `backend/api/routes/workflow.py` 초안, `docs/graph_workflow_ui_plan.md` 업데이트 |
| Stage 3 | 그래프 데이터 모델 초안 구현 | Backend | 위 스키마 | 워크플로우 메타 JSON, 단위 테스트 초안 |
| Stage 4 | React Flow 기반 화면 설계 | Frontend | Stage3 API 초안 | `frontend/src/pages/WorkflowGraphPage.tsx` 설계서 |
| Stage 4 | 설정 팝업 UX/폼 정의 | Frontend | UI 시나리오 | Figma/문서 링크, 상태도 |
| Stage 4 | 그래프 상호작용 테스트 케이스 작성 | QA | UI 설계 | Cypress 스펙 초안 |
| Stage 5 | SQL 로그 연계 여부 검토 | Backend | Stage3 API | 설정 변경 로그 → SQL 기록 정책 문서 |

## 문서화 & 로그 계획
- `Tasklist.md`, `task_details/stage3_detail.md`, `task_details/stage4_detail.md`, `task_details/stage5_detail.md`에 그래프/SAVE/파워쿼리 작업 반영 및 완료 체크
- `logs/task_execution_20250925.log`에 그래프 계획 수립, SAVE 기능 반영, 컬럼 매핑 업데이트 로그 기록
- Stage 4 보고서(`docs/stage4_frontend_report.md`)와 Stage 5 보고서(`docs/stage5_sql_report.md`)에 그래프 UI/파워쿼리 매핑 섹션 링크 포함

## 승인 요청 체크리스트
- [x] Tasklist 업데이트 사항 사용자 보고 — 2025-09-25T09:10:00Z, 그래프 워크플로우 범위 정리 후 Stakeholder 메일 발송 및 Tasklist Stage 3/4 섹션 수정 보고
- [x] Stage 3/4 상세 문서에 그래프 항목 반영 사실 보고 — 2025-09-25T09:12:00Z, `task_details/stage3_detail.md`, `task_details/stage4_detail.md` 업데이트 내용 공유
- [x] 로그 파일에 계획 수립 및 승인 요청 시간 기록 — 2025-09-25T09:14:00Z, `logs/task_execution_20250925.log`에 백그라운드 계획 및 승인 요청 타임스탬프 추가
- [x] 추가 의존성(React Flow 등) 사내망 배포 정책 검토 보고 — 2025-09-25T09:16:00Z, 사내 배포 가이드 준수 여부 점검 결과 전달 및 의존성 정책 로그 기록

## 진행 상태 업데이트
- 2025-09-25T09:08:00Z 기준 그래프 워크플로우 범위를 재정리하고 Tasklist Stage 3/4 항목에 반영 완료, 관련 이해관계자에게 변경 사항과 영향 범위를 공지했다.
- React Flow 채택에 따른 사내 의존성 정책 검토 결과를 승인 라인과 공유했으며, Stage 3/4 문서 업데이트와 함께 로그에 승인 요청 및 확인 시간을 기록했다.

## 2025-09-25 구현 메모
- ReactFlow를 채택해 노드/엣지 기본 스타일을 블루스크린 컨셉으로 구현하고, MiniMap·Controls·Background 조합으로 전체 플로우 탐색을 지원한다.
- 노드 더블클릭 이벤트에서 trainer/predictor/sql 구간별 설정 폼을 호출하며, SAVE 시 `/api/workflow/graph` PATCH payload에 런타임 파라미터를 포함하도록 처리했다.
- 레이아웃 저장 버튼은 노드 좌표를 `WorkflowGraphNode.position` 필드로 반영해 config JSON과 런타임 저장소가 동일한 상태를 유지한다.
