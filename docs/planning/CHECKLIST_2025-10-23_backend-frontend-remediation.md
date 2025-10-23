# CHECKLIST – Backend/Frontend 회귀 대응 (2025-10-23)

## Metadata
- **작성일**: 2025-10-23
- **작업명**: backend-frontend-remediation
- **담당**: Codex (자동화 에이전트)

## Phase 1 – 분석 및 설계
- [x] Task 1.1: 백엔드 iter_training/API 회귀 분석 (누락 함수, 스펙 정리)  
  - 예상 소요: 0.5시간  
  - 검증 기준: 필요한 함수/테스트 목록 문서화
- [x] Task 1.2: Database config 테스트/인증 의존성 분석  
  - 예상 소요: 0.3시간  
  - 검증 기준: 요구 mock/fixture 설계 문서화
- [x] Task 1.3: 프론트 lint/타입/테스트 실패 원인 분류  
  - 예상 소요: 0.7시간  
  - 검증 기준: 주요 오류 카테고리 및 해결 전략 목록화

## Phase 2 – 백엔드 개선
- [x] Task 2.1: `iter_training` 샘플링/배포 기능 구현 또는 테스트 스펙 정비  
  - 예상 소요: 1.2시간  
  - 검증 기준: 관련 pytest 모듈 통과, 문서/주석 남김
- [x] Task 2.2: Database config 테스트와 구현 동기화 (`require_admin` 대응, mock)  
  - 예상 소요: 0.8시간  
  - 검증 기준: 테스트 진입 시 ImportError 없음, 기대 시나리오 통과
  - 예상 소요: 1.0시간  
  - 검증 기준: 실패 시 원인 기록, 성공 로그 확보

## Phase 3 – 프론트엔드 개선
- [x] Task 3.1: `frontend-training` lint/타입 에러 수정 (`any` 제거, 타입 정의, 의존성 설치)  
  - 예상 소요: 1.2시간  
  - 검증 기준: `npm run lint` 통과
- [x] Task 3.2: `frontend-training` vitest 실패 해결 (hook 사용, WebGL mock 등)  
  - 예상 소요: 1.0시간  
  - 검증 기준: `npm run test -- --run` 통과
- [ ] Task 3.3: `frontend-prediction` lint/타입/테스트 정리  
  - 예상 소요: 1.0시간  
  - 검증 기준: lint 통과 및 핵심 테스트 실행 성공
- [ ] Task 3.4: `frontend-shared` 툴링 점검 (lint 스크립트 추가 여부 포함)  
  - 예상 소요: 0.3시간  
  - 검증 기준: 공용 패키지 빌드/린트 체계 정리

## Phase 4 – 통합 검증 및 보고
- [ ] Task 4.1: 백엔드 pytest + 프론트 lint/build/test 재실행 및 로그 수집  
  - 예상 소요: 0.7시간  
  - 검증 기준: 모든 명령 성공, 로그 경로 기록
- [ ] Task 4.2: 체크리스트/Progress Tracking 업데이트, 증빙 정리  
  - 예상 소요: 0.5시간  
  - 검증 기준: 모든 항목 `[x]`, 링크 정리
- [ ] Task 4.3: 최종 보고서/요약 작성  
  - 예상 소요: 0.3시간  
  - 검증 기준: 결과/권고/근거 포함 보고서 전달

## Dependencies
- Phase 2는 Phase 1 분석 완료 후 착수.
- Phase 3는 최소 iter_training 회귀 수정 후 착수(백엔드 API 정상 가정 필요).
- Phase 4는 전체 수정 완료 후 검증/보고 단계.

## Acceptance Criteria
- 각 Task는 관련 로그/테스트 결과/코드 변경을 근거로 완료 판단.
- 실패 사항 발생 시 체크리스트에 RCA 및 후속 조치 기록.
- 최종 보고서와 체크리스트는 Git에 추적 가능.

## Progress Tracking
Phase 1: [##########] 100% (3/3 tasks)  
Phase 2: [######    ] 67% (2/3 tasks)  
Phase 3: [#####     ] 50% (2/4 tasks)  
Phase 4: [          ] 0% (0/3 tasks)  

Total: [#####     ] 54% (7/13 tasks)
