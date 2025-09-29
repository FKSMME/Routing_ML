# Routing Groups API QA (2025-09-29)

- **Command**: `pytest tests/test_rsl_routing_groups.py`
- **Result**: ✅ Pass – 성공(201 응답), 중복 순번 충돌(400 응답) 시나리오 검증, `erp_required` 필드 무시 현상 확인. 【66517b†L1-L33】
- **Notes**:
  - 성공 케이스는 `/api/rsl/groups` 기준으로 소유자와 태그가 기대값과 일치함을 확인. 【F:tests/test_rsl_routing_groups.py†L89-L109】
  - 충돌 케이스는 동일 sequence 공정 등록 시 400과 한글 오류 메시지를 반환함을 확인. 【F:tests/test_rsl_routing_groups.py†L111-L138】
  - ERP ON 시나리오는 응답이 201로 돌아오나 `erp_required` 필드가 저장되지 않음을 확인, 백엔드 확장 필요. 【F:tests/test_rsl_routing_groups.py†L140-L148】
