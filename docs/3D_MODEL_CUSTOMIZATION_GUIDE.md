# 3D 모델 커스터마이징 가이드

## 📋 개요
Routing ML 시스템의 3D 로고 애니메이션을 원하는 3D 모델로 교체하는 방법을 안내합니다.

---

## 🎯 지원 파일 형식
- **GLB** (권장): Binary glTF 형식, 단일 파일
- **GLTF**: JSON 기반 glTF 형식 + 별도 바이너리 파일

---

## 📁 파일 위치

### Prediction Frontend
```
/frontend-prediction/public/models/
```

### Training Frontend
```
/frontend-training/public/models/
```

---

## 🔧 교체 방법

### 1단계: 3D 모델 파일 준비
1. 3D 모델을 GLB 또는 GLTF 형식으로 내보내기
2. 파일 크기 최적화 권장 (< 5MB)
3. 애니메이션 포함 가능

**권장 도구:**
- Blender (무료, 오픈소스)
- Autodesk Maya
- 3ds Max
- glTF 변환기: https://github.com/CesiumGS/gltf-pipeline

### 2단계: 파일 배치
1. 준비한 GLB 파일을 `public/models/` 디렉토리에 복사
   ```bash
   cp my-model.glb /frontend-prediction/public/models/
   ```

2. 파일명 예시:
   - `logo.glb`
   - `custom-logo.glb`
   - `machine-part.glb`

### 3단계: 컴포넌트 코드 수정

#### Prediction Frontend
파일: `/frontend-prediction/src/components/AnimatedLogo3D.tsx`

```typescript
// 기존 코드 (예시):
const modelPath = "/models/logo.glb";

// 수정 후:
const modelPath = "/models/custom-logo.glb"; // 본인의 파일명으로 변경
```

#### Training Frontend
파일: `/frontend-training/src/components/AnimatedLogo3D.tsx`

동일하게 modelPath 변경

### 4단계: 애니메이션 파라미터 조정 (선택사항)

3D 모델의 회전 속도, 크기, 위치를 조정할 수 있습니다.

```typescript
// AnimatedLogo3D.tsx 파일 내부

// 회전 속도 조정
useFrame((state, delta) => {
  if (meshRef.current) {
    meshRef.current.rotation.y += delta * 0.5; // 0.5 값을 변경 (기본값)
    // 값이 클수록 빠르게 회전
  }
});

// 크기 조정
<primitive
  object={scene}
  scale={1.5} // 1.5 = 150% 크기, 2.0 = 200% 크기
/>

// 위치 조정
<primitive
  object={scene}
  position={[0, 0, 0]} // [x, y, z] 좌표
  scale={1.5}
/>
```

---

## 🎨 최적화 팁

### 1. 파일 크기 최적화
```bash
# gltf-pipeline 사용 (Node.js 필요)
npm install -g gltf-pipeline

# GLB 압축
gltf-pipeline -i input.glb -o output.glb -d
```

### 2. 텍스처 최적화
- 텍스처 해상도: 1024x1024 이하 권장
- 포맷: PNG 또는 JPG
- 불필요한 텍스처 제거

### 3. 폴리곤 수 최적화
- 로고용 모델: 10,000 폴리곤 이하 권장
- 복잡한 모델: 50,000 폴리곤 이하

---

## 🔍 문제 해결

### 모델이 보이지 않음
**원인:**
- 파일 경로 오류
- 파일 형식 문제
- 모델 스케일이 너무 작거나 큼

**해결:**
1. 브라우저 개발자 도구 (F12) → Console 탭 확인
2. Network 탭에서 모델 파일 로딩 확인
3. scale 값을 0.1 ~ 10 범위로 조정

### 모델이 너무 어둡거나 밝음
**원인:**
- 조명 설정 문제

**해결:**
```typescript
// AnimatedLogo3D.tsx에서 조명 강도 조정
<ambientLight intensity={0.5} /> // 기본 조명 (0.3 ~ 1.0)
<directionalLight position={[10, 10, 5]} intensity={1} /> // 방향 조명
```

### 애니메이션이 작동하지 않음
**원인:**
- 모델에 애니메이션 데이터 없음
- useAnimations hook 설정 오류

**해결:**
```typescript
const { animations } = useGLTF(modelPath);
const { actions, mixer } = useAnimations(animations, meshRef);

useEffect(() => {
  // 첫 번째 애니메이션 재생
  if (actions && Object.keys(actions).length > 0) {
    const firstAction = Object.values(actions)[0];
    firstAction?.play();
  }
}, [actions]);
```

---

## 📊 모델 사양 권장사항

| 항목 | 권장값 | 최대값 |
|------|--------|--------|
| 파일 크기 | < 2MB | < 5MB |
| 폴리곤 수 | < 10,000 | < 50,000 |
| 텍스처 해상도 | 512x512 | 2048x2048 |
| 텍스처 개수 | 1-2개 | 5개 |

---

## 🎓 3D 모델 제작 튜토리얼

### Blender에서 GLB 내보내기
1. Blender에서 모델 생성 또는 불러오기
2. File → Export → glTF 2.0 (.glb/.gltf)
3. 내보내기 설정:
   - Format: **glTF Binary (.glb)** 선택
   - Remember Export Settings 체크
   - Include: Selected Objects (선택한 객체만 내보내기)
4. Export glTF 2.0 클릭

### 온라인 3D 모델 다운로드 사이트
- **Sketchfab**: https://sketchfab.com (무료/유료)
- **CGTrader**: https://www.cgtrader.com
- **TurboSquid**: https://www.turbosquid.com
- **Free3D**: https://free3d.com

---

## 🚀 빠른 테스트 방법

### 테스트용 간단한 모델
1. https://sketchfab.com/3d-models 방문
2. "Free Download" 필터 선택
3. "glTF" 형식 다운로드
4. `public/models/` 에 복사
5. 코드에서 파일명 변경
6. 브라우저 새로고침 (Ctrl+F5)

---

## 💡 예제 코드

### 완전한 AnimatedLogo3D.tsx 예제
```typescript
import { useRef, useEffect } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function AnimatedLogo3D() {
  const meshRef = useRef<THREE.Group>(null);

  // 본인의 모델 파일명으로 변경
  const { scene, animations } = useGLTF('/models/custom-logo.glb');
  const { actions, mixer } = useAnimations(animations, meshRef);

  // 애니메이션 자동 재생
  useEffect(() => {
    if (actions && Object.keys(actions).length > 0) {
      const firstAction = Object.values(actions)[0];
      firstAction?.play();
    }
  }, [actions]);

  // 자동 회전
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={meshRef}>
      <primitive
        object={scene}
        scale={1.5}           // 크기 조정
        position={[0, 0, 0]}  // 위치 조정
      />
    </group>
  );
}

// 모델 프리로드 (성능 향상)
useGLTF.preload('/models/custom-logo.glb');
```

---

## 📞 추가 지원

### Three.js 공식 문서
- React Three Fiber: https://docs.pmnd.rs/react-three-fiber
- Three.js: https://threejs.org/docs/
- glTF 스펙: https://www.khronos.org/gltf/

### 커뮤니티
- Three.js Discord: https://discord.gg/poimandres
- React Three Fiber GitHub: https://github.com/pmndrs/react-three-fiber

---

## ✅ 체크리스트

커스터마이징 전 확인사항:
- [ ] GLB 또는 GLTF 형식 모델 준비 완료
- [ ] 파일 크기 5MB 이하
- [ ] `public/models/` 디렉토리에 파일 복사
- [ ] `AnimatedLogo3D.tsx`에서 파일 경로 수정
- [ ] 브라우저 새로고침 (Ctrl+F5)
- [ ] 개발자 도구에서 에러 확인
- [ ] scale/position 조정으로 최적 표시 설정

---

**작성일:** 2025-10-07
**버전:** 1.0
**작성자:** Claude Code
