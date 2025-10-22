# 라우팅 ML – 신규 엔지니어 온보딩 가이드 (2025-10-22)

본 문서는 Prediction Routing 생성 페이지를 개선(인증 안정화, Canvas 와이어 저장, 모니터링 지표 확장)하는 프로젝트를 이어받을 신규 엔지니어를 위한 절차 안내서입니다. 아래 순서를 반드시 준수해 주세요.

---

## 1. 준비물
- 개발 환경: Node.js 18+, pnpm, Python 3.11, PostgreSQL 15+, FastAPI 런타임
- 필수 서비스 실행:
  - `backend`: FastAPI 서버 (`uvicorn backend.api.app:app --reload`)
  - `frontend-prediction`: `pnpm dev --filter frontend-prediction`
  - Prometheus/Grafana (메트릭 대시보드 확인용)
- 접근 권한:
  - Postgres `routing_ml_rsl` (테이블 수정 가능)
  - MSSQL ERP 뷰 읽기 (테스트 필요 시)

---

## 2. 작업 단계
1. **리포지토리 점검**
   - `git status` 로 변경 사항 확인
   - `.env` 확인 (Postgres URL, JWT 설정)
2. **프론트엔드 모듈 빌드**
   - `pnpm install --filter frontend-prediction`
   - `pnpm test --filter frontend-prediction` (향후 테스트 추가 예정)
3. **Canvas 커스텀 와이어 기능 검수**
   - `frontend-prediction/src/components/routing/RoutingCanvas.tsx:30` : React Flow 핸들러 확인
   - 드래그로 수동 연결 생성/삭제 → 상태 변화(Undo/Redo, IndexedDB) 검증
4. **백엔드 저장소 검증**
   - `backend/models/routing_groups.py:23` : `connections` 컬럼 확인 (필요 시 Alembic 마이그레이션 작성)
   - `/api/routing/groups` 생성/수정 요청 테스트 (Postman 또는 VSCode REST client)
5. **모니터링 지표 연동**
   - `backend/api/routes/metrics.py:79` : 401 카운터와 endpoint 평균 응답 노출 확인
   - Grafana 패널 업데이트 (`docs/planning/METRICS_2025-10-22_dashboard-spec.md:1`)
6. **문서 리뷰**
   - 설계 문서: `docs/planning/DESIGN_2025-10-22_auth-loading-telemetry.md:1`
   - QA 결과: `docs/planning/QA_2025-10-22_canvas-recommendations.md:1`
   - 와이어 로드맵: `docs/planning/DESIGN_2025-10-22_canvas-connections-roadmap.md:1`

---

## 3. 검증 체크리스트
- 수동 연결 생성 → 새로고침 → 캐시 복원 여부
- 라우팅 그룹 저장 후 DB에 `connections` JSON 존재 여부 (`SELECT connections FROM routing_groups`)
- 인증 완료 전 예측 API가 호출되지 않는지 Network 탭 확인
- `GET /metrics` 에 새 Prometheus 지표가 노출되는지 확인
- Grafana 대시보드 템플릿 업데이트

---

## 4. 산출물 목록
- 코드: 프론트엔드 Zustand/React Flow 수정, 백엔드 모델/스키마/라우터 확장
- 문서: 설계안, QA, 메트릭 스펙, 본 온보딩 가이드
- 향후 과제: MSSQL 지연 추이 템플릿, 최종 한글 보고서 배포

---

## 5. 연락처 & 지원
- 프론트엔드 담당: FE 리드 (internal Slack #front-prediction)
- 백엔드 담당: BE 리드 (internal Slack #api-platform)
- 인프라/모니터링: SRE 팀 (internal Slack #monitoring)

행운을 빕니다! 추가 질문은 위 채널로 문의해 주세요.
