# 번들 최적화 분석 보고서

**작성일**: 2025-10-08
**프로젝트**: frontend-prediction
**Vite 버전**: 5.4.20

---

## 📊 현재 번들 상태

### 빌드 결과 (Production)
```
✓ 2394 modules transformed
✓ built in 1m 28s

dist/
├── index.html                    0.60 KB  (gzip: 0.37 KB)
├── assets/
│   ├── 4-BNPfQCk1.jpg           92.32 KB
│   ├── App-DQPxQJrH.css          1.80 KB  (gzip: 0.63 KB)
│   ├── index-Dk0AHtzM.css      125.84 KB  (gzip: 22.66 KB)
│   ├── ui-vendor-BABAaYaT.js    15.22 KB  (gzip: 3.57 KB)
│   ├── index-BjSftvbo.js        36.38 KB  (gzip: 11.76 KB)
│   ├── react-vendor-DsceW-4w.js 140.86 KB (gzip: 45.26 KB)
│   ├── reactflow-vendor-*.js   147.00 KB  (gzip: 48.08 KB)
│   └── App-*.js              1,100.79 KB  (gzip: 316.31 KB) ⚠️
└── Total                       ~1.7 MB
```

### ⚠️ 문제점
- **App-*.js**: 1.1MB (minified) → **500KB 권장값의 2.2배 초과**
- Rollup 경고: "Some chunks are larger than 500 kB after minification"

---

## 🔍 App 번들 구성 추정

### 주요 의존성 크기 (예상)
| 라이브러리 | 예상 크기 | gzip 크기 | 용도 |
|-----------|----------|-----------|------|
| **three.js** | ~600KB | ~150KB | Ballpit 3D 효과 (OGL 렌더러 포함) |
| **ogl** | ~80KB | ~25KB | WebGL 렌더링 (Ballpit 내부) |
| **@tanstack/react-query** | ~40KB | ~12KB | 데이터 fetching |
| **zustand** | ~15KB | ~5KB | 상태 관리 |
| **기타 UI/비즈니스 로직** | ~365KB | ~124KB | 컴포넌트, 유틸리티 |

**total**: ~1,100KB (gzip: ~316KB)

---

## 🎯 최적화 전략

### 전략 1: Three.js 지연 로딩 (Lazy Load) ⭐ 우선순위 높음
**문제**: Three.js + OGL이 초기 로딩 시 600KB+ 차지, 하지만 로그인 화면에서만 사용

**해결 방법**:
```typescript
// App.tsx - Before
import Ballpit from './components/effects/Ballpit';

// App.tsx - After
const Ballpit = lazy(() => import('./components/effects/Ballpit'));

<Suspense fallback={<div className="bg-slate-950" />}>
  <Ballpit />
</Suspense>
```

**예상 효과**:
- 초기 번들: 1,100KB → **500KB** (-55%)
- FCP (First Contentful Paint): 개선
- 로그인 화면 진입 시 Ballpit만 비동기 로드

---

### 전략 2: Code Splitting - 라우트별 분리
**문제**: 모든 워크스페이스 컴포넌트가 메인 번들에 포함

**해결 방법**:
```typescript
// App.tsx
const RoutingTabbedWorkspace = lazy(() => import('./components/workspaces/RoutingTabbedWorkspace'));
const MasterDataSimpleWorkspace = lazy(() => import('./components/workspaces/MasterDataSimpleWorkspace'));

// 사용자가 해당 워크스페이스 선택 시에만 로드
```

**예상 효과**:
- 초기 번들: 500KB → **350KB** (-30%)
- 각 워크스페이스: 별도 chunk (100-150KB)

---

### 전략 3: Tree Shaking 강화
**문제**: 미사용 exports가 번들에 포함될 수 있음

**해결 방법**:
1. `vite.config.ts`에 manualChunks 설정:
```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three-vendor': ['three', 'ogl'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'flow-vendor': ['reactflow', '@xyflow/react'],
        }
      }
    }
  }
});
```

2. 미사용 import 제거:
```bash
$ npx depcheck  # 미사용 의존성 검출
```

**예상 효과**:
- 캐싱 효율 증가 (vendor 변경 없으면 재다운로드 불필요)
- gzip 압축률 향상 (+5-10%)

---

### 전략 4: CSS 최적화
**현재 상태**:
- index.css: 125.84KB → 22.66KB (gzipped, 82% 압축)
- Tailwind CSS 전체 포함 가능성

**해결 방법**:
1. `tailwind.config.js`에서 purge 강화:
```javascript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [], // 동적 클래스 명시
};
```

2. 미사용 CSS 제거:
```bash
$ npx purgecss --css dist/**/*.css --content dist/**/*.html dist/**/*.js
```

**예상 효과**:
- CSS 크기: 125KB → **70KB** (-44%)

---

### 전략 5: Image 최적화
**현재 상태**:
- 4-BNPfQCk1.jpg: 92.32KB (압축되지 않음)

**해결 방법**:
1. WebP 변환:
```bash
$ npx @squoosh/cli --webp auto 4-*.jpg
```

2. `vite-plugin-imagemin` 추가:
```typescript
import viteImagemin from 'vite-plugin-imagemin';

plugins: [
  viteImagemin({
    gifsicle: { optimizationLevel: 7 },
    optipng: { optimizationLevel: 7 },
    mozjpeg: { quality: 75 },
    webp: { quality: 75 }
  })
]
```

**예상 효과**:
- 이미지 크기: 92KB → **40KB** (-57%)

---

## 📈 최적화 로드맵

### Phase 1: 즉시 적용 가능 (1-2시간)
1. ✅ Three.js/Ballpit 지연 로딩
2. ✅ 주요 워크스페이스 Code Splitting
3. ✅ Tailwind CSS purge 재확인

**예상 효과**: 초기 번들 1,100KB → **400KB** (-64%)

### Phase 2: 중기 개선 (1일)
1. ⭐ manualChunks 설정 (vendor 분리)
2. ⭐ 이미지 WebP 변환
3. ⭐ 미사용 의존성 제거

**예상 효과**: 총 번들 1.7MB → **1.0MB** (-41%)

### Phase 3: 고급 최적화 (1주)
1. 🔥 Dynamic import for all large components
2. 🔥 Prefetch/Preload 전략
3. 🔥 Service Worker (Workbox)

**예상 효과**: TTI 2초 이내, Lighthouse Performance 95+

---

## 🎯 목표 지표

| 지표 | 현재 | 목표 (Phase 1) | 목표 (Phase 2) |
|------|------|----------------|----------------|
| 초기 JS 번들 | 1,100KB | **400KB** | **350KB** |
| 총 번들 크기 | 1.7MB | 1.4MB | **1.0MB** |
| FCP | ~3.5s (추정) | **2.0s** | **1.5s** |
| TTI | ~5.0s (추정) | **3.0s** | **2.0s** |
| Lighthouse Performance | 70 (추정) | **85** | **95** |

---

## ✅ 다음 액션

### 즉시 시작 가능
1. [App.tsx](../../frontend-prediction/src/App.tsx:15) - Ballpit lazy import 추가
2. [vite.config.ts](../../frontend-prediction/vite.config.ts) - manualChunks 설정
3. 빌드 후 번들 크기 재측정

### 검증 방법
```bash
# 1. 빌드
npm run build

# 2. 번들 크기 확인
du -sh dist/assets/*.js

# 3. Lighthouse 측정
npx lighthouse http://localhost:5173 --view

# 4. Bundle Analyzer (선택)
npm install -D rollup-plugin-visualizer
# vite.config.ts에 visualizer() 추가 후 빌드
```

---

**작성자**: Claude Code Assistant
**다음 리뷰**: Phase 1 적용 후 결과 측정
