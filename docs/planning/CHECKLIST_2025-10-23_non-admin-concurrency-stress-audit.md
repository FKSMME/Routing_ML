# Checklist: 비관리자 동시 접속 스트레스 감사

**Date**: 2025-10-23  
**Related PRD**: docs/planning/PRD_2025-10-23_non-admin-concurrency-stress-audit.md  
**Status**: Not Started  
**Priority**: 🚨 HIGH  
**Branch**: 251014

---

## Phase 1: 정보 수집 & 스코프 확정

- [x] 비관리자 접근 가능 페이지/기능 인벤토리 정리 (프론트 라우팅/메뉴 기준)  
- [x] 백엔드 라우트/서비스 중 `role != admin` 노출 API 목록화  
- [x] 기존 문서(권한 매트릭스, 동시성 보고서, QA 체크리스트) 검토  
- [x] 로그/모니터링/성능 지표 획득 경로 파악 (APM, metrics, test scripts)  
- [ ] 테스트 계정/세션 토큰 확보 (일반 사용자 5명 분)  
- [x] 추적할 정량 지표 정의 (응답 시간, 오류율, 락 대기 등)  
- [ ] Git status 확인 → 필요한 자료 스냅샷 정리 (docs/work-history 초안)

**Dependencies**: 환경 접근 권한, 이전 보고서  
**Acceptance Criteria**: 점검 범위 문서화, 지표 정의 완료

---

## Phase 2: 코드/문서 전수 검사 및 정량 분석

### 프론트엔드
- [x] `frontend-*` 프로젝트에서 비관리자 상태/스토어/훅 정적 분석  
- [x] 동시에 발생 가능한 상태 경합 (예: React Query stale, Zustand write) 식별  
- [x] API 호출 패턴 및 낙관적 업데이트/재시도 로직 확인  
- [x] 에러 경로(Log toast/Modal) 동시 발생 시 UX 영향 평가

### 백엔드
- [x] FastAPI 라우트/서비스/리포지토리에서 트랜잭션/락/겹치는 자원 확인  
- [x] DB 세션 관리 (SQLAlchemy session_scope) 동시성 안전성 평가  
- [x] 캐시/큐/배치 작업 중 비관리자와 경합 가능성 탐색  
- [x] 권한 체크 데코레이터/미들웨어 누락 여부 확인

### 인프라/문서
- [x] 배포/모니터링 문서에서 동시성 관련 설정(AutoScale, rate-limit) 조사  
- [x] QA/테스트 스크립트에서 동시 사용자 시나리오 커버리지 확인  
- [x] 로그 정책(로그 레벨, 구조화) 검토

### 정량 지표 산출
- [x] 로그/모니터링/테스트 결과로부터 평균/피크 지표 수집  
- [x] 잠재적 병목 리스트와 심각도(High/Med/Low) 분류 표 작성  
- [x] 발견된 문제 수, 영향 사용자 수, 관련 코드 라인 수 등 KPI 집계

---

## Phase 3: 보고서 작성 & 개선안 도출

- [ ] Executive Summary (핵심 위험 & 지표)  
- [ ] 정량 지표 테이블/그래프 정리  
- [ ] 위험 항목 상세 (설명, 영향, 재현, 현재 방어, 추천 조치, ETA)  
- [ ] 개선 필요 항목 (Quick Win / Scheduled / Backlog) 분류  
- [ ] 권한 매트릭스 & 체크리스트 업데이트  
- [ ] Work history/QA 리포트 기록  
- [ ] 이해관계자 공유 채널(Slack/메일) 초안 작성  
- [ ] Git status → add -A → status → 커밋/푸시 준비

---

## Progress Tracking

```
Phase 1 (정보 수집): [..........] 0% (0/7)  
Phase 2 (전수 검사): [..........] 0% (0/15)  
Phase 3 (보고/개선): [..........] 0% (0/8)  

총합:                 [..........] 0% (0/30)  
Git Operations:       [..........] 0% (0/6)
```

---

## Notes & Risks
- 실제 부하 테스트 미수행 시 추정치 기반 → 보고서에 전제 명시 필요  
- 인증/세션 키 관리 주의 (테스트 후 폐기)  
- 광범위 코드 검사 시 시간 부족 가능 → 우선순위 정기 업데이트 필요

---

## Sign-off Checklist
- [ ] QA/보안팀 검토  
- [ ] 이해관계자 보고 완료  
- [ ] 개선안 티켓/백로그 등록  
- [ ] 최종 git status = clean

**Last Updated**: 2025-10-23  
**Next Review**: Phase 1 완료 시

