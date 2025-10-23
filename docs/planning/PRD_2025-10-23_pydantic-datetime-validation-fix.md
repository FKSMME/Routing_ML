# PRD: Pydantic Datetime Validation Error Fix

**Date**: 2025-10-23
**Priority**: CRITICAL
**Type**: Bug Fix
**Related**: Work History 2025-10-23_routing-prediction-page-fixes.md

---

## Executive Summary

라우팅 예측 API 응답에서 pandas datetime 컬럼이 Pydantic schema 검증에 실패하는 CRITICAL 버그를 수정합니다. OperationStep 스키마가 datetime 필드를 `Optional[str]`로 정의했으나, DataFrame에서 Timestamp/datetime 객체가 그대로 전달되어 24개의 validation error가 발생합니다.

이 버그는 라우팅 예측 기능을 완전히 차단하므로 즉시 수정이 필요합니다.

---

## Problem Statement

### Current Issue

```python
# Error Output
24 validation errors for RoutingSummary
operations.0.VALID_FROM_DT: Input should be a valid string
  [type=string_type, input_value=Timestamp('2001-01-01 00:00:00'), input_type=Timestamp]
operations.0.VALID_TO_DT: Input should be a valid string
  [type=string_type, input_value=datetime.datetime(2999, 12, 31, 0, 0), input_type=datetime]
operations.0.NC_WRITE_DATE: Input should be a valid string
  [type=string_type, input_value=NaT, input_type=NaTType]
...
```

### Root Cause

1. **Schema Definition**: `backend/api/schemas.py`의 `OperationStep`이 datetime 필드를 `Optional[str]`로 정의
2. **Data Source**: pandas DataFrame의 datetime 컬럼이 Timestamp/datetime 객체로 유지됨
3. **Conversion Missing**: DataFrame → dict 변환 시 datetime → string 변환 로직 누락

### Impact

- **Severity**: CRITICAL
- **Affected Users**: 모든 라우팅 예측 사용자
- **Functionality**: 라우팅 예측 API 완전 차단
- **Workaround**: 없음

---

## Goals and Objectives

### Primary Goal
pandas datetime 컬럼을 Pydantic 검증을 통과하는 ISO 8601 문자열로 변환하여 라우팅 예측 API를 복구합니다.

### Specific Objectives
1. ✅ DataFrame의 datetime 컬럼을 ISO 8601 문자열로 변환
2. ✅ NaT (Not a Time) 값을 None으로 변환
3. ✅ 모든 라우팅 관련 API 엔드포인트 검증
4. ✅ 기존 기능 회귀 테스트

---

## Requirements

### Functional Requirements

#### FR-1: Datetime Conversion
**Priority**: CRITICAL
**Description**: DataFrame의 datetime 컬럼을 ISO 8601 문자열로 변환

**Affected Columns**:
- `VALID_FROM_DT`: 라우팅 유효 시작 일자
- `VALID_TO_DT`: 라우팅 유효 종료 일자
- `NC_WRITE_DATE`: NC 프로그램 작성 일자
- `NC_REVIEW_DT`: NC 프로그램 검토 일자

**Conversion Rules**:
```python
# Timestamp/datetime → ISO 8601 string
pd.Timestamp('2001-01-01 00:00:00') → '2001-01-01T00:00:00'
datetime.datetime(2999, 12, 31, 0, 0) → '2999-12-31T00:00:00'

# NaT → None
pd.NaT → None
```

#### FR-2: NaT Handling
**Priority**: HIGH
**Description**: NaT (Not a Time) 값을 None으로 안전하게 변환

**Requirements**:
- pd.isna() 또는 pd.notna()를 사용한 안전한 변환
- None 값은 Pydantic `Optional[str]`과 호환
- 빈 문자열이나 'NaT' 문자열 생성 금지

#### FR-3: Type Safety
**Priority**: HIGH
**Description**: 타입 안전성을 유지하면서 변환

**Requirements**:
- 변환 함수는 pd.Series를 인자로 받음
- 변환 결과는 pd.Series로 반환
- 원본 DataFrame은 수정하지 않음 (immutable)

### Non-Functional Requirements

#### NFR-1: Performance
**Priority**: MEDIUM
**Description**: 변환 로직이 API 응답 시간에 영향을 주지 않음

**Metrics**:
- 변환 시간: < 10ms (100 rows 기준)
- API 응답 시간 증가: < 5%

#### NFR-2: Reliability
**Priority**: HIGH
**Description**: 모든 edge case를 안전하게 처리

**Edge Cases**:
- NaT 값
- None 값
- 이미 문자열인 경우
- 빈 DataFrame

---

## Technical Design

### Solution Approach

**Location**: `backend/database.py`
**Function**: `_safe_datetime()` (신규 생성)

```python
def _safe_datetime(col: pd.Series) -> pd.Series:
    """
    안전한 datetime → string 변환

    Args:
        col: pandas Series with datetime values

    Returns:
        pandas Series with ISO 8601 strings or None
    """
    return col.apply(
        lambda x: x.isoformat() if pd.notna(x) else None
    )
```

### Implementation Points

#### 1. `database.py` - datetime 변환 함수 추가
**Location**: Lines ~450-462 (다른 _safe_* 함수들 근처)

```python
def _safe_datetime(col: pd.Series) -> pd.Series:
    """안전한 datetime → string 변환"""
    return col.apply(
        lambda x: x.isoformat() if pd.notna(x) else None
    )
```

#### 2. DataFrame 변환 시점 파악
**Candidates**:
- `fetch_routing_for_item()` 반환 직전
- `_load_latest_routing()` 반환 직전
- API endpoint에서 DataFrame → dict 변환 시

**Decision**: `fetch_routing_for_item()` 반환 직전이 가장 적합
- 모든 라우팅 조회 경로를 커버
- 캐싱 이후 단계이므로 성능 영향 최소화
- 단일 수정 지점

#### 3. 적용 코드
**Location**: `database.py:fetch_routing_for_item()` 함수의 return 직전

```python
def fetch_routing_for_item(...) -> pd.DataFrame:
    # ... existing code ...

    # Task 1.2: Datetime 컬럼 문자열 변환 (Pydantic 검증용)
    datetime_columns = ['VALID_FROM_DT', 'VALID_TO_DT', 'NC_WRITE_DATE', 'NC_REVIEW_DT']
    for col in datetime_columns:
        if col in result.columns:
            result[col] = _safe_datetime(result[col])

    return result
```

### Alternative Approaches

#### Alternative 1: Schema 수정 (❌ 비추천)
```python
# backend/api/schemas.py
class OperationStep(BaseModel):
    valid_from_dt: Optional[Union[str, datetime]] = Field(None, alias="VALID_FROM_DT")
```

**Pros**: 백엔드 변경 최소화
**Cons**:
- Frontend에서 datetime 파싱 필요
- JSON 직렬화 문제 가능성
- 타입 안전성 저하

#### Alternative 2: API Layer 변환 (❌ 비추천)
```python
# backend/api/routes/prediction.py
operations = [
    {**op, 'VALID_FROM_DT': str(op['VALID_FROM_DT']) if op['VALID_FROM_DT'] else None}
    for op in operations_list
]
```

**Pros**: 데이터베이스 레이어 변경 없음
**Cons**:
- 중복 코드 발생 (모든 엔드포인트마다)
- 유지보수 어려움
- 누락 가능성

#### Alternative 3: to_dict 변환 시점 (✅ 선택)
**Reason**:
- 단일 수정 지점
- 모든 라우팅 조회 경로 커버
- 성능 영향 최소
- 타입 안전성 유지

---

## Phase Breakdown

### Phase 1: datetime 변환 함수 추가 (30분)

**Tasks**:
1.1. `_safe_datetime()` 함수 구현
1.2. `fetch_routing_for_item()`에 datetime 컬럼 변환 로직 추가
1.3. 로컬 테스트 (간단한 DataFrame 변환 확인)

**Deliverables**:
- `database.py` 수정 완료
- datetime → string 변환 작동 확인

**Acceptance Criteria**:
- _safe_datetime() 함수가 NaT를 None으로 변환
- Timestamp를 ISO 8601 문자열로 변환
- None 입력 시 None 반환

---

### Phase 2: 전체 테스트 및 검증 (30분)

**Tasks**:
2.1. 백엔드 서버 재시작
2.2. 라우팅 예측 API 호출 테스트
2.3. Pydantic 검증 통과 확인
2.4. 콘솔 로그에서 validation error 없음 확인

**Deliverables**:
- 라우팅 예측 API 정상 작동
- Pydantic 검증 오류 제거 확인

**Acceptance Criteria**:
- 24개 validation error 모두 해결
- 라우팅 예측 응답 정상 반환
- datetime 필드가 ISO 8601 문자열로 표시
- NaT 필드가 null로 표시

---

## Success Criteria

### Critical Success Factors
1. ✅ Pydantic validation error 0개
2. ✅ 라우팅 예측 API 정상 작동
3. ✅ 기존 기능 회귀 없음
4. ✅ API 응답 시간 변화 < 5%

### Verification Methods
- **Unit Test**: _safe_datetime() 함수 테스트
- **Integration Test**: 라우팅 예측 API 전체 플로우 테스트
- **Manual Test**: 실제 품목 코드로 예측 실행

### Expected Outcomes
```json
{
  "operations": [
    {
      "PROC_SEQ": 10,
      "VALID_FROM_DT": "2001-01-01T00:00:00",  // ✅ 문자열
      "VALID_TO_DT": "2999-12-31T00:00:00",     // ✅ 문자열
      "NC_WRITE_DATE": null,                     // ✅ null (NaT)
      "NC_REVIEW_DT": "2023-05-15T10:30:00"     // ✅ 문자열
    }
  ]
}
```

---

## Risks and Mitigation

### Risk 1: 다른 datetime 컬럼 누락
**Probability**: MEDIUM
**Impact**: MEDIUM
**Mitigation**: database.py의 ROUTING_VIEW_COLUMNS에서 모든 datetime 컬럼 확인

### Risk 2: 성능 저하
**Probability**: LOW
**Impact**: LOW
**Mitigation**: apply() 대신 vectorized 연산 사용 (필요시)

### Risk 3: 타임존 문제
**Probability**: LOW
**Impact**: LOW
**Mitigation**: isoformat()은 timezone 정보 자동 포함 (timezone-aware datetime의 경우)

---

## Timeline Estimate

| Phase | Task | Duration | Cumulative |
|-------|------|----------|------------|
| 1 | datetime 변환 함수 추가 | 30분 | 30분 |
| 2 | 전체 테스트 및 검증 | 30분 | 1시간 |
| **Total** | | **1시간** | |

---

## Dependencies

### Upstream Dependencies
- ✅ pandas (already installed)
- ✅ Pydantic (already installed)

### Downstream Impact
- ✅ Frontend: datetime 필드가 문자열로 반환됨 (이미 예상된 형식)
- ✅ API 호환성: 변경 없음 (schema 정의대로 수정)

---

## Future Enhancements

1. **Unit Test 추가**
   - `test_safe_datetime()` 함수
   - Edge case 커버리지

2. **다른 뷰의 datetime 컬럼 검토**
   - WORK_RESULT_VIEW_COLUMNS
   - ITEM_INFO_VIEW_COLUMNS

3. **Vectorized 연산 최적화**
   ```python
   def _safe_datetime_vectorized(col: pd.Series) -> pd.Series:
       mask = col.notna()
       result = pd.Series([None] * len(col), index=col.index)
       result[mask] = col[mask].dt.strftime('%Y-%m-%dT%H:%M:%S')
       return result
   ```

---

## Appendix

### Related Documents
- [CHECKLIST: Pydantic Datetime Validation Fix](./CHECKLIST_2025-10-23_pydantic-datetime-validation-fix.md)
- [Work History: Routing Prediction Page Fixes](../work-history/2025-10-23_routing-prediction-page-fixes.md)
- [Pydantic Error Output](https://github.com/pydantic/pydantic/discussions/3139)

### Code References
- `backend/database.py:989-1075` - fetch_routing_for_item()
- `backend/database.py:451-461` - _safe_string(), _safe_numeric()
- `backend/api/schemas.py:26-48` - OperationStep 스키마

---

**Document Version**: 1.0
**Created**: 2025-10-23
**Status**: READY FOR IMPLEMENTATION
