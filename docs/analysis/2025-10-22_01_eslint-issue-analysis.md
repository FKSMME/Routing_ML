# ESLint 오류 분석 보고서 (2025-10-22)

## 1. 개요
- 분석 대상: `frontend-prediction` 패키지 전체 (`src/**/*.{ts,tsx}`)
- 실행 명령: `npx eslint "src/**/*.{ts,tsx}" --format compact --max-warnings 0`
- 총 적발 건수: 200건  
  - 오류(Error) 180건 (90.0%)  
  - 경고(Warning) 20건 (10.0%)  
- 주요 목적: 린트 노이즈 정리 우선순위 수립 및 후속 리팩터링 가이드 마련

## 2. 정량 지표
| 구분 | 건수 | 비중 |
| --- | ---: | ---: |
| 총 적발 | 200 | 100% |
| 오류 | 180 | 90.0% |
| 경고 | 20 | 10.0% |

### 2.1 규칙별 분포
| ESLint 룰 | 건수 | 전체 대비 | 비고 |
| --- | ---: | ---: | --- |
| `@typescript-eslint/no-explicit-any` | 92 | 46.0% | API/서비스 계층에서 `any` 사용 집중 |
| `@typescript-eslint/no-unused-vars` | 50 | 25.0% | 미사용 변수·훅 잔존 |
| `simple-import-sort/imports` | 31 | 15.5% | 자동 정렬 미적용 |
| `react-hooks/exhaustive-deps` | 20 | 10.0% | 전부 경고, 의존성 배열 불일치 |
| `react/no-unescaped-entities` | 6 | 3.0% | JSX 내 특수문자 이스케이프 필요 |
| `no-case-declarations` | 1 | 0.5% | `switch`-`case` 블록 스코프 문제 |

### 2.2 파일별 상위 영향도
| 파일 경로 | 건수 | 전체 대비 |
| --- | ---: | ---: |
| `frontend-prediction/src/lib/apiClient.ts` | 44 | 22.0% |
| `frontend-prediction/src/components/workspaces/DataOutputWorkspace.tsx` | 19 | 9.5% |
| `frontend-prediction/src/components/routing/RoutingCanvas.tsx` | 12 | 6.0% |
| `frontend-prediction/src/components/RoutingGroupControls.tsx` | 8 | 4.0% |
| `frontend-prediction/src/components/admin/DataRelationshipManager.tsx` | 8 | 4.0% |
| `frontend-prediction/src/hooks/useTrackedClick.ts` | 7 | 3.5% |
| `frontend-prediction/src/components/data-quality/HistoricalIssuesChart.tsx` | 6 | 3.0% |
| `frontend-prediction/src/components/CandidatePanel.tsx` | 5 | 2.5% |
| `frontend-prediction/src/components/routing/ErpItemExplorer.tsx` | 5 | 2.5% |
| `frontend-prediction/src/components/workspaces/DataQualityWorkspace.tsx` | 5 | 2.5% |

## 3. 주요 문제 유형과 원인
### 3.1 `any` 남용 (`@typescript-eslint/no-explicit-any`, 92건)
- **대표 위치**: `src/lib/apiClient.ts`(32건), `DataOutputWorkspace.tsx`(16건)
- **원인**: API 응답/요청 타입 정의 미비, 임시 DI로직에 제네릭 미적용
- **영향**: 타입 안전성 저하, 런타임 예외 사전 탐지 어려움

### 3.2 미사용 자원 (`@typescript-eslint/no-unused-vars`, 50건)
- **대표 위치**: `CandidatePanel.tsx`(`useEffect`, `dirty`, `lastSavedAt` 등)
- **원인**: 리팩터링 과정에서 제거되지 않은 변수/훅, 실험 코드 잔존
- **영향**: 코드 가독성 저하, 향후 유지보수 시 혼란

### 3.3 임포트 정렬 미달 (`simple-import-sort/imports`, 31건)
- **특징**: 거의 모든 항목이 자동 수정 가능
- **원인**: 저장 시 정렬 자동화 미적용, 린트 자동 수정 미실행
- **영향**: 코드 리뷰 시 불필요한 diff 발생

### 3.4 훅 의존성 불일치 (`react-hooks/exhaustive-deps`, 20건, 모두 경고)
- **대표 위치**: `RoutingCanvas.tsx`, `useTrackedClick.ts`
- **원인**: 의존성 배열 누락 또는 불필요한 참조 포함
- **영향**: 비결정적 렌더링/메모리 누수 가능성

### 3.5 JSX 특수문자 미이스케이프 (`react/no-unescaped-entities`, 6건)
- **대표 위치**: `DataRelationshipManager.tsx`, `OnPremSearch.tsx`, `LogViewer.tsx`
- **해결**: HTML 엔티티(`&quot;`, `&ldquo;`) 적용 필요

### 3.6 `switch` 블록 스코프 (`no-case-declarations`, 1건)
- **위치**: `components/data-quality/IssuesPanel.tsx`
- **해결**: `case` 블록 내부에 중괄호 도입

## 4. 해결 방안 및 우선순위
### 4.1 단기 (D+1 ~ D+3)
1. `simple-import-sort` 자동 정렬 실행  
   - 명령: `npx eslint "src/**/*.{ts,tsx}" --fix --rule "simple-import-sort/imports:error"`
2. `no-case-declarations` 단일 케이스 즉시 수정  
3. `react/no-unescaped-entities` 해당 라인 HTML 엔티티 적용

### 4.2 중기 (D+4 ~ D+14)
1. `apiClient.ts` 타입 정의 리팩터링  
   - 백엔드 스키마(`frontend-shared`) 참조하여 DTO 생성  
   - `fetch` 래퍼에 제네릭/반환 타입 명시
2. `DataOutputWorkspace.tsx` 등 `any` 다량 파일별 작업 분배  
   - 모듈 단위로 `unknown` → 타입 가드 변환
3. 미사용 변수/훅 제거  
   - 기획상 보류된 기능이면 주석/설명 추가 후 eslint-disable 대신 TODO 관리

### 4.3 장기 (D+15 이상)
1. 공통 타입 라이브러리 정비  
   - `@routing-ml/shared`에 API 응답 타입 집중 관리  
2. ESLint 자동 실행 파이프라인 강화  
   - pre-commit(husky)나 CI 단계에 `--max-warnings 0` 유지  
3. 훅 사용 가이드 문서화  
   - 의존성 배열 체크리스트를 PR 템플릿에 반영

## 5. 후속 조치 제안
1. 팀 공유 미팅 (30분)에서 본 보고서 기반으로 담당자 및 일정 확정  
2. 각 규칙별 책임자 지정 후 JIRA/노션 태스크 생성  
3. 1차 정비 완료 후 `npm run lint` 재실행하여 감소율 측정, 문서 업데이트

## 6. 부록 – 샘플 적발 로그
- `@typescript-eslint/no-unused-vars`: `frontend-prediction/src/components/CandidatePanel.tsx:9 'useEffect' is defined but never used.`
- `@typescript-eslint/no-explicit-any`: `frontend-prediction/src/components/DatabaseSettings.tsx:17 Unexpected any. Specify a different type.`
- `react-hooks/exhaustive-deps`: `frontend-prediction/src/components/ModelViewer.tsx:325 React Hook useEffect has a missing dependency: 'camera.position'.`

---
문서 버전: v1.0 / 작성일 2025-10-22  
담당: Codex (자동 생성)

