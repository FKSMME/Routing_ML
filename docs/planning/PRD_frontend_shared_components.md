# PRD: Frontend Shared Components Module

**Document Version**: 1.0.0
**Date**: 2025-10-20
**Author**: Routing ML Team
**Status**: Draft
**Priority**: High (Priority 4 from Project Review)

---

## 📋 Executive Summary

### Problem Statement

현재 `frontend-prediction`과 `frontend-training` 프로젝트에 동일한 3D 배경 컴포넌트들이 중복되어 있어 다음과 같은 문제가 발생합니다:

1. **코드 중복**: 6개 이상의 컴포넌트가 두 프로젝트에 중복 존재
2. **유지보수 어려움**: 버그 수정이나 기능 개선 시 두 곳을 모두 수정해야 함
3. **일관성 부족**: 한쪽만 업데이트되어 동작이 달라질 위험
4. **번들 크기 증가**: 불필요한 코드 중복으로 빌드 크기 증가
5. **스타일 불일치**: CSS 파일도 중복되어 디자인 일관성 유지 어려움

### Proposed Solution

`frontend-shared` 패키지를 활성화하여 공용 3D 컴포넌트, 차트, 유틸리티를 중앙 집중화합니다.

### Success Metrics

- ✅ 코드 중복 제거: 6개 컴포넌트 통합
- ✅ 번들 크기 감소: 예상 10-15% 감소
- ✅ 개발 효율성: 컴포넌트 수정 시간 50% 단축
- ✅ 일관성: 두 프론트엔드에서 동일한 UX 제공

---

## 🎯 Background & Context

### Current Architecture

```
Routing_ML_251014/
├── frontend-prediction/
│   └── src/components/
│       ├── AnimatedLogo3D.tsx
│       ├── BackgroundControls.tsx
│       ├── FullScreen3DBackground.tsx
│       ├── Hyperspeed.tsx
│       ├── Hyperspeed.css
│       ├── HyperspeedBackground.tsx
│       ├── hyperspeedPresets.ts
│       └── ParticleBackground.tsx
│
├── frontend-training/
│   └── src/components/
│       ├── AnimatedLogo3D.tsx          (DUPLICATE)
│       ├── BackgroundControls.tsx      (DUPLICATE)
│       ├── FullScreen3DBackground.tsx  (DUPLICATE)
│       ├── Hyperspeed.tsx              (DUPLICATE)
│       ├── Hyperspeed.css              (DUPLICATE)
│       ├── HyperspeedBackground.tsx    (DUPLICATE)
│       ├── hyperspeedPresets.ts        (DUPLICATE)
│       └── ParticleBackground.tsx      (DUPLICATE)
│
└── frontend-shared/
    ├── package.json                    (EXISTS, empty src/)
    └── tsconfig.json
```

### Duplicate Components Analysis

| Component | Prediction (lines) | Training (lines) | Identical? | Priority |
|-----------|-------------------|------------------|------------|----------|
| Hyperspeed.tsx | 228 | 226 | No (slight diff) | High |
| Hyperspeed.css | 1955 bytes | 1955 bytes | Yes | High |
| hyperspeedPresets.ts | 3815 bytes | 3815 bytes | Yes | High |
| HyperspeedBackground.tsx | 1026 bytes | 1026 bytes | Yes | High |
| FullScreen3DBackground.tsx | 108 lines | 108 lines | Yes | High |
| AnimatedLogo3D.tsx | Unknown | Unknown | No | Medium |
| BackgroundControls.tsx | Unknown | Unknown | No | Medium |
| ParticleBackground.tsx | Unknown | Unknown | No | Medium |

### Dependencies

**Required for 3D Components**:
- `react` ^18.2.0
- `@react-three/fiber`
- `@react-three/drei`
- `three`
- `zustand` (for background settings store)

---

## 🔧 Functional Requirements

### FR-1: Shared Component Package

**Priority**: P0 (Must Have)

`frontend-shared` 패키지는 다음 구조를 가져야 합니다:

```
frontend-shared/
├── src/
│   ├── components/
│   │   ├── 3d/
│   │   │   ├── FullScreen3DBackground.tsx
│   │   │   ├── AnimatedLogo3D.tsx
│   │   │   ├── ParticleBackground.tsx
│   │   │   └── index.ts
│   │   ├── hyperspeed/
│   │   │   ├── Hyperspeed.tsx
│   │   │   ├── Hyperspeed.css
│   │   │   ├── HyperspeedBackground.tsx
│   │   │   ├── hyperspeedPresets.ts
│   │   │   └── index.ts
│   │   ├── controls/
│   │   │   ├── BackgroundControls.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── stores/
│   │   ├── backgroundSettings.ts
│   │   └── index.ts
│   ├── types/
│   │   ├── background.ts
│   │   └── index.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

### FR-2: Component Export Strategy

**Priority**: P0 (Must Have)

각 컴포넌트는 명시적으로 export되어야 합니다:

```typescript
// frontend-shared/src/index.ts
export * from './components/3d';
export * from './components/hyperspeed';
export * from './components/controls';
export * from './stores';
export * from './types';
```

### FR-3: Type Safety

**Priority**: P0 (Must Have)

모든 컴포넌트는 TypeScript로 작성되며 타입 정의를 export해야 합니다.

```typescript
// frontend-shared/src/types/background.ts
export interface BackgroundSettings {
  enabled: boolean;
  opacity: number;
  autoRotate: boolean;
  rotateSpeed: number;
  modelScale: number;
}

export interface HyperspeedPreset {
  name: string;
  starCount: number;
  speed: number;
  // ...
}
```

### FR-4: Store Integration

**Priority**: P0 (Must Have)

Background settings store를 공유:

```typescript
// frontend-shared/src/stores/backgroundSettings.ts
import { create } from 'zustand';
import { BackgroundSettings } from '../types';

export const useBackgroundSettings = create<BackgroundSettings>((set) => ({
  enabled: true,
  opacity: 0.3,
  autoRotate: true,
  rotateSpeed: 1.0,
  modelScale: 1.5,
  // ... setters
}));
```

### FR-5: CSS Bundling

**Priority**: P1 (Should Have)

CSS 파일은 컴포넌트와 함께 export되어야 합니다.

---

## 🎨 Non-Functional Requirements

### NFR-1: Performance

- **Bundle Size**: 공유 컴포넌트 사용 시 전체 번들 크기 10-15% 감소
- **Tree Shaking**: 사용하지 않는 컴포넌트는 번들에 포함되지 않음
- **Build Time**: 공유 패키지 빌드 시간 < 5초

### NFR-2: Developer Experience

- **Import Path**: `@routing-ml/shared` 경로로 간결한 import
- **Hot Reload**: 개발 모드에서 변경 시 즉시 반영
- **Type Support**: IDE 자동완성 및 타입 체크 지원

### NFR-3: Compatibility

- **React Version**: React 18.2.0 이상
- **TypeScript**: TypeScript 5.3.3 이상
- **Build Tools**: Vite, Webpack 모두 지원

### NFR-4: Maintainability

- **Documentation**: 각 컴포넌트에 JSDoc 주석
- **Examples**: Storybook 또는 예제 페이지 제공 (Phase 2)
- **Testing**: Unit tests for shared utilities (Phase 2)

---

## 📐 Implementation Plan

### Phase 1: Core 3D Components (Priority: High)

**Goal**: Hyperspeed와 FullScreen3DBackground 통합

**Tasks**:
1. ✅ Create `frontend-shared/src` directory structure
2. ✅ Extract Hyperspeed components
   - Hyperspeed.tsx
   - Hyperspeed.css
   - HyperspeedBackground.tsx
   - hyperspeedPresets.ts
3. ✅ Extract FullScreen3DBackground.tsx
4. ✅ Extract backgroundSettings store
5. ✅ Update package.json dependencies
6. ✅ Configure TypeScript paths in consuming projects
7. ✅ Update imports in frontend-prediction
8. ✅ Update imports in frontend-training
9. ✅ Test both projects
10. ✅ Remove duplicate files

**Estimated Time**: 2-3 hours

**Success Criteria**:
- Both frontends build successfully
- 3D backgrounds work identically in both
- No TypeScript errors
- Bundle size reduced

### Phase 2: Additional Components (Priority: Medium)

**Goal**: AnimatedLogo3D, ParticleBackground, BackgroundControls

**Tasks**:
1. Extract AnimatedLogo3D.tsx
2. Extract ParticleBackground.tsx
3. Extract BackgroundControls.tsx
4. Add component documentation
5. Test and verify

**Estimated Time**: 1-2 hours

### Phase 3: Optimization & Documentation (Priority: Low)

**Goal**: Developer experience and performance

**Tasks**:
1. Add Storybook for component preview
2. Add unit tests for shared utilities
3. Optimize bundle splitting
4. Create migration guide
5. Add CHANGELOG.md

**Estimated Time**: 2-3 hours

---

## 🚧 Technical Design

### Dependency Configuration

**frontend-shared/package.json**:
```json
{
  "name": "@routing-ml/shared",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "react": "^18.2.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.88.0",
    "three": "^0.158.0",
    "zustand": "^4.4.0"
  },
  "peerDependencies": {
    "react": "^18.2.0"
  }
}
```

### Path Alias Configuration

**frontend-prediction/tsconfig.json** & **frontend-training/tsconfig.json**:
```json
{
  "compilerOptions": {
    "paths": {
      "@routing-ml/shared": ["../frontend-shared/src"],
      "@routing-ml/shared/*": ["../frontend-shared/src/*"]
    }
  }
}
```

**frontend-prediction/vite.config.ts** & **frontend-training/vite.config.ts**:
```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@routing-ml/shared': path.resolve(__dirname, '../frontend-shared/src'),
    },
  },
});
```

### Import Examples

**Before** (Duplicate):
```typescript
// frontend-prediction/src/App.tsx
import { FullScreen3DBackground } from './components/FullScreen3DBackground';
import { HyperspeedBackground } from './components/HyperspeedBackground';
```

**After** (Shared):
```typescript
// frontend-prediction/src/App.tsx
import { FullScreen3DBackground, HyperspeedBackground } from '@routing-ml/shared';
```

---

## 🧪 Testing Strategy

### Phase 1 Testing

1. **Build Verification**:
   ```bash
   cd frontend-prediction && npm run build
   cd frontend-training && npm run build
   ```

2. **Visual Testing**:
   - Start both frontends
   - Verify 3D backgrounds render identically
   - Test background controls
   - Test hyperspeed effects

3. **Bundle Analysis**:
   ```bash
   npm run build -- --mode analyze
   ```

### Phase 2 Testing

1. **Component Unit Tests**:
   - Test background settings store
   - Test preset configurations
   - Test component props

2. **Integration Tests**:
   - Test in both prediction and training apps
   - Test with different configurations

---

## ⚠️ Risk Assessment

### Risk 1: Import Path Resolution

**Probability**: Medium
**Impact**: High
**Mitigation**:
- Test both relative and alias imports
- Document configuration clearly
- Provide troubleshooting guide

### Risk 2: CSS Bundling Issues

**Probability**: Medium
**Impact**: Medium
**Mitigation**:
- Test CSS import in both Vite projects
- Use CSS modules if conflicts occur
- Document CSS import best practices

### Risk 3: Version Conflicts

**Probability**: Low
**Impact**: Medium
**Mitigation**:
- Use exact versions in peerDependencies
- Document required versions
- Test with lock files

### Risk 4: Breaking Existing Features

**Probability**: Low
**Impact**: High
**Mitigation**:
- Thorough visual testing before deployment
- Keep duplicates until verified
- Gradual rollout (one component at a time)

---

## 📊 Success Metrics

### Quantitative Metrics

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| Duplicate Components | 8 files | 0 files | File count |
| Bundle Size (Prediction) | ~1.95 MB | ~1.70 MB | Build output |
| Bundle Size (Training) | ~2.91 MB | ~2.50 MB | Build output |
| Maintenance Time | 2x effort | 1x effort | Developer survey |
| Type Safety Errors | Unknown | 0 errors | TypeScript check |

### Qualitative Metrics

- ✅ Developers can import shared components easily
- ✅ Visual consistency between frontends
- ✅ Hot reload works in development
- ✅ Documentation is clear and complete

---

## 🔗 Related Documents

- [Project Review 2025-10-20](../reports/2025-10-20-0740-routing-ml-project-review.md)
- [Phase 1 Backend Test Fixes](./PRD_backend_test_fixes.md)
- Frontend Architecture (TBD)
- Component Library Guidelines (TBD)

---

## 📝 Appendices

### Appendix A: Component Inventory

**3D Components**:
1. FullScreen3DBackground.tsx - Main 3D background with GLTF model
2. AnimatedLogo3D.tsx - 3D animated logo
3. ParticleBackground.tsx - Particle effect background

**Hyperspeed Components**:
4. Hyperspeed.tsx - Main hyperspeed component (228 lines)
5. Hyperspeed.css - Hyperspeed styles (1955 bytes)
6. HyperspeedBackground.tsx - Background wrapper (1026 bytes)
7. hyperspeedPresets.ts - Configuration presets (3815 bytes)

**Control Components**:
8. BackgroundControls.tsx - UI controls for background settings

**Stores**:
9. @store/backgroundSettings - Zustand store for settings

### Appendix B: Migration Checklist

**For Each Component**:
- [ ] Copy to frontend-shared/src
- [ ] Update imports (remove relative paths)
- [ ] Export in index.ts
- [ ] Update consuming files
- [ ] Test in both projects
- [ ] Remove duplicates
- [ ] Update documentation

### Appendix C: Rollback Plan

If integration fails:
1. Revert tsconfig.json changes
2. Revert vite.config.ts changes
3. Restore import statements
4. Keep duplicate files
5. Git revert commits

Time to rollback: < 15 minutes

---

**Document Status**: Ready for Implementation
**Next Steps**: Create TASKLIST and begin Phase 1
**Approver**: Routing ML Team
**Last Updated**: 2025-10-20
