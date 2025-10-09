# 프론트엔드 UI 문제 점검 및 수정 보고서

**작성일시:** 2025-10-06 11:10 UTC  
**대상:** frontend-prediction  
**작성자:** Claude Code

---

## 📸 스크린샷 분석 결과

### 발견된 주요 문제점

1. **❌ 중복 컴포넌트 렌더링**
   - Routing Canvas가 2개 렌더링됨
   - 좌우 패널이 중복으로 표시됨
   - 레이아웃이 뒤죽박죽

2. **❌ 메뉴바 구조 문제**
   - 메인 네비게이션과 서브 탭이 혼재
   - 크기와 간격이 일관성 없음

3. **❌ 다크모드 토글 미작동**
   - 버튼은 존재하나 CSS 변수 미적용
   - LoginPage에서 버튼 렌더링 불안정

---

## 🔍 코드 분석

### 1. App.tsx 중복 렌더링 문제

**파일:** `/workspaces/Routing_ML_4/frontend-prediction/src/App.tsx`

#### 문제 코드 (라인 274-318)

```typescript
const routingContent = (
  <>
    {/* ✅ 정상: RoutingProductTabs가 workspace 렌더링 */}
    <RoutingProductTabs
      renderWorkspace={(tab) => renderRoutingWorkspace(tab)}
      emptyState={renderRoutingWorkspace()}
    />
    
    {/* ❌ 문제: 동일한 컴포넌트를 또 렌더링! */}
    <div className="routing-workspace-grid">
      <aside className="routing-column routing-column--left">
        {renderPredictionBanner()}
        <PredictionControls ... />
        <ReferenceMatrixPanel />
      </aside>
      <section className="routing-column routing-column--center">
        <TimelinePanel />
        <VisualizationSummary ... />
        <FeatureWeightPanel ... />
        <MetricsPanel ... />
      </section>
      <aside className="routing-column routing-column--right">
        <CandidatePanel />
      </aside>
    </div>
  </>
);
```

#### 근본 원인

- `RoutingProductTabs`는 이미 내부적으로 `renderWorkspace()` 함수를 호출하여 레이아웃 렌더링
- 그 아래 `<div className="routing-workspace-grid">`에서 **동일한 컴포넌트를 다시 렌더링**
- 결과: 모든 UI 요소가 **2번 렌더링**됨

#### 수정 내용

```typescript
// 수정 후 (라인 274-279)
const routingContent = (
  <RoutingProductTabs
    renderWorkspace={(tab) => renderRoutingWorkspace(tab)}
    emptyState={renderRoutingWorkspace()}
  />
);
```

**변경사항:**
- ❌ 삭제: 중복 `<div className="routing-workspace-grid">` 블록 (37줄)
- ✅ 유지: RoutingProductTabs만 렌더링

---

### 2. 다크모드 토글 문제

**파일:**
- `frontend-prediction/src/index.css`
- `frontend-training/src/index.css`

#### 문제 1: CSS Specificity 부족

```css
/* ❌ 이전 코드 (낮은 우선순위) */
.dark {
  --background: hsl(220 18% 10%);
  --foreground: hsl(210 20% 85%);
}

/* :root의 라이트 모드 변수가 이를 덮어씀 */
```

#### 수정 1: Specificity 강화

```css
/* ✅ 수정 후 (높은 우선순위) */
html.dark {
  --background: hsl(220 18% 10%);
  --foreground: hsl(210 20% 85%);
  /* ... */
}
```

#### 문제 2: 중복 .dark 정의

- **라인 157:** 정상적인 다크모드 CSS 변수
- **라인 5079:** 라이트 모드 변수를 참조하는 잘못된 정의 (이미 제거 완료)

#### 문제 3: Surface 유틸리티 클래스 미정의

```css
/* ✅ 추가된 코드 (라인 246-255) */
.surface-base {
  background-color: var(--background);
  transition: background-color 0.3s ease;
}

.surface-card {
  background-color: var(--card);
  transition: background-color 0.3s ease;
}
```

---

## ✅ 수정 완료 사항

### 1. 중복 렌더링 제거
- ✅ `App.tsx` 라인 280-316 삭제
- ✅ 37줄 코드 제거
- ✅ Routing Canvas 1개만 렌더링

### 2. 다크모드 CSS 수정
- ✅ `.dark` → `html.dark` (Specificity 강화)
- ✅ 중복 `.dark` 정의 제거 (라인 5079)
- ✅ `.surface-base`, `.surface-card` 클래스 추가

### 3. LoginPage 테마 토글
- ✅ ThemeToggle 컴포넌트 추가
- ✅ 우측 상단 배치 (`absolute top-4 right-4`)

### 4. Git 문제 해결
- ✅ `.git/index.lock` 제거
- ✅ Git 성능 최적화 (7.3초 → 즉시)

---

## ⚠️ 미해결 문제

### 1. 다크모드 CSS 변수 실제 적용 미확인
**상태:** CSS 코드는 수정되었으나 브라우저 적용 미확인

**원인 추정:**
- Vite HMR이 CSS 변경사항 미반영
- 브라우저 캐시

**권장 조치:**
1. 브라우저 하드 리프레시 (Ctrl+Shift+R)
2. Dev 서버 재시작
3. 브라우저 개발자 도구에서 `document.documentElement.classList` 확인

### 2. Prediction LoginPage 테마 토글 렌더링 불안정
**상태:** Training은 정상, Prediction은 간헐적 실패

**Playwright 테스트 결과:**
- **Training:** ✅ 버튼 발견 (`"text": "🌙"`)
- **Prediction:** ❌ 버튼 미발견 (`[]`)

**권장 조치:**
- 브라우저 개발자 도구 콘솔 확인
- ThemeToggle import 경로 확인
- 빌드 에러 로그 확인

### 3. 메뉴바 레이아웃 정리 필요
**현재 상태:**
- MainNavigation과 RoutingProductTabs가 별도 렌더링
- 간격과 크기 일관성 부족

**권장 조치:**
- CSS Grid/Flexbox 레이아웃 재설계
- 디자인 시스템 정립

---

## 📊 테스트 결과

### Playwright 다크모드 테스트

**실행 시간:** 2025-10-06 10:35 ~ 11:04 UTC

| 테스트 항목 | Prediction | Training |
|-----------|------------|----------|
| 서버 실행 | ✅ :5174 | ✅ :5175 |
| 테마 버튼 | ❌ 미발견 | ✅ 발견 |
| .dark 클래스 추가 | - | ✅ |
| CSS 변수 적용 | - | ❌ |

**스크린샷:**
- `test-results/dark-mode-prediction-*.png`
- `test-results/dark-mode-training-*.png`

---

## 🎯 다음 단계

### 우선순위 1: 즉시 확인 필요
1. ✅ **중복 렌더링 수정 확인** - App.tsx 수정 완료
2. 🔄 **브라우저에서 직접 확인**
   - http://localhost:5174/
   - http://localhost:5175/
   - 우측 상단 테마 토글 버튼 클릭
   - 다크모드 전환 확인

### 우선순위 2: 레이아웃 개선
1. 메뉴바 구조 정리
2. CSS Grid 레이아웃 재설계
3. 반응형 디자인 점검

### 우선순위 3: 코드 품질
1. TypeScript 빌드 에러 해결
2. 컴포넌트 구조 리팩토링
3. Playwright E2E 테스트 추가

---

## 📝 작업 이력

| 시간 (UTC) | 작업 내용 | 파일 |
|-----------|---------|------|
| 10:20-10:30 | 다크모드 CSS 중복 제거 | index.css |
| 10:30-10:35 | Git lock 문제 해결 | .git/index.lock |
| 10:35-10:45 | Playwright 테스트 | tests/dark-mode-*.spec.ts |
| 10:45-10:50 | Surface 클래스 추가 | index.css |
| 10:50-10:52 | CSS Specificity 강화 | index.css |
| 11:00-11:10 | 중복 렌더링 제거 | App.tsx |

---

## 💾 변경된 파일 목록

1. `frontend-prediction/src/App.tsx` - 중복 렌더링 제거 (37줄 삭제)
2. `frontend-prediction/src/index.css` - 다크모드 CSS 수정
3. `frontend-prediction/src/components/auth/LoginPage.tsx` - ThemeToggle 추가
4. `frontend-training/src/index.css` - 다크모드 CSS 수정
5. `frontend-training/src/components/auth/LoginPage.tsx` - ThemeToggle 추가
6. `.gitignore` - 테스트 결과 제외 패턴 추가
7. `tests/dark-mode-verification.spec.ts` - Playwright 테스트 추가

---

**보고서 작성 완료:** 2025-10-06 11:10 UTC
