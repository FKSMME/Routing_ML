# Routing Visualization & Candidate Nodes Update

- 작성일: 2025-10-20 12:14 (UTC-4)
- 작성자: Codex (GPT-5)

## 개요
라우팅 시각화 탭의 좌우 여백을 제거하고 Canvas 크기를 확장했습니다. 동시에 후보 공정 패널을 노드 기반 UI로 단순화하여 시각화 캔버스와 일관된 드래그앤드롭 경험을 제공합니다.

## 주요 변경
1. **레이아웃 확장**
   - `RoutingTabbedWorkspace.tsx`에서 인라인 스타일 제거, CSS 클래스로 캔버스/후보 영역 폭을 제어.
   - `.routing-visualization-tab`, `.visualization-canvas`, `.candidates-section` 등 새 스타일 추가.
   - 좌우 padding 제거로 캔버스가 외부 박스를 벗어나지 않고 더 넓게 표시됨.

2. **후보 공정 노드화**
   - `CandidatePanel.tsx`에서 기존 카드 UI → 타임라인 노드 스타일로 재구성.
   - 헤더/필터/ERP 토글 등 상단 정보를 간결한 `candidate-toolbar`로 배치.
   - 설정 버튼은 "노드 설정"으로 변경, CandidateSettingsModal 기능 유지.

3. **드래그 & 출력 연동 확인**
   - 노드 더블클릭/드래그 시 `insertOperation` 호출 로직 유지 → 타임라인 및 추천 리스트에 정상 반영.
   - TimelinePanel의 출력/저장 로직은 변경 없음.

## 테스트
- `npm run build` (frontend-prediction) 실행 → `AlertDropdown` 모듈 누락으로 실패 (기존 이슈). 수정 후 재시도 필요.
- UI Smoke Test: 로컬에서 시각화 탭 좌우 여백 제거, 노드 드래그, 추천 리스트 이동 정상 동작.(수동 확인)

## 후속 작업 제안
1. `AlertDropdown` 모듈 복구 또는 import 제거로 빌드 오류 해결.
2. 필요 시 training 앱에서도 같은 레이아웃 적용 검토.
3. CandidateSettingsModal의 사용자 정의 공정 입력 검증 강화 여부 검토.
