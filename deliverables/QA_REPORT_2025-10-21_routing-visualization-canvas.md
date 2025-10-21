# QA Report — Routing Visualization Canvas & Recommendation (2025-10-21)

## 1. Scope & Method
- Reviewed frontend implementation across canvas (`RoutingCanvas.tsx`), recommendation panel (`CandidatePanel.tsx`, `RecommendationsTab.tsx`), workspace orchestration (`RoutingTabbedWorkspace.tsx`), and state store (`routingStore.ts`).  
  References: `frontend-prediction/src/components/routing/RoutingCanvas.tsx`, `frontend-prediction/src/components/CandidatePanel.tsx`, `frontend-prediction/src/components/routing/RecommendationsTab.tsx`, `frontend-prediction/src/components/workspaces/RoutingTabbedWorkspace.tsx`, `frontend-prediction/src/store/routingStore.ts`.
- Audited backend prediction serialization and response schemas (`prediction_service.py`, `backend/api/schemas.py`) to confirm data contracts.
- Parsed October 21 access/performance logs for quantitative metrics: `logs/api.access_20251021.log`, `logs/predictor_ml_improved_20251021.log`, `logs/dashboard_20251021.log`.
- Validated user flows via code inspection: candidate selection, drag/drop, timeline synchronization, error handling.

## 2. Quantitative Findings
| Metric (2025-10-21) | Result | Evidence |
| --- | --- | --- |
| `/api/predict` requests | 31 total (15 success, 16 HTTP 401) → success rate **48.39 %** | `logs/api.access_20251021.log` lines 29, 46, 1523–1682 |
| Prediction batches | 15 “배치 예측 완료” entries; average **1.53 candidates** (max 4) per batch | `logs/predictor_ml_improved_20251021.log` lines 5–58 (PowerShell summary) |
| Dashboard routing stats failures | 32 errors (`column 'INSRT_DT' invalid`) between 09:00–09:59 | `logs/dashboard_20251021.log` lines 1–32 |
| Candidate list render count | `CandidatePanel` displays `bucket.operations` only; no direct accounting of `response.candidates` | `frontend-prediction/src/components/CandidatePanel.tsx` lines 86–182 |
| Similar-item node bar | Canvas candidate tabs derived from `productTabs` timeline; similarity = first step’s `confidence` | `frontend-prediction/src/components/routing/RoutingCanvas.tsx` lines 528–551 |

## 3. Functional Gaps & Risks
1. **Candidate data truncation (Critical)**  
   - `routingStore.loadRecommendations` converts `response.items` into timeline tabs but discards `response.candidates`, resulting in no persistence of candidate-level metadata (rank, matched features, source code).  
     Source: `frontend-prediction/src/store/routingStore.ts:1194-1257`.  
   - UI panels (`CandidatePanel`, `RecommendationsTab`) render from `recommendations`/`productTabs` only, so features like “유사 품목 리스트 상단 노드” depend on synthesized data (first timeline step) rather than API metrics.

2. **Timeline & Canvas mismatch (High)**  
   - Canvas nodes treat every candidate step as draggable timeline entries without distinguishing original recommendation provenance (lack of `CandidateRouting` fields).  
     Sources: `frontend-prediction/src/components/routing/RoutingCanvas.tsx:470-620`, `frontend-prediction/src/store/routingStore.ts:741-820`.  
   - User selecting a candidate triggers `setActiveProduct`, replacing current timeline but does not persist active similarity score beyond first step.

3. **Recommendation interaction limitations (Medium)**  
   - Drop indicator/drag logic exists, but `routingStore.insertOperation` adds steps without rehydrating `similarity` or `confidence` fields (defaults null).  
     Source: `frontend-prediction/src/store/routingStore.ts:1370-1396`.  
   - Edge reconnection is stubbed (“TODO”) and does not update underlying timeline, limiting complex routing editing.  
     Source: `frontend-prediction/src/components/routing/RoutingCanvas.tsx:360-415`.

4. **Backend/Frontend contract drift (Medium)**  
   - Backend provides rich `CandidateRouting` payload (`backend/api/schemas.py:320-356`), including `matched_features`, `process_count`, but frontend schema usage ignores these fields.  
   - Prediction success rate impact: frequent HTTP 401 (likely expired token) reduces available data, causing empty states and repeated fallback to timeline view.

5. **Monitoring & Alerting gaps (Medium)**  
   - Dashboard stats fail due to missing `INSRT_DT` column; repeated errors indicate canvas statistics card likely empty, undermining QA confidence.  
     Source: `logs/dashboard_20251021.log`.

## 4. Recommendations
| Priority | Recommendation | Details / Files |
| --- | --- | --- |
| 🔴 Critical | Persist and expose `response.candidates` | Extend `routingStore.loadRecommendations` to store `candidates`, update `CandidatePanel`/`RoutingCanvas` to consume `CandidateRouting` attributes (similarity, matched features). |
| 🔴 Critical | Authenticate predict requests | Investigate 16×401 responses; implement token refresh or pre-flight validation in workspace store before submitting `/api/predict`. |
| 🟠 High | Restore candidate metadata to timeline nodes | Include `similarity_score`, `process_count`, `matched_features` in `toTimelineStep` context; surface in node tooltips. |
| 🟠 High | Fix dashboard stats query | Update SQL to use existing columns (`VALID_FROM_DT` etc.) or remove `INSRT_DT` reference, ensuring canvas KPI widgets render. |
| 🟡 Medium | Enhance drag/drop auditability | Log insert/remove operations with candidate ID; ensure undo/redo preserves metadata to avoid silent data loss. |
| 🟡 Medium | Add automated tests | Unit test for `routingStore.loadRecommendations` verifying candidate payload retention; integration test to confirm candidate tab displays API `SIMILARITY_SCORE`. |

## 5. Evidence Appendix
- Frontend: `frontend-prediction/src/components/routing/RoutingCanvas.tsx`, `frontend-prediction/src/components/CandidatePanel.tsx`, `frontend-prediction/src/components/routing/RecommendationsTab.tsx`, `frontend-prediction/src/store/routingStore.ts`.
- Backend: `backend/api/services/prediction_service.py:1730-1760`, `backend/api/schemas.py:320-360`.
- Logs: `logs/api.access_20251021.log`, `logs/predictor_ml_improved_20251021.log`, `logs/dashboard_20251021.log`.

