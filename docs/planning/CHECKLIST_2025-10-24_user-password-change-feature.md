# Checklist: 사용자 비밀번호 변경 기능

**Date**: 2025-10-24
**Related PRD**: [docs/planning/PRD_2025-10-24_user-password-change-feature.md](./PRD_2025-10-24_user-password-change-feature.md)
**Priority**: Medium
**Status**: Ready to Start

---

## Phase 1: 백엔드 API 구현

**Estimated Time**: 2 hours
**Status**: Not Started

### Tasks

- [ ] **1.1** 기존 인증 시스템 분석
  - backend/api/routes/ 디렉토리에서 인증 관련 파일 확인
  - 사용자 모델 구조 파악 (User 모델, password 필드)
  - 비밀번호 해싱 방식 확인 (bcrypt, passlib 등)
  - 현재 인증 함수 위치 파악 (verify_password, hash_password)

- [ ] **1.2** Pydantic 스키마 정의
  - PasswordChangeRequest 스키마 작성
    - current_password: str
    - new_password: str (min_length=1, max_length=128)
    - confirm_password: str (min_length=1, max_length=128)
  - PasswordChangeResponse 스키마 작성
    - message: str
    - changed_at: datetime
  - Validator 추가: confirm_password == new_password 확인

- [ ] **1.3** 비밀번호 최소 검증 함수 구현
  - validate_password_minimal() 함수 작성
  - 최소 1자 검증 (빈 비밀번호만 방지)
  - 유연한 정책 적용

- [ ] **1.4** 비밀번호 강도 계산 함수 구현 (참고용)
  - calculate_password_strength() 함수 작성
  - 강도 레벨: weak/medium/strong 반환
  - 강제하지 않음, UI 표시용

- [ ] **1.5** API 엔드포인트 구현
  - POST /api/auth/change-password 엔드포인트 추가
  - 인증 의존성 추가 (Depends(require_auth))
  - Request body 파싱 (PasswordChangeRequest)

- [ ] **1.6** 비즈니스 로직 구현
  - 현재 비밀번호 확인 (verify_password)
  - 현재 비밀번호 불일치 시 401 반환
  - 비밀번호 최소 검증 (validate_password_minimal - 1자 이상)
  - 빈 비밀번호 시 422 반환
  - 새 비밀번호 해싱 (hash_password)
  - DB 업데이트 (update_user_password)

- [ ] **1.7** 에러 처리 및 로깅
  - HTTPException 처리
  - 로그 기록 (비밀번호 평문 제외, 강도 레벨 포함)
  - 성공 시 200 OK 반환

**Acceptance Criteria**:
- POST /api/auth/change-password 엔드포인트 정상 작동
- 현재 비밀번호 불일치 시 401 Unauthorized
- 빈 비밀번호 입력 시 422 Unprocessable Entity
- 성공 시 200 OK 및 PasswordChangeResponse 반환
- 비밀번호가 DB에 해시되어 저장됨
- 유연한 비밀번호 정책 적용 (1자 이상)

**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 1: "feat: Implement password change API endpoint"
- [ ] Push to 251014
- [ ] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 2: 프론트엔드 UI 구현

**Estimated Time**: 2 hours
**Status**: Not Started

### Tasks

- [ ] **2.1** ChangePassword 컴포넌트 생성
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
Phase 1: [░░░░░░░] 0% (0/7 tasks)
Phase 2: [░░░░░░░] 0% (0/7 tasks)
Phase 3: [░░░░░] 0% (0/5 tasks)

Total: [░░░░░░░░░░] 0% (0/19 tasks)
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
- (Phase 진행 중 발견된 이슈를 여기에 기록)

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
