# Visual Effects - 공통 컴포넌트

**목적**: frontend-prediction과 frontend-training에서 공유하는 시각 효과 컴포넌트

## 사용법

### Ballpit.tsx
3D 배경 효과 (Three.js + OGL)

**Import**:
```typescript
// 각 프로젝트에서 심볼릭 링크 또는 빌드 시 복사
import Ballpit from '@components/effects/Ballpit';
```

**Props**:
```typescript
{
  count?: number;          // 구체 개수 (기본: 100)
  followCursor?: boolean;  // 마우스 추적 (기본: false)
}
```

## 유지보수

- **단일 소스**: common/visual-effects/Ballpit.tsx
- **배포 방법**: 각 프로젝트로 복사 또는 심볼릭 링크
- **타입 체크**: `@ts-nocheck` 사용 (Three.js 타입 복잡도)

## 변경 이력

- 2025-10-08: 초기 생성, 중복 제거 목적
