# Liquid Ether 배경 교체 PRD

- **작성일**: 2025-10-20 11:45 (UTC-4)
- **요청자**: 사용자
- **작성자**: Codex (GPT-5)

## 1. 배경
기존 라우팅 웹 애플리케이션들은 Three.js 기반 3D 배경(`FullScreen3DBackground`, `ModelViewer`)을 사용하고 있었다. 유지보수 비용과 로딩 성능 부담이 커졌고, 사용자는 3D 요소를 배경에서 제거하고 새로운 인터랙티브 플루이드 효과(Liquid Ether)를 적용할 것을 요청했다.

## 2. 목표
1. 모든 React 프런트엔드(frontend-prediction, frontend-training)에서 3D 배경을 제거한다.
2. LiquidEther 효과를 공용 컴포넌트로 구현하고 공유 라이브러리(`@routing-ml/shared`)를 통해 재사용한다.
3. 사용자에게 제공된 스크린샷과 동일한 파라미터(색상, 속도 등)를 기본값으로 적용한다.
4. 기존 BackgroundControls UI를 수정해 Liquid Ether 옵션을 제어할 수 있도록 한다.
5. HeroBanner 등 3D 모델을 사용하던 UI를 Liquid Ether 기반으로 재구성한다.

## 3. 범위
- **포함**
  - 3D 컴포넌트 및 관련 스토어 제거
  - LiquidEther 컴포넌트 추가 및 CSS 생성
  - 프런트엔드 App 루트에 Liquid Ether 백드롭 삽입
  - BackgroundControls 스토어/컴포넌트 확장
  - HeroBanner 시각 영역 Liquid Ether로 대체
- **제외**
  - 정적 HTML(frontend-home) 리뉴얼
  - 모바일/반응형 추가 디자인 변경
  - Three.js 의존성 제거 (다른 컴포넌트 사용 가능성 존재)

## 4. 기술 요구사항
- `@routing-ml/shared`에 `LiquidEther` 컴포넌트를 추가하고 CSS를 포함한다.
- Zustand 스토어(`useBackgroundSettings`)를 Liquid Ether 파라미터(색상, Force, 해상도 등) 기반으로 재정의한다.
- BackgroundControls에서 다음 항목을 제어할 수 있어야 한다.
  - Colors(3), Opacity, Mouse Force, Cursor Size, Resolution, Auto Speed, Auto Intensity, Pressure(iterations), Bounce Edges, Auto Animate, Viscous, Viscous Coef, Viscous Iterations
- 앱 루트에서 `LiquidEtherBackdrop`을 렌더링할 때 pointer-events: none, z-index:0, opacity 적용.
- HeroBanner의 3D 모델 영역은 Liquid Ether 박스로 치환한다.
- `npm run build` (frontend-prediction, frontend-training)로 통합 검증한다.

## 5. 파라미터 (스크린샷 기준 기본값)
| 항목 | 값 |
| --- | --- |
| Colors | `#5227FF`, `#FF9FFC`, `#B19EEF` |
| Mouse Force | 20 |
| Cursor Size | 100 |
| Resolution | 0.5 |
| Auto Speed | 0.5 |
| Auto Intensity | 2.2 |
| Pressure (iterations_poisson) | 32 |
| Bounce Edges | false |
| Auto Animate | true |
| Viscous | false |
| Viscous Coef | 30 |
| Viscous Iterations | 32 |
| dt | 0.014 |
| BFECC | true |
| Takeover Duration | 0.25 |
| Auto Resume Delay | 3000 ms |
| Auto Ramp Duration | 0.6 |

## 6. 성공 지표
- 3D 컴포넌트 관련 번들 크기 감소 (React Three Fiber 관련 청크 분리 유지)
- BackgroundControls를 통해 실시간으로 Liquid Ether 파라미터 조정 가능
- `npm run build` 두 프런트에서 모두 성공

## 7. 리스크
- Liquid Ether는 WebGL을 계속 사용하므로 GPU가 약한 환경에서 성능 저하 가능
- IntersectionObserver/ResizeObserver 사용으로 인한 브라우저 호환성(legacy IE) 미지원
- colors 길이를 3개로 고정했으므로 추가 색상 요구가 있을 경우 확장 필요

## 8. 일정 (현지 시각 기준)
- 11:10~11:25 3D 컴포넌트 제거 범위 확정
- 11:25~12:05 LiquidEther 컴포넌트 이식 및 shared export 구성
- 12:05~12:40 프런트엔드(App, HeroBanner) 적용 및 스토어/컨트롤 개편
- 12:40~12:55 빌드 검증, 문서/체크리스트 작성

## 9. 승인
- **승인 필요자**: 사용자
- **상태**: 승인 대기
