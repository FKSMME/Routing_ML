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
- [ ] Run monitor build validation sequence (`.\.venv\Scripts\python.exe -m PyInstaller --clean --noconfirm RoutingMLMonitor_v5.2.5.spec` → verify `deploy\build_monitor_v5.bat` outputs `RoutingMLMonitor_v5.2.5.exe` → `.\.venv\Scripts\python.exe scripts\server_monitor_dashboard_v5_1.py`) before any commit/push/merge
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
- [ ] Run monitor build validation sequence (`.\.venv\Scripts\python.exe -m PyInstaller --clean --noconfirm RoutingMLMonitor_v5.2.5.spec` → verify `deploy\build_monitor_v5.bat` outputs `RoutingMLMonitor_v5.2.5.exe` → `.\.venv\Scripts\python.exe scripts\server_monitor_dashboard_v5_1.py`) before any commit/push/merge
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

## 7.5 RoutingMLMonitor 버전 관리 및 재빌드 (필수)

### 7.5.1 재빌드 시점

**CHECKLIST 100% 완료 시 필수 재빌드**:

모든 작업(CHECKLIST)이 100% 완료되면 **반드시** RoutingMLMonitor를 재빌드하고 버전을 업데이트해야 합니다.

### 7.5.2 버전 관리 규칙

**버전 형식**: `RoutingMLMonitor_vX.Y.Z.spec` / `RoutingMLMonitor_vX.Y.Z.exe`

**버전 번호 규칙**:

1. **Major (X) - 큰 변경**:
   - 주요 기능 추가 (예: 새로운 모니터링 기능, UI 대폭 개편)
   - 아키텍처 변경 (예: 백엔드 프레임워크 변경)
   - 하위 호환성 깨짐 (Breaking Changes)
   - **예시**: 5.2.5 → 6.0.0

2. **Minor (Y) - 중간 변경**:
   - 새로운 차트/대시보드 추가
   - 데이터베이스 스키마 변경
   - 새로운 API 엔드포인트 추가
   - **예시**: 5.2.5 → 5.3.0

3. **Patch (Z) - 작은 변경**:
   - 버그 수정
   - UI 텍스트/레이블 변경
   - 성능 최적화
   - 문서 업데이트만 있는 경우
   - **예시**: 5.2.5 → 5.2.6

### 7.5.3 재빌드 절차

**CHECKLIST 100% 완료 후 수행**:

```bash
# 1. 버전 번호 결정
#    - 변경 사항 검토
#    - Major/Minor/Patch 판단

# 2. 빌드 전 스크립트 실행 테스트 (필수!)
python scripts/server_monitor_dashboard_v5_1.py --help
# - 최소 10초 동안 실행
# - 오류 없이 종료되는지 확인
# - 만약 오류 발생 시:
#   1. 코드 수정
#   2. 재테스트
#   3. 오류 없을 때까지 반복
#   4. 빌드 중단 (오류 있으면 빌드 금지!)

# 3. 구버전 백업
mkdir -p old
move RoutingMLMonitor_v{OLD_VERSION}.spec old/
move RoutingMLMonitor_v{OLD_VERSION}.exe old/  # (있으면)

# 4. 새 버전 spec 파일 생성
copy RoutingMLMonitor_v{OLD_VERSION}.spec RoutingMLMonitor_v{NEW_VERSION}.spec

# 5. spec 파일 내부 버전 업데이트
#    - exe_name 수정
#    - version 정보 수정

# 6. 재빌드
.\.venv\Scripts\python.exe -m PyInstaller --clean --noconfirm RoutingMLMonitor_v{NEW_VERSION}.spec

# 7. 빌드 후 검증 및 정리 (필수!)
#    - dist/RoutingMLMonitor_v{NEW_VERSION}.exe 생성 확인
ls -lh dist/RoutingMLMonitor_v{NEW_VERSION}.exe  # 파일 크기 ~12MB 확인
move dist/RoutingMLMonitor_v{NEW_VERSION}.exe .  # 프로젝트 루트로 이동

# ✅ CRITICAL: dist 폴더 정리 (사용자 혼란 방지)
rm -f dist/RoutingMLMonitor_v*.exe  # 이전 버전 exe 삭제
rm -rf dist/* build/*  # 모든 빌드 아티팩트 삭제

# 최종 검증: 프로젝트 루트에만 최신 버전 존재 확인
ls -lh RoutingMLMonitor_v*.exe
# 출력: RoutingMLMonitor_v{NEW_VERSION}.exe (최신만 표시되어야 함)
# ❌ 여러 개 표시되면 이전 버전 수동 삭제 필요!

# 8. 빌드 후 실행 테스트 (필수!)
./RoutingMLMonitor_v{NEW_VERSION}.exe --version &
# - 최소 30초 동안 실행
# - UI가 정상적으로 로딩되는지 육안 확인
# - Tkinter 예외 또는 오류 팝업 없는지 확인
# - 종료 후 콘솔에 오류 로그 없는지 확인
# - 만약 오류 발생 시:
#   1. 코드 수정
#   2. 2단계부터 재시작
#   3. 오류 없을 때까지 반복
#   4. ⚠️ 오류 있으면 빌드 완료로 보고하지 말 것!

# 9. Git 커밋 (테스트 통과 후에만!)
git add RoutingMLMonitor_v{NEW_VERSION}.exe RoutingMLMonitor_v{NEW_VERSION}.spec old/
git commit -m "build: Rebuild monitor v{NEW_VERSION} - CHECKLIST 100% complete"
git push origin 251014
git checkout main && git merge 251014 && git push origin main && git checkout 251014
```

### 7.5.4 버전 업데이트 예시

**Case 1: 작은 변경 (Patch)**
```
변경 사항: 라우팅 예측 UI 개선, 후보 노드 추가
현재 버전: v5.2.5
새 버전: v5.2.6

이유: 기존 기능에 UI 개선만 추가, 하위 호환성 유지
```

**Case 2: 중간 변경 (Minor)**
```
변경 사항: 다중 후보 병합 기능 추가, 새 API 엔드포인트
현재 버전: v5.2.5
새 버전: v5.3.0

이유: 새로운 예측 기능 추가, 백엔드 로직 확장
```

**Case 3: 큰 변경 (Major)**
```
변경 사항: PostgreSQL 마이그레이션, 전체 백엔드 재구성
현재 버전: v5.2.5
새 버전: v6.0.0

이유: 데이터베이스 변경, 설정 파일 구조 변경 (Breaking)
```

### 7.5.5 old/ 디렉토리 관리

**규칙**:
- 직전 3개 버전까지만 보관
- 그 이전 버전은 삭제 또는 아카이브

**예시**:
```
현재: v5.2.6
old/
  ├── RoutingMLMonitor_v5.2.5.spec
  ├── RoutingMLMonitor_v5.2.4.spec
  └── RoutingMLMonitor_v5.2.3.spec
```

### 7.5.6 CHECKLIST 업데이트

**작업 완료 조건에 추가**:
```markdown
## 작업 완료 조건

✅ PRD 문서 작성 완료
✅ Checklist 문서 작성 완료
✅ 모든 체크박스 [x] 처리
✅ 모든 Phase Git commit & merge 완료
✅ 251014 브랜치로 복귀 완료
✅ RoutingMLMonitor 재빌드 (버전 업데이트) ← NEW
✅ 구버전 old/ 디렉토리로 이동 ← NEW
✅ 작업 히스토리 문서 작성 완료
```

### 7.5.7 Checklist 템플릿 업데이트

**Final Phase Git Operations**:
```markdown
**Final Git Operations** (CHECKLIST 100% 완료 시):
- [ ] Determine version number (Major/Minor/Patch)
- [ ] Backup old version to old/ directory
- [ ] Update spec file with new version
- [ ] Rebuild: `python -m PyInstaller --clean --noconfirm RoutingMLMonitor_v{NEW}.spec`
- [ ] Verify: dist/RoutingMLMonitor_v{NEW}.exe created
- [ ] Test: `python scripts/server_monitor_dashboard_v5_1.py`
- [ ] Commit: "build: Rebuild monitor v{NEW} - CHECKLIST complete"
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014
```

---

## 7.6 Git Staging 및 커밋 규칙 (필수)

### 7.6.1 커밋 전 필수 단계

모든 커밋 작업 시 **반드시** 다음 절차를 따라야 합니다:

```bash
# 1단계: 모든 Changes 확인
git status

# 2단계: 모든 Changes를 Staged 상태로 변경 (필수!)
git add -A
# 또는
git add .

# 3단계: Staging 완전성 재확인
git status

# ✅ 이상적 출력:
# On branch 251014
# Changes to be committed:
#   (all files listed here)
#
# ❌ 다음 섹션이 있으면 안 됨:
# Changes not staged for commit:  ← 이 섹션 없어야 함!

# 4단계: 커밋
git commit -m "commit message"
```

### 7.6.2 포함 대상

**모든 변경사항을 반드시 포함**:
- ✅ Claude가 수정한 파일
- ✅ 외부 프로세스 (Training, Analysis 스크립트)가 수정한 파일
- ✅ 자동 생성된 파일 (feature_importance.json, feature_weights.json 등)
- ✅ 빌드 산출물 (RoutingMLMonitor_vX.Y.Z.exe, .spec 파일)

**예외: 절대 커밋 금지** (.gitignore 처리):
- ❌ `.env`, `.env.local` (환경 변수)
- ❌ `credentials.json`, `*.pem`, `*.key` (시크릿)
- ❌ `__pycache__/`, `*.pyc` (Python 캐시)
- ❌ `node_modules/` (npm 패키지)
- ❌ `dist/`, `build/` (빌드 산출물 중 .exe 제외)

### 7.6.3 커밋 완전성 검증

커밋 후 **반드시** 다음 명령어로 검증:

```bash
git status

# ✅ 이상적 출력:
# On branch 251014
# nothing to commit, working tree clean

# ❌ 만약 이런 메시지가 있다면:
# Changes not staged for commit:
#   modified:   models/default/feature_weights.json
# → 커밋 누락! 아래 명령어로 수정:

git add -A
git commit --amend --no-edit
```

### 7.6.4 Merge 전 검증

Main branch로 merge 하기 전 **반드시** 확인:

```bash
# 현재 브랜치와 main의 차이 확인
git diff main..251014

# 예상치 못한 변경사항이 없는지 검토
# - 삭제된 파일이 의도적인지
# - 추가된 파일이 올바른지
# - 변경된 내용이 모두 의도된 것인지
```

### 7.6.5 실패 예시 및 해결

**❌ 실패 사례**:
```bash
$ git status
On branch 251014
Changes to be committed:
  modified:   backend/predictor_ml.py

Changes not staged for commit:  # ← 문제!
  modified:   models/default/feature_weights.json

$ git commit -m "feat: Update predictor"
# → feature_weights.json이 누락됨!
```

**✅ 올바른 방법**:
```bash
$ git status
On branch 251014
Changes not staged for commit:
  modified:   backend/predictor_ml.py
  modified:   models/default/feature_weights.json

$ git add -A  # 모든 파일 staging

$ git status
On branch 251014
Changes to be committed:
  modified:   backend/predictor_ml.py
  modified:   models/default/feature_weights.json  # ✅ 포함됨!

$ git commit -m "feat: Update predictor and feature weights"
```

### 7.6.6 정량적 목표

- **Unstaged files per commit**: 0개 (목표 100% 달성)
- **Commit completeness**: 100% (모든 변경사항 포함)
- **Main-branch consistency**: 100% (코드 저장소 = 실행 환경)

### 7.6.7 CHECKLIST 템플릿 반영

모든 CHECKLIST의 Git Operations 섹션에 다음 추가:

```markdown
**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Run monitor build validation (해당 시)
- [ ] Commit Phase X
- [ ] Push to 251014
- [ ] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014
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
❌ 모든 Phase 완료 후 한 번에 커밋
❌ main 병합 생략
✅ 각 Phase 완료 시마다 커밋
✅ Git 워크플로우 실행 직전에 Monitor build validation sequence(`.\.venv\Scripts\python.exe -m PyInstaller --clean --noconfirm RoutingMLMonitor_v5.2.5.spec` → `deploy\build_monitor_v5.bat` 결과 확인 → `.\.venv\Scripts\python.exe scripts\server_monitor_dashboard_v5_1.py` 실행) 수행
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
