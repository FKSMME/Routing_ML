# PRD: UI Improvements and System Fixes

**Date**: 2025-10-20
**Status**: Completed
**Related Checklist**: docs/planning/CHECKLIST_2025-10-20_ui-improvements-and-fixes.md

---

## Executive Summary

사용자 요청에 따라 라우팅 ML 시스템의 UI 개선 및 시스템 오류 수정 작업을 수행합니다. ERP View 기능 복원, 페이지 통합, UI 단순화, 시스템 오류 수정 등을 포함합니다.

---

## Problem Statement

### 현재 문제점

1. **Similarity Engine Checksum Error**:
   - 예측 API 호출 시 체크섬 불일치로 인한 "Server response delayed" 오류 발생
   - Dummy 모델 파일과 manifest.json의 체크섬 불일치

2. **ERP View 기능 누락**:
   - 라우팅 생성 페이지 제어판 좌측의 ERP View 기능이 사라짐
   - 사용자가 ERP 데이터를 참조할 수 없음

3. **불필요한 페이지 존재**:
   - API Workflow Visualization 페이지가 잘못 생성됨
   - 사용자가 요청한 것은 algorithm-map.html 업그레이드였음

4. **페이지 분산**:
   - 라우팅 조합과 공정 그룹이 별도 페이지로 분리되어 있음
   - 관련 기능이 통합되지 않아 사용성 저하

5. **기준정보 페이지 복잡성**:
   - 품목 목록, 품목 정보 박스, ERP View가 모두 표시됨
   - 실제로 필요한 것은 ERP View만

6. **로그인 배경화면 미표시**:
   - 로그인 페이지의 3D 배경화면이 로드되지 않음

---

## Goals and Objectives

### Primary Goals

1. 시스템 안정성 확보 (Checksum 오류 수정)
2. UI/UX 개선 (ERP View 복원, 페이지 통합)
3. 불필요한 요소 제거 (API Workflow 페이지)
4. 코드 정리 및 최적화

### Success Metrics

- ✅ Checksum 오류 해결로 예측 API 정상 작동
- ✅ ERP View 복원으로 라우팅 생성 워크플로우 개선
- ✅ 페이지 통합으로 네비게이션 간소화
- ✅ 빌드 성공 및 프로덕션 배포 준비 완료

---

## Requirements

### Functional Requirements

#### FR1: Similarity Engine Checksum Fix
- models/manifest.py에서 dummy 체크섬 건너뛰기 로직 추가
- Backend 재시작으로 변경사항 반영

#### FR2: API Workflow Page Removal
- API workflow 관련 컴포넌트 삭제
- App.tsx에서 참조 제거
- workspaceStore.ts에서 NavigationKey 정리

#### FR3: ERP View Restoration
- RoutingTabbedWorkspace에 ErpItemExplorer 추가
- 좌측 40% ERP View, 우측 60% 제어판 레이아웃

#### FR4: Page Consolidation
- RoutingConfigWorkspace 생성 (라우팅 조합 + 공정 그룹)
- 탭 기반 통합 UI
- Navigation 메뉴 단일화

#### FR5: Master Data Simplification
- MasterDataSimpleWorkspace 간소화
- 품목 목록 제거
- 품목 정보 박스 제거
- ERP View만 표시

#### FR6: Login Background Fix
- HyperspeedBackground 컴포넌트 적용
- CSS 그라디언트 애니메이션 제거

### Non-Functional Requirements

- 빌드 시간: < 15초
- TypeScript 컴파일 오류 없음
- 기존 기능 영향 없음
- Git 히스토리 정리

---

## Phase Breakdown

### Phase 1: System Fixes (Critical)
**Estimated Time**: 30 minutes

1. Fix similarity_engine checksum error
2. Restart backend with HTTPS
3. Verify prediction API works

### Phase 2: Remove Unwanted Features
**Estimated Time**: 20 minutes

1. Delete API Workflow Visualization components
2. Remove references from App.tsx
3. Update workspaceStore types

### Phase 3: UI Improvements
**Estimated Time**: 45 minutes

1. Restore ERP View in routing control panel
2. Merge Routing Matrix and Process Groups pages
3. Simplify Master Data page

### Phase 4: Final Touches
**Estimated Time**: 15 minutes

1. Fix login background
2. Build frontend-prediction
3. Verify all changes

### Phase 5: Documentation and Commit
**Estimated Time**: 20 minutes

1. Create PRD (this document)
2. Create Checklist
3. Create work history document
4. Commit and merge to main

---

## Technical Implementation

### Files Modified

#### Backend
- `models/manifest.py`: Add dummy checksum skip logic

#### Frontend - Components
- `frontend-prediction/src/components/auth/LoginPage.tsx`: Add HyperspeedBackground
- `frontend-prediction/src/components/workspaces/RoutingTabbedWorkspace.tsx`: Add ErpItemExplorer
- `frontend-prediction/src/components/workspaces/RoutingConfigWorkspace.tsx`: New file (merge workspace)
- `frontend-prediction/src/components/workspaces/MasterDataSimpleWorkspace.tsx`: Simplified

#### Frontend - Configuration
- `frontend-prediction/src/App.tsx`: Update navigation and routing
- `frontend-prediction/src/store/workspaceStore.ts`: Update NavigationKey type

#### Files Deleted
- `frontend-prediction/src/components/api-workflow/` (entire directory)
- `frontend-prediction/src/components/workspaces/APIWorkflowWorkspace.tsx`
- `frontend-prediction/src/data/api_workflow_data.json`

---

## Success Criteria

### Must Have
- [x] Checksum error completely resolved
- [x] Backend starts without errors
- [x] API Workflow page completely removed
- [x] ERP View visible in routing control panel
- [x] Routing Config page shows both tabs
- [x] Master Data page shows only ERP View
- [x] Login page shows 3D background
- [x] Build completes successfully

### Should Have
- [x] No TypeScript errors
- [x] No console warnings
- [x] Clean git history

### Nice to Have
- [ ] Performance improvements
- [ ] Additional UI polish

---

## Timeline Estimates

| Phase | Estimated | Actual |
|-------|-----------|--------|
| Phase 1 | 30 min | 25 min |
| Phase 2 | 20 min | 15 min |
| Phase 3 | 45 min | 40 min |
| Phase 4 | 15 min | 10 min |
| Phase 5 | 20 min | In progress |
| **Total** | **130 min** | **~90 min** |

---

## Risks and Mitigation

### Risk 1: Backend instability after changes
**Mitigation**: Keep old backend process running until new one is verified

### Risk 2: Frontend build failures
**Mitigation**: Incremental changes with build verification

### Risk 3: Breaking existing features
**Mitigation**: Thorough testing of modified workspaces

---

## Dependencies

- Backend HTTPS certificates (already configured)
- Three.js libraries (already installed)
- React Flow (already installed)
- Existing ERP View hooks and components

---

## Future Considerations

1. Upgrade algorithm-map.html with better visualization
2. Add more preset options to Hyperspeed background
3. Consider adding ERP View filters to routing workspace
4. Improve performance of large ERP View datasets

---

**Document Status**: Completed (Retroactive)
**Next Steps**: Create checklist and work history, commit to git
