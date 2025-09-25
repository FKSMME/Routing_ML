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
- [ ] 절대 지령 준수 상태와 승인 로그 확보 (`logs/task_execution_20250925.log`에 기록 예정)
- [ ] Stage 3~4 산출물 오류 재점검 및 그래프 기능 추가 시 영향 범위 확인
- [ ] 외부 라이브러리 도입 시 라이선스/사내망 정책 검토
- [ ] 문서/웹뷰어 접근 승인 후 UI 프로토타입 검토 진행

## UX 시나리오
1. 기본 화면에서 "워크플로우" 탭 선택 시 파란색 계열 배경의 그래프 뷰가 표시된다.
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
   - 더블클릭: 설정 팝업 열림 → 설정 항목(예: 유사도 임계, 트림 표준편차, SQL 출력 경로)을 폼으로 표시
   - 노드 선택 시 우측 패널에 메트릭/로그 요약 표시
   - 배경 더블클릭: 전체 레이아웃 자동 정렬(Dagre 레이아웃)

## 기술 선택
- 후보 라이브러리 비교
  - React Flow: TypeScript 지원, 커스텀 노드/에지, 인터랙션 편의성, 라이선스 MIT
  - Cytoscape.js + React wrapper: 대규모 그래프 성능 우수, 스타일 유연, 더블클릭 이벤트 지원
  - D3 + Custom: 최대 유연성, 그러나 유지보수 부담
- 평가 기준: 사내망에서의 번들 크기, TypeScript 호환성, 커뮤니티 안정성
- 제안: React Flow 채택, 이유는 TypeScript 기반, 더블클릭 핸들러/노드 팝업 구현이 용이하고 기존 React 구조와 자연스럽게 통합 가능.

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
- 응답 스키마 초안
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
    "last_updated": "2025-09-25T15:30:00Z"
  }
  ```
- 설정 업데이트: `PATCH /api/workflow/graph/nodes/{node_id}` → 설정 값 검증 후 메타 스토어 업데이트(예: YAML/JSON 저장)
- 데이터 소스: trainer/predictor 메타데이터(JSON) + PRD/Tasklist 링크 매핑

## 백엔드 엔드포인트 설계
- FastAPI 라우터 `workflow.py`
  - `GET /api/workflow/graph`: 노드/에지/메타 정보 반환
  - `PATCH /api/workflow/graph/nodes/{node_id}`: 설정 업데이트, 변경 로그 기록
- 서비스 계층
  - `WorkflowGraphService` → 메타데이터 로드(파일/DB), 설정 검증, 응답 캐싱
  - Access 테이블 명칭 변경 대응: 중앙 매핑(`common/schema_aliases.yaml`) 참조
- 로깅
  - 요청 ID, 사용자, 변경 항목, 절대 지령 준수 여부(승인 로그 체크)
  - 변경 시 `logs/task_execution_YYYYMMDD.log`에 자동 기록

## 설정 패널
- 노드 유형별 편집 항목
  - 데이터 소스: 컬럼 매핑, ODBC 연결명
  - 학습 모듈: 유사도 임계값, 표준편차 트림 비율, TensorBoard export 경로
  - 예측 모듈: Top-K, 후보 개수 제한, SQL 저장 테이블명(alias 지원)
  - 서비스 노드: API 라우트 경로, 타임아웃, 캐시 만료 시간
- UI 구성
  - 탭 구조(기본, 고급, 로그)
  - 저장 시 승인 체크박스(“승인 로그 첨부 완료”) 필수
  - 취소 시 변경사항 폐기, 이전 값 복원

## UX 플로우(더블클릭)
1. 사용자 노드 더블클릭 → `onNodeDoubleClick`에서 설정 상태 열기
2. `WorkflowSettingsDialog` 표시, 백엔드에서 최신 설정 fetch
3. 사용자 편집 후 저장 → PATCH 요청, 성공 시 토스트 알림 + 그래프 데이터 재요청
4. 모든 변경은 Tasklist Stage 3/4 로그에 기록 → 자동 로그 API 호출

## 데이터 동기화 전략
- 초기 로드: 페이지 진입 시 `GET /api/workflow/graph`
- 업데이트: PATCH 성공 시 invalidate → 재로드
- 주기적 검증: 5분 간격 백그라운드 갱신(옵션)
- 오프라인 대응: fetch 실패 시 캐싱된 그래프 JSON 렌더 + 경고 배지 표시

## 테스트 전략
- 단위 테스트
  - 노드 데이터 파서: 빈 값/누락 필드 처리
  - 설정 검증기: 임계값 범위, 트림 비율 합(0.05) 고정
- 통합 테스트
  - GET → UI 렌더 → 더블클릭 → PATCH → 재렌더 플로우 자동화(Cypress/Playwright)
  - 드래그/줌/선택 이벤트 시 그래프 상태 유지 확인
- 회귀 테스트
  - 기존 후보 테이블/타임라인과의 상호작용 충돌 여부 검증
- 접근성 테스트
  - 키보드 포커스 이동, 스크린리더 ARIA 라벨 지정

## 배포 전략
- 기능 플래그: `.env`의 `ENABLE_WORKFLOW_GRAPH=true`로 제어
- 라우팅: `/workflow` 별도 페이지, 기존 `/` 대시보드와 라우팅 분리
- 점진적 롤아웃: 내부 QA → 생산 10% → 전체
- 모니터링: 그래프 API 호출량, 오류율, 팝업 저장 실패율 대시보드 구성

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
- `Tasklist.md`, `task_details/stage3_detail.md`, `task_details/stage4_detail.md`에 신규 작업 추가 (미체크 상태 유지)
- `logs/task_execution_20250925.log`에 그래프 계획 수립 로그 및 승인 확인 기록 추가 예정
- Stage 4 보고서(`docs/stage4_frontend_report.md`) 업데이트 시 그래프 UI 섹션 링크 포함

## 승인 요청 체크리스트
- [ ] Tasklist 업데이트 사항 사용자 보고
- [ ] Stage 3/4 상세 문서에 그래프 항목 반영 사실 보고
- [ ] 로그 파일에 계획 수립 및 승인 요청 시간 기록
- [ ] 추가 의존성(React Flow 등) 사내망 배포 정책 검토 보고
