# 긴급 수정 계획서 - 2025-10-05

**작성 시각**: 2025-10-05 08:36 UTC
**심각도**: 🚨 긴급 (Critical)
**예상 소요 시간**: 1-2시간

---

## 🔍 발견된 문제 (사용자 리포트)

### 1. ParticleBackground 무한루프 타임아웃 ⚠️ **치명적**
**증상**:
```
Script terminated by timeout at:
animate@http://localhost:5174/src/components/ParticleBackground.tsx:70:17
```

**원인**:
- 파티클 개수 150개로 과다
- requestAnimationFrame 무한 재귀 호출
- 브라우저 메인 스레드 점유

**영향**:
- 브라우저 프리징
- CPU 사용률 100%
- 사용자 경험 불가능

### 2. Vite HMR 변경사항 미반영 ⚠️ **치명적**
**증상**:
- 04:04 UTC부터 현재까지의 코드 변경사항이 브라우저에 반영되지 않음
- 캐시 클리어해도 동일

**원인**:
- Vite 개발 서버가 변경사항 감지 못함
- 또는 서버 재시작 필요

**영향**:
- 모든 UI/UX 개선사항 미적용
- 낙하 + 먼지 효과 확인 불가

### 3. 소스맵 에러 🔶 **중간**
**증상**:
```
소스 맵 오류: No sources are declared in this source map.
리소스 URL: http://localhost:5174/node_modules/.vite/deps/react.js
```

**원인**:
- Vite의 dependency pre-bundling 소스맵 문제
- node_modules 내부 라이브러리 소스맵 누락

**영향**:
- 디버깅 불편
- 콘솔 에러 메시지 노이즈

### 4. 메뉴바 텍스트 안보임 🔶 **중간**
**증상**:
- 메뉴바의 텍스트가 보이지 않음
- 두 사이트 모두 동일

**원인** (추정):
- 텍스트 색상이 배경색과 동일
- z-index 문제로 다른 요소에 가려짐
- CSS 파스텔톤 적용 시 색상 값 오류

**영향**:
- 네비게이션 불가능
- 사용성 치명적 저하

### 5. 메뉴바 고정으로 화면 가림 🔶 **중간**
**증상**:
- 스크롤 시 메뉴바가 고정되어 있어 화면 가림
- 답답함

**원인**:
- CSS `position: fixed` 또는 `sticky`
- 의도된 디자인이지만 사용자 불만

**영향**:
- 콘텐츠 가시성 저하
- UX 불편

### 6. 페이지별 레이아웃 불일치 🔶 **중간**
**증상**:
- 메뉴바와 페이지 크기 불일치
- 글자 크기 제각각
- 통일감 없음

**원인**:
- CSS 표준화 미적용
- 페이지마다 다른 스타일 사용

**영향**:
- 비전문적 인상
- 브랜드 일관성 저하

### 7. 다크모드/라이트모드 미작동 🔷 **낮음**
**증상**:
- 토글 버튼 작동하지 않음

**원인** (추정):
- 테마 전환 로직 미구현
- 또는 CSS 변수 바인딩 문제

**영향**:
- 기능 미제공

### 8. API 500 에러 🔶 **중간**
**증상**:
```
POST http://localhost:5173/api/predict
Status: 500 Internal Server Error
```

**원인** (추정):
- 백엔드 API 코드 오류
- 또는 데이터베이스 연결 문제

**영향**:
- 라우팅 예측 기능 불가
- 핵심 기능 장애

---

## 📋 수정 우선순위 및 계획

### Phase 1: 긴급 수정 (30분)
**목표**: 사이트 기본 동작 가능하도록

#### 1.1. ParticleBackground 성능 최적화 ⚡
**작업 내용**:
- [x] 파티클 개수 150 → 50으로 감소
- [ ] requestAnimationFrame throttling 추가
- [ ] 성능 모니터링 추가 (FPS)

**예상 시간**: 10분

**수정 파일**:
- `frontend-prediction/src/components/ParticleBackground.tsx`
- `frontend-training/src/components/ParticleBackground.tsx`

#### 1.2. 서버 재시작 (HMR 문제 해결) ⚡
**작업 내용**:
- [ ] Frontend Prediction 서버 재시작 (port 5173)
- [ ] Frontend Training 서버 재시작 (port 5174)
- [ ] 브라우저 강제 새로고침 가이드 작성

**예상 시간**: 5분

**명령어**:
```bash
# 기존 서버 종료
pkill -f "vite.*5173"
pkill -f "vite.*5174"

# 재시작
cd /workspaces/Routing_ML_4/frontend-prediction && npm run dev &
cd /workspaces/Routing_ML_4/frontend-training && npm run dev &
```

#### 1.3. 메뉴바 텍스트 가시성 긴급 수정 ⚡
**작업 내용**:
- [ ] MainNavigation 컴포넌트 텍스트 색상 확인
- [ ] CSS 변수 `--text-primary-light` 값 확인
- [ ] 대비비율 확보 (WCAG AA: 4.5:1)

**예상 시간**: 15분

**체크 포인트**:
```css
/* 확인할 CSS 변수 */
--text-primary-light: #f1f5f9 /* 현재 값 */
--surface-menu-light: #475569 /* 메뉴바 배경 */

/* 대비비율 계산 */
/* White (#f1f5f9) vs Slate (#475569) ≈ 7.5:1 (양호) */
```

---

### Phase 2: UI 일관성 확보 (30분)
**목표**: 메뉴바 및 레이아웃 통일

#### 2.1. 메뉴바 고정 해제 또는 조정
**작업 내용**:
- [ ] MainNavigation CSS 확인 (`position` 속성)
- [ ] 옵션 1: `position: fixed` → `position: relative`
- [ ] 옵션 2: 메뉴바 높이 축소 (60px → 48px)
- [ ] 옵션 3: 자동 숨김/표시 (스크롤 방향에 따라)

**예상 시간**: 15분

#### 2.2. 페이지 레이아웃 CSS 표준화 적용
**작업 내용**:
- [ ] 모든 페이지에 `.panel-card` 클래스 적용
- [ ] 글자 크기 통일:
  - 제목: `1.5rem` (24px)
  - 본문: `1rem` (16px)
  - 설명: `0.875rem` (14px)
- [ ] 간격 통일: `--spacing-lg` (24px)

**예상 시간**: 15분

---

### Phase 3: 기능 수정 (30분)
**목표**: 다크모드 및 API 정상화

#### 3.1. 다크모드/라이트모드 토글 구현
**작업 내용**:
- [ ] 테마 전환 로직 확인 (useTheme hook?)
- [ ] CSS 변수 다크모드 버전 정의
- [ ] 토글 버튼 이벤트 핸들러 연결

**예상 시간**: 20분

#### 3.2. API 500 에러 디버깅
**작업 내용**:
- [ ] 백엔드 로그 확인 (uvicorn 출력)
- [ ] `/api/predict` 엔드포인트 코드 확인
- [ ] 요청 페이로드 검증
- [ ] 응답 수정

**예상 시간**: 10분

---

### Phase 4: 검증 및 문서화 (30분)

#### 4.1. 브라우저 테스트
**체크리스트**:
- [ ] Prediction (5173): 메뉴바 텍스트 보임
- [ ] Training (5174): 메뉴바 텍스트 보임
- [ ] 파티클 애니메이션 부드러움 (타임아웃 없음)
- [ ] 메뉴 전환 시 낙하 + 먼지 효과 확인
- [ ] 스크롤 시 메뉴바 동작 확인
- [ ] 다크모드 토글 작동
- [ ] API 호출 성공 (200 OK)

#### 4.2. 문서 업데이트
**작성 문서**:
- [ ] URGENT_FIX_REPORT_20251005.md (수정 결과 보고)
- [ ] BROWSER_CACHE_CLEAR_GUIDE.md (사용자 가이드)
- [ ] IMPROVEMENT_LOG.md (전체 이력 업데이트)

---

## 🛠️ 기술 세부사항

### ParticleBackground 최적화 전략

**Before (문제)**:
```typescript
const PARTICLE_COUNT = 150;

const animate = () => {
  particles.forEach((particle, index) => {
    // 매 프레임마다 150개 파티클 계산
  });
  requestAnimationFrame(animate); // 무조건 재귀 호출
};
```

**After (해결)**:
```typescript
const PARTICLE_COUNT = 50; // 1/3로 감소

let lastTime = 0;
const FPS_LIMIT = 60;
const FRAME_INTERVAL = 1000 / FPS_LIMIT;

const animate = (currentTime: number) => {
  const delta = currentTime - lastTime;

  if (delta < FRAME_INTERVAL) {
    requestAnimationFrame(animate);
    return;
  }

  lastTime = currentTime;

  // 파티클 업데이트 (50개만)
  particles.forEach(...);

  requestAnimationFrame(animate);
};
```

**효과**:
- CPU 사용률: ~60% 감소
- 프레임 드롭 방지
- 브라우저 응답성 개선

### 메뉴바 텍스트 가시성 수정

**확인할 CSS 경로**:
```
frontend-prediction/src/index.css
frontend-prediction/src/components/MainNavigation.tsx (인라인 스타일)
```

**수정 예시**:
```css
/* Before (추정) */
.main-nav__item {
  color: var(--primary-pastel); /* #7dd3fc - 너무 밝아서 안보일 수 있음 */
}

/* After */
.main-nav__item {
  color: var(--text-primary-light); /* #f1f5f9 - 명확한 흰색 */
}
```

### 서버 재시작 및 캐시 클리어

**사용자 가이드**:
1. **개발자**: 서버 재시작
   ```bash
   # Ctrl+C로 종료 후
   npm run dev
   ```

2. **브라우저 캐시 클리어**:
   - Chrome/Edge: `Ctrl + Shift + Delete` → 캐시된 이미지 및 파일 체크 → 삭제
   - Firefox: `Ctrl + Shift + Delete` → 캐시 체크 → 지금 지우기
   - 또는 **강제 새로고침**: `Ctrl + F5` (Windows) / `Cmd + Shift + R` (Mac)

3. **Vite 캐시 클리어**:
   ```bash
   rm -rf node_modules/.vite
   npm run dev
   ```

---

## 📊 예상 타임라인

```
08:36 - 08:45 UTC: Phase 1.1 ParticleBackground 최적화
08:45 - 08:50 UTC: Phase 1.2 서버 재시작
08:50 - 09:05 UTC: Phase 1.3 메뉴바 텍스트 수정
---
09:05 - 09:20 UTC: Phase 2.1 메뉴바 고정 조정
09:20 - 09:35 UTC: Phase 2.2 레이아웃 표준화
---
09:35 - 09:55 UTC: Phase 3.1 다크모드 구현
09:55 - 10:05 UTC: Phase 3.2 API 에러 수정
---
10:05 - 10:35 UTC: Phase 4 검증 및 문서화
---
예상 완료: 10:35 UTC (2시간 소요)
```

---

## ✅ 완료 기준 (Definition of Done)

### 필수 (Must Have)
- [ ] ParticleBackground 타임아웃 에러 0건
- [ ] 메뉴바 텍스트 모든 페이지에서 명확히 보임
- [ ] 낙하 + 먼지 효과 브라우저에서 확인 가능
- [ ] API 호출 성공률 > 95%

### 권장 (Should Have)
- [ ] 메뉴바 스크롤 시 UX 개선
- [ ] 페이지 레이아웃 일관성 > 80%
- [ ] 다크모드 작동

### 선택 (Nice to Have)
- [ ] 소스맵 에러 0건
- [ ] TypeScript 에러 < 50개

---

## 🚨 롤백 계획

문제 발생 시:

```bash
# 1. ParticleBackground 완전 비활성화
# App.tsx에서 <ParticleBackground /> 주석 처리

# 2. 이전 버전 체크아웃
git stash
git checkout <이전_커밋_해시>

# 3. 서버 재시작
pkill -f vite
npm run dev
```

---

**작성자**: Claude Code
**검토 필요**: 즉시
**승인자**: 사용자
