# PRD – Routing DB·인증·시각화 전수 점검

**작성일**: 2025-10-22  
**작성자**: Codex (GPT-5)  
**대상 범위**: Prediction Routing 생성 페이지 전 영역 (백엔드 DB 계층, 인증 흐름, 시각화 & 추천 UI)

---

## Executive Summary
- 운영 `.env` 는 `RSL_DATABASE_URL`, `ROUTING_GROUPS_DATABASE_URL`, `MODEL_REGISTRY_URL` 모두 PostgreSQL(psyopg) 접속으로 설정되었으나, 문서/스크립트/테스트 23개 파일에 `sqlite:///` 경로가 잔존한다. `migration/schema.sql` 기준 내부 저장소 테이블 8종(PostgreSQL)과 ERP MSSQL 뷰 4종을 재점검하고, 임시 DB 사용 경로를 차단·대체해야 한다.
- 2025-10-21 `api.access` 로그에서 `POST /api/predict` 401 오류 19회, `GET /api/auth/me` 401 오류 20회가 기록됨. 원인은 `workspaceStore` 기본 `itemCodes=["ITEM-001"]` 로 인해 인증 전 예측 API가 즉시 호출되는 구조다. 인증 상태 연동, 초기 로딩 UX, 토큰 재발급 대기 전략을 포함한 근본 대책이 필요하다.
- 시각화 탭의 `RoutingCanvas` 는 타임라인 기반 자동 엣지만 제공하며 `handleConnect` 가 실제 `addConnection` 스토어 액션을 호출하지 않아 신규 와이어 저장이 불가능하다. `RecommendationsTab` 기본 뷰도 `"timeline"` 으로 설정돼 추천 패널이 첫 화면에 노출되지 않는다. Canvas-추천 동기화 QA와 기본 탭 전환 로직 조정이 요구된다.

---

## Problem Statement
1. **DB 구조 파편화 위험**  
   - 내부 저장소는 PostgreSQL로 통합되었지만, 잔존 문서/스크립트/CI 흐름이 SQLite를 기본값으로 안내하고 있다.  
   - ERP 연동은 MSSQL View(`dbo.BI_ITEM_INFO_VIEW`, `dbo.BI_ROUTING_VIEW`, `dbo.BI_WORK_ORDER_RESULTS`, `dbo.BI_PUR_PO_VIEW`)에 의존하고 있으나, 최신 운영 연결 정보·뷰 명칭 측정치가 공유되지 않았다.
2. **예측 페이지 초기 인증 오류**  
   - React Query가 인증 상태 확인 이전에 `POST /api/predict`를 실행하면서 401 → 지연 배너 노출 → 수동 재시도로 해결되는 UX가 반복된다.  
   - 토큰 갱신/쿠키 발급 대기 로직이 없고, 초기 로딩 바·프리홈 화면도 준비돼 있지 않다.
3. **Canvas & Recommendations 연동 미완성**  
   - `RoutingCanvas` 의 신규 엣지 연결은 로그만 남기고 끝나며, 스토어 `connections` 배열은 자동 생성 엣지로만 채워져 있다.  
   - 추천 패널이 최초 렌더에서 숨겨져 있어 추천 기반 작업 흐름이 단절된다.  
   - Canvas/추천 상태 QA 체계(테스트 케이스, 계량 지표)가 마련돼 있지 않다.

---

## Goals and Objectives
1. **DB 아키텍처 체계화**  
   - PostgreSQL 스키마(8개 테이블)·MSSQL 뷰(4개)의 최신 상태, 행 수, 활용 경로를 지도화한다.  
   - SQLite 의존 경로를 모두 분류하고, Postgres 또는 in-memory 대체 전략을 제시한다.
2. **초기 인증 실패 제거**  
   - 인증 완료 이전에는 예측 API를 호출하지 않도록 조건을 분리하고, 토큰 발급 대기·재시도 프로세스를 정의한다.  
   - 로딩/진입 UX 개선(로딩 스피너, 별도 허브 화면 등) 옵션을 비교·선정한다.
3. **Canvas-추천 QA 및 기본 UX 개선**  
   - Canvas 와이어 연결 기능의 현황·제약을 계량 검증하고 개선 계획을 수립한다.  
   - 추천 탭을 기본 탭으로 노출하고, Canvas/추천 간 데이터 동기화 테스트 시나리오를 마련한다.
4. **재사용 가능한 지표·산출물 제공**  
   - 신규 엔지니어가 바로 착수할 수 있도록 작업 경로, 책임 구간, 체크포인트를 문서화한다.

---

## Requirements
### Functional Requirements
1. **DB 점검**
   - PostgreSQL 내부 테이블 8종(`item_master`, `routing_master`, `ml_predictions`, `users`, `routing_groups`, `model_registry`, `concept_drift_log`, `audit_log`)의 존재 여부와 행 수 샘플(Top-N, NULL 비율 등) 보고.
   - MSSQL 뷰 4종의 ROW COUNT, 최근 `insrt_dt`/`MODI_DT` 범위, 연결 지연 시간(ms) 측정.
   - `sqlite:///` 문자열이 남아 있는 23개 파일별 역할과 대체 방안을 정리.
2. **인증 흐름**
   - 인증 전 예측 API 호출을 방지하는 가드(`isAuthenticated && itemCodes.length > 0`) 설계.  
   - 토큰 발급 대기 재시도(지수 백오프) 혹은 로딩 허브 페이지 옵션 비교표 제시.
   - 401 응답 수 집계를 API 미들웨어에서 수집하는 로깅/Prometheus 측정안 제시.
3. **Canvas / 추천 QA**
   - Canvas 노드-엣지 상태 테스트 케이스: 노드 추가, 엣지 재연결, 새 엣지 생성, undo/redo.  
   - `RecommendationsTab` 초기 뷰 `"recommendations"` 로 설정하고, 기본 후보군이 없을 때의 UI(비활성 버튼, 안내문) 정의.  
   - Canvas `addConnection` 활용 로드맵(스토어 연동, DB 저장 모델) 제안.

### Non-Functional Requirements
- 모든 보고서는 한국어 기준, 공통 템플릿 준수.
- 로그·지표는 UTC+9 기준 타임스탬프 사용.
- 신규 엔지니어 온보딩 시간을 0.5일 이하로 줄일 수 있도록 작업 순서도 포함.

---

## Phase Breakdown
| Phase | 주요 작업 | 산출물 | 예상 기간 |
| --- | --- | --- | --- |
| Phase 1 – 데이터베이스 전수 점검 | PostgreSQL 테이블 프로파일링, MSSQL 뷰 지표 수집, SQLite 경로 분류 | DB 자산 매트릭스, SQLite 제거 계획 | 1.5일 |
| Phase 2 – 인증/토큰 안정화 설계 | React Query 가드, 로딩 UX 옵션 정의, 백엔드 로깅 설계 | 인증 흐름 개선안, 로딩 UX 와이어프레임 | 1.0일 |
| Phase 3 – Canvas·추천 QA & UX | Canvas/추천 테스트 시나리오, 기본 탭 전환, 와이어 연결 로드맵 | QA 체크리스트, UX 시연 GIF/스토리보드 | 1.5일 |
| Phase 4 – 문서/전달 | 최종 보고서, 온보딩 가이드, 정량 지표 대시보드 템플릿 | 한글 종합 보고서, 데이터 시트 | 0.5일 |

---

## Success Criteria
- SQLite 경로 제거 계획이 모든 23건에 대해 대응 상태(대체/보류/무시 사유 포함)를 분류.  
- PostgreSQL & MSSQL 측정 지표를 표 형식으로 제공하고, SLA(예: MSSQL 조회 지연 1.0초 이하) 목표를 정의.  
- 인증 전 401 오류가 QA 환경 재현 시 0건으로 감소하며, 실패 시 재시도 정책 로그가 수집됨.  
- Canvas QA 시나리오(최소 8건)와 추천 탭 기본 노출이 테스트 스냅샷 또는 스크린샷으로 검증.  
- 신규 엔지니어용 실행 안내서가 “준비물 → 단계 → 검증 → 산출물” 구조를 따라 3페이지 이내로 정리됨.

---

## Timeline Estimates
- **시작일**: 2025-10-22 (수)  
- **종료 목표**: 2025-10-27 (월) – 총 4.5 작업일  
- **주요 마일스톤**  
  - 10-23 AM: Phase 1 DB 매트릭스 초안 완료  
  - 10-24 PM: 인증/토큰 UX 설계 리뷰  
  - 10-25 PM: Canvas QA 시나리오·UX 개선안 확정  
  - 10-27 AM: 최종 보고서 전달 & 핸드오프

---

## Dependencies & Risks
- MSSQL/PosgreSQL 실환경 접속 권한이 필요하며, 미가용 시 로컬 샘플 DB로 대체 측정 필요.
- React Query 수정은 실제 코드 변경이 수반되므로, 배포 일정과 충돌 가능성.
- Canvas 와이어 기능은 현 시점에서 스펙 미완성 → 구현 범위 조정 또는 기술 부채 등록 필요.

---

## Open Questions
- 인증 토큰 재발급 정책을 서버(Refresh Token)로 확장할 계획 여부.
- Canvas 커스텀 연결을 영구 저장할 DB 테이블이 필요한지, 혹은 계산된 순서만 유지할지.
- MSSQL 뷰 명칭이 향후 변경될 가능성(ERP 팀 협의 필요)이 있는지.

---

## Approval
- **검토 요청**: 백엔드 리드, 프론트엔드 리드, DBA, PM
- **승인 기준**: Success Criteria 충족 여부 및 Phase별 산출물 검토 결과

