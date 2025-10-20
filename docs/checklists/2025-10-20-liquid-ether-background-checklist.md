# 2025-10-20 Liquid Ether 배경 교체 체크리스트

- 작성 시각: 2025-10-20 12:55 (UTC-4)
- 작성자: Codex (GPT-5)

## 진행 로그
- [x] 11:15 기존 3D 컴포넌트 및 공유 모듈(FullScreen3DBackground, ModelViewer) 제거 범위 조사 완료
- [x] 11:40 `@routing-ml/shared`에 LiquidEther 컴포넌트와 CSS 추가
- [x] 12:05 프런트엔드(App) 백드롭을 LiquidEtherBackdrop으로 교체 (prediction, training)
- [x] 12:20 BackgroundControls · Zustand 스토어를 Liquid Ether 파라미터로 리팩터
- [x] 12:30 HeroBanner 3D 시각요소를 Liquid Ether 박스로 대체
- [x] 12:45 `npm run build` (frontend-prediction)
- [x] 12:50 `npm run build` (frontend-training)
- [x] 12:55 PRD 및 체크리스트 문서화 완료

## 확인 사항
- [x] LiquidEther 기본 파라미터가 스크린샷 값과 일치함을 검증
- [x] BackgroundControls에서 색상/해상도/Force/Viscous 등 값이 실시간 반영됨
- [x] pointer-events: none, opacity 적용한 고정 백드롭 동작 확인
- [x] 3D 전용 스토어/컴포넌트가 번들에서 제거되었음
