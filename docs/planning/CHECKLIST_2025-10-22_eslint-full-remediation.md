# Checklist: ESLint ��ü ���� ����ȭ

## Phase 1 - �ڵ� ����/���� ���� (ETA 0.5��)
- [ ] `npx eslint "src/**/*.{ts,tsx}" --fix --rule "simple-import-sort/imports:error"` 실행 (의존성: npm scripts 정상 동작)
  - Acceptance: import 정렬 관련 오류 31건 → 0건, 주요 파일 diff 확인
- [ ] JSX 특수문자(`react/no-unescaped-entities`) 6건 HTML 엔티티로 치환
  - Acceptance: eslint 동일 규칙 재실행 시 경고 없음
- [ ] `switch` 내 변수 선언(`no-case-declarations`) 케이스 블록 감싸기
  - Acceptance: 해당 규칙 재실행 시 오류 0건

## Phase 2 - Ÿ��/�̻�� ���� 정리 (ETA 1.5��)
- [ ] `frontend-prediction/src/lib/apiClient.ts` `any` → 명시적 DTO/Generic으로 대체 (의존성: `frontend-shared` schema 파악)
  - Acceptance: 파일 내 `no-explicit-any` 0건, fetch/response 타입 일치
- [ ] `DataOutputWorkspace.tsx` `any` 제거 및 상태/props 타입 정의 재구성
  - Acceptance: lint 통과 + 주요 상호작용 수동 테스트
- [ ] `@typescript-eslint/no-unused-vars` 50건 정리 (삭제 혹은 사용처 추가)
  - Acceptance: 규칙별 카운트 0, dead code 미존재 확인

## Phase 3 - Hook 및 경고 정리 (ETA 1��)
- [ ] `react-hooks/exhaustive-deps` 20건 정리 (필요 시 `useMemo/useCallback` 도입)
  - Acceptance: 경고 0, 기능 회귀 없음
- [ ] 정리된 컴포넌트 smoke test (RoutingCanvas, DataOutputWorkspace, CandidatePanel)
  - Acceptance: QA 노트 작성, 주요 기능 정상 동작

## Phase 4 - ��Ȯ/���� (ETA 0.5��)
- [ ] 최종 `npx eslint "src/**/*.{ts,tsx}" --format compact --max-warnings 0` 실행 및 0건 캡처
  - Acceptance: 로그 첨부(`docs/reports/2025-10-22_eslint-zero-log.txt`)
- [ ] `docs/analysis/2025-10-22_01_eslint-issue-analysis.md` 결과 감소 수치 업데이트
  - Acceptance: 이전 대비 감소량 표 기재
- [ ] Checklist Progress Tracking 갱신 및 모든 항목 `[x]` 처리

## Dependencies
- Node.js 18+ 환경, npm 패키지 설치 상태 (`node_modules` 최신)
- `frontend-shared` 타입 정의 참조 가능
- Git branch `251014` 최신 코드 기준

## Progress Tracking
Phase 1: [□□□□□□□□□□] 0% (0/3 tasks)  
Phase 2: [□□□□□□□□□□] 0% (0/3 tasks)  
Phase 3: [□□□□□□□□□□] 0% (0/2 tasks)  
Phase 4: [□□□□□□□□□□] 0% (0/3 tasks)  
Total: [□□□□□□□□□□] 0% (0/11 tasks)

