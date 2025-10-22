# Phase 2 설계안 – 인증 가드, 로딩 UX, 401 대시보드

**작성일**: 2025-10-22  
**작성자**: Codex  
**대상**: Prediction Routing 생성 페이지 (frontend-prediction) & 백엔드 API

---

## 1. 인증 가드 코드 변경안

### 1.1 적용 범위
- 파일: `frontend-prediction/src/App.tsx`
- 훅: `usePredictRoutings` (React Query)
- 상태: `useAuthStore().isAuthenticated`, `useWorkspaceStore().itemSearch.itemCodes`

### 1.2 제안 변경
```tsx
const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
const hasSearchItems = itemCodes.length > 0;

const { data, isLoading, isFetching, error, refetch } = usePredictRoutings({
  ...,
  enabled: isAuthenticated && hasSearchItems,
});
```

- 로그인 완료 전에는 `queryFn` 이 실행되지 않도록 `enabled` 옵션을 추가.
- `checkAuth()` 완료 이후 `isAuthenticated` 가 true로 전환될 때만 첫 호출 수행.
- `itemCodes` 가 비어있으면 예측 API 호출을 막아 초기 페이지 로딩 시 401 오류를 제거.

### 1.3 영향도 & 테스트
- 영향 범위: Prediction 탭 기본 워크플로, React Query 캐시.
- 테스트:
  1. 비로그인 상태로 `/` 진입 → `usePredictRoutings` 호출 안되는지 확인.
  2. 로그인 후 `itemCodes` 입력 → 예측 API 호출 정상 작동.
  3. `itemCodes` 삭제 후 다시 빈 배열 → 쿼리 비활성 확인.

---

## 2. 로딩 UX 초안 비교

| 옵션 | 설명 | 장점 | 단점 | 권장안 |
| --- | --- | --- | --- | --- |
| A. 상단 로딩 스피너 | 기존 페이지 그대로 유지, 중앙 스피너+“인증 확인 중” 배너 | 구현 간단, 전환 빠름 | 사용자가 무엇을 기다리는지 모호 | 후보 |
| B. 허브(Welcome) 화면 | 인증 완료 전까지 전용 허브 화면 표시(상태 메시지, FAQ 링크) | 상태 안내 명확, 온보딩 정보 제공 | 라우팅 저장·복귀 처리 추가 필요 | **선호** – 401 발생 빈도 높아 UX 개선 효과 큼 |

### 2.1 허브 화면 스케치
- 구성 요소: 로고, “세션 확인 중입니다” 메시지, 예상 시간(최대 5초), 문제 발생 시 안내 버튼(로그아웃/새로고침).
- 구현: `authLoading === true` 인 동안 기존 스피너 대신 새 컴포넌트 렌더.
- 접근성: 라이브 영역(`aria-live="polite"`) 에 진행상태 안내 문구 제공.

---

## 3. 401/토큰 대시보드 스펙

### 3.1 수집 지표 (FastAPI 미들웨어)
- 메트릭 이름 예시: `auth_401_total`, `prediction_401_total`
- 태그: `endpoint`, `client_host`, `user_agent`, `environment`
- 로그 필드: timestamp(UTC+9), username, failure_reason (`token_missing`, `token_expired`, `unauthorized`)

### 3.2 Prometheus / Grafana 패널
- **패널 1**: 401 응답 추이 (5분 단위) – 급증 시 알람(임계치: 3분 동안 10회 이상)
- **패널 2**: 평균 인증 응답 시간 – `GET /api/auth/me` latency (95퍼센타일)
- **패널 3**: 예측 API 실패 사유 분포 파이 차트 – `failure_reason` 기준

### 3.3 알람 기준
- 조건: 5분 내 `auth_401_total` > 15 또는 `prediction_401_total` > 6
- 액션: Slack #routing-alert 채널 알림, Runbook 링크 포함

### 3.4 구현 순서
1. FastAPI 미들웨어에서 401 응답 시 `metrics.increment()` 호출.
2. Prometheus exporter 업데이트 및 `metrics/` 엔드포인트에 지표 노출.
3. Grafana 대시보드 패널 생성 (JSON export 템플릿 저장).

---

## 4. 후속 작업
- 위 제안에 대해 Frontend/Backend 리드 승인 후 Sprint 작업 항목 생성.
- QA: 로그인/로그아웃, 세션 만료 시나리오 자동화(PW 테스트) 추가 검토.
- 문서화: 운영 Runbook에 허브 화면 도입 시 행동 지침 업데이트.

