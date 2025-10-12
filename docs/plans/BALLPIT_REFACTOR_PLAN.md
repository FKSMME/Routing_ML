# Ballpit 공통 모듈화 계획

**작성일**: 2025-10-08
**목표**: 742줄 × 2 = 1,484줄 중복 제거, 유지보수성 향상

---

## 📊 현황 분석

### 중복 상태
```bash
$ md5sum frontend-*/src/components/effects/Ballpit.tsx
a19a6bb98f5e398ffb040b98761827c8  frontend-prediction
a19a6bb98f5e398ffb040b98761827c8  frontend-training
```

- **완전 동일**: 100% 중복 (742줄 × 2)
- **영향 범위**: 두 프로젝트 모두 로그인 화면 3D 배경 효과
- **문제점**:
  - 버그 수정 시 두 파일 모두 수정 필요
  - 일관성 보장 어려움
  - 번들 크기 불필요하게 증가

---

## 🎯 리팩토링 전략

### 옵션 1: Shared Library (권장) ⭐
**구조**:
```
packages/
├── shared-ui/
│   ├── package.json
│   ├── src/
│   │   └── effects/
│   │       └── Ballpit.tsx  (742줄, 단일 소스)
│   └── tsconfig.json
├── frontend-prediction/
│   └── package.json → dependencies: "@routing-ml/shared-ui": "workspace:*"
└── frontend-training/
    └── package.json → dependencies: "@routing-ml/shared-ui": "workspace:*"
```

**장점**:
- ✅ 완전한 중복 제거 (1,484 → 742줄)
- ✅ 버전 관리 용이
- ✅ 타입 정의 공유
- ✅ 향후 다른 공통 컴포넌트 추가 가능

**단점**:
- ⚠️ Monorepo 구조 전환 필요 (pnpm/yarn workspaces)
- ⚠️ 빌드 설정 추가 작업

**예상 소요**: 2-3시간

---

### 옵션 2: npm 패키지 발행
**구조**:
```
@routing-ml/ballpit-effect/
├── package.json (name: "@routing-ml/ballpit-effect")
├── src/Ballpit.tsx
└── dist/ (빌드 산출물)

frontend-prediction → npm install @routing-ml/ballpit-effect
frontend-training → npm install @routing-ml/ballpit-effect
```

**장점**:
- ✅ 기존 구조 유지
- ✅ npm 저장소 활용

**단점**:
- ⚠️ 개발 워크플로우 복잡 (publish 필요)
- ⚠️ 로컬 개발 시 link 설정 필요

**예상 소요**: 1-2시간

---

### 옵션 3: Git Submodule
**구조**:
```
routing-ml-shared-components/  (별도 Git 저장소)
└── Ballpit.tsx

frontend-prediction/src/components/effects/ → submodule
frontend-training/src/components/effects/ → submodule
```

**장점**:
- ✅ 빠른 적용

**단점**:
- ❌ Submodule 관리 복잡성
- ❌ 팀원 협업 시 혼란 가능성

**비권장**

---

## 📋 권장 실행 계획 (옵션 1)

### Phase 1: Monorepo 구조 설정 (30분)
1. 프로젝트 루트에 `pnpm-workspace.yaml` 생성
2. `packages/shared-ui/` 디렉터리 생성
3. `shared-ui/package.json` 설정:
   ```json
   {
     "name": "@routing-ml/shared-ui",
     "version": "0.1.0",
     "main": "./src/index.ts",
     "peerDependencies": {
       "react": "^18.0.0",
       "ogl": "^1.0.0"
     }
   }
   ```

### Phase 2: Ballpit 이동 (20분)
1. `frontend-prediction/src/components/effects/Ballpit.tsx` → `packages/shared-ui/src/effects/Ballpit.tsx`
2. `shared-ui/src/index.ts` 생성:
   ```typescript
   export { default as Ballpit } from './effects/Ballpit';
   ```
3. frontend-training의 Ballpit.tsx 삭제

### Phase 3: Import 경로 수정 (30분)
**frontend-prediction/src/App.tsx**:
```typescript
// Before
import Ballpit from './components/effects/Ballpit';

// After
import { Ballpit } from '@routing-ml/shared-ui';
```

**frontend-training/src/App.tsx**: 동일하게 수정

### Phase 4: 빌드 및 테스트 (40분)
1. `pnpm install` (workspace dependencies 연결)
2. `pnpm -F frontend-prediction build`
3. `pnpm -F frontend-training build`
4. 개발 서버 실행 및 UI 확인

### Phase 5: 검증 (20분)
1. TypeScript 컴파일: `tsc --noEmit` (양쪽 모두)
2. Playwright 스크린샷 테스트
3. 번들 크기 비교 (before/after)

---

## 📈 예상 효과

### 정량적 지표
| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| 중복 라인 수 | 1,484줄 | 742줄 | **-50%** |
| 유지보수 포인트 | 2개 파일 | 1개 파일 | **-50%** |
| 번들 크기 (합산) | ~2.2MB | ~1.5MB | **-32% (예상)** |
| 타입 일관성 | 수동 동기화 | 자동 공유 | **100%** |

### 정성적 효과
- ✅ 버그 수정 시 단일 파일만 수정
- ✅ 새 프로젝트 추가 시 즉시 재사용
- ✅ Three.js 타입 에러 중앙 관리 (`@ts-nocheck` 한 곳)
- ✅ Props 인터페이스 표준화

---

## 🚨 리스크 및 대응

| 리스크 | 영향 | 대응 방안 |
|--------|------|-----------|
| Monorepo 학습 곡선 | 중 | pnpm workspaces 공식 문서 참조, 예제 프로젝트 확인 |
| 빌드 설정 충돌 | 중 | tsconfig.json paths 설정, Vite alias 추가 |
| 개발 서버 HMR 동작 안 함 | 높 | shared-ui도 watch 모드로 실행 (`vite build --watch`) |
| 기존 import 경로 누락 | 중 | ESLint auto-fix, 전체 검색 후 일괄 수정 |

---

## ✅ 실행 기준

### 즉시 시작 조건
- [x] TypeScript 타입 에러 0개 (현재 달성)
- [x] 프로덕션 빌드 성공 (현재 달성)
- [ ] 팀 합의 (Monorepo 전환 승인)

### 연기 조건
- 프로젝트 구조 대규모 변경 계획 있음
- 다른 긴급 버그 수정 중
- 팀원 리소스 부족

---

## 📅 타임라인 (총 2.5시간)

| 시간 | 작업 | 담당 |
|------|------|------|
| 0:00-0:30 | Monorepo 구조 설정 | DevOps |
| 0:30-0:50 | Ballpit 이동 | Frontend |
| 0:50-1:20 | Import 경로 수정 | Frontend |
| 1:20-2:00 | 빌드 및 테스트 | QA |
| 2:00-2:20 | 검증 | Lead |
| 2:20-2:30 | 문서 업데이트 | All |

---

**다음 액션**: 팀 리뷰 요청 및 Monorepo 전환 승인 대기
**대안**: 승인 전까지 옵션 2 (npm 패키지) 프로토타입 구현
