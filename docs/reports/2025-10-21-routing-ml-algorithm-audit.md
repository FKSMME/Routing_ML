# Routing ML Algorithm QA Audit — 2025-10-21

## 1. Executive Summary

Comprehensive inspection of the training, prediction, and visualization pipeline surfaced strong coverage in feature ingestion and runtime configurability, but also highlighted correctness gaps versus the stated objective of joining `dbo_BI_ITEM_INFO_VIEW` embeddings with `dbo_BI_ROUTING_VIEW` and `dbo_BI_WORK_ORDER_RESULTS`. The current predictor only consumes routing view data, legacy `v1` artifacts are absent from the repo, and the visualization layer does not yet surface similar-item nodes or click-through routing previews. Quantitative diagnostics (dataset size, missing-value ratios, weight statistics) have been assembled to guide remediation.

## 2. Training Feature Inventory & Transformations

| Item | Observation | Evidence |
| --- | --- | --- |
| Feature universe | 41 fields sourced from `dbo_BI_ITEM_INFO_VIEW`, defined in `TRAIN_FEATURES`, with numeric subset declared separately for scaler paths. | `backend/constants.py:25`, `backend/constants.py:62` |
| Preprocessing | `ImprovedPreprocessor.fit` applies safe string/number coercion, OrdinalEncoder for categoricals, StandardScaler and optional PCA, variance threshold and dead-dimension pruning prior to HNSW vectorization. | `backend/trainer_ml.py:363`, `backend/trainer_ml.py:519` |
| Embedding stats | Latest full training run (job `api-train-20251021024036`) processed **324 919** items × 39 features, trimmed 3 low-variance columns, padded embeddings to 128 dims, and completed in **29.98 s**. | `logs/trainer_ml_20251021.log`, `models/test_phase2/training_metrics.json` |
| Missingness hotspots | Five worst missing rates: `ITEM_NM_ENG` 100%, `DRAW_USE` 100%, `GROUP3` 99.07%, `RAW_MATL_KINDNM` 96.97%, `SealTypeGrup` 84.22%. | `models/test_phase2/metrics.json` |

## 3. Feature Weight Management Audit

- Default domain weights prioritize material/geometry features (max 2.5) with 33 active features; mean weight 1.14, σ 0.65 (derived via PowerShell aggregation).
- Recent logs show two consecutive analyses: one pathological run with only **2** features due to truncated dataset, followed by a full 36-feature analysis; both emitted “embedding dimension ≠ feature count” warnings before padding. | `logs/feature_weights_20251021.log`
- Top auto-importance scores (normalized) emphasize `PART_TYPE`, `ITEM_MATERIAL`, `ITEM_SPEC`, `IN_SEALTYPE_CD`, and `DRAW_NO`. | `models/test_phase2/feature_importance.json`
- `feature_recommendations.json` is garbled (encoding issue), blocking UI presentation of Korean headings; needs UTF-8 sanitation.
- No automated post-fit validation currently checks weight drift against historical baselines; consider comparing new weight vectors to manifest snapshots and flag >20% deviation per feature.

### Recommended next steps
1. Add regression guard: capture checksum/summary stats after each save (`FeatureWeightManager.save_weights`) and diff against prior manifest.
2. Instrument feature importance generation to fail fast when encoder vector length < feature count (current warning hides upstream data loss).
3. Replace corrupted recommendation file with UTF-8 JSON to unblock UI hints.

## 4. Embedding / DB Join Alignment

| Requirement | Current Behavior | Gap / Risk |
| --- | --- | --- |
| Embed `dbo_BI_ITEM_INFO_VIEW`, join with `dbo_BI_ROUTING_VIEW` and `dbo_BI_WORK_ORDER_RESULTS` to predict routing + time | `predict_single_item_with_ml_enhanced` fetches first routed similar item via `fetch_routing_for_item`; `WORK_ORDER_RESULTS` is never queried in predictor path. | Objective not fully met: actual cycle-time predictions only reuse routing view aggregates; work-order results remain unused. |
| Config alignment | Latest `training_request.json` still references `dbo.BI_ROUTING_HIS_VIEW` even though runtime code defaults to `dbo.BI_ROUTING_VIEW`. | Schema mismatch risk if workflow config rehydrates request payload verbatim. |
| Batch retrieval | `fetch_all_data_batch` returns item master + routing + work results per item, but no downstream consumer uses the merged dict. | Existing helper can underpin join but is unreferenced. |

**Action Items**
1. Extend predictor pipeline (`predict_routing_from_similar_items`) to optionally blend actual performance metrics (`ACT_RUN_TIME`, etc.) from `fetch_work_results_for_item`.
2. Align training request templates with runtime view constants; enforce via config store validation.
3. Build integration tests ensuring join output contains both routing steps and summarized work-order stats for a sample ITEM_CD.

## 5. Legacy Model (`v1`) Reuse Assessment

| Check | Finding |
| --- | --- |
| Repository assets | No `models/v1*` directories exist; only `default/`, `test_phase2/`, and timestamped versions are present. | `Test-Path models/v1.0.0` → false |
| Backwards loader support | `_LegacyDummyPickleModule` in `trainer_ml.py` handles `DummySimilarityEngine` and `DummyEncoder`, enabling import of joblib artifacts serialized from older entrypoints. | `backend/trainer_ml.py:37` |
| Manifest expectations | New pipeline expects manifest schema `routing-ml/manifest@1`, metadata JSON, and TB projector fallback outputs. | `models/test_phase2/manifest.json` |
| Compatibility plan | To reuse an external `v1` bundle, convert assets to the manifest layout: provide `feature_columns.joblib`, scaler/encoder joblibs, similarity index, and optional `feature_weights`. Script `models.save_load.load_model_with_metadata` already handles legacy joblib when files are present. |

**Guidance:** Document legacy import runbook—mount legacy joblib directory under `models/legacy_v1`, add manifest stub, and call `backend.trainer_ml.load_optimized_model` with `auto_feature_weights=False` to skip re-weighting.

## 6. Weight Selection Workflow & Trigger Path

| Component | Observation |
| --- | --- |
| Front-end store | `workspaceStore` exposes `setFeatureWeightProfile`, `setManualWeight`, and tracks manual overrides, defaulting to “custom” profile upon manual change. | `frontend-prediction/src/store/workspaceStore.ts:276` |
| Prediction trigger | `usePredictRoutings` injects `featureWeights` and `weightProfile` into query key, causing React Query to refetch predictions whenever weights/profile change. | `frontend-prediction/src/hooks/usePredictRoutings.ts:20` |
| Execution flow | `applyPredictionResponse` pushes new recommendations into `routingStore`, which updates timeline and candidate panels; logs confirm predictor runtime re-applies thresholds on each request. | `frontend-prediction/src/store/workspaceStore.ts:447`, `logs/predictor_ml_improved_20251021.log` |
| Server-side weight load | `PredictionService._apply_feature_weights` uses `FeatureWeightManager` to overlay manual/selected profiles before calling `predict_items_with_ml_optimized`. | `backend/api/services/prediction_service.py:633` |

**Recommendation:** Record applied weight profile and checksum inside `PredictionResponse.metrics.feature_weights` so UI can display audit info beside visualization.

## 7. Visualization Behavior Assessment

| Requirement from brief | Implementation status |
| --- | --- |
| “Similar item list displayed as nodes atop visualization” | No dedicated node strip exists; `RoutingCanvas` renders only timeline nodes with similarity badges, and `CandidatePanel` lists operations (not candidate items). | `frontend-prediction/src/components/routing/RoutingCanvas.tsx`, `CandidatePanel.tsx:29` |
| “Click similar item node to load that item’s routing below” | `selectedCandidateId` is stored (`App.tsx:179`), but no UI renders candidate list for selection; clicking cards toggles operations, not candidate-level routing. |
| “Recommendation node showing predicted routing on visualization page” | Recommendations appear under separate tab (`RecommendationsTab`) but require manual drag to timeline; no automatic overlay node is rendered. |

**Gap Closure Plan**
1. Add `SimilarItemRail` component that maps `PredictionResponse.candidates` to clickable badges, dispatching `setSelectedCandidate`.
2. Modify `RoutingCanvas` to highlight timeline per selected candidate (e.g., color-coding edges) and allow quick switch between source items.
3. Surface recommendation summary node within main canvas (e.g., synthetic “Recommendation” node feeding into timeline) to fulfill requirement 4 visually.

## 8. Key Risks & Remediation Priorities

| Severity | Issue | Impact | Recommended Fix |
| --- | --- | --- | --- |
| High | `WORK_ORDER_RESULTS` unused in predictions | Time predictions ignore actual execution data; deviates from promised objective. | Extend predictor aggregation to incorporate work-result statistics; add regression tests. |
| High | Legacy `v1` artifacts absent / undocumented | Blocks reuse request; risk of ad-hoc file swaps. | Produce migration script & documentation; store sanitized legacy bundle under version control or artifact registry. |
| Medium | Weight analysis occasionally runs on truncated feature sets (only 2 columns) | Leads to misleading importance outputs if padding kicks in silently. | Add validation + CI check to ensure feature count ≥ expected minimum before saving weights. |
| Medium | UI lacks similar-item node rail & click-through behavior | Users cannot inspect contributing items per requirement. | Implement `SimilarItemRail`, connect to `selectedCandidateId`, update canvas rendering. |
| Medium | `feature_recommendations.json` encoding corrupted | UI cannot display category labels for weight hints. | Regenerate file with UTF-8 encoding. |
| Low | TensorBoard projector depends on fallback path; TensorFlow missing warnings logged each run. | Noise in logs; fallback works but hides misconfiguration. | Gate fallback behind optional dependency message or vendor TensorFlow Lite wheel. |

## 9. Metrics Appendix

### 9.1 Dataset & Training Snapshot (2025-10-21 02:41 UTC)

| Metric | Value |
| --- | --- |
| Samples | 324 919 |
| Unique ITEM_CD | 324 919 |
| Total columns ingested | 41 |
| Active features post-trim | 36 |
| Embedding dimensionality | 128 |
| Training duration | 29.98 s |
| Similarity threshold | 0.85 (trainer), 0.82 (predictor runtime) |

### 9.2 Top Feature Weights (post-training)

| Feature | Weight |
| --- | --- |
| ITEM_TYPE | 2.50 |
| PART_TYPE | 2.50 |
| SealTypeGrup | 2.50 |
| RAW_MATL_KIND | 2.20 |
| ITEM_MATERIAL | 2.00 |
| OUTDIAMETER | 1.80 |
| INDIAMETER | 1.80 |
| OUTTHICKNESS | 1.80 |
| MID_SEALTYPE_CD | 1.70 |
| OUT_SEALTYPE_CD | 1.70 |

### 9.3 Missing Value Leaders

| Feature | Missing Rate |
| --- | --- |
| ITEM_NM_ENG | 100% |
| DRAW_USE | 100% |
| GROUP3 | 99.07% |
| RAW_MATL_KINDNM | 96.97% |
| SealTypeGrup | 84.22% |
| ROTATE_CTRCLOCKWISE | 75.84% |
| MID_SEALSIZE | 16.00% |
| OUT_SEALSIZE | 12.06% |
| MID_SEALSIZE_UOM | 11.14% |
| MID_SEALTYPE_CD | 11.14% |

---

*Prepared by Codex QA Agent on 2025-10-21 at 13:15 KST.*
