# Claude Code Workflow Directives

**Last Updated**: 2025-10-20
**Status**: ABSOLUTE DIRECTIVES
**Applies To**: ALL TASKS

---

## Absolute Workflow Requirements

모든 작업 진행 시 아래 절차를 **반드시** 준수해야 합니다.

---

## 1. 작업 시작: PRD 및 Checklist 생성 (필수)

### 1.1 문서 작성 순서

모든 작업은 다음 순서로 시작합니다:

```
1. PRD (Product Requirements Document) 작성
   └─ 위치: docs/planning/PRD_{task_name}.md

2. Checklist/Tasklist 작성
   └─ 위치: docs/planning/CHECKLIST_{task_name}.md

3. 작업 실행
   └─ Checklist 항목을 [ ]에서 [x]로 순차적 업데이트
```

### 1.2 PRD 작성 규칙

**필수 포함 항목**:
- Executive Summary (요약)
- Problem Statement (문제 정의)
- Goals and Objectives (목표)
- Requirements (요구사항)
- Phase Breakdown (단계별 분해)
- Success Criteria (성공 기준)
- Timeline Estimates (예상 시간)

**파일명 형식**:
```
docs/planning/PRD_{YYYY-MM-DD}_{task_description}.md
```

**예시**:
```
docs/planning/PRD_2025-10-20_data-quality-ui-implementation.md
```

### 1.3 Checklist 작성 규칙

**필수 포함 항목**:
- Task breakdown by phase
- Checkbox format: `- [ ] Task description`
- Estimated time per task
- Dependencies between tasks
- Acceptance criteria per task

**파일명 형식**:
```
docs/planning/CHECKLIST_{YYYY-MM-DD}_{task_description}.md
```

**체크박스 업데이트 규칙**:
```markdown
작업 전:  - [ ] Task description
진행 중:  - [ ] Task description (작업 시작 시 표시 안 함)
완료 후:  - [x] Task description
```

**Progress Tracking**:
```markdown
## Progress Tracking

Phase 1: [▓▓▓░░] 60% (3/5 tasks)
Phase 2: [░░░░░] 0% (0/5 tasks)

Total: [▓▓░░░░░░░░] 30% (3/10 tasks)
```

---

## 2. 작업 실행: 순차적 진행 (필수)

### 2.1 Phase별 순차 실행

```
Phase 1 시작
  ├─ Task 1.1 실행
  │   └─ [x] 체크박스 업데이트
  ├─ Task 1.2 실행
  │   └─ [x] 체크박스 업데이트
  └─ Phase 1 완료
      └─ Git commit & push (Phase 1 완료)

Phase 2 시작
  ├─ Task 2.1 실행
  │   └─ [x] 체크박스 업데이트
  ...
```

### 2.2 체크박스 업데이트 규칙

**CRITICAL**: 각 작업 완료 즉시 체크박스를 `[x]`로 업데이트해야 합니다.

```python
# 작업 플로우 예시
1. Task 수행
2. Task 완료 확인
3. 즉시 Checklist 파일 업데이트 ([ ] → [x])
4. 다음 Task 진행
```

**금지 사항**:
- ❌ 여러 Task 완료 후 일괄 업데이트
- ❌ 체크박스 업데이트 없이 다음 Phase 진행
- ❌ 빈 체크박스 `[ ]`가 남아있는 상태로 Phase 완료

**허용 사항**:
- ✅ 각 Task 완료 직후 즉시 업데이트
- ✅ Progress tracking 섹션도 함께 업데이트
- ✅ Phase 완료 시 100% 확인

---

## 3. Phase 완료: Git Workflow (필수)

### 3.1 Phase 완료 시 Git 작업

**각 Phase 완료 시마다** 다음 Git 작업을 수행합니다:

```bash
# 1. 현재 브랜치에서 작업 커밋
git add -A
git commit -m "feat: Complete Phase X - {description}"

# 2. 현재 브랜치 push
git push origin {current_branch}

# 3. main 브랜치로 전환 및 병합
git checkout main
git merge {current_branch} -m "Merge {current_branch}: Phase X complete"

# 4. main push
git push origin main

# 5. 작업 브랜치로 복귀
git checkout {current_branch}
```

### 3.2 커밋 메시지 규칙

**형식**:
```
feat: Complete Phase {N} - {Phase Name}

{Phase 요약}

**Phase {N} Completed**:
- [x] Task 1
- [x] Task 2
- [x] Task 3

**Progress**: {X}% complete ({completed}/{total} tasks)

**Files Modified**:
- {file1}
- {file2}

**Next Phase**: {Phase N+1 description}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### 3.3 브랜치 전략

**기본 브랜치**:
- `main`: 안정 버전
- `251014`: 작업 브랜치 (현재)

**작업 플로우**:
```
251014 브랜치에서 작업
  ↓
Phase 완료
  ↓
Commit & Push (251014)
  ↓
Merge to main
  ↓
Push main
  ↓
Return to 251014
  ↓
다음 Phase 계속
```

---

## 4. 작업 완료 조건 (필수)

### 4.1 완료 기준

다음 조건을 **모두** 만족해야 작업 완료로 간주합니다:

```
✅ PRD 문서 작성 완료
✅ Checklist 문서 작성 완료
✅ 모든 체크박스 [x] 처리
✅ 모든 Phase Git commit & merge 완료
✅ 251014 브랜치로 복귀 완료
✅ 작업 히스토리 문서 작성 완료
```

### 4.2 작업 히스토리 문서

**모든 작업 완료 후** 작업 히스토리 문서를 생성합니다:

**위치**:
```
docs/work-history/{YYYY-MM-DD}_{task_description}.md
```

**필수 포함 항목**:
- 작업 요약
- Git commit history
- Phase별 상세 내역
- 생성/수정된 파일 목록
- 정량 지표
- 다음 단계

---

## 5. 예외 처리

### 5.1 작업 중단 시

작업을 중단해야 하는 경우:

```
1. 현재까지 완료된 Task를 [x]로 업데이트
2. Progress tracking 업데이트
3. 현재 상태 커밋
4. Checklist에 "PAUSED" 표시 추가
5. 재개 시 필요한 정보 문서화
```

### 5.2 오류 발생 시

오류 발생 시:

```
1. 오류 내용을 Checklist에 기록
2. 해당 Task를 [ ] 상태로 유지
3. 오류 수정 후 다시 진행
4. 수정 완료 시 [x] 업데이트
```

---

## 6. 적용 예시

### 예시 1: Data Quality UI 구현

```markdown
## Phase 1: Setup (3 tasks)

- [x] Create DataQualityWorkspace.tsx skeleton
- [x] Add API client functions for 4 endpoints
- [x] Add workspace to routing

**Git Commit**: ✅ Complete
**Merged to main**: ✅ Done
**Returned to 251014**: ✅ Done

## Phase 2: Metrics Dashboard (4 tasks)

- [x] Implement metrics chart component
- [x] Add real-time data fetching
- [x] Implement error handling
- [x] Add loading states

**Git Commit**: ✅ Complete
**Merged to main**: ✅ Done
**Returned to 251014**: ✅ Done

## Phase 3: Testing (2 tasks)

- [x] Test all API connections
- [x] Verify UI rendering

**Git Commit**: ✅ Complete
**Merged to main**: ✅ Done
**Returned to 251014**: ✅ Done

## Progress Tracking

Phase 1: [▓▓▓▓▓] 100% ✓
Phase 2: [▓▓▓▓▓] 100% ✓
Phase 3: [▓▓▓▓▓] 100% ✓

Total: [▓▓▓▓▓▓▓▓▓▓] 100% (9/9 tasks)
```

---

## 7. Checklist 템플릿

### 7.1 기본 템플릿

```markdown
# Checklist: {Task Name}

**Date**: {YYYY-MM-DD}
**Related PRD**: docs/planning/PRD_{task_name}.md
**Status**: In Progress

---

## Phase 1: {Phase Name}

- [ ] Task 1.1
- [ ] Task 1.2
- [ ] Task 1.3

**Estimated Time**: {X} hours
**Status**: Not Started

**Git Operations**:
- [ ] Commit Phase 1
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 2: {Phase Name}

- [ ] Task 2.1
- [ ] Task 2.2

**Estimated Time**: {X} hours
**Status**: Not Started

**Git Operations**:
- [ ] Commit Phase 2
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Progress Tracking

```
Phase 1: [░░░░░] 0% (0/3 tasks)
Phase 2: [░░░░░] 0% (0/2 tasks)

Total: [░░░░░░░░░░] 0% (0/5 tasks)
```

---

## Acceptance Criteria

- [ ] All tasks completed and marked [x]
- [ ] All phases committed and merged
- [ ] Work history document created
- [ ] No empty checkboxes [ ] remaining

---

**Last Updated**: {YYYY-MM-DD}
**Next Review**: After Phase completion
```

---

## 8. 강제 적용 규칙

다음 규칙들은 **절대적으로** 준수해야 합니다:

### 8.1 문서 작성 우선

```
❌ 작업 먼저 시작, 나중에 문서 작성
✅ PRD → Checklist → 작업 실행
```

### 8.2 순차적 실행

```
❌ Phase 건너뛰기
❌ Task 순서 바꾸기
✅ Phase 1 → Phase 2 → Phase 3 순차 진행
✅ Task 순서대로 실행
```

### 8.3 체크박스 업데이트

```
❌ 작업 완료 후 체크박스 미업데이트
❌ 여러 Task 한번에 업데이트
✅ 각 Task 완료 즉시 [x] 업데이트
✅ Progress tracking도 함께 업데이트
```

### 8.4 Phase별 Git 작업

```
❌ 모든 Phase 완료 후 한번에 커밋
❌ main 병합 생략
✅ 각 Phase 완료 시마다 커밋
✅ 반드시 main 병합 후 251014 복귀
```

### 8.5 완료 조건

```
❌ 빈 체크박스 [ ] 남은 상태로 완료
❌ 작업 히스토리 없이 완료
✅ 모든 [ ]를 [x]로 변경
✅ 작업 히스토리 문서 작성
```

---

## 9. 위반 시 조치

이 지침을 위반한 경우:

1. 즉시 작업 중단
2. 누락된 문서 작성
3. 체크박스 업데이트
4. 누락된 Git 작업 수행
5. 작업 재개

---

## 10. 적용 범위

이 지침은 다음 모든 작업에 적용됩니다:

- ✅ 새로운 기능 개발
- ✅ 버그 수정
- ✅ 리팩토링
- ✅ 문서 작성
- ✅ 테스트 추가
- ✅ 성능 최적화
- ✅ 모든 코드 변경 작업

**예외 없음**: 모든 작업은 이 워크플로우를 따릅니다.

---

**END OF DIRECTIVES**
