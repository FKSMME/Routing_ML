# Routing ML 백엔드/프론트엔드 회귀 대응 PRD

- **작성일**: 2025-10-23
- **작성자**: Codex (자동화 에이전트)
- **관련 태그**: Regression Fix, Backend, Frontend, QA, Iterative Training

## Executive Summary (요약)
- 2025-10-23 통합 검증에서 확인된 주요 회귀(백엔드 iter_training API 미구현, database config 테스트 실패, 프론트 린트/빌드/테스트 오류)를 해소한다.
- 우선순위는 백엔드 학습 파이프라인 정상화, 데이터베이스 라우터 테스트 정합성 확보, 프론트엔드 품질 기준(린트/빌드/테스트) 충족이다.
- 해결 후 전 범위 검증(백엔드 pytest, 프론트 npm lint/build/test) 재실행 및 결과를 보고서에 첨부한다.

## Problem Statement (문제 정의)
- `backend.iter_training` 모듈에서 테스트가 요구하는 `sample_items_for_quality`, `deploy_model` API가 누락되어 회귀 테스트가 즉시 실패한다.
- `backend.api.routes.database_config`가 `require_admin`을 사용하도록 변경되었으나 테스트(`test_database_config.py`)가 `require_auth` 기반 mock으로 작성돼 불일치가 생겼다. 또한 `require_admin` 의존이 실제 인증 흐름을 요구하므로 테스트 인프라가 준비되지 않았다.
- `frontend-training`과 `frontend-prediction`에서 다수의 린트/타입 에러, 테스트 실패가 발생해 CI 품질 기준을 충족하지 못한다.

## Goals and Objectives (목표)
1. iter_training 샘플링·배포 API를 복원(또는 테스트와 스펙을 동기화)하여 백엔드 테스트가 통과하도록 한다.
2. Database config 라우터와 테스트를 동기화하고 인증 의존성을 우회할 수 있는 test fixture를 구축한다.
3. Frontend-training/prediction에서 린트/타입 에러 및 비동기 테스트 실패를 해결해 `npm run lint`, `npm run build`, `npm run test -- --run`이 성공하도록 한다.
4. 필요 시 `frontend-shared`에 린트 스크립트를 추가하거나 tooling 정비.
5. 전체 수정 사항에 대한 회귀 검증 로그를 수집하고 보고한다.

## Requirements (요구사항)
- **백엔드**:  
  - iter_training 관련 누락 함수 구현 혹은 테스트 수정 시, 문서화/주석으로 명시.  
  - pytest 전체 스위트 실행 시 최소 주요 모듈(특히 iter_training, api.database) 통과.  
  - auth 관련 테스트는 실제 외부 의존 없이 mock 기반으로 수행.
- **프론트엔드**:  
  - lint 규칙 위반 0, 빌드 성공, vitest 주요 테스트(특히 TrainingStatusWorkspace, CandidatePanel 등) 통과.  
  - WebGL 의존 컴포넌트는 테스트 환경에서 graceful degrade.  
  - `NavigationKey` 타입 재정의 및 필요한 패키지(`recharts`) 설치/정합성 확보.
- **도구/문서**:  
  - 새 체크리스트/프로그레스 업데이트.  
  - 작업 완료 후 보고서 업데이트(근거 로그/스크린샷 경로 포함).

## Phase Breakdown (페이즈)
1. **Phase 1 – 분석 및 설계**: 기존 코드/테스트 분석, 수정 전략 수립, 린트/테스트 에러 목록화.
2. **Phase 2 – 백엔드 개선**: iter_training 함수 보강, database_config 테스트 정비, pytest 실행.
3. **Phase 3 – 프론트엔드 개선**: lint/타입 수정, 패키지 의존성 정리, vitest 환경 안정화.
4. **Phase 4 – 통합 검증 및 보고**: lint/build/test/pytest 재실행, 증빙 수집, 체크리스트/보고서 업데이트.

## Success Criteria (성공 기준)
- `pytest tests/backend --maxfail=1 --disable-warnings -q`가 iter_training, database_config 영역에서 더 이상 ImportError를 발생시키지 않는다.
- `npm run lint`, `npm run build`, `npm run test -- --run`이 frontend-training/prediction에서 모두 성공한다. 필요 시 flaky 테스트는 합리적 방법으로 skip 처리하며 근거 문서화.
- 신규/수정 함수는 단위 테스트를 제공하거나 최소 기존 테스트에서 커버된다.
- 체크리스트 100% 완료, 보고서에 근거 로그/결과가 첨부된다.

## Timeline Estimates (일정)
- Phase 1: 1.0시간 – 상세 영향 범위 파악, 작업 계획 구체화.
- Phase 2: 3.0시간 – iter_training 기능 구현 + database 테스트 수선 + pytest 정리.
- Phase 3: 3.5시간 – 프론트 lint/타입/테스트 수정, 의존성 추가.
- Phase 4: 1.5시간 – 전체 검증 재실행 및 보고.
- **총합**: 9.0시간 (2025-10-23 14:30 ~ 23:30, 버퍼 포함).

