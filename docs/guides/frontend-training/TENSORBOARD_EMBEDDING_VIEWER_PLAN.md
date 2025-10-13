# Training Dashboard TensorBoard Embedding Viewer 계획서

## 개요
- **목표**: TensorBoard Projector 수준의 3D 임베딩 시각화, 지표별 탭 그래프, 피처 기반 필터 UI를 Routing ML Training 대시보드에 통합한다.
- **범위**: `frontend-training` React 애플리케이션, FastAPI 백엔드(포트 8000 통합), `models/<version>/tb_projector/` 산출물.
- **제약**
  - UX에서 사용자가 드롭다운으로 Projector 세트를 선택할 수 있도록 구현한다.
  - 테스트는 사용자(요청자)가 직접 실행하며, 스크린샷으로 결과를 공유한다.
  - Figma 등 외부 디자인 툴 사용 금지. 대신, Web 상에서 많이 사용되는 LLM/임베딩 시각화 패턴(예: OpenAI Embedding Playground, Anthropic Claude 톤의 3D Point Cloud, HuggingFace Embedding Explorer)을 참고하여 UI/UX를 구현한다.

## Implementation Status (2025-10-13)
- **Backend**
  - Added `backend/api/routes/tensorboard_projector.py` to read projector artifacts, compute PCA coordinates, expose filter metadata, and synthesize metric series.
- **Frontend**
  - Added TensorBoard types (`src/types/tensorboard.ts`) and API clients (`fetchTensorboardProjectors`, `fetchTensorboardProjectorPoints`, `fetchTensorboardProjectorFilters`, `fetchTensorboardMetrics`).
  - Introduced `useTensorboardStore` to track projector selection, point cloud data, filters, color mapping, and metrics.
  - Enhanced `TensorboardEmbeddingPanel.tsx` with dropdowns, 3D canvas, filter controls, and ECharts-based metric tabs with auto refresh via `/api/trainer/status`.
  - Added a dedicated `TensorBoard` navigation workspace so the explorer lives on its own screen.
- **Auto refresh**
  - Poll `/api/trainer/status` every 15 seconds and invalidate cached projector data when the signature changes.
- **Demo data warning**
  - Current vectors/metadata are sample exports; replace with production TensorBoard outputs before launch.

- **현재 데이터는 스텁**으로 동작(백엔드와 프런트 모두 더미 응답). 실제 TensorBoard 산출물 연동 시 해당 API/RPC만 교체하면 된다.

## 데이터 명세
- **Projector Selector (드롭다운)**
  - 항목: `version_label`, `tensorName`, `updated_at`, `sample_count`
  - UX: 상단 고정 드롭다운에서 하나만 선택.
- **Coordinates 데이터**
  - 포맷: JSON 배열 (`[{ id, x, y, z, metadata: {...} }]`)
  - 포인트 수: 기본 10,000개까지 페이로드 제공 (추가 데이터는 페이징 또는 필터 후 재요청).
  - 좌표 계산: t-SNE/UMAP/PCA 중 백엔드에서 선계산하여 저장.
- **Metadata**
  - `metadata.tsv`의 주요 컬럼 (예: `ITEM_CD`, `PART_TYPE`, `DRAW_NO`, `OUTDIAMETER`, `MATERIAL_DESC`).
  - 필터링용 컬럼 목록을 API에서 함께 제공 (`categorical`, `numeric` 구분).
- **Metrics**
  - TensorBoard 이벤트 또는 기존 학습 로그에서 추출한 지표(Training Loss, Validation Accuracy 등).
  - 각 지표는 시계열 배열로 전송 (`[{ step, value, timestamp }]`).

## 백엔드 설계
- **FastAPI 라우트 (기존 8000번 서비스에 통합)**
  1. `GET /api/training/tensorboard/projectors`
     - 사용 가능한 Projector 리스트 반환.
  2. `GET /api/training/tensorboard/projectors/{projector_id}/points`
     - 좌표 + 메타데이터 반환 (기본 10,000개, `limit`/`offset`/`filters` 지원).
  3. `GET /api/training/tensorboard/projectors/{projector_id}/filters`
     - 필터링 가능한 컬럼/값 목록.
  4. `GET /api/training/tensorboard/metrics/{run_id}`
     - 지표별 그래프 데이터.
  5. 정적 파일 서빙: 필요 시 `/static/tensorboard/...` 경로를 추가하여 TSV 다운로드 제공.
- **자동 업데이트**
  - 학습 완료 시 `/api/trainer/status` 응답에 최신 Projector ID 포함.
  - 백엔드에서 새 버전 생성 시 `models/<version>/tb_projector/` 경로를 업데이트하고 라우트에서 즉시 반영.
- **보안/권한**
  - 기존 JWT 인증 미들웨어 재사용.
  - 대용량 다운로드 시 gzip 또는 csv streaming 검토.

## 프런트엔드 UI/UX 방향
- **3D 임베딩 뷰어**
  - 라이브러리: Three.js + drei 기반 Point Cloud(현재 프로젝트 의존성과 일관).
  - 기능: 마우스/터치 회전, 줌, 패닝, hover 툴팁, 선택 포인트 하이라이트.
  - 색상 매핑: 드롭다운으로 선택한 피처(예: `PART_TYPE`)를 기준으로 색상 팔레트 적용.
  - 인기 LLM 시각화 레이아웃 참고:
    1. 클러스터 중심 정렬 + 동적 범례 → HuggingFace Embeddings Explorer.
    2. 우측 정보 패널 + 좌측 필터 → OpenAI Playground 패턴.
    3. 상단 지표 탭과 하단 3D Canvas 배치 → 여러 AI Ops 콘솔 사례(BentoML, Weights & Biases).
- **피처 필터 UI**
  - Categorical: 체크박스 그룹, `전체/개별` 토글.
  - Numeric: 범위 슬라이더(최소/최대, 자동 binning).
  - 필터 적용 시 Point Cloud 리렌더링.
- **지표 탭**
  - 상단 탭 구조: `학습`, `검증`, `추론` 등.
  - 각 탭: Line/Area 차트(`echarts` 또는 `visx`) + 최근 값 강조.
  - 드롭다운 선택 변경 시 지표/포인트 동기화.
- **자동 새로고침**
  - 5~10초 간격 폴링 또는 SSE(WebSocket)로 최신 Projector 알림 → “새 데이터 감지” 배너 표시 후 자동 갱신.

## Task Progress Checklist
1. **API contract** ✅  `backend/api/routes/tensorboard_projector.py` implemented and registered.
2. **Frontend scaffolding** ✅  `useTensorboardStore` and `TensorboardEmbeddingPanel` seeded with dropdown + 3D canvas.
3. **Filter & color plumbing** ✅  Metadata-driven filters and color mapping feed the point cloud renderer.
4. **Metrics tab** ✅  Wired to `/training/tensorboard/metrics` and upgraded to ECharts visualizations.
5. **Auto-refresh** ✅  `/api/trainer/status` polling triggers projector cache invalidation.
6. **Docs & clean-up** ✅  Plan updated with latest components, navigation workspace, and follow-up notes.

## 테스트 & 검증
- 요청자 측에서 직접 기능 테스트 후 스크린샷 공유 예정.
- 개발 단계에서는 기본 Playwright/Vitest로 최소 렌더링 여부 체크(IP 확인, UI 뼈대 검증)만 진행.

## 향후 고려 사항
- 포인트 수가 10만 이상으로 증가할 경우 WebGPU/Instancing 도입 검토.
- TensorBoard Scalars 이벤트를 직접 읽어오는 크론/ETL 작업 마련.
- 서버 모니터(EXE)에서 TensorBoard API 상태를 추가로 표시할지 여부 평가.


