# 다크/라이트 테마 토글 가이드

## 개요

사용자가 라이트 모드와 다크 모드를 자유롭게 전환할 수 있는 테마 토글 기능입니다.

## 기능

- ✅ **라이트/다크 모드 전환**: 클릭 한 번으로 테마 변경
- ✅ **LocalStorage 저장**: 사용자 선호도 영구 저장
- ✅ **부드러운 전환**: CSS transition으로 자연스러운 효과
- ✅ **기본값 설정**: 현장 환경 고려하여 라이트 테마 기본
- ✅ **접근성**: ARIA 레이블 및 키보드 네비게이션 지원

## 파일 구조

### Prediction Frontend
```
frontend-prediction/
├── src/
│   ├── hooks/
│   │   └── useTheme.ts                # 테마 관리 훅
│   ├── components/
│   │   └── ThemeToggle.tsx            # 테마 토글 버튼
│   └── index.css                      # 라이트/다크 CSS 변수
```

### Training Frontend
```
frontend-training/
├── src/
│   ├── hooks/
│   │   └── useTheme.ts                # 테마 관리 훅
│   ├── components/
│   │   └── ThemeToggle.tsx            # 테마 토글 버튼
│   ├── index.css                      # 기본 CSS
│   └── theme-dark.css                 # 다크 테마 오버라이드
```

## 사용 방법

### 1. 기본 사용

#### App.tsx에서 테마 토글 버튼 추가

```tsx
import { ThemeToggle } from '@components/ThemeToggle';

function App() {
  return (
    <div className="app">
      {/* 헤더에 테마 토글 추가 */}
      <header>
        <h1>Routing ML</h1>
        <ThemeToggle variant="icon" size="md" />
      </header>

      {/* 나머지 앱 컨텐츠 */}
      <main>{/* ... */}</main>
    </div>
  );
}
```

### 2. 다양한 버튼 스타일

```tsx
// 아이콘만 (기본)
<ThemeToggle variant="icon" />

// 텍스트만
<ThemeToggle variant="text" />

// 아이콘 + 텍스트
<ThemeToggle variant="both" />

// 크기 조절
<ThemeToggle size="sm" />   // 작게
<ThemeToggle size="md" />   // 중간 (기본)
<ThemeToggle size="lg" />   // 크게
```

### 3. 네비게이션 바에 통합

```tsx
import { CompactThemeToggle } from '@components/ThemeToggle';

function NavigationBar() {
  return (
    <nav className="flex items-center justify-between p-4">
      <div className="logo">Logo</div>

      <div className="flex items-center gap-4">
        <a href="/dashboard">Dashboard</a>
        <a href="/settings">Settings</a>

        {/* 컴팩트 토글 */}
        <CompactThemeToggle />
      </div>
    </nav>
  );
}
```

### 4. 프로그래밍 방식으로 테마 제어

```tsx
import { useTheme } from '@hooks/useTheme';

function CustomComponent() {
  const { theme, setTheme, toggleTheme, isDark } = useTheme();

  const handleThemeChange = () => {
    // 특정 테마로 변경
    setTheme('dark');

    // 또는 토글
    toggleTheme();
  };

  return (
    <div>
      <p>현재 테마: {theme}</p>
      <p>다크 모드: {isDark ? 'Yes' : 'No'}</p>

      <button onClick={handleThemeChange}>
        테마 변경
      </button>
    </div>
  );
}
```

## API Reference

### useTheme Hook

```typescript
interface UseThemeReturn {
  /** 현재 테마 ('light' | 'dark') */
  theme: Theme;

  /** 테마를 특정 값으로 설정 */
  setTheme: (theme: Theme) => void;

  /** 테마 토글 (light ↔ dark) */
  toggleTheme: () => void;

  /** 다크 모드 여부 */
  isDark: boolean;

  /** 라이트 모드 여부 */
  isLight: boolean;
}
```

**사용 예시:**

```tsx
const { theme, toggleTheme, isDark } = useTheme();

// 조건부 렌더링
if (isDark) {
  return <DarkLogo />;
} else {
  return <LightLogo />;
}
```

### ThemeToggle Component

#### Props

```typescript
interface ThemeToggleProps {
  /** 버튼 크기 */
  size?: 'sm' | 'md' | 'lg';

  /** 버튼 스타일 */
  variant?: 'icon' | 'text' | 'both';

  /** 추가 CSS 클래스 */
  className?: string;
}
```

#### 예시

```tsx
<ThemeToggle
  variant="both"
  size="lg"
  className="ml-auto"
/>
```

### CompactThemeToggle Component

헤더/네비게이션용 작은 토글 버튼

```tsx
<CompactThemeToggle className="ml-4" />
```

## CSS 변수

### Prediction Frontend (index.css)

라이트 테마:
```css
:root {
  --bg-primary: #ffffff;
  --text-primary: #111827;
  --accent-primary: #0ea5e9;
  /* ... */
}
```

다크 테마:
```css
:root.dark {
  --bg-primary: #0a0e1a;
  --text-primary: #e4e7eb;
  --accent-primary: #0ea5e9;
  /* ... */
}
```

### Training Frontend (theme-dark.css)

```css
:root.dark {
  --background: hsl(220 20% 12%);
  --foreground: hsl(210 15% 90%);
  --card: hsl(220 18% 16%);
  /* ... */
}
```

## LocalStorage 키

테마 선택은 LocalStorage에 저장됩니다:

```
Key: 'routing-ml-theme'
Value: 'light' | 'dark'
```

**확인:**
```javascript
// 브라우저 콘솔에서
localStorage.getItem('routing-ml-theme'); // 'light' 또는 'dark'
```

**수동 설정:**
```javascript
localStorage.setItem('routing-ml-theme', 'dark');
location.reload(); // 페이지 새로고침
```

## 커스터마이징

### 1. 기본 테마 변경

`useTheme.ts`:

```typescript
// 다크 모드를 기본으로
const DEFAULT_THEME: Theme = 'dark';
```

### 2. 시스템 설정 따르기

기본적으로 비활성화되어 있습니다. 활성화하려면:

`useTheme.ts`:

```typescript
// 초기 테마 설정
const [theme, setThemeState] = useState<Theme>(() => {
  const stored = getStoredTheme();
  if (stored) return stored;

  // 시스템 설정 따르기
  return getSystemTheme(); // 이전: DEFAULT_THEME
});
```

### 3. 커스텀 CSS 변수 추가

`index.css`:

```css
:root {
  --my-custom-color: #ff6b6b;
}

:root.dark {
  --my-custom-color: #c92a2a;
}
```

사용:
```css
.my-element {
  background-color: var(--my-custom-color);
}
```

### 4. 커스텀 토글 버튼

```tsx
import { useTheme } from '@hooks/useTheme';

function MyCustomToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme}>
      {isDark ? '🌞 Light' : '🌚 Dark'}
    </button>
  );
}
```

## Training Frontend 통합

### main.tsx에 CSS import

```tsx
// Training Frontend의 main.tsx
import './index.css';
import './theme-dark.css'; // 다크 테마 추가
```

### App.tsx에 테마 토글 추가

```tsx
import { CompactThemeToggle } from '@components/ThemeToggle';

function App() {
  return (
    <>
      <NavigationBar>
        {/* 기존 네비게이션 내용 */}
        <CompactThemeToggle />
      </NavigationBar>

      {/* 나머지 앱 */}
    </>
  );
}
```

## 접근성 (Accessibility)

### 키보드 네비게이션

- **Tab**: 버튼에 포커스
- **Enter** / **Space**: 테마 토글

### ARIA 속성

```tsx
<button
  onClick={toggleTheme}
  aria-label="다크 모드로 전환"
  title="다크 모드로 전환"
>
  {/* ... */}
</button>
```

### 포커스 인디케이터

```css
.theme-toggle:focus {
  outline: none;
  ring: 2px solid var(--accent-primary);
  ring-offset: 2px;
}
```

## 트러블슈팅

### 문제 1: 테마가 저장되지 않음

**원인**: LocalStorage 비활성화 또는 권한 문제

**해결**:
```javascript
// 브라우저 콘솔에서 테스트
try {
  localStorage.setItem('test', 'test');
  localStorage.removeItem('test');
  console.log('✅ LocalStorage 작동');
} catch (e) {
  console.error('❌ LocalStorage 비활성화:', e);
}
```

### 문제 2: 페이지 로드 시 깜빡임

**원인**: 초기 테마 적용 지연

**해결**: `index.html`에 인라인 스크립트 추가

```html
<!-- index.html -->
<head>
  <script>
    // 페이지 로드 전 테마 적용
    (function() {
      const theme = localStorage.getItem('routing-ml-theme');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    })();
  </script>
</head>
```

### 문제 3: CSS 변수가 적용되지 않음

**원인**: Tailwind CSS가 CSS 변수를 덮어씀

**해결**: `tailwind.config.js`에서 다크 모드 설정

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class', // 'class' 모드 사용
  // ...
};
```

### 문제 4: Training Frontend에서 다크 테마 미적용

**원인**: `theme-dark.css` import 누락

**해결**: `main.tsx`에 import 추가

```tsx
import './theme-dark.css';
```

## 모범 사례

### 1. 일관된 테마 사용

모든 컴포넌트에서 CSS 변수 사용:

```css
/* ❌ 하드코딩된 색상 */
.card {
  background: #ffffff;
  color: #000000;
}

/* ✅ CSS 변수 사용 */
.card {
  background: var(--card);
  color: var(--card-foreground);
}
```

### 2. 조건부 스타일

```tsx
function Card() {
  const { isDark } = useTheme();

  return (
    <div className={isDark ? 'card-dark' : 'card-light'}>
      {/* ... */}
    </div>
  );
}
```

### 3. 이미지/로고 대응

```tsx
function Logo() {
  const { isDark } = useTheme();

  return (
    <img
      src={isDark ? '/logo-dark.svg' : '/logo-light.svg'}
      alt="Logo"
    />
  );
}
```

## 성능 최적화

### LocalStorage 캐싱

테마는 LocalStorage에 저장되어 서버 요청 없이 즉시 로드됩니다.

### CSS 변수 활용

JavaScript로 스타일 변경 대신 CSS 변수 사용으로 성능 향상:

```css
/* CSS 변수 전환만으로 모든 요소 업데이트 */
:root.dark {
  --bg: #000;
}
```

### Transition 최적화

```css
body {
  /* GPU 가속 속성만 전환 */
  transition: background-color 0.3s ease;
  /* transform, opacity 등은 제외 */
}
```

## 참고 자료

- [React useTheme Pattern](https://www.patterns.dev/posts/hooks-pattern)
- [CSS Custom Properties (Variables)](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [WCAG 2.1 Color Contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

## Changelog

- **2025-10-05**: 초기 구현 (라이트 기본, LocalStorage 저장)
- **Future**: 자동 스케줄 모드 (시간대별 자동 전환)
