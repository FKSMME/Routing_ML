# 3D 모델 업로드 방법 가이드

## 개요
프론트엔드 프로젝트에 3D 모델을 추가하여 Three.js, React Three Fiber 등을 사용해 렌더링할 수 있습니다.

---

## 방법 1: Public 폴더에 업로드 (가장 간단)

### 단계:

1. **3D 모델 파일 준비**
   - 지원 형식: `.glb`, `.gltf`, `.fbx`, `.obj` 등
   - 권장: `.glb` (GLB Binary) - 압축되어 있어 로딩 빠름

2. **파일 배치**
   ```bash
   /workspaces/Routing_ML_4/frontend-prediction/public/models/
   또는
   /workspaces/Routing_ML_4/frontend-training/public/models/
   ```

   예시:
   ```
   frontend-prediction/
   ├── public/
   │   ├── models/
   │   │   ├── robot.glb
   │   │   ├── machine.gltf
   │   │   └── factory.fbx
   ```

3. **코드에서 로드**
   ```jsx
   import { useLoader } from '@react-three/fiber';
   import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

   function Model() {
     const gltf = useLoader(GLTFLoader, '/models/robot.glb');
     return <primitive object={gltf.scene} />;
   }
   ```

---

## 방법 2: Assets 폴더 (src 내부)

### 단계:

1. **모델 파일 배치**
   ```bash
   /workspaces/Routing_ML_4/frontend-prediction/src/assets/models/
   ```

2. **Import 방식으로 로드**
   ```jsx
   import robotModel from '@/assets/models/robot.glb';

   function Model() {
     const gltf = useLoader(GLTFLoader, robotModel);
     return <primitive object={gltf.scene} />;
   }
   ```

---

## 방법 3: 외부 URL에서 로드

### CDN이나 외부 스토리지 사용:

```jsx
const MODEL_URL = 'https://cdn.example.com/models/robot.glb';

function Model() {
  const gltf = useLoader(GLTFLoader, MODEL_URL);
  return <primitive object={gltf.scene} />;
}
```

---

## 필요한 패키지 설치

### 5173 (frontend-prediction) 또는 5174 (frontend-training)에서:

```bash
# Three.js 및 React Three Fiber 설치
npm install three @react-three/fiber @react-three/drei

# 타입스크립트 사용 시
npm install -D @types/three
```

---

## 기본 3D Scene 예제

### 1. 간단한 3D 컴포넌트 생성

**파일: `src/components/3d/Scene3D.tsx`**

```tsx
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';

interface ModelProps {
  url: string;
}

function Model({ url }: ModelProps) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1} />;
}

export function Scene3D() {
  return (
    <div style={{ width: '100%', height: '600px' }}>
      <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.3} />

        <Suspense fallback={null}>
          <Model url="/models/robot.glb" />
        </Suspense>

        <OrbitControls />
      </Canvas>
    </div>
  );
}
```

### 2. 페이지에 추가

```tsx
import { Scene3D } from '@/components/3d/Scene3D';

function MyPage() {
  return (
    <div>
      <h1>3D Model Viewer</h1>
      <Scene3D />
    </div>
  );
}
```

---

## 현재 프로젝트에 적용하기

### 5173 (라우팅 예측) 예시:

**1. 패키지 설치:**
```bash
cd /workspaces/Routing_ML_4/frontend-prediction
npm install three @react-three/fiber @react-three/drei
```

**2. 모델 업로드:**
```bash
mkdir -p public/models
# 여기에 .glb 파일 복사
```

**3. 컴포넌트 생성:**
```bash
mkdir -p src/components/3d
# Scene3D.tsx 생성 (위 예제 코드 사용)
```

**4. 워크스페이스에서 사용:**
```tsx
// src/components/workspaces/SomeWorkspace.tsx에 추가
import { Scene3D } from '@/components/3d/Scene3D';

export const MyWorkspace = () => {
  return (
    <div>
      {/* 기존 컨텐츠 */}
      <Scene3D />
    </div>
  );
};
```

---

## 모델 최적화 팁

1. **파일 크기 줄이기**
   - Blender나 온라인 툴로 텍스처 압축
   - 불필요한 메타데이터 제거
   - GLB 형식 사용 (압축)

2. **로딩 성능**
   - `Suspense`로 lazy loading
   - 로딩 스피너 표시
   - Progressive loading 사용

3. **권장 파일 크기**
   - 웹용: 5MB 이하
   - 모바일용: 2MB 이하

---

## 무료 3D 모델 리소스

1. **Sketchfab** - https://sketchfab.com/
2. **Poly Pizza** - https://poly.pizza/
3. **Clara.io** - https://clara.io/library
4. **TurboSquid** - https://www.turbosquid.com/Search/3D-Models/free
5. **CGTrader** - https://www.cgtrader.com/free-3d-models

---

## 문제 해결

### 모델이 보이지 않을 때:

1. **브라우저 콘솔 확인**
   - F12 → Console 탭
   - 로딩 에러 확인

2. **파일 경로 확인**
   ```jsx
   // Public 폴더: / 로 시작
   '/models/robot.glb'  ✅

   // 잘못된 경로
   './models/robot.glb'  ❌
   'public/models/robot.glb'  ❌
   ```

3. **CORS 에러 시**
   - 로컬 파일 사용 (public 폴더)
   - 또는 서버 CORS 설정

4. **모델 스케일 조정**
   ```tsx
   <primitive object={scene} scale={0.1} />  // 너무 크면 축소
   <primitive object={scene} scale={10} />   // 너무 작으면 확대
   ```

---

## 다음 단계

1. Three.js 공식 문서: https://threejs.org/docs/
2. React Three Fiber 문서: https://docs.pmnd.rs/react-three-fiber/
3. Drei 헬퍼 라이브러리: https://github.com/pmndrs/drei

---

**작성일:** 2025-10-07
**프로젝트:** Routing ML System
**대상:** Frontend Prediction (5173), Frontend Training (5174)
