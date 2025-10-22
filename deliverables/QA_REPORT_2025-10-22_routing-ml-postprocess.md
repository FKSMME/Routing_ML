# QA Report – Routing ML Post-Processing Integration (2025-10-22)

## 1. 범위
- ITEM_INFO 기반 유사 품목 탐색 이후 ROUTING_VIEW / WORK_ORDER_RESULTS를 활용해 추천 라우팅을 보강하는 신규 알고리즘.
- 시각화(UI) 개선: 공정 노드 Hover 정보, 후보 리스트 메타데이터, 외주→사내 전환 안내.

## 2. 테스트 요약
| 구분 | 시나리오 | 결과 | 비고 |
| --- | --- | --- | --- |
| **단위** | `python -m compileall backend` | ✅ 통과 | 신규 모듈(`routing_postprocess`) 및 `predictor_ml` 구조 검증 |
| **정적 분석** | `npm run lint --silent` (frontend-prediction) | ⚠️ 실패 | 기존 프로젝트 전반의 lint 오류 183건(미사용 import, any 타입 등) 존재. 신규 변경과 직접 연관된 오류 없음. |
| **수동 검증** | 추천 캔버스 노드 Hover 시 공정 시간·샘플·신뢰도 노출 여부 확인 | ✅ | 개발 환경에서 JSON mock으로 확인 (실제 DB 데이터 미연결) |
| **수동 검증** | 유사 품목 탭에 샘플 수/신뢰도/외주 배지 표출 | ✅ | mock data, UI 반응 확인 |

## 3. 주요 관찰 사항
1. 백엔드 보조 스코어 로직은 ROUTING/WORK 데이터를 활용해 라우팅 프레임·후보 정보를 생성하며, 실적 데이터가 없는 경우 기본 값으로 graceful fallback.
2. 외주 공정(외주8/외주2 등)은 우선 사내 공정 배지로 노출되고, 샘플 데이터가 부족한 경우 신뢰도가 0%로 표시되도록 처리.
3. 프런트엔드 lint는 기존 대규모 미사용 import/any 타입 경고로 실패 → 전체 프로젝트 일정상 별도 정리 필요.

## 4. 잔여 리스크 & 권장 조치
- **데이터 연동 미확인**: 실제 DB 연결 후 실시간 데이터에 대한 엔드투엔드 테스트 필요.
- **Lint 정리**: 기존 누적 lint 이슈 정비 필요 (별도 작업 항목 생성 권장).
- **성능 검증**: 후보 수 및 캐시 전략에 대한 부하 테스트 미수행 → 차후 성능 프로파일링 필요.

## 5. 산출물
- Backend: `backend/predictor_ml.py`, `backend/routing_postprocess.py`
- Frontend: `frontend-prediction/src/components/routing/RoutingCanvas.tsx`, `frontend-prediction/src/components/CandidatePanel.tsx`, `frontend-prediction/src/components/routing/CandidateNodeTabs.tsx`
- 문서: `deliverables/QA_REPORT_2025-10-22_routing-ml-postprocess.md`

작성자: Codex QA  
작성일: 2025-10-22  
비고: `.claude/WORKFLOW_DIRECTIVES.md`에 따라 Phase 3 QA 완료 기록.
