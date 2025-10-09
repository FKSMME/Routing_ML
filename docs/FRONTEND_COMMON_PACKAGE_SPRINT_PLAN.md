# Frontend Common Package - Sprint Implementation Plan

**Project**: Routing ML System
**Sprint Type**: Frontend Refactoring
**Estimated Duration**: 2-3 days (16-24 hours)
**Priority**: Medium (Deferred from Phase 3.1)
**Status**: 📋 Planning Phase

---

## 📊 Executive Summary

### Current State
- **3 separate frontend projects**: frontend-prediction, frontend-training, frontend-home
- **Estimated code duplication**: 4,000+ LOC across projects
- **Empty scaffold exists**: `frontend-shared/` directory with package.json

### Target State
- **Single source of truth**: `@routing-ml/shared` npm package
- **Shared components**: Common UI, hooks, utilities, types
- **Reduced duplication**: Estimated 30-40% code reduction
- **Improved maintainability**: Single update propagates to all frontends

### Success Metrics
- ✅ Zero regression (all existing tests pass)
- ✅ Build time reduction: <10% increase acceptable
- ✅ Bundle size: No increase (tree-shaking verified)
- ✅ TypeScript: 0 errors across all projects
- ✅ Developer experience: Clear import paths (`@routing-ml/shared`)

---

## 🎯 Sprint Objectives

### Primary Goals
1. Extract common components, hooks, and utilities into `frontend-shared`
2. Configure build tooling for package consumption
3. Update frontend-prediction and frontend-training to use shared package
4. Maintain 100% backward compatibility
5. Document shared package usage and contribution guidelines

### Non-Goals (Out of Scope)
- ❌ Design system changes (use existing components as-is)
- ❌ Performance optimization (maintain current performance)
- ❌ New features (refactoring only)
- ❌ Frontend-home migration (simple static site, low value)

---

## 📦 Package Structure

### frontend-shared Directory Layout

```
frontend-shared/
├── package.json                    # Package configuration
├── tsconfig.json                   # TypeScript config
├── vite.config.ts                  # Build configuration (NEW)
├── README.md                       # Usage documentation (NEW)
├── CHANGELOG.md                    # Version history (NEW)
├── src/
│   ├── index.ts                    # Main export file
│   ├── components/                 # Shared React components
│   │   ├── index.ts
│   │   ├── common/                 # Common UI components
│   │   │   ├── CardShell.tsx
│   │   │   ├── DialogContainer.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── navigation/             # Navigation components
│   │   │   ├── MainNavigation.tsx
│   │   │   └── ResponsiveNavigationDrawer.tsx
│   │   └── layout/                 # Layout components
│   │       └── WorkspaceLayout.tsx
│   ├── hooks/                      # Shared React hooks
│   │   ├── index.ts
│   │   ├── useResponsiveNav.ts
│   │   ├── usePersistence.ts
│   │   └── useApiClient.ts
│   ├── lib/                        # Utility functions
│   │   ├── index.ts
│   │   ├── classNames.ts
│   │   ├── formatters.ts
│   │   └── validators.ts
│   ├── types/                      # Shared TypeScript types
│   │   ├── index.ts
│   │   ├── common.ts
│   │   ├── api.ts
│   │   └── routing.ts
│   ├── styles/                     # Shared styles/theme
│   │   ├── index.ts
│   │   ├── theme.ts
│   │   └── responsive.ts
│   └── constants/                  # Shared constants
│       ├── index.ts
│       └── config.ts
├── dist/                           # Build output (gitignored)
└── node_modules/                   # Dependencies (gitignored)
```

---

## 🔍 Code Audit & Extraction Plan

### Phase 1: Analysis (2 hours)

#### 1.1 Identify Common Components
**Task**: Scan both frontends for duplicate components

**Method**:
```bash
# Find duplicate component names
find frontend-prediction/src/components -name "*.tsx" | xargs basename -a | sort | uniq -d
find frontend-training/src/components -name "*.tsx" | xargs basename -a | sort | uniq -d

# Compare file contents for similarity
diff -rq frontend-prediction/src/components/common/ frontend-training/src/components/common/
```

**Expected Duplicates** (preliminary analysis):
- `CardShell.tsx` (both projects)
- `DialogContainer.tsx` (both projects)
- `MainNavigation.tsx` (similar implementations)
- `HeroBanner.tsx` (both projects)
- Layout wrappers and containers

#### 1.2 Identify Common Hooks
**Expected Shared Hooks**:
- `useResponsiveNav` (navigation state management)
- `usePersistence` (localStorage/IndexedDB)
- `useApiClient` (axios wrapper with auth)
- `useDebounce` (input debouncing)

#### 1.3 Identify Common Utilities
**Expected Shared Utils**:
- `classNames.ts` (Tailwind class merging)
- `formatters.ts` (date, number formatting)
- `validators.ts` (form validation)
- `api.ts` (API client configuration)

#### 1.4 Identify Common Types
**Expected Shared Types**:
- `auth.ts` (User, AuthState)
- `api.ts` (ApiResponse, ErrorResponse)
- `common.ts` (Nullable, Optional, etc.)

---

### Phase 2: Package Setup (3 hours)

#### 2.1 Configure Build System
**File**: `frontend-shared/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      include: ['src/**/*'],
      exclude: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'RoutingMLShared',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'axios'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          axios: 'axios',
        },
      },
    },
    sourcemap: true,
    minify: false, // Keep readable for debugging
  },
});
```

#### 2.2 Update package.json
**File**: `frontend-shared/package.json`

```json
{
  "name": "@routing-ml/shared",
  "version": "1.0.0",
  "description": "Shared components and utilities for Routing ML frontends",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./components": {
      "import": "./dist/components/index.mjs",
      "require": "./dist/components/index.cjs",
      "types": "./dist/components/index.d.ts"
    },
    "./hooks": {
      "import": "./dist/hooks/index.mjs",
      "require": "./dist/hooks/index.cjs",
      "types": "./dist/hooks/index.d.ts"
    },
    "./lib": {
      "import": "./dist/lib/index.mjs",
      "require": "./dist/lib/index.cjs",
      "types": "./dist/lib/index.d.ts"
    }
  },
  "files": [
    "dist",
    "src",
    "README.md",
    "CHANGELOG.md"
  ],
  "scripts": {
    "build": "vite build",
    "watch": "vite build --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "test": "vitest",
    "prepublishOnly": "npm run build"
  },
  "peerDependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "dependencies": {
    "axios": "^1.6.7",
    "clsx": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.11",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.0",
    "vite-plugin-dts": "^3.7.0",
    "vitest": "^1.2.0"
  }
}
```

#### 2.3 Configure TypeScript
**File**: `frontend-shared/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@routing-ml/shared": ["./src/index.ts"],
      "@routing-ml/shared/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx"]
}
```

---

### Phase 3: Component Extraction (6 hours)

#### 3.1 Priority 1: Common UI Components (2 hours)
**Components to extract**:
1. `CardShell.tsx` - Used in 20+ locations
2. `DialogContainer.tsx` - Used in 15+ locations
3. `LoadingSpinner.tsx` - Used in 10+ locations
4. `ErrorBoundary.tsx` - Used in app roots

**Extraction Process** (per component):
1. Copy from frontend-prediction (reference implementation)
2. Remove project-specific dependencies
3. Add prop types and JSDoc
4. Create barrel export in `src/components/index.ts`
5. Build and verify type generation
6. Update frontend-prediction to import from shared
7. Run tests to verify no regression
8. Update frontend-training to import from shared
9. Run tests again

**Example Migration**:
```typescript
// BEFORE (frontend-prediction/src/components/common/CardShell.tsx)
import { ReactNode } from 'react';

export function CardShell({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

// AFTER (frontend-shared/src/components/common/CardShell.tsx)
import { ReactNode } from 'react';

export interface CardShellProps {
  /** Card content */
  children: ReactNode;
  /** Card title */
  title?: string;
  /** Additional CSS classes */
  className?: string;
  /** Card variant */
  variant?: 'default' | 'bordered' | 'elevated';
}

/**
 * Shared card container component
 * @example
 * <CardShell title="My Card" variant="elevated">
 *   <p>Content here</p>
 * </CardShell>
 */
export function CardShell({
  children,
  title,
  className = '',
  variant = 'default'
}: CardShellProps) {
  return (
    <div className={`card card--${variant} ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
}

// MIGRATION (frontend-prediction/src/components/SomeComponent.tsx)
// Before:
import { CardShell } from '@components/common/CardShell';

// After:
import { CardShell } from '@routing-ml/shared/components';
```

#### 3.2 Priority 2: Hooks (2 hours)
**Hooks to extract**:
1. `useResponsiveNav.ts` - Navigation state
2. `usePersistence.ts` - localStorage wrapper
3. `useDebounce.ts` - Input debouncing
4. `useApiClient.ts` - Axios wrapper

**Testing Requirements**:
- Each hook must have a Vitest test
- Test file: `src/hooks/__tests__/useHookName.test.ts`
- Verify behavior in both frontends after migration

#### 3.3 Priority 3: Utilities & Types (2 hours)
**Utilities**:
- `classNames.ts` (or use `clsx` package)
- `formatters.ts`
- `validators.ts`
- `api.ts`

**Types**:
- `common.ts`
- `api.ts`
- `auth.ts`

**Type Safety**:
- Ensure strict mode enabled
- No `any` types allowed
- Export all public interfaces

---

### Phase 4: Consumer Integration (4 hours)

#### 4.1 Link Shared Package Locally
**During Development**:
```bash
# In frontend-shared/
npm run build
npm link

# In frontend-prediction/
npm link @routing-ml/shared

# In frontend-training/
npm link @routing-ml/shared
```

#### 4.2 Update Import Paths
**Tool**: Use VS Code find-and-replace with regex

**Frontend Prediction Migrations**:
```bash
# Find all imports from common components
grep -r "from '@components/common" frontend-prediction/src/

# Replace with shared package
# Before: import { CardShell } from '@components/common/CardShell'
# After:  import { CardShell } from '@routing-ml/shared/components'
```

**Automated Refactoring Script** (optional):
```bash
# scripts/migrate-to-shared.sh
#!/bin/bash

# Replace component imports
find frontend-prediction/src -name "*.tsx" -type f -exec sed -i \
  "s|from '@components/common/\(.*\)'|from '@routing-ml/shared/components'|g" {} +

# Replace hook imports
find frontend-prediction/src -name "*.tsx" -type f -exec sed -i \
  "s|from '@hooks/\(.*\)'|from '@routing-ml/shared/hooks'|g" {} +

# Replace lib imports
find frontend-prediction/src -name "*.ts" -type f -exec sed -i \
  "s|from '@lib/\(.*\)'|from '@routing-ml/shared/lib'|g" {} +
```

#### 4.3 Update Build Configurations
**frontend-prediction/vite.config.ts**:
```typescript
export default defineConfig({
  resolve: {
    alias: {
      '@routing-ml/shared': path.resolve(__dirname, '../frontend-shared/src'),
    },
  },
  // ... rest of config
});
```

**frontend-prediction/tsconfig.json**:
```json
{
  "compilerOptions": {
    "paths": {
      "@routing-ml/shared": ["../frontend-shared/src/index.ts"],
      "@routing-ml/shared/*": ["../frontend-shared/src/*"]
    }
  }
}
```

---

### Phase 5: Testing & Validation (3 hours)

#### 5.1 Unit Tests
**Shared Package Tests**:
```bash
cd frontend-shared
npm test
# Expect: All component/hook tests pass
```

**Frontend Prediction Tests**:
```bash
cd frontend-prediction
npm test -- --run
# Expect: All 5 component tests pass
```

**Frontend Training Tests**:
```bash
cd frontend-training
npm test -- --run
# Expect: All tests pass
```

#### 5.2 E2E Tests
```bash
cd frontend-prediction
npm run test:e2e
# Expect: All 7 Playwright specs pass
```

#### 5.3 Build Verification
```bash
# Build all projects
cd frontend-shared && npm run build
cd ../frontend-prediction && npm run build
cd ../frontend-training && npm run build

# Verify bundle sizes
ls -lh frontend-prediction/dist/
ls -lh frontend-training/dist/

# Check for bundle size increase
# Acceptable: <10% increase
# Expected: Slight decrease due to shared chunks
```

#### 5.4 TypeScript Verification
```bash
cd frontend-prediction && npx tsc --noEmit
cd ../frontend-training && npx tsc --noEmit
cd ../frontend-shared && npx tsc --noEmit

# Expect: 0 errors across all projects
```

---

## 📋 Day-by-Day Sprint Plan

### Day 1: Setup & Analysis (8 hours)

**Morning (4h)**:
- [ ] Code audit (identify all duplicates)
- [ ] Create detailed extraction list
- [ ] Set up frontend-shared build configuration
- [ ] Configure TypeScript & linting

**Afternoon (4h)**:
- [ ] Extract Priority 1 components (CardShell, DialogContainer)
- [ ] Write component tests
- [ ] Build and verify type generation
- [ ] Create initial documentation

**Deliverable**: Working shared package with 2 components

---

### Day 2: Component Extraction & Integration (8 hours)

**Morning (4h)**:
- [ ] Extract remaining common components
- [ ] Extract shared hooks
- [ ] Extract utilities and types
- [ ] Update barrel exports

**Afternoon (4h)**:
- [ ] Migrate frontend-prediction imports
- [ ] Run all frontend-prediction tests
- [ ] Fix any breaking changes
- [ ] Verify build output

**Deliverable**: frontend-prediction using shared package

---

### Day 3: Final Integration & Validation (8 hours)

**Morning (4h)**:
- [ ] Migrate frontend-training imports
- [ ] Run all frontend-training tests
- [ ] Fix any breaking changes
- [ ] E2E test verification

**Afternoon (4h)**:
- [ ] Final build verification (all projects)
- [ ] Bundle size analysis
- [ ] Documentation completion
- [ ] Create CHANGELOG.md
- [ ] Git commit and push

**Deliverable**: All frontends using shared package, all tests passing

---

## 🧪 Testing Strategy

### Regression Testing Checklist

**Before Migration**:
- [ ] Screenshot all pages (Playwright)
- [ ] Record bundle sizes
- [ ] Document current test results
- [ ] Backup current working branch

**During Migration**:
- [ ] Run tests after each component migration
- [ ] Verify TypeScript compilation
- [ ] Check for console errors
- [ ] Validate visual appearance

**After Migration**:
- [ ] Compare screenshots (visual regression)
- [ ] Compare bundle sizes
- [ ] Run full test suite
- [ ] Manual smoke testing

### Test Coverage Requirements

| Area | Metric | Target |
|------|--------|--------|
| Shared Components | Unit test coverage | 80%+ |
| Shared Hooks | Unit test coverage | 90%+ |
| Utilities | Unit test coverage | 100% |
| Integration | Frontend tests pass | 100% |
| E2E | Playwright specs pass | 100% |

---

## 📚 Documentation Requirements

### README.md (frontend-shared)

```markdown
# @routing-ml/shared

Shared components, hooks, and utilities for Routing ML frontend applications.

## Installation

```bash
# For local development (monorepo)
npm link @routing-ml/shared

# For production
npm install @routing-ml/shared
```

## Usage

### Components
```typescript
import { CardShell, DialogContainer } from '@routing-ml/shared/components';

function MyComponent() {
  return (
    <CardShell title="My Card" variant="elevated">
      <p>Content</p>
    </CardShell>
  );
}
```

### Hooks
```typescript
import { useResponsiveNav, usePersistence } from '@routing-ml/shared/hooks';

function MyComponent() {
  const { isOpen, toggle } = useResponsiveNav();
  const [data, setData] = usePersistence('key', defaultValue);
  // ...
}
```

### Utilities
```typescript
import { classNames, formatDate } from '@routing-ml/shared/lib';

const classes = classNames('base', { active: isActive });
const formatted = formatDate(new Date());
```

## Development

```bash
# Build
npm run build

# Watch mode
npm run watch

# Type check
npm run typecheck

# Test
npm test
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)
```

### CHANGELOG.md

```markdown
# Changelog

## [1.0.0] - 2025-10-09

### Added
- Initial release of @routing-ml/shared package
- Common UI components (CardShell, DialogContainer, LoadingSpinner)
- Shared hooks (useResponsiveNav, usePersistence, useDebounce)
- Utility functions (classNames, formatters, validators)
- Shared TypeScript types

### Migration
- Extracted from frontend-prediction and frontend-training
- Estimated 4,000+ LOC code reduction
- Zero breaking changes (100% backward compatible)
```

---

## 🚨 Risk Management

### High Risk: Breaking Changes

**Risk**: Import path changes break existing code
**Mitigation**:
- Gradual migration (one component at a time)
- Maintain backward compatibility aliases
- Comprehensive test coverage
- Automated refactoring scripts

**Rollback Plan**:
```bash
# Revert to previous commit
git reset --hard HEAD~1

# Or restore from backup branch
git checkout backup-before-shared-package
```

---

### Medium Risk: Bundle Size Increase

**Risk**: Importing entire shared package increases bundle size
**Mitigation**:
- Tree-shaking verification
- Named exports only (no default exports)
- Subpath exports (`/components`, `/hooks`)
- Bundle analyzer in CI

**Verification**:
```bash
# Analyze bundle
npm run build -- --analyze

# Compare before/after
du -h frontend-prediction/dist/ | grep total
```

---

### Low Risk: Type Errors

**Risk**: TypeScript errors after migration
**Mitigation**:
- Strict type checking in shared package
- Pre-migration type audit
- CI pipeline type checking

---

## ✅ Definition of Done

### Checklist

- [ ] All shared components extracted and tested
- [ ] All shared hooks extracted and tested
- [ ] All utilities and types extracted
- [ ] frontend-prediction migrated (0 TypeScript errors)
- [ ] frontend-training migrated (0 TypeScript errors)
- [ ] All unit tests passing (56/56 backend, 5+ frontend)
- [ ] All E2E tests passing (7/7 Playwright specs)
- [ ] Bundle size verified (<10% increase)
- [ ] Documentation complete (README, CHANGELOG, JSDoc)
- [ ] Code review completed
- [ ] Git commits pushed to branch
- [ ] PR created with migration summary

---

## 🔗 Related Documents

- [FRONTEND_TESTING_GUIDE.md](./FRONTEND_TESTING_GUIDE.md)
- [CI_CD_PIPELINE.md](./CI_CD_PIPELINE.md) (to be created)
- [WORK_LOG_2025-10-09_FINAL_COMPLETION.md](./WORK_LOG_2025-10-09_FINAL_COMPLETION.md)

---

**Status**: 📋 Ready for Sprint Kickoff
**Next Step**: Allocate 2-3 day sprint and begin Phase 1 (Analysis)
**Estimated ROI**: 30-40% code reduction, improved maintainability, faster feature development
