# Checklist — TensorBoard 페이지 복구

**Date**: 2025-10-24  
**Related PRD**: docs/planning/PRD_2025-10-24_tensorboard-page-fix.md  
**Status**: Not Started

---

## Phase 1: API 계약 점검 및 데이터 파이프라인 복원

- [x] (1.5h) 백엔드 TensorBoard config/projector 엔드포인트 실제 응답 스키마 검증
- [x] (1.0h) `@app-types/tensorboard` 타입 정의와 API 응답 매핑 재작성
- [x] (1.5h) `@lib/apiClient` TensorBoard 관련 함수 에러 처리/재시도 로직 보강
- [x] (2.0h) 로컬 워크플로 설정(`workflow_settings.json`)과 모델 아티팩트 경로 점검

**Estimated Time**: 6h  
**Dependencies**: 백엔드 서비스 기동, 최신 모델 아티팩트(`models/default/tb_projector/`) 존재  
**Acceptance Criteria**:
- API 호출이 200 응답을 반환하고, 타입가드/파서가 모든 필드를 통과한다.
- 실패 시 에러 메시지/재시도 전략이 문서화된다.
- 환경 설정이 TensorBoard 내보내기 경로와 일치한다.

**Git Operations**:
- [ ] Run monitor build validation sequence (`.\.venv\Scripts\python.exe -m PyInstaller --clean --noconfirm RoutingMLMonitor_v5.2.5.spec` → verify `deploy\build_monitor_v5.bat` outputs `RoutingMLMonitor_v5.2.5.exe` → `.\.venv\Scripts\python.exe scripts\server_monitor_dashboard_v5_1.py`)
- [ ] Commit Phase 1
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 2: 프런트엔드 상태 및 시각화 개선

- [x] (2.0h) `useTensorboardStore` 상태 머신 리팩터링(로딩/에러/ready 플래그, 폴링 주기)
- [ ] (3.0h) `TensorboardEmbeddingPanel` 3D/히트맵 컴포넌트 데이터 파이프라인 정리 및 렌더링 복구
- [ ] (2.0h) Export 버튼, 상태 알림 토스트, Projector 리스트 새로고침 연결
- [ ] (3.0h) Metrics 차트(ReactECharts) 실데이터 연결 및 빈 상태/에러 UI 구현

**Estimated Time**: 10h  
**Dependencies**: Phase 1 완료, 프런트엔드 런타임 환경(Vite dev server) 기동  
**Acceptance Criteria**:
- 페이지 최초 진입 시 Skeleton → 실데이터 UI 흐름이 어긋남 없이 동작한다.
- Export 성공/실패 흐름이 QA 로그와 일치한다.
- Heatmap/3D/클러스터 UI가 성능 목표(60fps 목표) 내에서 렌더링된다.

**Git Operations**:
- [ ] Run monitor build validation sequence (`.\.venv\Scripts\python.exe -m PyInstaller --clean --noconfirm RoutingMLMonitor_v5.2.5.spec` → verify `deploy\build_monitor_v5.bat` outputs `RoutingMLMonitor_v5.2.5.exe` → `.\.venv\Scripts\python.exe scripts\server_monitor_dashboard_v5_1.py`)
- [ ] Commit Phase 2
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 3: QA, 테스트, 문서화

- [ ] (1.5h) Vitest/RTL 기반 단위 테스트(`tensorboardStore`, `TensorboardEmbeddingPanel` 핵심 분기) 작성
- [ ] (1.0h) 수동 QA 시나리오 실행(데이터 없음, 오류, 정상 케이스) 및 증적 캡처
- [ ] (1.0h) `docs/guides/frontend-training` 문서 업데이트 및 운영 체크리스트 작성
- [ ] (0.5h) 회귀 리그레이션: 다른 Training 메뉴 영향도 검증

**Estimated Time**: 4h  
**Dependencies**: Phase 1·2 완료, 테스트 러너 환경(Vitest) 설치  
**Acceptance Criteria**:
- 신규 테스트 통과 및 CI 스크립트(해당 시) 성공.
- QA 증적이 저장소에 기록되고, 이슈 재현 절차가 명확하다.
- 문서 변경이 리뷰되었으며 운영팀이 TensorBoard 사용법을 이해할 수 있다.

**Git Operations**:
- [ ] Run monitor build validation sequence (`.\.venv\Scripts\python.exe -m PyInstaller --clean --noconfirm RoutingMLMonitor_v5.2.5.spec` → verify `deploy\build_monitor_v5.bat` outputs `RoutingMLMonitor_v5.2.5.exe` → `.\.venv\Scripts\python.exe scripts\server_monitor_dashboard_v5_1.py`)
- [ ] Commit Phase 3
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Progress Tracking

Phase 1: [##########] 100% (4/4 tasks)  
Phase 2: [##........] 25% (1/4 tasks)  
Phase 3: [..........] 0% (0/4 tasks)

Total: [####......] 42% (5/12 tasks)
