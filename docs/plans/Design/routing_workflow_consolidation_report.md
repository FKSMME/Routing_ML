# 라우팅 워크플로우 정비 및 중복 점검 보고서 (2025-09-29 23시)

## 1. 지시 수락 및 범위
- 유지보수 용이성, 사용자 친화 UI, 데이터·학습 시각화, 설치 자동화, 개발 난이도 완화를 기존 구조를 유지하면서 달성하라는 지시를 재확인했다.
- 절대 지령에 따라 Codex 응답과 사용자 지시, Tasklist 상태를 시간 단위로 남기고 잔여 작업 수량을 정량 보고한다.
- 전체 워크플로우 문서·코드 전반의 중복을 검토하고, 이상 징후와 불필요한 코드 파일을 정리한다.

## 2. 엔드투엔드 워크플로우 다이어그램
```mermaid
flowchart TD
    U[사용자 지시 수신] --> L[로그 및 Tasklist 현황 재확인]
    L --> T[Training Service]
    T --> T1[Access 전처리]
    T1 --> T2[임베딩/HNSW 생성]
    T2 --> T3[models/<version> 산출]
    T3 --> T4[manifest.json 작성]
    T4 --> T5[registry.db 등록(inactive)]
    L --> I[Inference Service]
    T5 -->|활성 전환| I1[active_version 로드]
    I1 --> I2[모델/인덱스 초기화]
    I2 --> I3[예측 API]
    I3 --> I4[관측성 로그/대시보드]
    I3 --> UI[UI & 블루프린터]
    UI --> UI1[DnD 라우팅 편집]
    UI --> UI2[규칙 검증/매핑 프로파일]
    UI --> UI3[옵션 패널(시각화/내보내기)]
    L --> Ops[설치·운영 자동화]
    Ops --> Ops1[Installer 검증]
    Ops --> Ops2[Windows 스케줄러/헬스체크]
    L --> Dev[DevEx 품질 훅]
    Dev --> Dev1[pre-commit/pytest]
```
- 다이어그램은 `docs/Design/onprem_two_tier_architecture.md`, `docs/Design/routing_workflow_final_validation.md`와 일치하도록 최신화했다.

## 3. 중복 점검 결과
| 구분 | 확인 방법 | 결과 |
| --- | --- | --- |
| 워크플로우 문서 | `routing_workflow_*` 4종 교차 검토 | 관점별 차별화 유지 (감사/무결성/실행/정비) |
| 코드 중복 | SHA-1 해시 비교 스크립트(`python` 전 경로 검사) | 사용자 코드 중복 없음, node_modules UMD/ESM 쌍만 중복 |
| 로그 체계 | `docs/sprint/hourly_history_20250929.md`, `docs/sprint/logbook.md`, `logs/task_execution_20250929.log` | 23시 로그 추가로 시·분 단위 연속성 확보 |

## 4. 이상 징후 및 조치
1. **미사용 프런트엔드 컴포넌트**: `DataSourceConfigurator`, `ExportOptionsPanel`, `TrainingConsole`이 실제 UI 흐름에서 참조되지 않아 혼선을 유발했다. → 파일 삭제 후 PRD/절대지령 보고서에서 기능 전달 방식을 갱신했다.
2. **시각화 옵션 중복 정의**: Export 옵션이 전용 패널과 라우팅 워크스페이스 옵션 카드에서 이중 정의되어 있었다. → 옵션 제어를 워크스페이스 내 단일 패널로 통합하고 문서 반영.
3. **데이터 소스 편집 경로 불명확**: DataSourceConfigurator가 제거되면서 데이터 소스 편집 위치가 모호했다. → `MasterDataWorkspace` 메타데이터 패널과 향후 블루프린터 확장을 이용하도록 재명세했다.

## 5. 정리된 불필요 코드 파일
| 경로 | 비고 |
| --- | --- |
| `frontend/src/components/DataSourceConfigurator.tsx` | MasterDataWorkspace에서 기능 중복, 미사용 상태로 제거 |
| `frontend/src/components/ExportOptionsPanel.tsx` | 라우팅 워크스페이스 옵션 카드로 기능 통합 |
| `frontend/src/components/TrainingConsole.tsx` | 학습 상태는 `TrainingStatusWorkspace`에서 제공, 전용 콘솔 미사용 |

## 6. 남은 작업 수량 보고
- `Tasklist.md` 기준 잔여 작업 0건, 완료 27건을 유지했다.
- 절대 지령 로그는 23시 항목을 추가해 사용자 지시와 Codex 응답이 모두 기록되었다.

## 7. 후속 권고
- 데이터 소스/옵션 패널 재구현 시 이번 보고서의 단일 패널 원칙을 준수하고, 도입 전 테스트 케이스를 `tests/test_sql_column_config.py`에 추가할 것.
- 로그 자동 검증 훅 설계 시 SHA-1 중복 검사를 사내 코드 경로만 대상으로 제한해 노드 모듈 중복을 필터링한다.
