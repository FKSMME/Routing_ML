# Checklist: Training Log Viewer API 구현

**Date**: 2025-10-23
**Related PRD**: docs/planning/PRD_2025-10-23_training-log-viewer-api-implementation.md
**Status**: In Progress

---

## Phase 1: LogViewer 컴포넌트 분석 (0.5 hour)

**Goal**: LogViewer.tsx가 기대하는 API 형식을 파악합니다.

- [x] LogViewer.tsx 전체 코드 읽기
  - API 호출 방식: axios.get()
  - URL: /api/training/logs
  - Query params: limit=500

- [x] 기대하는 응답 형식 파악
  - Interface: `{ logs: LogLine[]; total: number }`
  - LogLine: `{ timestamp: string; level: string; message: string }`

- [x] UI 구성 분석
  - 리스트 형식 (monospace font)
  - 로그 레벨별 색상 코딩 (ERROR/WARNING/INFO/DEBUG)
  - 자동 새로고침 (5초 간격)
  - 자동 스크롤, 다운로드 기능

- [x] 분석 결과 문서화
  - API 응답: `{ logs: Array<{timestamp, level, message}>, total: number }`
  - 404 시 mock data 표시 (fallback 구현됨)

**Estimated Time**: 0.5 hour
**Status**: ✅ Completed

---

## Phase 2: 백엔드 로그 파일 확인 (0.5 hour)

**Goal**: 백엔드 로깅 설정 및 로그 파일 위치를 확인합니다.

- [x] 백엔드 로깅 설정 분석
  - backend/api/app.py에서 logging 설정 확인 ✅
  - APILoggingMiddleware 사용 확인 ✅
  - get_logger("api.access") 사용 확인 ✅

- [x] 로그 파일 위치 확인
  - 파일 시스템에서 로그 파일 검색 ✅
  - logs/ 디렉토리 확인 ✅
  - 로그 파일: trainer_ml_20251023.log (221 lines) ✅

- [x] 로그 형식 분석
  - 로그 파일 샘플 읽기 (head, tail) ✅
  - 형식: Pipe-separated (7 fields) ✅
  - 필드: timestamp | module | level | [file:line] | function | thread | message ✅

- [x] 로그 파싱 전략 수립
  - 파싱 방법: line.split('|') ✅
  - 필드 추출: [0]=timestamp, [2]=level, [6]=message ✅
  - 필터링: level matching, limit (tail approach) ✅
  - 파일 패턴: logs/trainer_ml_*.log (glob) ✅

**Estimated Time**: 0.5 hour
**Status**: ✅ Completed

---

## Phase 3: API 엔드포인트 구현 (1.5 hours)

**Goal**: `/api/training/logs` 엔드포인트를 구현합니다.

- [ ] 로그 조회 함수 구현
  - 위치: backend/api/routes/ (신규 파일 또는 기존 파일)
  - 로그 파일 읽기 (tail 방식)
  - 파싱 및 필터링 (level, since, limit)

- [ ] Pydantic 스키마 정의
  - backend/api/schemas.py에 추가
  - TrainingLogEntry (timestamp, level, module, message)
  - TrainingLogsResponse (logs, total, limit)

- [ ] FastAPI 라우터 생성/업데이트
  - training_logs.py 신규 생성 또는
  - 기존 training.py에 추가
  - GET /api/training/logs 엔드포인트

- [ ] Query parameters 구현
  - limit (default=500, min=1, max=10000)
  - level (optional, filter by log level)
  - since (optional, ISO 8601 timestamp)

- [ ] Error handling
  - 파일 없음 (FileNotFoundError)
  - 파싱 실패 (ValueError)
  - 권한 없음 (PermissionError)

- [ ] 라우터 등록
  - backend/api/app.py에서 include_router
  - 또는 자동 등록 로직 확인

**Estimated Time**: 1.5 hours
**Status**: Not Started

---

## Phase 4: LogViewer 업데이트 (선택, 0.5 hour)

**Goal**: API 응답 형식에 맞춰 LogViewer를 업데이트합니다.

- [ ] API 응답 형식 매칭 확인
  - LogViewer의 interface와 API 응답 비교
  - 불일치 시 interface 업데이트

- [ ] Error handling 추가/개선
  - API 호출 실패 시 메시지 표시
  - Loading state 개선

- [ ] UI 개선 (선택)
  - 로그 레벨 색상 코딩 (ERROR: red, WARNING: yellow, INFO: blue)
  - 검색 기능 (클라이언트 측 필터)
  - 복사 버튼 추가

**Estimated Time**: 0.5 hour (선택)
**Status**: Not Started

---

## Phase 5: 테스트 및 검증 (1 hour)

**Goal**: API와 UI가 정상 동작하는지 확인합니다.

- [ ] API 단위 테스트 (curl/Postman)
  - GET /api/training/logs (기본)
  - GET /api/training/logs?limit=100
  - GET /api/training/logs?level=ERROR
  - GET /api/training/logs?since=2025-10-23T16:00:00

- [ ] API 응답 검증
  - 상태 코드 200
  - JSON 형식 올바름
  - logs 배열 존재
  - total 및 limit 값 올바름

- [ ] UI 통합 테스트
  - log-viewer 메뉴 접근
  - 로그 목록 표시 확인
  - 로그 내용 가독성 확인

- [ ] 필터 및 기능 테스트
  - level 필터 동작 (있는 경우)
  - 검색 기능 동작 (있는 경우)
  - Pagination 또는 scroll 동작

- [ ] 성능 테스트
  - limit=500 응답 시간 <2초
  - 대용량 로그 파일 처리 (10MB+)
  - 메모리 사용량 확인

- [ ] 404 에러 제거 확인
  - Browser DevTools Network 탭
  - /api/training/logs 200 응답 확인

**Estimated Time**: 1.0 hour
**Status**: Not Started

---

## Git Operations (Phase별 수행)

### Phase 1 완료 후
- [ ] Git staging 완전성 확인
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 1: "docs: Complete Phase 1 - LogViewer 분석 완료"
- [ ] Push to 251014
- [ ] Merge 전 검증
  - `git diff main..251014` 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

### Phase 2 완료 후
- [ ] Git staging 완전성 확인
- [ ] Commit Phase 2: "docs: Complete Phase 2 - 백엔드 로그 파일 확인 완료"
- [ ] Push to 251014
- [ ] Merge 전 검증
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

### Phase 3 완료 후
- [ ] Git staging 완전성 확인
- [ ] Commit Phase 3: "feat: Complete Phase 3 - /api/training/logs 엔드포인트 구현"
- [ ] Push to 251014
- [ ] Merge 전 검증
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

### Phase 4 완료 후 (선택)
- [ ] Git staging 완전성 확인
- [ ] Commit Phase 4: "feat: Complete Phase 4 - LogViewer UI 개선"
- [ ] Push to 251014
- [ ] Merge 전 검증
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

### Phase 5 완료 후
- [ ] Git staging 완전성 확인
- [ ] Commit Phase 5: "test: Complete Phase 5 - Log Viewer API 테스트 완료"
- [ ] Push to 251014
- [ ] Merge 전 검증
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Progress Tracking

```
Phase 1: [▓▓▓▓] 100% (4/4 tasks) ✓
Phase 2: [▓▓▓▓] 100% (4/4 tasks) ✓
Phase 3: [░░░░░░] 0% (0/6 tasks)
Phase 4: [░░░] 0% (0/3 tasks) - 선택
Phase 5: [░░░░░░] 0% (0/6 tasks)

Total: [▓▓▓▓░░░░░░] 35% (8/23 tasks)
```

---

## Acceptance Criteria

- [ ] /api/training/logs 엔드포인트 구현 완료 ✅
- [ ] API 응답 시간 <2초 (limit=500) ✅
- [ ] 404 에러: 1개 → 0개 ✅
- [ ] log-viewer 메뉴에서 로그 정상 표시 ✅
- [ ] All tasks completed and marked [x]
- [ ] All phases committed and merged
- [ ] No empty checkboxes [ ] remaining

---

## Notes

- **로그 파일 경로**: Phase 2에서 확인 후 결정
- **Phase 4 선택 사항**: API 동작 후 필요 시 진행
- **성능 목표**: 응답 시간 <2초, 대용량 로그 지원

---

**Last Updated**: 2025-10-23
**Next Review**: After Phase 1 completion
