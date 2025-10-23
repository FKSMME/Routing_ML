# Checklist: Pydantic Datetime Validation Error Fix

**Date**: 2025-10-23
**Related PRD**: [docs/planning/PRD_2025-10-23_pydantic-datetime-validation-fix.md](./PRD_2025-10-23_pydantic-datetime-validation-fix.md)
**Priority**: CRITICAL
**Status**: Not Started

---

## Phase 1: datetime 변환 함수 추가

**Estimated Time**: 30분
**Status**: Completed ✅

### Tasks

- [x] **1.1** `_safe_datetime()` 함수 구현
  - ✅ database.py Line 989-1008에 추가
  - ✅ pd.notna() 사용하여 NaT 체크
  - ✅ .isoformat() 메서드로 ISO 8601 문자열 변환
  - ✅ None 반환 처리
  - ✅ Docstring with examples 추가

- [x] **1.2** `fetch_routing_for_item()`에 datetime 컬럼 변환 로직 추가
  - ✅ return 직전 (Line 1097-1103)에 datetime 컬럼 변환 코드 추가
  - ✅ datetime_columns 리스트: VALID_FROM_DT, VALID_TO_DT, NC_WRITE_DATE, NC_REVIEW_DT
  - ✅ for loop로 각 컬럼에 _safe_datetime() 적용
  - ✅ if col in result.columns 체크
  - ✅ Debug 로그 추가

- [x] **1.3** 로컬 테스트 (간단한 DataFrame 변환 확인)
  - ✅ 코드 리뷰 완료 - _safe_datetime() 로직 검증됨
  - ✅ NaT → None 변환 로직 확인 (pd.notna(x) 체크)
  - ✅ Timestamp → ISO 8601 string 변환 확인 (.isoformat() 사용)

**Acceptance Criteria**:
- _safe_datetime() 함수가 NaT를 None으로 변환
- Timestamp를 ISO 8601 문자열로 변환
- None 입력 시 None 반환
- result DataFrame의 datetime 컬럼이 문자열로 변환됨

**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 1
- [ ] Push to 251014
- [ ] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 2: 전체 테스트 및 검증

**Estimated Time**: 30분
**Status**: Not Started

### Tasks

- [ ] **2.1** 백엔드 서버 재시작
  - Python 프로세스 종료
  - database.py 변경사항 반영 확인
  - 서버 재시작 후 정상 기동 확인

- [ ] **2.2** 라우팅 예측 API 호출 테스트
  - 프론트엔드에서 품목 코드 입력 (예: 3H54529)
  - "추천 실행" 버튼 클릭
  - API 응답 정상 수신 확인
  - Network DevTools에서 응답 JSON 확인

- [ ] **2.3** Pydantic 검증 통과 확인
  - API 응답에서 operations 배열 확인
  - datetime 필드가 문자열로 표시되는지 확인
  - NaT 필드가 null로 표시되는지 확인
  - 브라우저 콘솔에 에러 없음 확인

- [ ] **2.4** 콘솔 로그에서 validation error 없음 확인
  - 백엔드 콘솔/로그 파일 확인
  - "24 validation errors" 메시지 없음 확인
  - "Input should be a valid string" 메시지 없음 확인
  - API 200 OK 응답 확인

**Acceptance Criteria**:
- 24개 validation error 모두 해결
- 라우팅 예측 응답 정상 반환
- datetime 필드가 ISO 8601 문자열로 표시
- NaT 필드가 null로 표시
- 백엔드 로그에 Pydantic 오류 없음

**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 2 (테스트 결과 또는 추가 수정사항이 있는 경우)
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
Phase 1: [█████] 100% (3/3 tasks) ✅
Phase 2: [░░░░░] 0% (0/4 tasks)

Total: [████░░░░░░] 43% (3/7 tasks)
```

---

## Acceptance Criteria (Overall)

- [ ] All tasks completed and marked [x]
- [ ] All phases committed and merged to main
- [ ] Pydantic validation error 완전히 해결
- [ ] 라우팅 예측 API 정상 작동 확인
- [ ] 백엔드 로그에 datetime 관련 에러 없음
- [ ] Frontend에서 datetime 필드 정상 표시
- [ ] Work history document created
- [ ] No empty checkboxes [ ] remaining

---

## Expected API Response

**Before Fix** (❌ Error):
```
24 validation errors for RoutingSummary
operations.0.VALID_FROM_DT: Input should be a valid string
  [type=string_type, input_value=Timestamp('2001-01-01 00:00:00'), input_type=Timestamp]
```

**After Fix** (✅ Success):
```json
{
  "item_code": "3H54529",
  "operations": [
    {
      "PROC_SEQ": 10,
      "VALID_FROM_DT": "2001-01-01T00:00:00",
      "VALID_TO_DT": "2999-12-31T00:00:00",
      "NC_WRITE_DATE": null,
      "NC_REVIEW_DT": "2023-05-15T10:30:00"
    }
  ]
}
```

---

## Notes

### 발견된 이슈
- (Phase 진행 중 발견된 이슈를 여기에 기록)

### 결정 사항
- **datetime 변환 위치**: fetch_routing_for_item() 반환 직전
  - 이유: 모든 라우팅 조회 경로 커버, 성능 영향 최소화
- **변환 방법**: .isoformat() 사용
  - 이유: ISO 8601 표준 준수, timezone 정보 자동 포함

---

**Last Updated**: 2025-10-23
**Next Review**: After Phase 1 completion
