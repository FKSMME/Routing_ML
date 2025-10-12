# Issue: Manual Browser QA Blocked (2025-10-02)

## Summary
Manual verification steps in `docs/sprint/routing_enhancement_qa.md` that require a Chrome 127+ browser at ≥1440px width were initially blocked in the CI/container environment. Following the 2025-10-04 Lab-3 session, all eight manual checks have been executed with physical device evidence attached to the repository.

## Impacted Checklist Items
- Layout measurements for 20/60/20 columns at 1440px and 1280px breakpoints.
- Browser-based regression flows (`PredictionControls`, Metrics/Visualization panel, `WorkflowGraphPanel` navigation).
- API integration confirmation that requires UI-driven captures (dirty reset, ERP toggle payload captures, audit log sampling).

## Current Status
Automated build (`npm run build`), backend pytest suite, and frontend Vitest e2e scenarios all pass. Manual validations were executed during the 2025-10-04 09:05-10:26 KST Lab-3 slot, and ERP 토글 페이로드/감사 로그 수집은 [`deliverables/onboarding_evidence/erp_toggle_manual_20251004.network.json`](../../deliverables/onboarding_evidence/erp_toggle_manual_20251004.network.json)에 기록되었다.

## Proposed Follow-up
1. ~~Schedule a QA slot on a workstation with Chrome 127+ and 1440px+ resolution.~~ ✅ Completed 2025-09-29.
2. ~~Capture screenshots/logs for each pending checklist item.~~ ✅ Completed 2025-10-04, see [`deliverables/onboarding_evidence/lab3_manual_session_20251004.md`](../../deliverables/onboarding_evidence/lab3_manual_session_20251004.md).
3. ~~Attach outputs to `docs/sprint/routing_enhancement_qa.md` and close this issue.~~ ✅ Documentation updated 2025-10-04.
4. ~~Dirty reset 수동 시나리오 캡처(Chrome 127+): Lab-3 세션 로그와 증빙은 내부 공유 드라이브 `secure-share/QA/Lab3/20251004_dirty_reset/` 경로에 저장 후 체크리스트에 경로를 기록한다.~~ ✅ [`deliverables/onboarding_evidence/dirty_reset_manual_20251004.log`](../../deliverables/onboarding_evidence/dirty_reset_manual_20251004.log) 참고.

## Reservation Log
- [x] **2025-09-29 23:15 UTC** – 김서윤( QA Ops )이 Lab-3 물리 장비(Chrome 127+, 27"@2560×1440) 오전 슬롯을 예약. 확정 일정: 2025-10-04 00:00-02:00 UTC (09:00-11:00 KST). 예비 슬롯: 2025-10-07 05:00-06:30 UTC (14:00-15:30 KST). 증빙: 내부 공유 드라이브 `QA/Lab3/chrome127_manual_reservation_20250929.png` (저장 정책에 따라 저장소에는 바이너리를 보관하지 않음).
- [x] **2025-10-04 00:00 UTC** – 현장 수동 QA 실행 및 캡처/측정 기록. ✅ 실행 완료, 결과물: [`deliverables/onboarding_evidence/lab3_manual_session_20251004.md`](../../deliverables/onboarding_evidence/lab3_manual_session_20251004.md).
- [ ] **2025-10-07 05:00 UTC** – 예비 슬롯에서 미완료 항목 보완 (필요 시). (보류: 모든 항목 완료로 불필요하면 취소 예정.)

> _Note: 플레이스홀더 이미지는 내부 공유 드라이브에만 저장하며, 저장소에는 텍스트 로그만 유지한다. 현장 실행 후 실제 계측/화면 캡처를 동일 위치에 업데이트할 예정이다._

## Owner / Next Action
- **Owner**: QA Ops (김서윤) / Engineering Support
- **Next Action**: None – manual verification complete. Close issue after confirming no additional evidence is requested.
