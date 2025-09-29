# Routing ML Release Notes — 2025-09-29

## Highlights
- `/api/rsl/groups` 라우팅 그룹 성공/충돌/ERP 플래그 무시 시나리오에 대한 자동화 테스트(`tests/test_rsl_routing_groups.py`) 추가. 【F:tests/test_rsl_routing_groups.py†L19-L148】
- FastAPI 워크스페이스 감사 엔드포인트(`POST /api/audit/ui`)의 204 응답 규격을 수정하여 OpenAPI 스키마/테스트 클라이언트 호환성 확보. 【F:backend/api/routes/workspace.py†L1-L150】
- 문서 업데이트: `docs/backend_api_overview.md`, `docs/sprint/routing_enhancement_qa.md`, `docs/install_guide_ko.md`에 최신 QA/배포 정책 반영. 【F:docs/backend_api_overview.md†L20-L89】【F:docs/sprint/routing_enhancement_qa.md†L1-L74】【F:docs/install_guide_ko.md†L98-L174】
- Stage 9 설치형 배포 SOP/설치 가이드를 정비하여 Alpha·Beta·GA 승인 흐름, 증빙 수집 절차, Task Execution 로그 연계를 명문화. 【F:docs/deploy/internal_routing_ml_sop.md†L1-L93】【F:docs/install_guide_ko.md†L24-L70】

## Test Summary
- ✅ `pytest tests/test_rsl_routing_groups.py` — 성공 및 충돌 시나리오 통과, ERP 필드 미지원 확인. 【66517b†L1-L33】

## Known Issues / Follow-up
- ERP ON 저장 시 `erp_required` 필드가 백엔드에서 무시됨 → RSL 스키마 확장 필요. 【F:tests/test_rsl_routing_groups.py†L140-L148】
- 프런트엔드 빌드 실패(TypeScript 오류)로 UI 시나리오는 보류 상태. 【F:docs/sprint/routing_enhancement_qa.md†L1-L33】
