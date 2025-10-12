PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 1 | Completed 22 | Blockers 0

# Routing UI Gap Analysis (샘플 vs 현재 구현)

## 참고 자료
- Design 샘플: `docs/Design/samples`
- 현 프런트엔드: `frontend/src`

## 상단 내비게이션
- [x] 샘플의 파스텔/글라스 스타일 적용 (구현: `frontend/src/components/MainNavigation.tsx`, `frontend/src/index.css`)
- [x] 한글 라벨 정상 표기 및 메뉴 순서 정렬 (`기준정보 확인 → 라우팅 생성 → 알고리즘 → 데이터 출력 설정 → 학습 데이터 현황 → 시스템 옵션`)
  - 2025-09-30: `frontend/src/App.tsx` 네비게이션 라벨/설명을 설계 명칭에 맞춰 갱신.
- [x] 반응형 사이드/토글 메뉴 구현 (구현: `frontend/src/components/ResponsiveNavigationDrawer.tsx`, `frontend/src/hooks/useResponsiveNav.ts`, `frontend/src/App.tsx`)

## 기준정보 확인
- [x] Access DB 연동 및 Siemens Tree 유사 탐색 UI 구성 (구현: `frontend/src/components/master-data/MasterDataWorkspace.tsx`)
- [x] 제품 행렬/검색/메타 데이터 패널 구현 (구현: `frontend/src/components/master-data/MasterDataWorkspace.tsx`)

## 라우팅 생성
- [x] 20/60/20 레이아웃, 탭 기반 다품목 전환 (`Tabs` 구성) (구현: `frontend/src/components/routing/RoutingWorkspaceLayout.tsx`, `frontend/src/index.css`, `frontend/src/components/routing/RoutingProductTabs.tsx`)
- [x] 좌측 멀티 입력 및 Access 컬럼 매핑 그리드 (구현: `frontend/src/components/PredictionControls.tsx`, `frontend/src/components/routing/ReferenceMatrixPanel.tsx`)
- [x] 센터 가로 블록 타임라인 + 가로/세로 스크롤 + 추천 라우팅 탭 (구현: `frontend/src/components/TimelinePanel.tsx`, `frontend/src/components/routing/RoutingProductTabs.tsx`)
- [x] 우측 후보 블록 리스트 + 저장(SAVE/INTERFACE) 패널 (로컬/클립보드/다중 포맷, ERP 토글 연동) (구현: `frontend/src/components/CandidatePanel.tsx`, `frontend/src/components/RoutingGroupControls.tsx`)
- [x] 워크플로우 그룹 저장 UX (샘플의 Save/Download/Upload 흐름) (구현: `frontend/src/components/RoutingGroupControls.tsx`, `frontend/src/components/SaveInterfacePanel.tsx`)

## 알고리즘
- [x] 블루프린트 스타일 시각화(노드/에지) + 더블클릭 편집 팝업 + 코드 싱크 (구현: `frontend/src/components/workspaces/AlgorithmWorkspace.tsx`)

## 데이터 출력 설정
- [x] 컬럼 매핑/행렬 구성 UI + 저장 후 라우팅 SAVE 연계 (구현: `frontend/src/components/workspaces/DataOutputWorkspace.tsx`)

## 학습 데이터 현황
- [x] 모델 상태 시각화(Tensorboard, Heatmap 등) + 피처 가중치 체크박스 + Save (구현: `frontend/src/components/workspaces/TrainingStatusWorkspace.tsx`)

## 시스템 옵션
- [x] 표준편차/유사 품목 옵션, 충돌 제약, 라우팅/학습/출력 컬럼 매핑 설정 (구현: `frontend/src/components/workspaces/OptionsWorkspace.tsx`)

## 공통 요구
- [x] 설정값 Persist (로컬/서버) + 감사 로그(IP/시간/작업) (구현: `frontend/src/store/workspaceStore.ts`, `frontend/src/components/RoutingGroupControls.tsx`, `frontend/src/components/workspaces/OptionsWorkspace.tsx`)
- [x] Access DB 파일/테이블 연결 기능 (구현: `frontend/src/components/master-data/MasterDataWorkspace.tsx`, `frontend/src/components/workspaces/OptionsWorkspace.tsx`)
- [x] Docker/내부망 배포 전략 문서화 (`deploy/docker/internal_network_playbook.md` 최신 플레이북으로 범위 충족)
- [x] 모델 학습 콘솔 분리, 사전 학습 데이터 활용 경로 확보 (`backend/cli/train_model.py`, `backend/cli/README.md` 기반 전용 콘솔/데이터 경로 문서화)
- [x] main\4.jpg 스타일 메인화면 반영, pastel gradient/hover 강조 일관 적용 (구현: `frontend/src/components/HeroBanner.tsx`, `frontend/src/index.css`)
- [x] Workflow Graph 편집 → 코드 연동, Tensorboard 링크 연결 (구현: `frontend/src/components/WorkflowGraphPanel.tsx`)

## 발견된 인코딩/문서 이슈
- [x] `frontend/src/App.tsx` 등 한글 문자열 깨짐 재발
  - 네비게이션 텍스트를 UTF-8 한글 문자열로 수정해 이슈 해소.
- [x] 기존 문서(예: `docs/Design/routing_enhancement_plan.md`) 인코딩 재정비 필요 (2025-09-30: UTF-8 재인코딩 및 검증 완료, 툴체인 점검 포함)
- [x] 문서 상단 PRD/Tasklist 지표 확인 및 최신화 (2025-09-30: 본 문서 점검 시 스프린트 지표 갱신)

## 다음 조치 제안
1. 샘플 구조 기반으로 각 메뉴별 상세 설계 문서화
2. 레이아웃/스타일 토큰 재구성 후 UI 리팩터링 단계적 수행
3. 저장/로그/Access 연동 및 배포 전략 정의
