# Work Log - 2025-10-07 (Continued Session)

> 오전 세션 후속 기록. 원본 문서는 09:20 시점에서 멈춰 있었기 때문에 최신 결과가 반영되지 않은 것처럼 보였습니다. 아래에 문제 해결 과정과 최종 상태를 업데이트했습니다.

## [09:20] Ballpit & Orb Effects Implementation

### 완료된 산출물
- Orb 컴포넌트 + 스타일 시트 생성  
  - `frontend-prediction/src/components/effects/Orb.tsx`  
  - `frontend-prediction/src/components/effects/Orb.css`  
  - `frontend-training/src/components/effects/Orb.tsx`  
  - `frontend-training/src/components/effects/Orb.css`
- Three.js 기반 Ballpit 컴포넌트 생성 및 양쪽 서비스에 복제  
  - `frontend-prediction/src/components/effects/Ballpit.tsx`  
  - `frontend-training/src/components/effects/Ballpit.tsx`
- 디버깅용 2D Fallback (`BallpitSimple.tsx`) 제작
- 공용 의존성 설치  
  - `npm install three ogl`  
  - `npm install --save-dev @types/three`

### 발견한 이슈
- `BallpitSimple`이 DOM에 canvas를 렌더링하지 않음
- React Fragment로 감싼 레이아웃이 `LoginPage`의 전체 화면 flex 컨테이너에 가려짐
- z-index 조정만으로는 문제 해결이 되지 않음

## [09:33] LoginPage 내부 통합

### 조치
- `frontend-prediction/src/components/auth/LoginPage.tsx`에 Ballpit을 직접 삽입하고 `position`, `zIndex`, `pointerEvents` 레이어링 정리
- 동일한 구조를 `frontend-training/src/components/auth/LoginPage.tsx`에도 적용
- CardShell/ThemeToggle 등에 명시적 `zIndex` 부여

### 확인
- 수동 테스트: 배경 레이어가 등장하지만 5173 환경에서 캔버스가 비어 있음
- `TestVisible.tsx` 임시 컴포넌트로 마운트 여부 점검 → 렌더링 경계 문제임을 확인

## [09:40] 서버 재시작 & 런타임 검증

### 실행
- `lsof -ti:3000,5173,5174,8000 | xargs -r kill -9`로 포트 정리
- Backend(8000), Prediction(5173), Training(5174), Home(3000) 모두 재기동

### 결과
- Playwright 1차 검증: 5174에서는 Three.js Ballpit 감지, 5173에서는 Fallback 때문에 여전히 실패
- 원인 재확인 후 5173도 Three.js 버전으로 교체

## [09:50] 최종 배경 효과 검증

### 수정
- Prediction/Training LoginPage 모두 `Ballpit.tsx`만 사용하도록 정리
- CardShell 위치 계산 조정, ThemeToggle z-index 상단 유지

### 검증
- Playwright 2차 검증 → 5173/5174 모두 `canvas 1920x1080` 확인
- 스크린샷: 5173은 컬러풀 공, 5174는 어두운 금속 느낌 공 애니메이션

## [10:05] Import 오류 & 캐시 정리

### 문제
- 브라우저 콘솔: `Uncaught ReferenceError: Ballpit is not defined` (App.tsx 잔여 import)
- 로컬 Vite 캐시가 이전 빌드 유지

### 해결
- `frontend-prediction/src/App.tsx`에서 불필요한 `import Ballpit` 제거
- `rm -rf frontend-prediction/node_modules/.vite frontend-prediction/dist frontend-prediction/.vite`
- 강력 새로고침 가이드 제공 (`Ctrl/Cmd + Shift + R`)
- Playwright 3차 검증으로 5173/5174 모두 정상 동작 확인

## ✅ 최종 상태 요약
- 두 프론트엔드(LoginPage)에서 Ballpit 3D 배경 정상 실행
- Orb/Orb.css, BallpitSimple 등 실험 파일들은 코드베이스에 남아있으나 현재 미사용
- 모든 주요 포트(3000, 5173, 5174, 8000) 기동 상태 유지
- 검증 스크립트: `/tmp/verify-ballpit-effects.js` 성공 종료

## 📌 참고
- 전체 요약: `WORK_LOG_2025-10-07.md`
- 분 단위 상세 기록: `WORK_LOG_2025-10-07_DETAILED.md`
