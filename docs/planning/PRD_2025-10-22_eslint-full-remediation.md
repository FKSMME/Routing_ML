# PRD: ESLint ��ü ���� ����ȭ

## Executive Summary
- `frontend-prediction` ��Ű�� ��ü�� `npx eslint "src/**/*.{ts,tsx}" --format compact --max-warnings 0` �������� 200��(���� 180, ��� 20)�� ������ Ȯ����.
- ���� ������ �ڵ� ���뺸��, Ư�� `any` Ÿ�� ���, �̻�� ����, ���� ��� ε��� �� ������ ����ҿ� ���� ������ ���̴�.
- ���� PRD�� �� ������� ���, ������ ������, Ư���� ESG ������ �ҿ� ������ ��ġ�Ͽ� 0��(Error/Warning) ���ݿ��θ� �����ϴٰ� �����Ѵ�.

## Problem Statement
- ESLint ������ ������ ������ ����Ǵ� ����� �������� ���迡 ���� ���簡���̰�, �ڵ� ��ǥ�� ���� ����(����/QA)�� ����Ͽ� �����ϴ�.
- `any` ��Ÿ �̻�� �ڵ�, ���� ���, JSX Ư������, `switch` ���� ������ �� Ư�� ����� ��ǥ�� ������������ ���� ���Ƽ����� ���� ���̰�.
- ���� ��Ʈ ����/CI �ܰ迡 ���� `--max-warnings 0` ������ �����ϴ�, �� ESLint ������ �ڵ跮 ���� ȿ���� ĥ������ ���ΰ� ���Ѵ�.

## Goals and Objectives
1. ESLint �� 200�� �̻� ������ ȹ������ 0��(Error + Warning) ����Ʈ�� �����Ѵ�.
2. �������� `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-unused-vars`, `react-hooks/exhaustive-deps` �� Ư�� ������ �������Ʈ�ߴٴ� ȿ���� ���� ��ġ�Ͽ� ���� �����Ѵ�.
3. ESLint ��Ʈ ����/CI �ܰ迡 ���ӵ��� ��ϵǴ� ���̺귯������ Ư�� ������(예: DTO, util type, custom hooks)�� ���� ����/���������Ѵ�.
4. �۾��� ������� ��ü �����Ͽ� re-run �� ������Ʈ/������ ������Ʈ�Ͽ� ��� ǰ��尡 Ȯ��Ȱ�ϰ� ���Ѵ�.

## Requirements
- **정량 지표**: 규칙별/파일별 남아 있는 ESLint 카운트를 추적하고 단계별 감소율을 기록할 것.
- **타입 안정성**: `any` → 명시적 타입 또는 `unknown` 기반 좁히기 패턴 변환.
- **자동화 활용**: `simple-import-sort/imports` 등 auto-fix 규칙을 우선 제거하고, 나머지 lint도 코드 구조 개선으로 해결.
- **테스트/검증**: 주요 UI 경로(라우팅 Canvas, Data Output, Data Quality) smoke test 혹은 스토리북 체크로 회귀 방지.
- **산출물**: 
  - `docs/analysis/2025-10-22_01_eslint-issue-analysis.md` 갱신 (감소량 리포트)
  - 체크리스트/Progress 업데이트
  - ESLint 결과 로그 첨부 (`docs/reports` 내 신규 파일)

## Phase Breakdown
| Phase | 범위 | 산출물 |
| --- | --- | --- |
| Phase 1 | 자동 수정 가능 항목 처리 및 기준선 확보 (`simple-import-sort`, `react/no-unescaped-entities`, `no-case-declarations`) | ESLint 로그, checklist Phase 1 완료 |
| Phase 2 | 타입 정비(`any` 대체), `unused-vars` 정리, 공용 타입/DTO 정리 | 타입 정의 파일, 수정된 컴포넌트 |
| Phase 3 | 훅 의존성(`react-hooks/exhaustive-deps`) 정리 및 회귀 테스트, 최종 ESLint 0건 | ESLint 결과 로그, smoke test 기록 |
| Phase 4 | 체크리스트/Progress 정리, 분석 문서 업데이트, 후속 예방 조치 정리 | 문서 업데이트, 향후 가이드 |

## Success Criteria
- `npx eslint "src/**/*.{ts,tsx}" --format compact --max-warnings 0` 실행 결과 오류·경고 모두 0건.
- 모든 체크리스트 항목이 `[x]` 처리되고 Progress 섹션이 100%로 갱신.
- `any` 사용이 불가피한 지점은 `@typescript-eslint/ban-ts-comment` 없이 안전한 타입으로 대체하거나 최소한 지역 좁히기 로직을 추가.
- 리팩토링 이후 주요 화면(라우팅 Canvas, DataOutputWorkspace) 수동 Smoke Test 수행 및 결과 기록.

## Timeline Estimates
- Phase 1: 0.5일 (자동 수정 및 간단한 문법 수정)
- Phase 2: 1.5일 (타입 정의/리팩토링)
- Phase 3: 1일 (훅 의존성 및 경고 제거, Smoke Test)
- Phase 4: 0.5일 (문서 업데이트 및 회고)

