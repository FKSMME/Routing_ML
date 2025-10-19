# Hyperspeed 3D Animation Background - Implementation Guide

**Date**: 2025-10-20
**Version**: 1.0.0
**Author**: Routing ML Team
**Status**: Implemented

---

## Overview

로그인 페이지에 Hyperspeed 3D 파티클 애니메이션 배경을 구현하여 시각적 향상과 사용자 경험을 개선했습니다. Three.js 기반의 WebGL 렌더링을 사용하며, 6가지 커스터마이징 가능한 테마 프리셋을 제공합니다.

---

## Features

### 1. **3D 파티클 애니메이션**
- Three.js 기반 WebGL 렌더링
- 실시간 파티클 움직임 (하이퍼스페이스 효과)
- 파티클 트레일 (잔상) 효과
- 동적 카메라 움직임 (쉐이크 & 회전)

### 2. **6가지 커스터마이징 테마**

#### Cyberpunk (사이버펑크)
- **색상**: 마젠타, 시안, 핫핑크, 일렉트릭 블루
- **특징**: 네온 조명 미래 도시 분위기
- **파티클**: 8,000개
- **속도**: 1.2x
- **카메라 쉐이크**: 활성화

#### Akira (아키라)
- **색상**: 레드 계열 (순수 레드, 밝은 레드, 레드-오렌지)
- **특징**: 네오 도쿄 스타일
- **파티클**: 10,000개
- **속도**: 1.5x (가장 빠름)
- **카메라 쉐이크**: 활성화

#### Golden (골든)
- **색상**: 골드, 앰버 톤
- **특징**: 따뜻한 프리미엄 느낌
- **파티클**: 6,000개
- **속도**: 0.9x (느림)
- **카메라 쉐이크**: 비활성화

#### Split (스플릿)
- **색상**: 블루와 오렌지 대비
- **특징**: 영화적인 컬러 그레이딩
- **파티클**: 7,000개
- **속도**: 1.1x
- **카메라 쉐이크**: 비활성화

#### Highway (하이웨이)
- **색상**: 화이트, 옐로우
- **특징**: 클래식 도로선 느낌
- **파티클**: 5,000개
- **속도**: 1.8x (매우 빠름)
- **카메라 쉐이크**: 비활성화

#### Matrix (매트릭스)
- **색상**: 그린 계열 (밝은 그린, 다크 그린, 시안-그린)
- **특징**: 디지털 레인 효과
- **파티클**: 9,000개
- **속도**: 1.3x
- **카메라 쉐이크**: 비활성화

### 3. **프리셋 선택 UI**
- 좌측 상단에 드롭다운 선택기 배치
- 실시간 테마 전환
- 현재 테마 설명 표시
- 다크 테마 스타일링

---

## File Structure

```
frontend-prediction/src/components/
├── Hyperspeed.tsx              # 메인 3D 렌더링 컴포넌트
├── Hyperspeed.css              # 스타일 정의
├── HyperspeedBackground.tsx    # 프리셋 선택기 래퍼
└── hyperspeedPresets.ts        # 6가지 테마 설정

frontend-training/src/components/
├── Hyperspeed.tsx
├── Hyperspeed.css
├── HyperspeedBackground.tsx
└── hyperspeedPresets.ts
```

---

## Technical Details

### Dependencies

```json
{
  "three": "^0.170.0",
  "postprocessing": "^6.36.4"
}
```

### Component Architecture

#### 1. **Hyperspeed.tsx** (메인 컴포넌트)

**Props**:
```typescript
interface HyperspeedProps {
  preset: HyperspeedPreset;
  className?: string;
}
```

**Key Features**:
- Three.js Scene, Camera, Renderer 초기화
- 파티클 시스템 (BufferGeometry + PointsMaterial)
- 트레일 효과 구현 (다중 레이어)
- 애니메이션 루프 (`requestAnimationFrame`)
- 반응형 리사이즈 핸들러
- 메모리 정리 (cleanup on unmount)

**Performance Optimizations**:
- `powerPreference: 'high-performance'`
- `pixelRatio` 제한 (max 2)
- Additive blending for efficient rendering
- Deferred initialization

#### 2. **hyperspeedPresets.ts** (설정)

**Preset Interface**:
```typescript
export interface HyperspeedPreset {
  name: string;                 // 테마 이름
  description: string;          // 테마 설명
  backgroundColor: number;      // 배경색 (hex)
  fogColor: number;             // 안개색 (hex)
  fogDensity: number;           // 안개 밀도
  particleCount: number;        // 파티클 개수
  particleSize: number;         // 파티클 크기
  particleOpacity: number;      // 파티클 투명도
  particleSpread: number;       // 파티클 분포 범위
  particleColors: number[];     // 파티클 색상 배열
  speed: number;                // 이동 속도
  trailLength: number;          // 트레일 길이
  cameraShake: boolean;         // 카메라 쉐이크 활성화
  cameraRotation: number;       // 카메라 회전 속도
}
```

#### 3. **HyperspeedBackground.tsx** (래퍼)

**Features**:
- 프리셋 선택 상태 관리 (`useState`)
- 드롭다운 UI 렌더링
- 실시간 프리셋 전환

---

## Integration

### LoginPage.tsx 통합

**Before**:
```tsx
import { FullScreen3DBackground } from "@components/FullScreen3DBackground";
import { BackgroundControls } from "@components/BackgroundControls";

// ...
<FullScreen3DBackground />
<BackgroundControls />
```

**After**:
```tsx
import { HyperspeedBackground } from "@components/HyperspeedBackground";

// ...
<HyperspeedBackground />
```

---

## Usage

### 기본 사용법

로그인 페이지에서 자동으로 렌더링됩니다:

1. **https://localhost:5173** (Frontend Prediction)
2. **https://localhost:5174** (Frontend Training)

### 테마 변경

좌측 상단의 "Animation Theme" 드롭다운에서 원하는 테마를 선택합니다.

### 커스터마이징

`hyperspeedPresets.ts` 파일을 수정하여 새로운 테마를 추가하거나 기존 테마를 조정할 수 있습니다:

```typescript
export const HYPERSPEED_PRESETS: Record<string, HyperspeedPreset> = {
  myCustomTheme: {
    name: 'My Custom Theme',
    description: 'Custom description',
    backgroundColor: 0x000000,
    fogColor: 0x111111,
    fogDensity: 0.01,
    particleCount: 7000,
    particleSize: 2.5,
    particleOpacity: 0.85,
    particleSpread: 80,
    particleColors: [0xff0000, 0x00ff00, 0x0000ff],
    speed: 1.0,
    trailLength: 5,
    cameraShake: false,
    cameraRotation: 0.0001,
  },
  // ...
};
```

---

## Browser Compatibility

- **Chrome/Edge**: ✅ 완전 지원
- **Firefox**: ✅ 완전 지원
- **Safari**: ✅ 완전 지원 (macOS/iOS)
- **Minimum**: WebGL 1.0 지원 브라우저

---

## Performance Considerations

### 파티클 개수와 성능

| 테마 | 파티클 개수 | 트레일 길이 | 예상 FPS |
|------|------------|------------|----------|
| Highway | 5,000 | 10 | 60 FPS |
| Golden | 6,000 | 4 | 60 FPS |
| Split | 7,000 | 6 | 60 FPS |
| Cyberpunk | 8,000 | 5 | 60 FPS |
| Matrix | 9,000 | 7 | 55-60 FPS |
| Akira | 10,000 | 8 | 50-60 FPS |

**Note**: 실제 성능은 GPU 성능에 따라 달라집니다.

### 최적화 팁

1. **파티클 수 조정**: `particleCount` 값을 낮춰서 성능 향상
2. **트레일 비활성화**: `trailLength: 0`으로 설정
3. **픽셀 비율 제한**: 코드에서 이미 `Math.min(window.devicePixelRatio, 2)` 적용됨
4. **카메라 쉐이크 비활성화**: `cameraShake: false`

---

## Troubleshooting

### 애니메이션이 표시되지 않음

1. **WebGL 지원 확인**: 브라우저에서 WebGL이 활성화되어 있는지 확인
2. **콘솔 에러 확인**: 개발자 도구에서 에러 메시지 확인
3. **GPU 드라이버**: 최신 GPU 드라이버로 업데이트

### 성능 저하

1. **프리셋 변경**: Highway 또는 Golden과 같은 가벼운 테마로 변경
2. **브라우저 하드웨어 가속**: 브라우저 설정에서 하드웨어 가속 활성화
3. **백그라운드 앱 종료**: GPU를 많이 사용하는 다른 애플리케이션 종료

### 로딩이 느림

- 초기 로딩 시 로딩 스피너가 표시됩니다
- 일반적으로 1-2초 내에 렌더링 시작
- 네트워크 속도에 따라 Three.js 라이브러리 로딩 시간 차이 발생 가능

---

## Future Enhancements

### 계획된 기능

1. **사용자 정의 테마 저장**
   - LocalStorage에 선호 테마 저장
   - 로그인 유지 시 테마 유지

2. **추가 시각 효과**
   - Bloom 효과 (postprocessing 라이브러리 활용)
   - Chromatic aberration
   - Vignette 효과

3. **인터랙티브 기능**
   - 마우스 움직임에 반응하는 카메라
   - 클릭 시 파티클 폭발 효과

4. **접근성 개선**
   - 모션 감소 옵션 (prefers-reduced-motion)
   - 애니메이션 일시정지 버튼

---

## References

- **Three.js Documentation**: https://threejs.org/docs/
- **Postprocessing Library**: https://github.com/pmndrs/postprocessing
- **WebGL Fundamentals**: https://webglfundamentals.org/

---

## Changelog

### v1.0.0 (2025-10-20)
- ✨ Initial implementation with 6 presets
- ✨ Preset selector UI
- ✨ Trail effects
- ✨ Camera shake and rotation
- ✨ Responsive design
- ✨ Memory cleanup on unmount
- 🐛 Fixed TypeScript compilation errors
- 📝 Complete documentation

---

## License

© 2025 KSM. All rights reserved.

---

**Implemented by**: Routing ML Team
**Contact**: syyun@ksm.co.kr
