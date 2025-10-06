# 라우팅 설명 패널 (Routing Explanation Panel)

**작성일**: 2025-10-06
**버전**: 1.0.0
**상태**: ✅ 완료

---

## 📋 개요

라우팅 설명 패널은 ML 모델의 추천 결과를 사용자가 이해할 수 있도록 **설명 가능성(Explainability)**을 제공하는 UI 컴포넌트입니다.

### 주요 기능

1. **유사도 점수 시각화** - 선택한 후보와의 유사도를 0-100% 척도로 표시
2. **Feature Importance 표시** - 유사도 계산에 기여한 주요 특성과 가중치
3. **일치 속성 표시** - 두 품목 간 일치하는 특성 목록
4. **공정 정보** - 후보 라우팅의 공정 단계 수
5. **다크/라이트 테마 지원** - CSS 변수 기반 테마 자동 적용

---

## 🎯 목적

### 문제점 (Before)
- 사용자가 "왜 이 라우팅이 추천되었는지" 알 수 없음
- ML 모델이 블랙박스처럼 동작
- 추천 신뢰도를 판단하기 어려움
- 도메인 전문가의 검증이 어려움

### 해결책 (After)
- 유사도 점수와 주요 매칭 특성을 명확히 표시
- Feature Importance로 추천 근거를 정량적으로 제공
- 일치하는 속성을 직관적으로 확인
- 사용자가 추천 결과를 검증하고 신뢰할 수 있음

---

## 🏗️ 아키텍처

### 1. Backend Schema 확장

**파일**: `backend/api/schemas.py`

```python
class CandidateRouting(BaseModel):
    candidate_item_code: str = Field(..., alias="CANDIDATE_ITEM_CD")
    similarity_score: float = Field(..., alias="SIMILARITY_SCORE")
    # ... 기존 필드 ...

    # 새로 추가된 필드
    feature_importance: Optional[Dict[str, float]] = Field(
        None, description="Feature importance scores showing which attributes contributed to the match"
    )
    matched_features: Optional[List[str]] = Field(
        None, description="List of features that matched between source and candidate items"
    )
```

**예시 응답**:
```json
{
  "CANDIDATE_ITEM_CD": "ITEM-A-001",
  "SIMILARITY_SCORE": 0.92,
  "feature_importance": {
    "SPEC": 0.85,
    "MATERIAL": 0.78,
    "ITEM_NM": 0.65,
    "COMPLEXITY": 0.52,
    "DRAW_NO": 0.38
  },
  "matched_features": ["SPEC", "MATERIAL", "ITEM_TYPE", "UNIT"],
  "PROCESS_COUNT": 8
}
```

### 2. Frontend TypeScript 타입

**파일**: `frontend-prediction/src/types/routing.ts`

```typescript
export interface CandidateRouting {
  CANDIDATE_ITEM_CD: string;
  SIMILARITY_SCORE: number;
  RANK: number;
  HAS_ROUTING?: string | null;
  PROCESS_COUNT?: number | null;
  feature_importance?: Record<string, number> | null;  // 추가
  matched_features?: string[] | null;                  // 추가
  metadata?: Record<string, unknown>;
}
```

### 3. React Component

**파일**: `frontend-prediction/src/components/routing/RoutingExplanationPanel.tsx`

**주요 Props**:
```typescript
interface RoutingExplanationPanelProps {
  candidate: CandidateRouting | null;  // 선택된 후보 (null이면 빈 상태)
  className?: string;                   // 추가 CSS 클래스
}
```

**주요 기능**:
1. **유사도 레벨 계산**
   - 90% 이상: "매우 높음" (녹색)
   - 75-90%: "높음" (파란색)
   - 60-75%: "보통" (노란색)
   - 40-60%: "낮음" (빨간색)
   - 40% 미만: "매우 낮음" (회색)

2. **Feature 한글 변환**
   ```typescript
   const FEATURE_DISPLAY_NAMES: Record<string, string> = {
     ITEM_NM: "품목명",
     SPEC: "규격",
     MATERIAL: "재질",
     ITEM_TYPE: "품목유형",
     UNIT: "단위",
     DRAW_NO: "도면번호",
     // ...
   };
   ```

3. **Top 5 Feature Importance 표시**
   - 가중치가 높은 순으로 정렬
   - 프로그레스 바로 시각화
   - 백분율로 표시

---

## 🎨 UI/UX 디자인

### 레이아웃 구조

```
┌─────────────────────────────────────┐
│ 왜 이 라우팅?                        │
│ 추천 근거 분석                        │
├─────────────────────────────────────┤
│ 유사도 점수                           │
│ ┌─────────┐ ┌────────────┐          │
│ │  92.0%  │ │ 매우 높음   │          │
│ └─────────┘ └────────────┘          │
│                                      │
│ 주요 매칭 특성 (Feature Importance)   │
│ 규격        ███████████░░ 85%        │
│ 재질        ████████░░░░░ 78%        │
│ 품목명      ██████░░░░░░░ 65%        │
│                                      │
│ 일치하는 속성                         │
│ [규격] [재질] [품목유형] [단위]       │
│                                      │
│ 공정 정보                             │
│ 총 공정 수: 8단계                     │
└─────────────────────────────────────┘
```

### 색상 체계

| 요소 | Light Mode | Dark Mode |
|------|-----------|-----------|
| 배경 | `#f9fafb` | `#1f2937` |
| 텍스트 | `#111827` | `#f9fafb` |
| 프로그레스 바 | `#3b82f6` → `#60a5fa` | 동일 (gradient) |
| 일치 태그 배경 | `#dbeafe` | `#1e3a8a` |

---

## 📦 통합 가이드

### 방법 1: 독립 컴포넌트로 사용

```tsx
import { useState } from "react";
import { RoutingExplanationPanel } from "./routing/RoutingExplanationPanel";
import type { CandidateRouting } from "@/types/routing";

function MyWorkspace() {
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRouting | null>(null);

  return (
    <div className="layout">
      <CandidateList onSelect={setSelectedCandidate} />
      <RoutingExplanationPanel candidate={selectedCandidate} />
    </div>
  );
}
```

### 방법 2: 기존 패널에 통합

```tsx
// CandidatePanel.tsx 예시
<div className="candidate-layout">
  <div className="candidate-list">
    {/* 기존 후보 목록 */}
  </div>

  {/* 우측에 설명 패널 추가 */}
  <aside className="explanation-sidebar">
    <RoutingExplanationPanel candidate={selectedCandidate} />
  </aside>
</div>
```

### 방법 3: Modal/Drawer로 사용

```tsx
<Dialog open={showExplanation} onClose={onClose}>
  <RoutingExplanationPanel candidate={selectedCandidate} />
</Dialog>
```

---

## 🔧 백엔드 구현 예시

### prediction_service.py 수정

```python
def predict(self, item_codes, top_k=5, **kwargs):
    # 기존 예측 로직
    candidates = self._find_similar_items(item_codes, top_k)

    # Feature Importance 계산
    for candidate in candidates:
        # 방법 1: SHAP 값 사용
        feature_importance = self._calculate_shap_values(
            source_item=item_codes[0],
            candidate_item=candidate.CANDIDATE_ITEM_CD
        )

        # 방법 2: 단순 가중치 사용 (빠른 구현)
        feature_importance = self._calculate_simple_importance(
            source_features,
            candidate_features
        )

        candidate.feature_importance = feature_importance
        candidate.matched_features = self._find_matched_features(
            source_features,
            candidate_features
        )

    return candidates
```

### Feature Importance 계산 예시

```python
def _calculate_simple_importance(self, source, candidate):
    """간단한 Feature Importance 계산 (Cosine Similarity 기반)"""
    importance = {}

    # 각 feature별로 유사도 계산
    for feature in ['SPEC', 'MATERIAL', 'ITEM_NM', 'COMPLEXITY']:
        source_val = source.get(feature)
        candidate_val = candidate.get(feature)

        if source_val and candidate_val:
            # TF-IDF 벡터화 후 코사인 유사도
            similarity = cosine_similarity(
                vectorize(source_val),
                vectorize(candidate_val)
            )
            importance[feature] = float(similarity)

    return importance
```

---

## 🧪 테스트

### Demo 페이지

**파일**: `frontend-prediction/src/components/routing/RoutingExplanationDemo.tsx`

Mock 데이터를 사용한 독립 데모 페이지가 제공됩니다.

**실행 방법**:
```tsx
// App.tsx 또는 라우터에 추가
import { RoutingExplanationDemo } from "@components/routing/RoutingExplanationDemo";

<Route path="/demo/explanation" element={<RoutingExplanationDemo />} />
```

### 테스트 케이스

1. **Empty State**
   ```tsx
   <RoutingExplanationPanel candidate={null} />
   ```
   → "후보를 선택하면 추천 근거가 표시됩니다" 메시지 표시

2. **High Similarity**
   ```tsx
   <RoutingExplanationPanel candidate={{
     SIMILARITY_SCORE: 0.95,
     feature_importance: { SPEC: 0.9, MATERIAL: 0.85 },
     // ...
   }} />
   ```
   → "매우 높음" 레벨 표시

3. **No Feature Importance**
   ```tsx
   <RoutingExplanationPanel candidate={{
     SIMILARITY_SCORE: 0.75,
     feature_importance: null,  // null인 경우
     // ...
   }} />
   ```
   → Feature Importance 섹션 숨김

---

## 📊 성능 고려사항

### 1. Memoization

```tsx
const featureImportanceList = useMemo<FeatureImportanceItem[]>(() => {
  if (!candidate?.feature_importance) return [];

  return Object.entries(candidate.feature_importance)
    .map(([feature, score]) => ({ feature, score, displayName: getFeatureDisplayName(feature) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);  // Top 5만 표시
}, [candidate?.feature_importance]);
```

### 2. CSS 최적화

- CSS 변수 사용으로 테마 전환 성능 최적화
- `will-change` 속성 없이 간단한 transition 사용
- 프로그레스 바 애니메이션 0.3s로 제한

### 3. 번들 크기

| 파일 | 크기 | 압축 후 |
|------|------|---------|
| RoutingExplanationPanel.tsx | ~5KB | ~1.5KB |
| RoutingExplanationPanel.css | ~4KB | ~1KB |
| **총합** | **~9KB** | **~2.5KB** |

---

## 🚀 배포 체크리스트

- [x] Backend schema에 `feature_importance`, `matched_features` 필드 추가
- [x] Frontend TypeScript 타입 업데이트
- [x] React 컴포넌트 구현
- [x] CSS 스타일 (다크 모드 포함)
- [x] Demo 페이지 작성
- [ ] Backend에서 실제 Feature Importance 계산 로직 구현 (TODO)
- [ ] 실제 워크스페이스에 통합 (TODO)
- [ ] E2E 테스트 작성 (TODO)

---

## 📝 향후 개선사항

### Phase 2 (다음 버전)

1. **SHAP/LIME 통합**
   - SHAP (SHapley Additive exPlanations) 라이브러리 사용
   - 더 정확한 Feature Importance 계산
   - Waterfall 차트 추가

2. **인터랙티브 차트**
   - Recharts/Chart.js로 시각화 강화
   - Feature별 드릴다운 기능
   - 시간에 따른 유사도 변화 추적

3. **비교 모드**
   - 여러 후보 간 Feature Importance 비교
   - Side-by-side 뷰
   - 차이점 하이라이트

4. **Export 기능**
   - 설명 패널을 PDF/이미지로 내보내기
   - 보고서 자동 생성
   - 감사 추적(Audit Trail)용 로그

### Phase 3 (장기)

1. **자연어 설명 생성**
   - GPT-4 API 연동
   - "이 라우팅은 규격과 재질이 일치하여 추천되었습니다" 자동 생성

2. **학습 데이터 피드백**
   - 사용자가 설명을 보고 "도움이 됨/안됨" 피드백
   - 모델 개선에 활용

---

## 🔗 관련 문서

- [TypeScript 에러 수정 보고서](TypeScript_에러_수정_완료_보고서.md)
- [테마 토글 가이드](theme_toggle_guide.md)
- [ROI 계산서](ROI_계산서.md) - Explainability의 비즈니스 가치
- [OpenAPI 타입 생성](openapi_type_generation.md)

---

## 📞 문의

- **담당자**: ML 엔지니어링 팀
- **이슈 트래킹**: GitHub Issues
- **Slack**: #routing-ml-dev

---

**마지막 업데이트**: 2025-10-06 02:45
**다음 리뷰**: 2025-10-13
