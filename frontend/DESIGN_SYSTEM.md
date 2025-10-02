# MZ세대 & 여성친화 디자인 시스템

> 주니어 엔지니어와 여성 사무직이 흥미를 잃지 않고 재미있게 일할 수 있는 UI/UX

## 🎨 색상 팔레트

### 파스텔 컬러
```css
--pastel-pink: hsl(330 80% 85%)          /* 부드러운 핑크 */
--pastel-pink-strong: hsl(330 75% 70%)   /* 진한 핑크 */
--pastel-lavender: hsl(270 65% 85%)      /* 라벤더 */
--pastel-lavender-strong: hsl(270 60% 70%)
--pastel-coral: hsl(15 85% 80%)          /* 코랄 */
--pastel-coral-strong: hsl(15 80% 65%)
--pastel-mint: hsl(140 60% 80%)          /* 민트 */
--pastel-mint-strong: hsl(140 55% 65%)
--pastel-peach: hsl(25 85% 82%)          /* 피치 */
--pastel-sky: hsl(195 75% 80%)           /* 하늘색 */
```

### 그라데이션
```css
--gradient-dreamy: 핑크 → 라벤더 → 스카이
--gradient-sunset: 코랄 → 핑크 → 라벤더
--gradient-fresh: 민트 → 스카이 → 청록
```

## 🎭 버튼 스타일

### 파스텔 버튼 (MZ감성)
```tsx
// 핑크 버튼 - 주요 액션
<button className="btn-pastel-pink">📋 도면 열람</button>

// 라벤더 버튼 - 검색/조회
<button className="btn-pastel-lavender">🔍 조회</button>

// 민트 버튼 - 성공/완료
<button className="btn-pastel-mint">✅ 저장</button>
```

**특징:**
- 통통 튀는 hover 효과 (translateY + scale)
- 클릭 시 눌리는 애니메이션
- 부드러운 그림자와 둥근 모서리

## 🎪 애니메이션

### 로딩 - 귀여운 통통 점
```tsx
<div className="loading-dots">
  <span></span>
  <span></span>
  <span></span>
</div>
```
- 3개 점이 차례로 통통 튐
- 색상: 핑크 → 라벤더 → 민트

### 성공 메시지
```tsx
<div className="success-message">
  ✨ 저장 완료!
</div>
```
- 반짝이는 효과
- 민트 → 스카이 그라데이션

### 에러 메시지
```tsx
<div className="error-message">
  😅 앗! 오류가 발생했어요
</div>
```
- 부드러운 흔들림
- 코랄 → 핑크 그라데이션

## 🎴 카드 디자인

### 귀여운 카드
```tsx
<div className="card-cute">
  {/* 내용 */}
</div>
```

**특징:**
- hover 시 살랑살랑 떠오름
- 라벤더 테두리 나타남
- 부드러운 그림자

## 🏷️ 배지 & 태그

```tsx
<span className="badge-cute badge-pink">새로운</span>
<span className="badge-cute badge-lavender">진행중</span>
<span className="badge-cute badge-mint">완료</span>
```

## 📊 진행 바

### 무지개 그라데이션
```tsx
<div className="progress-rainbow">
  <div className="progress-rainbow-bar" style={{ width: '70%' }}></div>
</div>
```
- 핑크 → 라벤더 → 스카이 → 민트 → 코랄
- 반짝이는 shine 효과

## 🎯 사용 예시

### 품목 선택 컴포넌트
```tsx
<div className="card-cute">
  <h2>🎯 품목 선택</h2>

  <button className="btn-pastel-lavender">🔍 조회</button>
  <button className="btn-pastel-pink">📋 도면 열람</button>

  {loading && (
    <div className="loading-dots">
      <span></span><span></span><span></span>
    </div>
  )}

  {error && (
    <div className="error-message">
      😅 {error}
    </div>
  )}
</div>
```

## 💡 디자인 원칙

1. **이모지 활용** 🎯📋🔍✨
   - 버튼과 제목에 적절한 이모지 사용
   - 시각적 재미와 직관성 증가

2. **부드러운 곡선**
   - border-radius: 1.5rem 이상
   - 딱딱한 느낌 제거

3. **마이크로 인터랙션**
   - hover: 떠오름 + 확대
   - click: 눌림 효과
   - 모든 변화에 애니메이션

4. **재미있는 피드백**
   - "로딩 중..." → 통통 튀는 점
   - "성공" → 반짝임
   - "오류" → 흔들림

5. **여성친화 색상**
   - 파스텔 톤 중심
   - 차가운 블루 계열 최소화
   - 따뜻한 핑크/코랄 활용

## 🚀 적용 방법

1. 기존 `panel-card` → `card-cute`로 변경
2. 기존 `btn-primary` → `btn-pastel-pink/lavender/mint`
3. 로딩/에러 상태에 새 컴포넌트 적용
4. 제목에 이모지 추가

## ✅ 체크리스트

- [x] 파스텔 색상 팔레트 정의
- [x] 파스텔 버튼 스타일 구현
- [x] 마이크로 애니메이션 추가
- [x] 귀여운 로딩/성공/에러 메시지
- [x] 카드 호버 효과
- [x] 무지개 진행 바
- [ ] 모든 컴포넌트에 적용
- [ ] 아이콘 시스템 통합 (Lucide React)
