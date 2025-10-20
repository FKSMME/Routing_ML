## 2025-10-20 15:30 KST — Routing UI & Data Quality 점검

### 1. 라우팅 생성 ERP View 리스트 UX 조정
- 좌측 ERP View Item Explorer 카드에 고정 배경과 정적인 box-shadow를 적용하여 마우스 이동 시 과도한 팝업 효과를 제거함.
- 리스트 칩과 항목 카드에 은은한 음영을 부여하고 hover 시 색상 변화만 전달하도록 완화.
- 관련 파일: `frontend-prediction/src/index.css`

### 2. 라우팅 제어판 더미 모델 호환성
- 과거 더미 모델에서 직렬화한 `DummySimilarityEngine` 등을 로드할 때 발생하던 `Can't get attribute` 예외를 호환 모드로 복구.
- `backend/trainer_ml.py`에 레거시 피클 전용 로더를 추가하고, `backend/dummy_models.py`의 더미 클래스 구조를 실제 서비스 인터페이스와 일치시킴.
- 더미 모델 생성 스크립트(`create_dummy_model_simple.py`)는 중복 정의 대신 공용 더미 클래스를 사용.

### 3. 기준정보(Master Data) 테이블 레이아웃 개선
- 검색 영역을 상단으로 통합하고, 좌측 컬럼 필터/우측 데이터 카드 2칼럼 구조로 재정렬.
- 필터 칩 영역 스크롤, 활성 컬럼 표시 컴포넌트 추가 등으로 레이아웃 파손을 해소.
- 관련 파일: `frontend-prediction/src/components/workspaces/MasterDataSimpleWorkspace.tsx`, `frontend-prediction/src/index.css`

### 4. 데이터 품질 모니터링 Health API 개선
- `/api/data-quality/health`가 404를 반환하던 이슈를 해결하고, 데이터베이스·API·작업자 상태를 포함한 표준화된 구조를 반환하도록 구현.
- 프론트엔드 `HealthPanel`이 새로운 HealthStatus 스키마를 그대로 활용.
- 관련 파일: `backend/api/routes/data_quality.py`, `backend/api/services/data_quality_service.py`

### 5. TensorBoard Projector Export 경로 개선
- `models/export_tb_projector.py`가 하드코딩된 경로(D:\)를 참조하던 문제를 제거하고 CLI 인자를 받아 Windows 로컬 경로(`C:\Users\syyun\Documents\GitHub\Routing_ML_251014\models\tb_projector`)를 직접 로딩 가능하도록 수정.
- export 시 샘플 간격과 최대 행 수 제어 옵션 추가, TensorBoard 스토어는 기본적으로 `root` 프로젝트를 우선 선택하도록 조정.
- 관련 파일: `models/export_tb_projector.py`, `frontend-training/src/store/tensorboardStore.ts`

### 6. 로그인 배경 교체
- Training 로그인 화면이 Prediction과 동일한 Hyperspeed 애니메이션 배경을 사용하도록 컴포넌트 정리.
- 관련 파일: `frontend-training/src/components/HyperspeedBackground.tsx`, `frontend-training/src/components/auth/LoginPage.tsx`

### 확인 및 참고
- 자동 테스트는 실행하지 않았으며, 브라우저 수동 확인이 필요.
- TensorBoard export는 `py -m models.export_tb_projector --model-dir models --meta-path models/tb_projector/metadata.tsv` 명령으로 재실행 가능.

### 2025-10-20 17:10 KST — 기준정보 화면 재조정
- ERP View 패널 배경과 카드 폭을 헤더 너비에 맞춰 확장했습니다.
- ERP 데이터 샘플은 초기 500건을 불러오고, 필요 시 `더 불러오기` 버튼으로 전체 행(`row_count`)까지 확장할 수 있게 했습니다.
- 컬럼 필터 선택 + 검색 후 페이지 단위로 결과를 볼 수 있도록 검색 폼과 페이지네이션(페이지 크기 변경 포함)을 추가했습니다.

### 2025-10-20 18:20 KST — 라우팅 생성 ERP View 스크롤 보강
- 라우팅 생성 탭 좌측 ERP View 패널을 `routing-control` 카드 레이아웃으로 정비해 기준정보 화면과 동일한 배경·간격 체계를 적용했습니다.
- 노드 리스트 영역에만 적용되는 스크롤 한계를 지정해, 항목을 많이 불러와도 페이지 전체 대신 리스트 내부에서만 스크롤되도록 조정했습니다.
- 관련 파일: `frontend-prediction/src/components/workspaces/RoutingTabbedWorkspace.tsx`, `frontend-prediction/src/index.css`

### 2025-10-20 19:05 KST — 로그인 배경 Liquid Ether 통일
- Prediction·Training 로그인 화면에서 기존 Hyperspeed 애니메이션을 제거하고 앱 본문과 동일한 Liquid Ether 효과를 적용했습니다.
- 배경 설정 스토어(`useBackgroundSettings`) 값을 그대로 읽어와 로그인 시점에도 사용자가 조정한 색상·투명도·에니메이션 강도를 유지합니다.
- 관련 파일: `frontend-prediction/src/components/auth/LoginPage.tsx`, `frontend-training/src/components/auth/LoginPage.tsx`

### 2025-10-20 19:30 KST — 헤더 3D 로고 GLB 로딩 개선
- 헤더 좌측 3D 로고(`AnimatedLogo3D`)가 더 이상 placeholder 큐브를 그리지 않고 `/models/background.glb`의 KSM 모델을 직접 렌더링합니다.
- GLTF 캐시를 초기화한 뒤 다시 불러오도록 처리해 Prediction·Training 모두에서 최신 리소스가 즉시 반영됩니다.
- 관련 파일: `frontend-prediction/src/components/AnimatedLogo3D.tsx`, `frontend-training/src/components/AnimatedLogo3D.tsx`

