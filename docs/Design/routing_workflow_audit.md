# 라우팅 리팩토링 워크플로우 중복 및 이상 점검 보고서

## 1. 개요
- 사용자 지시에 따라 라우팅 리팩토링 전체 흐름을 다이어그램 형태로 재구성하고, 단계·계약·아티팩트 간 중복 여부와 이상을 확인했다.
- 확인 범위: `Tasklist.md`, `docs/Design` 내 아키텍처/계약 문서, `docs/sprint` 로그 및 체크리스트, `scripts/update_logbook.py`가 기록하는 실행 로그.

## 2. 전체 워크플로우 개요 다이어그램
```mermaid
flowchart TD
    A[Training Service\n배치/스케줄] --> B[전처리]
    B --> C[임베딩 생성]
    C --> D[HNSW 인덱스 구축]
    D --> E[models/<version> 산출]
    E --> F[manifest.json 생성]
    F --> G[registry.db 등록(active 전환 전)]
    G -->|승인 후| H[active_version 전환]
    H --> I[Inference Service\n상시/멀티워크]
    I --> J[예측 API 제공]
    J --> K[UI/블루프린터/매핑 프로파일]
    subgraph 계약 계층
        F
        G
        K
    end
    K --> L[관측/QA/Installer 자동화]
```
- 다이어그램은 PRD 및 `docs/Design/onprem_two_tier_architecture.md`에 정의된 2계층 구조와 신규 manifest/registry 계약 지점을 정규화한다.

## 3. 중복 점검 결과
| 점검 대상 | 발견 사항 | 조치 | 결과 |
| --- | --- | --- | --- |
| `Tasklist.md` Step 1 섹션 | `routing_enhancement_plan`, `backend_api_routing_groups_spec`, `routing_state_store_plan` 검토 항목이 중복 기재됨 | 중복 블록 제거 후 체크박스 수 재계산 | Sprint Pending 0, Completed 27로 정정 |
| 계약 문서 (`manifest_registry_api_outline.md`, `model_registry_schema_scenarios.md`) | 내용 중복 없음. manifest → registry → inference로 일관되게 연결됨 | 교차 검토 (각 문서 내 계약 ID/테이블 비교) | 이상 없음 |
| 프런트엔드 계획 (`frontend_state_transition_plan.md`, `frontend_layout_reactflow_checklist.md`) | 상태 전환/레이아웃 책임이 분리되어 있으나 공유 용어 교차 참조 필요 | 공통 용어(스토어 모듈 이름, ReactFlow 노드 타입) 표기 확인 | 중복/충돌 없음 |
| 로그/체크리스트 (`docs/sprint/hourly_history_20250929.md`, `docs/sprint/next_stage_checklist.md`) | 시간대별 로그와 그룹 체크리스트 간 항목 매핑 일치 | 신규 작업 시간대 로그 추가 준비 | 이상 없음 |

## 4. 이상 및 조치 상세
1. **Tasklist 헤더 수치 불일치**: 기존 값(미완료 31/완료 11)이 실제 체크박스 수와 불일치. → 중복 항목 제거 후 자동 계산 기준으로 0/27로 갱신.
2. **중복 항목 제거 후 검증**: `scripts/update_logbook.py`가 `tasks_remaining`을 집계하므로, 중복 제거가 로그 수치에 영향을 주는지 재확인. → 스크립트 실행 시 갱신된 수치가 출력되는 것을 확인 예정.
3. **다이어그램 정합성 확인**: Training→Inference 흐름이 모든 문서에 동일하게 반영됨을 교차 검토했으며, manifest/registry/매핑/블루프린터 계약 경계가 충돌하지 않음을 재확인.

## 5. 후속 권장 사항
- Tasklist 업데이트 시 중복 방지를 위해 PR 병합 전에 `scripts/update_logbook.py` 또는 전용 체크 자동화 훅 실행 권장.
- 다이어그램은 추후 UI에서 제공할 시각화의 기초가 되므로 `docs/Design` 내 추가 다이어그램(예: UI 플로우)을 생성할 때 동일한 노드 명명 규칙을 재사용할 것.
- 계약 문서 갱신 시 manifest와 registry 키 값, 매핑 프로파일 ID를 표준화된 표로 추적하여 중복 정의를 예방.
