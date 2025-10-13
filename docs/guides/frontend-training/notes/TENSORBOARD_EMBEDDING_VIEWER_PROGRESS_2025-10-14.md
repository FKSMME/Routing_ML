# TensorBoard Embedding Viewer 진행 메모 (2025-10-14)

## 1. 작업 개요
- `models/export_tb_projector.py`를 저장소 상대 경로 기반으로 리팩터링하고 CLI 인자를 추가해 어디서 실행하든 동일하게 동작하도록 변경함.
- TensorBoard Projector 아티팩트(`vectors.tsv`, `projector_config.json/pbtxt`, TensorFlow 체크포인트 등) 생성 로직을 보완하고 검증 단계에서 필수 파일 존재 여부를 확인하도록 업데이트함.
- 프런트엔드 `apiClient`와 `TensorboardEmbeddingPanel`을 수정하여 새로운 익스포트 API 응답 구조를 처리하고, UI에서 샘플링/익스포트 상태 메시지를 노출하도록 개선함.

## 2. 스크립트 실행 및 산출물
- 실행 명령: `python .\models\export_tb_projector.py --model-dir .\models --out-dir .\models\tb_projector`
- 주요 로그
  - 메타데이터 TSV(`models/item_master.tsv`) 부재로 `metadata.tsv`에는 기본 `ITEM_CD` 열만 포함.
  - 총 321,305개의 임베딩(37차원) 추출 및 재구성 성공.
  - 출력 디렉터리: `models\tb_projector`
  - 생성 파일: `vectors.tsv` (약 137MB), `metadata.tsv`, `projector_config.json`, `projector_config.pbtxt`, `model.ckpt.*`, `events.out.tfevents.*`

## 3. 백엔드 API 검증
- 전체 FastAPI 앱은 `python-multipart` 미설치로 부팅 실패 → `FastAPI TestClient`로 라우터 단독 호출.
- 인증 의존성(`require_auth`) 오버라이드 후 호출 결과:
  - `POST /api/training/tensorboard/projectors/export` → 200 OK (`returncode: 0`)
  - `GET /api/training/tensorboard/projectors` → 200 OK, projector 2건(`root` 포함)
  - `GET /api/training/tensorboard/projectors/root/points?limit=5` → 200 OK, 총 321,305건 중 5건 샘플 반환
  - `GET /api/training/tensorboard/projectors/root/filters` → 200 OK, 필드 1개
  - `GET /api/training/tensorboard/metrics/root` → 200 OK, 메트릭 2종(`embedding_norm_mean`, `training_loss_proxy`)
- TestClient 실행 시 `pydantic` 경고(보호 네임스페이스)와 Windows 콘솔 인코딩 경고가 발생했으나 기능에는 영향 없음.

## 4. 미해결 항목 및 후속 작업
- **의존성 설치**: `python-multipart` 설치 시 사내 CA 경로(`C:\Users\syyun\Documents\GitHub\MCS\certs\corp-chain.pem`) 문제로 pip 실패. 올바른 인증서 경로 지정 또는 사내 패키지 프록시 사용 필요.
- **메타데이터 확장**: `models/item_master.tsv`를 준비하면 `PART_TYPE` 등 색상/필터용 열을 메타데이터에 포함 가능.
- **경고 정리**: TensorFlow oneDNN/TensorBoard 관련 경고가 로그에 노출되므로 필요 시 환경 변수(`TF_ENABLE_ONEDNN_OPTS=0`) 조정 검토.
- **전체 서버 테스트**: FastAPI 전체 앱 및 프런트엔드를 실제로 띄워 UI에서 3D 포인트/필터/메트릭이 정상 표시되는지 수동 검증 필요.

## 5. 참고 파일
- `models/export_tb_projector.py`
- `frontend-training/src/lib/apiClient.ts`
- `frontend-training/src/components/tensorboard/TensorboardEmbeddingPanel.tsx`
- `docs/guides/frontend-training/TENSORBOARD_EMBEDDING_VIEWER_PLAN.md`

---

## 6. Phase 2 작업 - 히트맵 및 3D 시각화 개선 (2025-10-14)

### 6.1 작업 목표
- TensorBoard 3D 시각화에 히트맵 기능 추가
- 3D 포인트 렌더링 개선 (사각형 → 원형)
- 시각화 모드 전환 UI 추가 (3D / Heatmap)

### 6.2 진행 대화 로그

**15:30 - 사용자 요청: 히트맵 구현**
> "지금 텐서보드 메뉴에 3d 시각화로 모델 현황을 보여주려고 해. 텐서보드 프로젝트 시각화 알지? T-SNE하고 히트맵 등등 이걸 구현하려는데 쉽지 않네."

- 사용자가 Galaxy.tsx WebGL 코드 공유
- Galaxy 배경은 불필요하다고 판단
- Phase 2(히트맵), Phase 3(3D 개선), Phase 4(빌드/테스트) 진행 요청

**15:45 - 히트맵 컴포넌트 생성**
- `HeatmapChart` 컴포넌트 추가 (line 150-302)
- Pearson 상관계수 계산 구현 (X, Y, Z 차원 간 상관관계)
- ECharts 히트맵 설정:
  - 색상 그라디언트 스케일 (-1 ~ 1)
  - 툴팁으로 상관계수 표시
  - 500px 높이 반응형 컨테이너
- `VisualizationMode` 타입 추가: `'3d' | 'heatmap' | 'scatter'`
- `visualizationMode` 상태 변수 추가 (line 406)

**16:00 - 사용자 피드백: 포인트 형태 수정**
> "인트는 점으로 해줘 지금 사각형이야"

- 3D 포인트가 사각형으로 렌더링되는 문제 발견
- 원형 포인트로 변경 필요

**16:10 - 3D 포인트 원형 렌더링 구현**
- Three.js 라이브러리 import 추가
- 원형 스프라이트 텍스처 생성:
  - 64x64 캔버스에 radial gradient 그리기
  - 중심에서 가장자리로 갈수록 투명도 증가 (soft edge)
  - `THREE.CanvasTexture`로 변환
- `pointsMaterial` 속성 업데이트:
  - `size`: 0.22 → 0.25
  - `opacity`: 0.85 → 0.9
  - `map`: circleTexture 추가
  - `alphaTest`: 0.1 설정
  - `transparent`: true

### 6.3 코드 변경 사항

**파일**: `frontend-training/src/components/tensorboard/TensorboardEmbeddingPanel.tsx`

```typescript
// Line 6: Three.js import 추가
import * as THREE from "three";

// Line 12: 시각화 모드 타입 추가
type VisualizationMode = '3d' | 'heatmap' | 'scatter';

// Line 150-302: HeatmapChart 컴포넌트
const HeatmapChart = () => {
  // Pearson 상관계수 계산 로직
  // ECharts heatmap 설정
  // ...
};

// Line 305-395: PointCloud 컴포넌트 개선
const PointCloud = () => {
  // Line 310-326: 원형 텍스처 생성
  const circleTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    // ... radial gradient 그리기
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Line 383-392: 원형 포인트 렌더링
  <pointsMaterial
    size={0.25}
    map={circleTexture}
    transparent
    opacity={0.9}
    // ...
  />
};

// Line 406: 시각화 모드 상태
const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('3d');
```

### 6.4 남은 작업 (Phase 2 완료를 위해)

- [x] 시각화 모드 전환 버튼 UI 추가 (3D / Heatmap 탭)
- [x] visualizationMode에 따라 Canvas 또는 HeatmapChart 조건부 렌더링
- [x] 스타일 조정 및 레이아웃 통합

### 6.5 타임라인

| 시간 | 작업 내용 |
|------|----------|
| 15:30 | 사용자 요청: 히트맵 구현, Galaxy WebGL 검토 |
| 15:35 | Galaxy 배경 불필요 판단, Phase 2-4 계획 수립 |
| 15:45 | HeatmapChart 컴포넌트 구현 완료 |
| 16:00 | 사용자 피드백: 포인트 사각형 → 원형 변경 요청 |
| 16:10 | 원형 스프라이트 텍스처 생성 및 적용 완료 |
| 16:20 | 시각화 모드 전환 UI 추가 및 조건부 렌더링 구현 완료 |
| 16:35 | Phase 3: Grid helper, 조명 시스템 개선 완료 |

---

## 7. Phase 3 작업 - 3D 시각화 품질 개선 (2025-10-14)

### 7.1 작업 목표
- 3D 공간 인식을 위한 Grid helper 추가
- 조명 시스템 개선으로 depth perception 향상
- 카메라 및 OrbitControls 최적화
- PointCloud 컴포넌트 props 기반 커스터마이징

### 7.2 구현 내용

**1. Infinite Grid Helper**
- `@react-three/drei`의 Grid 컴포넌트 사용
- 위치: Y축 -5 (포인트 클라우드 아래)
- 크기: 20x20, cell 1 단위, section 5 단위
- 색상: Indigo 계열 (#6366f1 cell, #818cf8 section)
- Fade distance 30, 카메라 미추적
- `showGrid` state로 토글 가능

**2. 개선된 조명 시스템**
```typescript
<ambientLight intensity={0.4} />                          // 기본 조도
<directionalLight position={[10, 10, 10]} intensity={1.0} castShadow />  // 메인
<directionalLight position={[-10, -10, -10]} intensity={0.3} />          // 보조
<pointLight position={[0, 10, 0]} intensity={0.5} color="#a0d8ff" />     // 상단 하늘색
```

**3. 카메라 설정 최적화**
- 초기 위치: [6, 6, 6] → [8, 8, 8] (더 넓은 시야)
- FOV: 60 → 50 (원근감 개선)

**4. OrbitControls 제한**
- minDistance: 3 (최소 줌인)
- maxDistance: 50 (최대 줌아웃)
- autoRotate: false (수동 회전)

**5. PointCloud Props 지원**
```typescript
interface PointCloudProps {
  pointSize?: number;      // 기본값 0.25
  pointOpacity?: number;   // 기본값 0.9
}
```

### 7.3 State 관리
- `pointSize`: number = 0.25
- `showGrid`: boolean = true
- 향후 UI 컨트롤 추가 가능

### 7.4 시각적 개선 효과
- ✅ Grid로 3D 공간감 향상
- ✅ 다층 조명으로 depth perception 개선
- ✅ 하늘색 point light로 상단 강조
- ✅ 카메라 거리 제한으로 UX 개선
- ✅ Props 기반 커스터마이징 지원

### 6.6 Phase 2 완료 사항

**구현된 기능**:
1. **히트맵 시각화**
   - X, Y, Z 차원 간 Pearson 상관계수 계산
   - ECharts 히트맵 차트로 시각화
   - 색상 그라디언트 스케일 (-1 ~ 1)
   - 인터랙티브 툴팁

2. **3D 포인트 렌더링 개선**
   - 사각형 → 원형 포인트로 변경
   - Radial gradient 텍스처로 soft edge 효과
   - 투명도 및 크기 조정 (size: 0.25, opacity: 0.9)

3. **시각화 모드 전환**
   - 3D View / Heatmap 탭 버튼 추가
   - visualizationMode 상태 기반 조건부 렌더링
   - 부드러운 UI 전환 애니메이션

**파일 변경 사항**:
- `frontend-training/src/components/tensorboard/TensorboardEmbeddingPanel.tsx`
  - Line 3: Grid import from @react-three/drei
  - Line 6: Three.js import
  - Line 13: VisualizationMode 타입
  - Line 151-303: HeatmapChart 컴포넌트
  - Line 308-403: PointCloud 원형 렌더링 (props 지원)
  - Line 437-438: pointSize, showGrid 상태
  - Line 636-659: 모드 전환 탭 버튼
  - Line 665-702: Canvas with Grid, improved lighting
  - Line 673-688: Infinite Grid helper
