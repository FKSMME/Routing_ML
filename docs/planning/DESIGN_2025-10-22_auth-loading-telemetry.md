# 인증 로딩 UX & 401 모니터링 설계 (2025-10-22)

**작성일**: 2025-10-22  
**작성자**: Codex  
**대상**: `frontend-prediction`, FastAPI 인증 미들웨어

---

## 1. 인증 상태 머신 설계

### 1.1 상태 정의
| 상태 | 설명 | persist | 진입 조건 |
| --- | --- | --- | --- |
| `unknown` | 저장된 세션을 검증하기 전 초기 상태 | ❌ | 앱 부트/스토리지 하이드 시 |
| `authenticating` | `/api/auth/me` 호출 중 | ❌ | `unknown → authenticating`, 재시도 시 |
| `authenticated` | 토큰 검증 성공 & 승인 계정 | ✅ | 200 응답 & `status==="approved"` |
| `guest` | 토큰 없음/만료 | ✅ | 401/403 응답, 명시적 로그아웃 |
| `error` | 네트워크/서버 오류 | ❌ | `fetch` 실패, 5xx 응답 |

### 1.2 전이 다이어그램
```
unknown ──hydrate──► authenticating ──200/approved──► authenticated
   │                                  ├─401/403──────► guest
   │                                  └─network─────► error ──재시도──► authenticating
authenticated ──logout/expiry──► guest ──login 성공──► authenticated
```

### 1.3 구현 지침
- `persist` 저장소에 `status` / `isAuthenticated` / `isAdmin`을 저장하지 않는다. 필요 시 `partialize` 옵션 사용.
- `onRehydrateStorage` 훅에서 항상 `{ status: "unknown" }`으로 재설정 후 `checkAuth()` 트리거.
- `checkAuth()`는 `status`를 단계적으로 업데이트하고, 응답의 `expires_at`을 저장해 남은 시간이 0 이하가 되면 자동 `guest` 전환.
- `logout()`은 백엔드 실패 여부와 무관하게 로컬 상태를 `guest`로 전환하고, 세션 스토리지를 즉시 비운다.
- 상태 값과 함께 `lastCheckedAt`, `lastError` 등을 저장해 UX에서 재시도/경고를 제어한다.

---

## 2. React Query 게이트 & UX 플로우

### 2.1 쿼리 활성 조건
```tsx
const status = useAuthStore((state) => state.status);
const authReady = status === "authenticated";
const isChecking = status === "authenticating";
const predictQueryEnabled = authReady && !isChecking && itemCodes.length > 0;

const { data, isLoading, isFetching, error } = usePredictRoutings({
  ...,
  enabled: predictQueryEnabled,
  retry: false,
  meta: { requiresAuth: true },
});
```
- `meta.requiresAuth`는 공통 에러 핸들러에서 401 발생 시 `guest`로 전환하는 트리거로 사용.
- `itemCodes` 변경으로 인한 재실행 시에도 `status`가 `authenticated`일 때만 API를 호출한다.

### 2.2 UI 상태 요약
| 상태 | 화면 요소 | 상세 |
| --- | --- | --- |
| `authenticating` | `AuthLoadingScreen` + skeleton | 텍스트: “재인증을 진행하고 있습니다. 잠시만 기다려 주세요.”, `aria-live="polite"` |
| `authenticated` & 추천 대기 | Recommendations 탭 기본 노출, `usePredictRoutings` 반복 | 배너: “추천 계산 중…” |
| `guest` (만료) | 로그인 페이지 또는 Prediction 탭 배너 | 배너: “로그인이 만료되었습니다. 다시 로그인해 주세요.”, 버튼: `로그인 화면 이동` |
| `error` | 토스트 + 재시도 버튼 | 메시지: “인증 서버와 통신할 수 없습니다. 다시 시도해 주세요.”, 재시도 시 `checkAuth()` |

### 2.3 UX 플로우 요약
1. 앱 부팅 → `status="unknown"` → 즉시 `checkAuth()` → `authenticating`.
2. 성공 시 `authenticated`로 이동하고 Recommendations 탭을 기본 탭으로 강제.
3. `/api/predict` 등에서 401이 발생하면 전역 인터셉터가 `guest`로 전환하고 로그인 화면으로 리디렉션.
4. 네트워크 장애 시 `error` → 재시도 버튼 또는 일정 시간 후 자동 재시도(backoff 2/4/8초).

---

## 3. 401/토큰 모니터링 설계

### 3.1 Prometheus 지표
```python
auth_401_total = Counter(
    "routing_ml_auth_401_total",
    "401 responses resolved by the auth layer",
    labelnames=["endpoint", "failure_reason", "environment"],
)
auth_handshake_latency = Histogram(
    "routing_ml_auth_handshake_seconds",
    "Latency of /api/auth/me handshake",
    buckets=[0.2, 0.5, 1, 2, 5]
)
```
- `failure_reason`: `missing_token`, `expired`, `unauthorized`, `csrf`, `invalid_signature`.
- `environment`: `dev`, `staging`, `prod` (CI에선 `test`).
- 필요 시 `routing_ml_auth_sessions_active` Gauge로 활성 세션 추적.

### 3.2 Grafana 패널/알람
1. **401 Trend**: `sum by (endpoint)(increase(routing_ml_auth_401_total[5m]))` → 5분 동안 15회 초과 시 경보.
2. **Failure Breakdown**: `topk(5, sum by (failure_reason)(increase(...[1h])))` 파이/바 차트.
3. **Handshake Latency**: `histogram_quantile(0.95, sum(rate(routing_ml_auth_handshake_seconds_bucket[5m])) by (le))`.
4. **SLO 패널**: 하루 기준 401 비율 `< 1%` 유지 여부 확인.

경보 룰 예시:
```
sum(increase(routing_ml_auth_401_total[5m])) > 15
 OR
sum(increase(routing_ml_auth_401_total{endpoint="/api/predict"}[5m])) > 6
```
→ Slack `#routing-alert`, Runbook 링크 포함.

### 3.3 구현 순서
1. FastAPI 미들웨어에 Counter/Histogram 계측 코드 추가.
2. `/metrics` exporter에 새 지표가 노출되는지 확인하고, pytest로 스냅샷 검증.
3. Grafana JSON 패널을 `deliverables/grafana/routing-auth.json`으로 버전 관리.
4. Alert Rule을 인프라 repo (`infrastructure/grafana/alerts`)에 PR.

---

## 4. 체크리스트 연계 작업
- Phase 1 체크리스트의 “상태 머신 정비안”은 본 문서 1장으로 충족.
- React Query 게이트/UX 정의는 2장에서 커버.
- 401 메트릭 설계는 3장에서 상세화했으며, 구현 시 스크린샷/지표 예시를 추가 예정.
- 향후 QA 항목은 `docs/planning/QA_2025-10-22_canvas-recommendations.md`에 Pass/Fail 결과를 기록한다.
