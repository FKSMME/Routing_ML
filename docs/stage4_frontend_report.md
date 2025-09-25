# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

## Stage 4 Execution Report: 프런트엔드 (React)

### Gate Review Summary
- 승인 타임스탬프: 2025-09-25T07:00:00Z (Stage 3 산출물 재점검 후 오류 없음 확인)
- 범위 확인 항목: 3열 레이아웃, 후보 비교 카드, 사용자 안내 패널, TensorBoard Projector 링크, 접근성 요구
- 승인 전 확인 사항: Stage 3 API 사양(`/predict`, `/candidates/save`)과 응답 스키마 재검토, UI 뷰어 접근 사전 승인

### 설계
- **레이아웃 구조**: 상단 고정 헤더, 3열(후보 탐색, 후보 비교, 설명/이력)로 구성하며 카드 기반 UI 컴포넌트 사용. 각 열은 `Grid` 컨테이너로 배치, 반응형 브레이크포인트는 1440/1280/960/720px 기준으로 설정.
- **카드 컴포넌트 계층**: `CardShell`(공통 헤더/바디/푸터) → 세부 카드(`SimilarityControlsCard`, `CandidateTableCard`, `GuidanceCard`).
- **유사도 조정 UX**: 유사도 슬라이더(0.0~1.0, 기본 0.35, 0.05 간격)와 Top-K 드롭다운(5/10/15/20) 조합. 값 변경 시 디바운스 350ms 이후 백엔드 호출.
- **후보 라우팅 테이블**: 컬럼(`Routing ID`, `공정 단계`, `예상 시간`, `예상 비용`, `품질 점수`, `근거 라벨`). 다중 행 선택과 정렬(시간/비용/품질) 제공, 필터는 공정 단계/품질 등급 기준.
- **TensorBoard Projector 안내**: Projector 링크는 `tb_projector/index.html?run={model_version}` 포맷으로 안내하며 접근 전 승인 체크리스트 제공.
- **설명 패널 콘텐츠**: 주니어 작업자용 단계별 안내, 추천 수락 시 주의사항, KPI 영향 요약, 모델 버전 정보 표기.

### 구현 계획
- **프로젝트 구조**: `gui/src` 내 `pages/RecommendationBoard.tsx`, `components/similarity`, `components/candidates`, `components/guidance` 폴더 신설. 라우트는 `/routing/advisor`.
- **상태 관리**: `React Query` 기반 데이터 패칭, `Zustand` 스토어로 UI 상태(슬라이더 값, Top-K, 선택 후보) 관리.
- **공통 컴포넌트**: `CardShell`, `MetricBadge`, `SectionTitle`, `LoadingOverlay` 정의. 스타일은 `styled-components` 혹은 CSS Modules 병행.
- **테이블 구현**: `AgGrid` 도입 검토, 대안으로 `MUI DataGrid` 사용. 백엔드 응답을 정규화하여 `CandidateRow` 인터페이스로 매핑.
- **TensorBoard 링크 컴포넌트**: 모델 버전 메타데이터(`model_version`, `trained_at`)를 표시하고, 접근 시 승인 체크박스를 재확인하는 모달 제공.

### 테스트 전략
- **기능 테스트 케이스**: 슬라이더 값 변경 시 후보 재요청, Top-K 조합 변화, 후보 선택 후 상세 카드 업데이트, TensorBoard 링크 접근 모달 동작.
- **접근성**: 키보드 내비게이션, ARIA 라벨링, 색 대비(AA 기준) 체크리스트 작성. 스크린 리더 텍스트 제공 계획 포함.
- **사용성 테스트**: 주니어 작업자 3인 대상 리모트 세션, 시나리오(추천 수락/편집, KPI 확인) 정의. 인터뷰 스크립트에 승인 체크 질문 포함.
- **성능 가드레일**: 초기 로딩 3초 이하, 슬라이더/Top-K 변경 후 UI 업데이트 1초 이하 목표. Lighthouse 백그라운드 실행 계획 수립.

### 배포 준비
- **CI 파이프라인**: 백그라운드 GitHub Actions 워크플로우(`gui-ci.yml`)에서 lint/test/build 실행, main 병합 전 필수.
- **호스팅 전략**: `routing-ml-frontend` 정적 빌드 산출물 S3 + CloudFront, 내부 환경은 Nginx 리버스 프록시로 서빙.
- **문서 업데이트**: README에 UI 사용법 추가, 온보딩 가이드에 스크린샷 삽입 예정. 문서/뷰어 접근 전 승인 절차 명시.
- **게이트 종료**: Stage 4 완료 보고 후 Stage 5 승인 요청. 선행 단계 오류 미존재 재확인 보고 포함.

### 위험 및 후속 조치
- API 응답 지연 시 UI 로딩 처리 필요 → 백그라운드에서 스켈레톤 로더 구현 계획.
- TensorBoard Viewer 접근 권한 관리 필요 → IAM 역할 정의 및 승인 로그 남기기.
- 사용자 피드백 반영 결과는 Stage 8 문서화 단계에서 최종 반영 예정.

### 2025-02-15 구현 결과 요약
- React + Vite 기반 실구현 완료 (`frontend/src/App.tsx`, `frontend/src/components/*`).
- React Query 훅으로 FastAPI `/api/predict` 호출 체계 수립 (`frontend/src/hooks/usePredictRoutings.ts`).
- TailwindCSS 디자인 토큰 적용 및 3열 대시보드 레이아웃 구축.
