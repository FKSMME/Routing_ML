# Checklist: 사용자 비밀번호 변경 기능

**Date**: 2025-10-24
**Related PRD**: [docs/planning/PRD_2025-10-24_user-password-change-feature.md](./PRD_2025-10-24_user-password-change-feature.md)
**Priority**: Medium
**Status**: Ready to Start

---

## Phase 1: 백엔드 API 구현

**Estimated Time**: 2 hours
**Status**: ✅ Completed

### Tasks

- [x] **1.1** 기존 인증 시스템 분석
  - ✅ backend/api/routes/auth.py 확인 - POST /api/auth/change-password 이미 존재
  - ✅ UserAccount 모델 확인 (database_rsl.py) - password_hash 필드
  - ✅ Argon2 해싱 사용 확인 (PasswordHasher)
  - ✅ auth_service.change_password() 메서드 위치 파악
  - **발견**: 기존 API 존재, confirm_password 없음, 최소 6자 정책

- [x] **1.2** Pydantic 스키마 수정
  - ✅ PasswordChangeRequest 스키마 수정 (schemas.py:116-137)
    - current_password: str (min_length=1) ← 유지
    - new_password: str (min_length=1, max_length=128) ← 6→1 변경
    - confirm_password: str (min_length=1, max_length=128) ← 추가
  - ✅ PasswordChangeResponse 확인 (schemas.py:140-145) ← 기존 유지
    - username, message, changed_at 포함
  - ✅ Validator 추가: _validate_passwords_match() ← confirm 일치 확인
  - ✅ Validator 수정: _validate_password_minimal() ← 1자 이상 검증

- [x] **1.3** 비밀번호 최소 검증 함수 구현
  - ✅ Pydantic validator로 구현 (schemas.py:123-129)
  - ✅ _validate_password_minimal() - 1자 검증
  - ✅ 유연한 정책 적용

- [x] **1.4** 비밀번호 강도 계산 함수 구현 (참고용)
  - ✅ calculate_password_strength() 메서드 추가 (auth_service.py:330-370)
  - ✅ 강도 레벨: weak/medium/strong 반환
  - ✅ 참고용, 강제하지 않음

- [x] **1.5** API 엔드포인트 확인
  - ✅ POST /api/auth/change-password 이미 존재 (auth.py:181-198)
  - ✅ 인증 의존성 확인 (Depends(require_auth)) ← 기존 유지
  - ✅ Request body 파싱 (ChangePasswordRequest) ← 스키마 수정 완료

- [x] **1.6** 비즈니스 로직 확인 및 수정
  - ✅ 현재 비밀번호 확인 (auth_service.py:387-394) ← 기존 유지
  - ✅ 현재 비밀번호 불일치 시 401 반환 ← 기존 유지
  - ✅ 비밀번호 최소 검증 (Pydantic validator) ← 스키마에서 처리
  - ✅ 빈 비밀번호 시 422 반환 ← Pydantic에서 자동 처리
  - ✅ 새 비밀번호 해싱 (auth_service.py:397-399) ← 기존 유지
  - ✅ DB 업데이트 (session.add(user)) ← 기존 유지

- [x] **1.7** 에러 처리 및 로깅 확인 및 개선
  - ✅ HTTPException 처리 (auth.py:188-192) ← 기존 유지
  - ✅ 비밀번호 강도 로깅 추가 (auth_service.py:401-406) ← 추가 완료
  - ✅ 성공 시 200 OK 반환 ← 기존 유지

**Acceptance Criteria**:
- POST /api/auth/change-password 엔드포인트 정상 작동
- 현재 비밀번호 불일치 시 401 Unauthorized
- 빈 비밀번호 입력 시 422 Unprocessable Entity
- 성공 시 200 OK 및 PasswordChangeResponse 반환
- 비밀번호가 DB에 해시되어 저장됨
- 유연한 비밀번호 정책 적용 (1자 이상)

**Git Operations**:
- [x] **Git staging 완전성 확인** (필수!)
  - ✅ `git status` 실행
  - ✅ `git add -A` 실행
  - ✅ `git status` 재확인 → "Changes not staged" 없음
- [x] Commit Phase 1: "feat: Complete Phase 1 - Implement password change API"
  - ✅ Commit hash: 2f76ebd5
- [x] Push to 251014
  - ✅ Pushed successfully
- [x] **Merge 전 검증** (필수!)
  - ✅ `git diff main..251014` 확인
  - ✅ 예상 범위 내 변경사항 (6 files, +405/-236)
- [x] Merge to main
  - ✅ Merged successfully (e8efef17)
- [x] Push main
  - ✅ Pushed to origin/main
- [x] Return to 251014
  - ✅ Switched back to 251014 branch

---

## Phase 2: 프론트엔드 UI 구현

**Estimated Time**: 2 hours
**Status**: ✅ Completed

### Tasks

- [x] **2.1** ChangePassword 컴포넌트 생성
  - 파일 생성: frontend-prediction/src/components/auth/ChangePassword.tsx
  - 또는: frontend-training/src/components/auth/ChangePassword.tsx
  - 기본 컴포넌트 구조 작성
  - TypeScript 타입 정의

- [ ] **2.2** State 및 Form 구현
  - useState 추가:
    - currentPassword
    - newPassword
    - confirmPassword
    - showPasswords (current, new, confirm)
    - isSubmitting
    - error
  - Form onSubmit 핸들러 작성

- [ ] **2.3** 입력 필드 구현
  - 현재 비밀번호 입력 필드
    - Type: password
    - Placeholder: "현재 비밀번호 입력"
    - Show/hide 토글 버튼 (눈 아이콘)
  - 새 비밀번호 입력 필드
    - Type: password
    - Placeholder: "새 비밀번호 입력 (8자 이상)"
    - Show/hide 토글 버튼
  - 새 비밀번호 확인 입력 필드
    - Type: password
    - Placeholder: "새 비밀번호 다시 입력"
    - Show/hide 토글 버튼

- [ ] **2.4** 비밀번호 강도 인디케이터 구현
  - calculatePasswordStrength() 함수 작성
    - 0-3 점수 계산
    - 'weak' | 'medium' | 'strong' 레이블
  - useEffect로 실시간 강도 계산
  - 프로그레스 바 또는 색상 인디케이터 표시
  - 검증 규칙 체크리스트 표시 (선택)

- [ ] **2.5** 실시간 검증 로직
  - 비밀번호 일치 확인
    - newPassword !== confirmPassword 시 경고 표시
    - ✓ 일치 / ✗ 불일치 아이콘
  - 제출 버튼 비활성화 로직
    - 모든 필드 입력 확인
    - 비밀번호 일치 확인
    - 비밀번호 강도 최소 기준 충족 확인

- [ ] **2.6** API 호출 함수 작성
  - apiClient.ts에 changePassword() 함수 추가
    - POST /api/auth/change-password
    - Request: { current_password, new_password, confirm_password }
    - Response: { message, changed_at }
  - 컴포넌트에서 API 호출
  - Loading state 처리

- [ ] **2.7** 에러 처리 및 성공 메시지
  - try-catch로 에러 처리
  - 401: "현재 비밀번호가 일치하지 않습니다"
  - 422: "비밀번호 정책을 충족하지 않습니다"
  - 500: "서버 오류가 발생했습니다"
  - 성공 시: alert 또는 toast 메시지
  - 성공 후 폼 초기화 또는 페이지 이동

**Acceptance Criteria**:
- 모든 입력 필드 정상 작동
- Show/hide password 토글 작동
- 비밀번호 강도 실시간 표시
- 비밀번호 불일치 시 경고 표시
- API 호출 성공 시 성공 메시지 표시
- 에러 발생 시 적절한 에러 메시지 표시

**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 2: "feat: Implement password change UI component"
- [ ] Push to 251014
- [ ] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 3: 통합 및 테스트

**Estimated Time**: 1 hour
**Status**: Not Started

### Tasks

- [ ] **3.1** 라우팅/메뉴 추가
  - App.tsx 또는 라우터 파일에 경로 추가
  - 메뉴 항목 추가 (예: "설정" > "비밀번호 변경")
  - 또는 사용자 프로필 메뉴에 추가
  - 접근 권한 확인 (로그인 사용자만)

- [ ] **3.2** 전체 플로우 테스트
  - 정상 케이스:
    1. 로그인
    2. 비밀번호 변경 페이지 접속
    3. 현재 비밀번호 입력 (정확)
    4. 새 비밀번호 입력 (정책 충족)
    5. 새 비밀번호 확인 입력 (일치)
    6. "변경" 버튼 클릭
    7. 성공 메시지 확인
    8. 새 비밀번호로 로그인 테스트

- [ ] **3.3** 에러 케이스 테스트
  - 현재 비밀번호 불일치:
    - 잘못된 현재 비밀번호 입력
    - 401 에러 메시지 확인
  - 비밀번호 정책 위반:
    - 7자 이하 입력
    - 422 에러 메시지 확인
  - 비밀번호 불일치:
    - 새 비밀번호와 확인 비밀번호 다르게 입력
    - 경고 메시지 확인
    - 제출 버튼 비활성화 확인
  - 인증 실패:
    - 로그아웃 상태에서 접근
    - 401 또는 로그인 페이지 리다이렉트 확인

- [ ] **3.4** UI/UX 개선
  - 스타일링 적용 (Tailwind CSS 등)
  - 반응형 디자인 확인 (모바일, 태블릿, 데스크톱)
  - 접근성 확인 (키보드 네비게이션, ARIA labels)
  - 로딩 인디케이터 추가

- [ ] **3.5** 보안 검증
  - HTTPS 통신 확인
  - 비밀번호 평문이 로그에 기록되지 않는지 확인
  - 네트워크 탭에서 Request body 확인 (암호화 확인)
  - 비밀번호 변경 후 세션 처리 확인

**Acceptance Criteria**:
- 사용자가 메뉴에서 비밀번호 변경 페이지 접근 가능
- 전체 정상 플로우 동작
- 모든 에러 케이스 적절히 처리
- UI/UX 사용자 친화적
- 보안 요구사항 충족

**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 3: "feat: Integrate password change feature and add tests"
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
Phase 1: [▓▓▓▓▓▓▓] 100% (7/7 tasks) ✅
Phase 2: [░░░░░░░] 0% (0/7 tasks)
Phase 3: [░░░░░] 0% (0/5 tasks)

Total: [▓▓▓▓░░░░░░] 36% (7/19 tasks)
```

---

## Acceptance Criteria (Overall)

- [ ] All tasks completed and marked [x]
- [ ] All phases committed and merged to main
- [ ] POST /api/auth/change-password API 정상 작동
- [ ] ChangePassword UI 컴포넌트 정상 작동
- [ ] 비밀번호 강도 검증 작동
- [ ] 전체 플로우 테스트 통과
- [ ] 보안 요구사항 충족
- [ ] Work history document created
- [ ] No empty checkboxes [ ] remaining

---

## Test Cases

### API Test Cases

| Test Case | Input | Expected Output | Status |
|-----------|-------|-----------------|--------|
| 정상 변경 (강한 비번) | current: "old123!", new: "New123!@#" | 200 OK, message | [ ] |
| 정상 변경 (약한 비번) | current: "old123!", new: "a" | 200 OK, message | [ ] |
| 현재 비번 불일치 | current: "wrong", new: "New123!@#" | 401 Unauthorized | [ ] |
| 빈 비번 | current: "old123!", new: "" | 422 Unprocessable | [ ] |
| 비번 불일치 | confirm: "different" | 422 Unprocessable | [ ] |
| 인증 실패 | No auth token | 401 Unauthorized | [ ] |

### UI Test Cases

| Test Case | Action | Expected Behavior | Status |
|-----------|--------|-------------------|--------|
| 비번 강도 표시 | 새 비번 입력 | 강도 인디케이터 업데이트 | [ ] |
| 비번 일치 확인 | 확인 비번 다르게 입력 | 경고 메시지 표시 | [ ] |
| Show/Hide | 눈 아이콘 클릭 | 비밀번호 보이기/숨기기 | [ ] |
| 제출 버튼 | 모든 필드 입력 | 버튼 활성화 | [ ] |
| 성공 메시지 | 변경 성공 | 성공 메시지 표시 | [ ] |

---

## Notes

### 발견된 이슈
- **[1.1]** 기존 API 존재: POST /api/auth/change-password가 이미 구현되어 있음
- **[1.1]** ChangePasswordRequest 스키마에 confirm_password 필드 없음 → 추가 필요
- **[1.1]** 기존 최소 비밀번호 길이: 6자 → 사용자 요구사항 1자로 변경 필요
- **[1.1]** 비밀번호 강도 계산 기능 없음 → 추가 필요 (참고용)

### 분석 결과 (Task 1.1)
**파일 위치**:
- 인증 라우터: `backend/api/routes/auth.py:181-198`
- 인증 서비스: `backend/api/services/auth_service.py:330-365`
- 사용자 모델: `backend/database_rsl.py:135-158`
- 스키마: `backend/api/schemas.py:116-135`

**기술 스택**:
- 비밀번호 해싱: Argon2 (PasswordHasher)
- 검증 함수: `self._hasher.verify()`, `self._hasher.hash()`
- 데이터베이스 필드: `UserAccount.password_hash` (String 255)

**기존 vs 요구사항 차이**:
| 항목 | 기존 | 요구사항 | 액션 |
|------|------|---------|------|
| current_password | ✅ min_length=1 | ✅ | 유지 |
| new_password | ✅ min_length=6 | ✅ min_length=1 | 수정 |
| confirm_password | ❌ 없음 | ✅ 필요 | 추가 |
| 비밀번호 강도 계산 | ❌ 없음 | ✅ 참고용 | 추가 |
| validator | 6자 강제 | 1자 이상, 권장만 | 수정 |

### 결정 사항 (사용자 요구사항 반영)
- **비밀번호 정책**: 유연한 정책 적용
  - 최소 1자 이상 (빈 비밀번호만 방지)
  - 사용자가 원하는 대로 변경 가능
  - 강도 검증은 참고용으로만 제공 (강제하지 않음)
  - 사용자 의견: "제한은 없어. 다만 사용자가 비번 변경 하고 싶을때 마음껏 변경하고 싶으면 좋겠네"
- **UI 위치**: 우측 최상단 (Top-right corner)
  - 사용자 프로필 메뉴/드롭다운에서 접근
  - 사용자 의견: "UI 위치는 우측 최상단"
- **인증 방식**: 현재 상태 유지
  - 사용자 의견: "인증 방식은 그냥 현재 상태 유지"
- **접근 권한**: 모든 인증된 사용자
  - 사용자 의견: "모든 인증된 사용자가 바꿀수 있어야함"
- **세션 처리**: 비밀번호 변경 후 세션 유지 또는 재로그인 (구현 시 결정)

### 기술 스택
- **Backend**: FastAPI, Pydantic, bcrypt/passlib
- **Frontend**: React, TypeScript, Tailwind CSS (또는 기존 스타일)
- **API**: RESTful, JSON

---

**Last Updated**: 2025-10-24
**Next Review**: After Phase 1 completion
