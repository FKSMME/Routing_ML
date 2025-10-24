# Checklist: Custom Process Nodes Management System

**Date**: 2025-10-24
**Related PRD**: docs/planning/PRD_2025-10-24_custom-process-nodes.md
**Status**: In Progress

---

## Phase 1: Backend API Implementation

**Tasks**:
- [x] Design database schema for custom_nodes (JSON file storage)
- [x] Create Pydantic models (CustomNodeCreate, CustomNodeUpdate, CustomNodeResponse)
- [x] Implement POST /api/custom-nodes (create)
- [x] Implement GET /api/custom-nodes (list user's nodes)
- [x] Implement PUT /api/custom-nodes/{id} (update)
- [x] Implement DELETE /api/custom-nodes/{id} (delete)
- [x] Add user authentication/filtering (require_auth dependency)
- [x] Register router in app.py

**Estimated Time**: 3-4 hours
**Status**: Completed ✅

**Implementation Details**:
- Storage: JSON files per user (data/custom_nodes/{user_id}.json)
- Models: CustomNodeCreate, CustomNodeUpdate, CustomNodeResponse
- Endpoints: GET, POST, PUT, DELETE with full CRUD
- Auth: Uses require_auth dependency for user filtering
- Validation: Duplicate process_code check, field validation

**Git Operations**:
- [x] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [x] Commit Phase 1
- [x] Push to 251014
- [x] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [x] Merge to main
- [x] Push main
- [x] Return to 251014

---

## Phase 2: Frontend State Management

**Tasks**:
- [x] Add custom nodes API client functions (apiClient.ts)
- [x] Create useCustomNodes hook (React Query)
- [x] Implement add mutation (useMutation)
- [x] Implement update mutation
- [x] Implement delete mutation
- [x] Add optimistic updates for better UX

**Estimated Time**: 2-3 hours
**Status**: Completed ✅

**Implementation Details**:
- Types: Created frontend-prediction/src/types/customNodes.ts
- API Client: Added fetchCustomNodes, createCustomNode, updateCustomNode, deleteCustomNode
- Hook: Created useCustomNodes (query), useCreateCustomNode, useUpdateCustomNode, useDeleteCustomNode
- Optimistic Updates: All mutations include optimistic UI updates with rollback on error
- Cache Management: Automatic cache invalidation after mutations

**Git Operations**:
- [x] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [x] Commit Phase 2
- [x] Push to 251014
- [x] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [x] Merge to main
- [x] Push main
- [x] Return to 251014

---

## Phase 3: UI Component Implementation

**Tasks**:
- [x] Create CustomNodeCard component (draggable card)
- [x] Create CustomNodeList component (horizontal scroll layout)
- [x] Create CustomNodeModal component (add/edit form)
- [x] Replace CandidateNodeTabs or create new tab
- [x] Add color picker for node customization
- [x] Add delete confirmation dialog
- [x] Style with existing design system

**Estimated Time**: 3-4 hours
**Status**: Completed ✅

**Implementation Details**:
- CustomNodeCard: Draggable card with edit/delete buttons, custom color support
- CustomNodeList: Horizontal scroll layout with add button, empty state, loading/error handling
- CustomNodeModal: Full add/edit form with validation, color picker (10 preset colors)
- Delete Confirmation: Modal dialog with confirm/cancel
- Integration: Added CustomNodeList to RoutingCanvas above CandidateNodeTabs
- Styling: Uses existing Tailwind design system, dark mode support, responsive layout

**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 3
- [ ] Push to 251014
- [ ] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 4: Drag & Drop Integration

**Tasks**:
- [ ] Add draggable prop to CustomNodeCard
- [ ] Implement drag data format (consistent with existing system)
- [ ] Add drop zone to TimelinePanel
- [ ] Implement drop handler (insert custom node)
- [ ] Auto-reorder seq numbers after insert
- [ ] Update visualization after node added
- [ ] Test drag & drop in routing view
- [ ] Test drag & drop in blueprint view

**Estimated Time**: 2-3 hours
**Status**: Not Started

**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 4
- [ ] Push to 251014
- [ ] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 5: Testing & Polish

**Tasks**:
- [ ] Test node CRUD operations (create, read, update, delete)
- [ ] Test drag & drop to routing timeline
- [ ] Test drag & drop to blueprint timeline
- [ ] Test multi-user scenario (user isolation)
- [ ] Test node deletion with confirmation
- [ ] Test color customization
- [ ] Fix any UI/UX issues
- [ ] Add loading states and error handling

**Estimated Time**: 1-2 hours
**Status**: Not Started

**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 5
- [ ] Push to 251014
- [ ] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Progress Tracking

```
Phase 1: [▓▓▓▓▓▓▓▓] 100% (8/8 tasks) ✅
Phase 2: [▓▓▓▓▓▓] 100% (6/6 tasks) ✅
Phase 3: [▓▓▓▓▓▓▓] 100% (7/7 tasks) ✅
Phase 4: [░░░░░░░░] 0% (0/8 tasks)
Phase 5: [░░░░░░░░] 0% (0/8 tasks)

Total: [▓▓▓▓▓▓░░░░] 57% (21/37 tasks)
```

---

## Acceptance Criteria

- [ ] User can create custom process nodes with code and name
- [ ] Nodes displayed in single-line horizontal layout
- [ ] User can edit existing nodes
- [ ] User can delete nodes with confirmation
- [ ] User can drag custom nodes to routing timeline
- [ ] User can drag custom nodes to blueprint timeline
- [ ] Nodes are user-specific (not shared between users)
- [ ] UI is intuitive and easy to use
- [ ] All phases committed and merged to main
- [ ] No empty checkboxes [ ] remaining

---

## Notes & Issues

### Design Decisions
- Storage: Database table vs JSON file (TBD in Phase 1)
- Drag format: Must be compatible with existing dragAndDrop system

### Known Limitations
- Initial version: no team sharing
- Color picker: simple implementation

---

**Last Updated**: 2025-10-24
**Next Review**: After Phase 1 completion
