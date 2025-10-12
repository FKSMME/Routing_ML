# Frontend Improvement Plan – 2025-10-07

문서 근거: `WORK_LOG_2025-10-07_DETAILED.md` 리뷰 및 `frontend-prediction`, `frontend-training` 최신 소스 분석 결과  
분석 일시: 2025-10-07 11:10 (KST)  
대상: Prediction / Training 프런트엔드 (Vite + React + TypeScript)

---

## 1. 현황 요약 (Baseline Metrics)

| 항목 | frontend-prediction | frontend-training |
| --- | --- | --- |
| 소스 파일 수 (`src/`, ts/tsx/css) | 104 개 | 94 개 |
| 총 코드 라인 수 | 35,308 | 33,603 |
| TSX 라인 수 | 15,641 | 15,679 |
| TS 라인 수 | 12,816 | 12,427 |
| CSS 라인 수 | 6,851 | 5,497 |
| Ballpit 3D 효과 라인 수 | 741 | 741 |
| 빌드 타입 오류 | 40+ 건 (대표: `App.tsx:156`, `Ballpit.tsx:28`) | 유사 구조로 오류 다수 잠재 |
| 주요 의존성 | `three`, `ogl`, `reactflow`, `@tanstack/react-query`, `zustand` | Prediction과 대부분 동일, 추가: `dagre`, `@xyflow/react` |

파악된 이슈 요약
- Ballpit 3D 효과가 두 프로젝트에서 1:1 복제되어 유지보수 비용 및 번들 사이즈 상승.
- 실험/디버깅용 컴포넌트(`BallpitSimple`, `TestVisible`)가 남아 있어 빌드 결과에 혼선.
- `npm run build` 실행 시 타입 오류가 대량으로 발생하여 공식 배포 불가.
- `@/lib/*` 경로 등 import alias 일부가 실제 디렉터리 구조와 불일치.
- Playwright 버전이 서비스별로 달라 테스트 환경이 일관되지 않음.
- 시각 효과에 대한 성능/접근성 대비 전략 미흡.

---

## 2. 개선 목표

| 구분 | 목표 | 정량 지표 |
| --- | --- | --- |
| 코드 구조 | 공통 모듈화, 중복 제거 | Ballpit 중복 라인 수 50% 이상 감소 |
| 유지보수성 | 타입 안정성 확보 | `npm run build` 시 TS 오류 0건 |
| 번들/성능 | 초기 로딩 성능 개선 | 초기 JS 번들 사이즈 30% 감소, 로그인 페이지 TTI 2초 이내 |
| 접근성 | 효과 비활성 모드 제공 | `prefers-reduced-motion` 대응, Lighthouse A11y ≥ 95 |
| 테스트/배포 | 통합 파이프라인 정비 | CI 빌드/테스트 통과율 95% 이상, 배포 리드타임 30분 → 10분 |

---

## 3. 단계별 개선 계획

### Phase 1 – 코드 구조 정리 (1주)
- Ballpit, Orb 등 시각 효과 공통 모듈화(`common/visual-effects` 가칭) → 파일 중복 제거 및 Props 인터페이스 정규화.
- 미사용 컴포넌트·실험용 파일 정리(BallpitSimple, TestVisible 등) 및 import 경로 일괄 정비.
- 라인 수 목표: Prediction 35k → 32k, Training 33k → 30k (약 10% 감축).

### Phase 2 – 타입/스토어 모델 정렬 (2주)
- Zustand 스토어 타입 정의 재검토 (`useWorkspaceStore`, `useRoutingStore` 등) 및 DTO ↔ UI 모델 분리.
- Ballpit 클래스 내부 멤버 타입 명시, implicit any 제거.
- API 클라이언트 경로(`@/lib/apiClient` 등) → 실제 디렉터리 구조와 일치하도록 조정.
- 목표: `npm run build`, `npm run lint`, `npm run test` 모두 오류 0건.

### Phase 3 – 성능 및 번들 최적화 (2주)
- Vite 번들 분석(`vite build --mode analyze`) 후 Tree Shaking 강화, 코드 분할 적용, 필요 시 WebGL 효과 지연 로딩.
- Three.js 효과에 `matchMedia('(prefers-reduced-motion)')` 대응 추가, 저사양/저전력 기기 전환 지원.
- Lighthouse 측정: Performance ≥ 90, First Contentful Paint ≤ 2.0s.

### Phase 4 – 테스트·배포 체계 강화 (1주)
- Playwright 버전 통일(최신 1.55.1 기준) 및 공통 테스트 유틸 공유.
- 3D 배경 존재 여부를 확인하는 E2E 테스트 케이스 추가.
- `docs/deploy/frontend.md` 작성: 빌드 → 테스트 → 배포 순서 표준화, 대상 시스템별 명령 및 롤백 절차 포함.
- 목표: CI 파이프라인 자동화, 배포 성공률 ≥ 95%.

---

## 4. 리스크 및 완화 방안

| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| Ballpit 타입 보강 시 내부 로직 이해 필요 | 일정 지연 | Three.js API 레퍼런스 공유, 단위 테스트 작성 |
| 공통 모듈화 과정에서 서비스별 특수 로직 충돌 | 기능 회귀 | 코드 freeze → 단계별 병합, 회귀 테스트 강화 |
| 번들 최적화가 시각 효과 품질 저하로 이어질 가능성 | UX 하락 | 프리셋 기반 품질/성능 모드 제공, QA 스냅샷 비교 |
| CI 환경에서 WebGL 테스트 불가 | 테스트 누락 | `playwright`에서 `--disable-gpu` fallback 시나리오 검토, 스크린샷 기반 검증 |

---

## 5. 후속 액션

1. 각 Phase별 담당자와 일정 확정.
2. 공통 시각 효과 모듈 설계 초안 작성 → 리뷰.
3. 타입 오류 우선 순위 큐 작성, 린트/테스트 파이프라인 가동.
4. 번들 분석 결과에 따른 최적화 계획 세부화.
5. 배포 문서 초안 검토 및 QA 체크리스트 업데이트.

---

문의 또는 조정 요청은 Frontend Tech Lead 또는 문서 작성자에게 전달 바랍니다.  
작성자: Codex Assistant (2025-10-07)
