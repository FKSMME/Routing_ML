# PRD: 사용자 비밀번호 변경 기능

**Date**: 2025-10-24
**Author**: Claude
**Status**: Active
**Priority**: Medium
**Type**: New Feature

---

## Executive Summary

인증된 사용자가 자신의 비밀번호를 변경할 수 있는 기능을 구현합니다. 보안을 위해 현재 비밀번호 확인, 새 비밀번호 강도 검증, 비밀번호 재입력 확인 등의 안전장치를 포함합니다.

---

## Problem Statement

### 현재 상황

**인증 시스템**:
- 사용자 로그인 기능 존재
- 사용자 정보는 데이터베이스에 저장
- 비밀번호는 해시 처리되어 저장 (추정)

**발견된 문제**:
- 사용자가 비밀번호를 변경할 수 있는 UI/API 없음
- 비밀번호 분실 시 관리자 개입 필요
- 보안 정책 준수를 위한 주기적 비밀번호 변경 불가

### 영향

- **보안 취약점**: 초기 비밀번호 영구 사용 가능
- **사용자 불편**: 비밀번호 변경을 위해 관리자 요청 필요
- **규정 준수**: 보안 정책 요구사항 미충족

---

## Goals and Objectives

### Primary Goals

1. **비밀번호 변경 API**: 안전한 비밀번호 변경 엔드포인트 구현
2. **UI 제공**: 사용자 친화적인 비밀번호 변경 화면
3. **보안 강화**: 현재 비밀번호 확인 및 새 비밀번호 검증

### Secondary Goals

1. **비밀번호 강도 표시**: 실시간 비밀번호 강도 인디케이터
2. **이력 관리**: 비밀번호 변경 이력 로그 (선택)
3. **알림**: 비밀번호 변경 완료 알림

---

## Requirements

### Functional Requirements

#### FR1: 비밀번호 변경 API

**엔드포인트**: `POST /api/auth/change-password`

**Request Body**:
```json
{
  "current_password": "oldPassword123!",
  "new_password": "newPassword456!",
  "confirm_password": "newPassword456!"
}
```

**Response** (Success):
```json
{
  "message": "비밀번호가 성공적으로 변경되었습니다.",
  "changed_at": "2025-10-24T10:30:00Z"
}
```

**Response** (Error):
```json
{
  "detail": "현재 비밀번호가 일치하지 않습니다."
}
```

**Status Codes**:
- 200 OK: 비밀번호 변경 성공
- 400 Bad Request: 입력 검증 실패
- 401 Unauthorized: 인증 실패 또는 현재 비밀번호 불일치
- 422 Unprocessable Entity: 비밀번호 정책 위반

---

#### FR2: 비밀번호 검증 규칙 (유연한 정책)

**사용자 자유도 최대화**:
- 사용자가 원하는 대로 비밀번호를 변경할 수 있도록 최소 제약 적용
- 강제 규칙 없이 권장사항만 제공
- 사용자 경험 우선

**최소 요구사항** (기술적 제약):
- 길이: 1자 이상 (빈 비밀번호 방지)
- 문자 조합: 제한 없음
- 복잡도: 제한 없음

**권장사항** (UI에 표시, 강제하지 않음):
- 길이: 8자 이상 권장
- 문자 조합: 영문, 숫자, 특수문자 혼합 권장
- 주기적 변경 권장

**비밀번호 강도 인디케이터** (선택):
- 약함 (Weak): 4자 미만
- 보통 (Medium): 4-8자
- 강함 (Strong): 8자 이상 + 문자 조합
- ⚠️ 강도 표시는 참고용이며, 약한 비밀번호도 설정 가능

---

#### FR3: 프론트엔드 UI

**위치**: 우측 최상단 (Top-right corner)
- 사용자 프로필 아이콘/메뉴 드롭다운에서 접근
- 또는 별도 "비밀번호 변경" 페이지 (우측 상단 메뉴에서 이동)

**UI 구성요소**:
1. **현재 비밀번호 입력**
   - Type: password
   - Placeholder: "현재 비밀번호 입력"
   - 눈 아이콘 (show/hide password)

2. **새 비밀번호 입력**
   - Type: password
   - Placeholder: "새 비밀번호 입력"
   - 비밀번호 강도 인디케이터 (프로그레스 바 - 참고용)
   - 권장사항 표시 (강제하지 않음)

3. **새 비밀번호 확인**
   - Type: password
   - Placeholder: "새 비밀번호 다시 입력"
   - 일치 여부 표시 (✓ 일치 / ✗ 불일치)

4. **버튼**
   - "변경" 버튼 (primary)
   - "취소" 버튼 (secondary)

**실시간 검증**:
- 비밀번호 입력 시 강도 표시
- 확인 비밀번호 불일치 시 즉시 표시
- 제출 전 모든 규칙 통과 확인

---

#### FR4: 보안 요구사항

1. **현재 비밀번호 확인**
   - 백엔드에서 현재 비밀번호 해시 비교
   - 3회 이상 실패 시 계정 임시 잠금 (선택)

2. **비밀번호 해싱**
   - bcrypt 또는 Argon2 사용
   - Salt 적용

3. **HTTPS 통신**
   - 평문 비밀번호는 HTTPS를 통해서만 전송

4. **세션 만료**
   - 비밀번호 변경 후 모든 세션 무효화 (선택)
   - 재로그인 요구

---

### Non-Functional Requirements

#### NFR1: 성능
- 비밀번호 해싱 시간: < 500ms
- API 응답 시간: < 1초
- UI 반응 시간: < 100ms (실시간 검증)

#### NFR2: 보안
- 비밀번호는 평문으로 로그에 기록 금지
- 에러 메시지는 구체적 정보 노출 금지 (예: "현재 비밀번호 또는 새 비밀번호가 올바르지 않습니다")
- Rate limiting: 동일 사용자 5분 내 10회 제한 (유연한 정책)

#### NFR3: 사용성
- 명확한 에러 메시지 제공
- 비밀번호 규칙 사전 고지
- 변경 완료 시 성공 메시지 표시

---

## Technical Design

### Solution Approach

#### Backend Architecture

**Location**: `backend/api/routes/auth.py` (신규 또는 기존 파일)

**Pydantic Schemas**:
```python
class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=1, max_length=128)
    confirm_password: str = Field(..., min_length=1, max_length=128)

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('비밀번호가 일치하지 않습니다')
        return v

class PasswordChangeResponse(BaseModel):
    message: str
    changed_at: datetime
```

**비밀번호 검증 함수**:
```python
def validate_password_minimal(password: str) -> bool:
    """
    비밀번호 최소 검증 (매우 유연한 정책)
    - 최소 1자 이상 (빈 비밀번호만 방지)
    """
    return len(password) >= 1

def calculate_password_strength(password: str) -> dict:
    """
    비밀번호 강도 계산 (참고용, 강제하지 않음)
    Returns: {'score': 0-3, 'label': 'weak'|'medium'|'strong'}
    """
    if len(password) < 4:
        return {'score': 0, 'label': 'weak'}

    score = 0
    if len(password) >= 8:
        score += 1

    has_lower = any(c.islower() for c in password)
    has_upper = any(c.isupper() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password)

    char_variety = sum([has_lower, has_upper, has_digit, has_special])
    if char_variety >= 2:
        score += 1
    if char_variety >= 3:
        score += 1

    labels = ['weak', 'medium', 'medium', 'strong']
    return {'score': score, 'label': labels[score]}
```

**API 엔드포인트**:
```python
@router.post("/change-password", response_model=PasswordChangeResponse)
async def change_password(
    request: PasswordChangeRequest,
    current_user: AuthenticatedUser = Depends(require_auth),
    db: Session = Depends(get_db)
):
    # 1. 현재 비밀번호 확인
    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="현재 비밀번호가 일치하지 않습니다")

    # 2. 최소 비밀번호 검증 (1자 이상)
    if not validate_password_minimal(request.new_password):
        raise HTTPException(status_code=422, detail="비밀번호는 최소 1자 이상이어야 합니다")

    # 3. 비밀번호 해싱 및 업데이트
    new_password_hash = hash_password(request.new_password)
    update_user_password(db, current_user.id, new_password_hash)

    # 4. 로그 기록 (비밀번호 강도 포함 - 참고용)
    strength = calculate_password_strength(request.new_password)
    logger.info(f"User {current_user.id} changed password (strength: {strength['label']})")

    return PasswordChangeResponse(
        message="비밀번호가 성공적으로 변경되었습니다",
        changed_at=datetime.utcnow()
    )
```

---

#### Frontend Architecture

**Location**:
- `frontend-prediction/src/components/auth/ChangePassword.tsx` (신규)
- 또는 `frontend-training/src/components/auth/ChangePassword.tsx`

**React Component Structure**:
```tsx
interface PasswordStrength {
  score: number; // 0-3
  label: 'weak' | 'medium' | 'strong';
}

export function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);

  // 실시간 비밀번호 강도 계산
  useEffect(() => {
    if (newPassword) {
      setPasswordStrength(calculatePasswordStrength(newPassword));
    }
  }, [newPassword]);

  const handleSubmit = async () => {
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      });
      alert('비밀번호가 성공적으로 변경되었습니다');
      // 로그아웃 또는 페이지 이동
    } catch (error) {
      alert(error.response.data.detail);
    }
  };

  return (
    <div className="change-password">
      {/* Form fields */}
    </div>
  );
}
```

---

## Phase Breakdown

### Phase 1: 백엔드 API 구현 (2 hours)

**Tasks**:
1.1. Pydantic 스키마 정의 (`PasswordChangeRequest`, `PasswordChangeResponse`)
1.2. 비밀번호 최소 검증 함수 구현 (`validate_password_minimal` - 1자 이상)
1.3. 비밀번호 강도 계산 함수 구현 (`calculate_password_strength` - 참고용)
1.4. `/api/auth/change-password` 엔드포인트 구현
1.5. 현재 비밀번호 확인 로직
1.6. 비밀번호 해싱 및 DB 업데이트
1.7. 에러 처리 및 로깅

**Deliverables**:
- `backend/api/routes/auth.py` 또는 `backend/api/routes/users.py` 수정
- API 엔드포인트 동작 확인

**Acceptance Criteria**:
- POST /api/auth/change-password 정상 작동
- 현재 비밀번호 불일치 시 401 반환
- 빈 비밀번호 입력 시 422 반환
- 성공 시 200 OK 및 메시지 반환
- 유연한 비밀번호 정책 적용 (1자 이상)

---

### Phase 2: 프론트엔드 UI 구현 (2 hours)

**Tasks**:
2.1. ChangePassword 컴포넌트 생성
2.2. 비밀번호 입력 필드 구현 (3개)
2.3. Show/hide password 토글 기능
2.4. 비밀번호 강도 인디케이터 구현
2.5. 실시간 검증 로직 (비밀번호 일치 확인)
2.6. API 호출 함수 작성 (`changePassword`)
2.7. 에러 처리 및 성공 메시지

**Deliverables**:
- `ChangePassword.tsx` 컴포넌트
- API 클라이언트 함수

**Acceptance Criteria**:
- 모든 입력 필드 정상 작동
- 비밀번호 강도 실시간 표시
- 비밀번호 불일치 시 경고 표시
- API 호출 성공 시 성공 메시지 표시

---

### Phase 3: 통합 및 테스트 (1 hour)

**Tasks**:
3.1. 라우팅/메뉴에 비밀번호 변경 페이지 추가
3.2. 전체 플로우 테스트
3.3. 에러 케이스 테스트
3.4. UI/UX 개선

**Deliverables**:
- 메뉴 항목 추가
- 전체 기능 동작 확인

**Acceptance Criteria**:
- 사용자가 메뉴에서 비밀번호 변경 페이지 접근 가능
- 전체 플로우 정상 작동
- 모든 에러 케이스 적절히 처리

---

## Success Criteria

### Critical Success Factors
1. ✅ 비밀번호 변경 API 정상 작동
2. ✅ 현재 비밀번호 확인 정상 작동
3. ✅ 비밀번호 강도 검증 정상 작동
4. ✅ 사용자 친화적인 UI
5. ✅ 보안 요구사항 충족

### Verification Methods
- **Unit Test**: 비밀번호 강도 검증 함수 테스트
- **Integration Test**: API 엔드포인트 전체 플로우 테스트
- **Manual Test**: UI를 통한 비밀번호 변경 테스트

### Expected Outcomes
- 사용자가 스스로 비밀번호 변경 가능
- 보안 정책 준수
- 관리자 개입 없이 비밀번호 관리

---

## Risks and Mitigation

### Risk 1: 인증 시스템 구조 불명확
**Probability**: HIGH
**Impact**: HIGH
**Mitigation**:
- 기존 인증 코드 분석 (backend/api/routes/*.py)
- 사용자 모델 및 비밀번호 저장 방식 확인
- 필요시 접근 방식 조정

### Risk 2: 비밀번호 정책 요구사항 불명확
**Probability**: MEDIUM
**Impact**: LOW
**Mitigation**:
- 일반적인 보안 정책 적용 (8자 이상, 3종류 조합)
- 필요시 정책 조정 가능하도록 설계

### Risk 3: 세션 관리
**Probability**: MEDIUM
**Impact**: MEDIUM
**Mitigation**:
- 비밀번호 변경 후 세션 처리 방식 확인
- 필요시 재로그인 요구

---

## Timeline Estimate

| Phase | Task | Duration | Cumulative |
|-------|------|----------|------------|
| 1 | 백엔드 API 구현 | 2시간 | 2시간 |
| 2 | 프론트엔드 UI 구현 | 2시간 | 4시간 |
| 3 | 통합 및 테스트 | 1시간 | 5시간 |
| **Total** | | **5시간** | |

---

## Dependencies

### Upstream Dependencies
- ✅ 기존 인증 시스템 (로그인 기능)
- ✅ 사용자 데이터베이스 모델
- ✅ 비밀번호 해싱 라이브러리 (bcrypt, passlib 등)

### Downstream Impact
- ✅ 기존 로그인 기능에 영향 없음
- ✅ 기존 사용자 데이터 마이그레이션 불필요

---

## Future Enhancements

1. **비밀번호 재설정 (분실 시)**
   - 이메일 인증을 통한 비밀번호 재설정
   - 임시 비밀번호 발급

2. **비밀번호 변경 이력**
   - 변경 일시 기록
   - 최근 N개 비밀번호 재사용 방지

3. **2단계 인증 (2FA)**
   - TOTP (Google Authenticator)
   - SMS 인증

4. **비밀번호 만료 정책**
   - 90일마다 비밀번호 변경 요구
   - 만료 알림

---

## Appendix

### Reference Links
- [OWASP Password Strength](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [bcrypt Documentation](https://github.com/pyca/bcrypt/)

### Related Documents
- CHECKLIST: docs/planning/CHECKLIST_2025-10-24_user-password-change-feature.md

---

**Document Version**: 1.0
**Created**: 2025-10-24
**Status**: READY FOR REVIEW
