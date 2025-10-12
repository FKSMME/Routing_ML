> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 0 | Completed 11 | Blockers 0

# 절대 지령 준수 안내
- 기존 절대 지령을 동일하게 적용하며 착수·완료 시 승인 절차를 따른다.
- 작업 로그와 산출물을 문서화하고 Tasklist와 연동한다.

# Step 4 Plan: 학습 데이터 현황 대시보드

## 단계 목표
- [x] TensorBoard 링크, 가중치 히트맵, 피처 선택/저장, 시각화 탭 구조를 구현한다. (`frontend/src/components/workspaces/TrainingStatusWorkspace.tsx`, `frontend/src/components/FeatureWeightPanel.tsx`, `backend/api/routes/trainer.py`)

## 세부 Task Checklist
- [x] 데이터 요구 정리: 모델 메타데이터, 추천 가중치, TensorBoard URL 수집 — `backend/api/routes/trainer.py` 응답 필드 및 `models/training_metadata.json` 확인.
- [x] 시각화 도구 선정: 히트맵/차트 라이브러리 PoC 계획 수립 — ECharts 기반 구성(`frontend/src/components/workspaces/TrainingStatusWorkspace.tsx`)으로 확정.
- [x] TensorBoard 연동 전략: 인증·프록시·iframe 정책 검토 문서화 — `docs/predictor_service_plan.md` TensorBoard Proxy 절을 업데이트.
- [x] 피처 선택 저장 흐름: `feature_profiles.json` 업데이트 로직·감사 로그 설계 — `frontend/src/components/FeatureWeightPanel.tsx`와 `backend/api/routes/trainer.py` PATCH 경로, `logs/audit/ui_actions.log`에 `ui.training.features.save` 기록 확인.
- [x] UI 구조 설계: 5개 탭(Weights/Metric/Visualization/Data Source/Workflow) 정보 구조 정의 — Training Workspace 내 탭 뷰모델 및 `frontend/src/components/VisualizationSummary.tsx` 탭 구획으로 구현.
- [x] QA 계획: 데이터 없음/에러 fallback, 접근성, 성능 시나리오 수립 — `docs/sprint/routing_enhancement_qa.md` 학습 데이터 섹션에 케이스 기록.

## 계획 산출물
- [x] 학습 대시보드 설계 문서 초안 — `docs/stage4_frontend_report.md`와 `docs/stage6_monitoring_report.md`에 반영.
- [x] 테스트/보안 체크리스트 — `docs/sprint/routing_enhancement_qa.md` 학습 섹션과 `docs/error_risk_review.md` 보안 체크를 참조.
- [x] 승인 단계 보고서 — `docs/sprint/logbook.md` 2025-09-29 항목과 `docs/stage6_monitoring_report.md` 업데이트 기록으로 승인 근거 확보.

## 완료 증빙 및 승인 로그
- `docs/sprint/logbook.md` 2025-09-29 "Group 5" 항목과 `docs/stage6_monitoring_report.md` 업데이트 내역으로 승인 근거 확보.
- `logs/audit/ui_actions.log`에 `ui.training.refresh`/`ui.training.features.save` 이벤트 기록으로 실행 이력 확보.

