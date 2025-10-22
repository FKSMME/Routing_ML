# ESLint Violation Analysis - ERP Drawing Viewer Integration

**Date**: 2025-10-22
**Context**: Phase 2 완료 후 ESLint 검증
**Related**: PRD_2025-10-22_erp-drawing-viewer-integration.md

---

## Executive Summary

ERP Drawing Viewer Integration Phase 2 완료 후 ESLint 검증 결과, 프로젝트 전체에서 **106개의 위반 사항**이 발견되었습니다. 새로 추가된 코드는 ESLint 규칙을 준수하지만, 기존 프로젝트 코드에 개선이 필요합니다.

**주요 지표**:
- Total Files: 140
- Files with Violations: 43 (30.7%)
- Total Errors: 86
- Total Warnings: 20
- **Total Violations: 106**

---

## Quantitative Metrics

### Overall Statistics

| Metric | Count | Percentage |
|--------|-------|------------|
| Total Files | 140 | 100% |
| Clean Files | 97 | 69.3% |
| Files with Errors | 33 | 23.6% |
| Files with Warnings | 10 | 7.1% |
| Total Errors | 86 | 81.1% of violations |
| Total Warnings | 20 | 18.9% of violations |

### Violation Distribution by Severity

```
Errors:   ████████████████████████████████████████████████ 81.1% (86)
Warnings: ██████████ 18.9% (20)
```

### Top Violation Rules (Top 4 = 100% of violations)

| Rule | Total | Errors | Warnings | % of Total |
|------|-------|--------|----------|------------|
| @typescript-eslint/no-unused-vars | 42 | 42 | 0 | 39.6% |
| @typescript-eslint/no-explicit-any | 41 | 41 | 0 | 38.7% |
| react-hooks/exhaustive-deps | 20 | 0 | 20 | 18.9% |
| simple-import-sort/imports | 3 | 3 | 0 | 2.8% |
| **Total** | **106** | **86** | **20** | **100%** |

---

## Detailed Analysis

### 1. @typescript-eslint/no-unused-vars (42 errors, 39.6%)

**Description**: Unused variables, imports, or parameters detected

**Impact**:
- Code bloat (unused imports increase bundle size)
- Maintenance overhead (confusing dead code)
- Potential bugs (unused variables may indicate incomplete implementation)

**Examples**:
```typescript
// Unused import
import { SomeUnusedComponent } from './components';

// Unused variable
const unusedVariable = calculateSomething();

// Unused function parameter
function handleClick(event: MouseEvent, unusedParam: string) {
  console.log(event);
}
```

**Fix Strategy**:
- Remove unused imports
- Remove unused variables
- Prefix intentionally unused parameters with `_` (e.g., `_unusedParam`)
- Use `// eslint-disable-next-line` for intentional unused vars (rare cases)

**Priority**: HIGH (affects bundle size)

---

### 2. @typescript-eslint/no-explicit-any (41 errors, 38.7%)

**Description**: Explicit `any` type usage detected

**Impact**:
- Loss of type safety (defeats TypeScript purpose)
- Runtime errors not caught at compile time
- Poor IDE autocomplete/IntelliSense
- Maintenance difficulty (unclear data structures)

**Examples**:
```typescript
// Bad: explicit any
function handleData(data: any) {
  return data.someProperty; // No type checking!
}

// Good: specific type
interface DataStructure {
  someProperty: string;
}
function handleData(data: DataStructure) {
  return data.someProperty; // Type-safe!
}
```

**Fix Strategy**:
- Define proper interfaces/types for data structures
- Use `unknown` type for truly unknown data, then narrow with type guards
- Use generics for flexible but type-safe functions
- Use `Record<string, unknown>` for object maps

**Priority**: MEDIUM (affects type safety)

---

### 3. react-hooks/exhaustive-deps (20 warnings, 18.9%)

**Description**: React Hook dependencies missing or incorrect

**Impact**:
- Stale closures (using old values)
- Missed re-renders (UI not updating)
- Infinite re-render loops (when dependencies added incorrectly)
- Subtle bugs in state management

**Examples**:
```typescript
// Bad: missing dependency
useEffect(() => {
  fetchData(itemCode); // itemCode not in deps!
}, []);

// Good: complete dependencies
useEffect(() => {
  fetchData(itemCode);
}, [itemCode]);

// Alternative: useCallback for stable references
const fetchDataCallback = useCallback(() => {
  fetchData(itemCode);
}, [itemCode]);

useEffect(() => {
  fetchDataCallback();
}, [fetchDataCallback]);
```

**Fix Strategy**:
- Add missing dependencies to dependency array
- Use `useCallback` to stabilize function references
- Split effects with different dependencies
- Use `// eslint-disable-next-line` ONLY if genuinely intentional (document why)

**Priority**: HIGH (affects correctness)

---

### 4. simple-import-sort/imports (3 errors, 2.8%)

**Description**: Import statements not sorted according to project conventions

**Impact**:
- Inconsistent code style
- Harder to find imports in large files
- Merge conflicts in import sections

**Fix Strategy**:
- Run `npm run lint -- --fix` to auto-sort
- Configure editor to sort on save

**Priority**: LOW (cosmetic, auto-fixable)

---

## New Code Analysis (Phase 2)

### Files Added in Phase 2

1. `DrawingViewerButton.tsx` ✅ CLEAN
2. `DrawingViewerSettings.tsx` ✅ CLEAN
3. `useDrawingViewerSettings.ts` ✅ CLEAN
4. `erpViewerUrl.ts` ✅ CLEAN
5. `apiClient.ts` (modified) ✅ CLEAN

**Result**: 새로 추가된 모든 코드는 ESLint 규칙을 100% 준수합니다.

---

## Impact Assessment

### Critical (Fix Before Phase 3)
- None in new code ✅

### High Priority (Fix in Phase 4)
- `react-hooks/exhaustive-deps` warnings (20) - May cause runtime bugs
- `@typescript-eslint/no-unused-vars` in new integration files (if any)

### Medium Priority (Fix Post-Launch)
- `@typescript-eslint/no-explicit-any` in existing codebase (41)
- `@typescript-eslint/no-unused-vars` in existing codebase (42)

### Low Priority (Cleanup)
- `simple-import-sort/imports` (3) - Auto-fixable

---

## Improvement Roadmap

### Phase 3: Integration (Current Phase)
**Action**:
- Ensure new integration code remains ESLint-clean
- Add pre-commit hook check for new files
- Monitor for new violations

**Success Criteria**:
- Zero new ESLint errors introduced
- Integration files pass `npm run lint`

### Phase 4: Polish & Documentation
**Action**:
- Fix ESLint violations in modified files only
- Focus on `react-hooks/exhaustive-deps` warnings
- Document any intentional rule suppressions

**Estimated Effort**: 30-60 minutes

### Post-Launch: Project-Wide Cleanup (Separate PRD)
**Scope**: Fix all 106 violations across project

**Phases**:
1. Auto-fix: `simple-import-sort/imports` (3 violations)
2. Remove unused vars: `no-unused-vars` (42 violations)
3. Type safety: `no-explicit-any` (41 violations)
4. Hook deps: `exhaustive-deps` (20 warnings)

**Estimated Effort**: 4-6 hours
**Priority**: Medium (schedule after current feature launch)

---

## Recommendations

### Immediate (Phase 3-4)
1. ✅ Maintain ESLint compliance for all new code
2. ⚠️ Fix `react-hooks/exhaustive-deps` in integration code (if any)
3. 📝 Add ESLint check to Phase 4 checklist

### Short-term (Post-Launch)
1. Create separate PRD for ESLint project cleanup
2. Run `npm run lint -- --fix` for auto-fixable issues
3. Set up pre-commit hooks to prevent new violations

### Long-term (Process Improvement)
1. Add ESLint to CI/CD pipeline (fail on errors)
2. Configure editor auto-fix on save
3. Team training on TypeScript best practices
4. Stricter ESLint rules (consider `strict` preset)

---

## Conclusion

**Current Project Status**: ✅ HEALTHY
- New code is ESLint-compliant
- Violations are in existing codebase only
- No blocking issues for Phase 3 integration

**Next Steps**:
1. Continue Phase 3 with ESLint awareness
2. Add ESLint fix tasks to Phase 4 checklist
3. Plan post-launch cleanup sprint

**Risk Level**: LOW
- No violations in critical new code
- Existing violations are manageable
- Clear remediation path established

---

**Analyzed by**: Claude Code
**Analysis Date**: 2025-10-22
**Total Violations**: 106 (86 errors, 20 warnings)
**Project Health**: 69.3% clean files
