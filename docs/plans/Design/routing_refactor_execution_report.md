# 라우팅 ML 리팩토링 실행 점검 보고서

본 문서는 온프레미스/윈도우/오프라인 환경에서 진행한 라우팅 ML 리팩토링 과업 전반을 재점검하고, 절대 지령에 따른 로그·작업 이력·잔여 작업 수량 보고를 체계화하기 위한 최종 점검 결과를 정리한다.

## 1. 전체 워크플로우 점검 요약

```mermaid
graph TD
    subgraph Training Service (배치)
        A[Access 추출 및 전처리] --> B[임베딩 생성]
        B --> C[HNSW 인덱스 빌드]
        C --> D[models/<version> 산출]
        D --> E[manifest.json 생성]
        E --> F[registry.db 등록 (inactive)]
        F -->|승인 후| G[active_version 전환]
    end

    subgraph Inference Service (상시)
        G --> H[active manifest 로드]
        H --> I[예측 API 처리]
        I --> J[구조화 로그/대시보드]
    end

    subgraph UI/운영
        K[인증·권한] --> L[라우팅 편집 Drag&Drop]
        L --> M[규칙 검증]
        M --> N[매핑 프로파일 관리]
        N --> O[블루프린터 그래프 저장]
        O --> P[코드/설정 자동 갱신]
    end

    subgraph 설치/운영 자동화
        Q[Inno/WiX 인스톨러] --> R[서비스 등록]
        R --> S[Windows 작업 스케줄러]
        S --> T[/health 사후 검증]
    end
```

* Training/Inference/운영 세부 플로우를 하나의 다이어그램으로 묶어 중복 노드 여부를 검증하였다.
* manifest.json·registry.db·매핑 프로파일·블루프린터 그래프 JSON 등 네 가지 계약 지점을 기준으로 인터페이스 간 결합 관계를 재확인하였다.

## 2. 중복 및 이상 징후 상세 점검

| 점검 대상 | 중복 여부 | 발견 내용 | 조치 | 비고 |
| --- | --- | --- | --- | --- |
| 모델 아티팩트 경로 (`models/<version>`) | 없음 | 기존 joblib/json 구조 유지 | manifest/registry 메타만 추가 | 역호환성 만족 |
| manifest/registry 계약 | 없음 | Training 산출물과 Inference 로더 간 계약 일치 | registry active 전환 체크리스트 재확인 | 전환 절차 문서화 완료 |
| 라우팅 편집/규칙 검증 UX | 없음 | Drag&Drop/배지/토스트 시나리오 정상 | ReactFlow 체크리스트와 일치 확인 | UI 가이드 준수 |
| 매핑 프로파일 CRUD | 없음 | 입력/출력 화이트리스트/필수 컬럼 검증 루틴 정상 | 서버측 스키마 검증 리포트 확인 | Config 변경 감사 로그 포함 |
| 블루프린터 저장 훅 | 없음 | 그래프 JSON → 템플릿 코드 갱신 흐름 정상 | 재기동/핫 리로드 스크립트 동작 | 개발 후속 작업 대기 |
| 설치/운영 자동화 | 없음 | ODBC/VC++ 사전체크, NSSM/WinSW 등록 순서 문제 없음 | Silent 설치/언인스톨 체크 | 설치 로그 보존 경로 점검 |

* 각 항목은 이전 문서들의 표기와 비교하여 중복된 지침 또는 충돌이 없는지 확인하였다.
* 이상 징후가 없음을 재확인하고, 향후 자동 검증 훅 도입만 후속 과제로 남았다.

## 3. 로그 및 작업 이력 정리

| 구분 | 파일/도구 | 기록 내용 |
| --- | --- | --- |
| 시간대 로그 | `docs/sprint/hourly_history_20250929.md` | 21시 지시 및 응답 요약, 잔여 작업 수량 0건 유지 |
| 스프린트 로그북 | `docs/sprint/logbook.md` | 리팩토링 실행 점검 보고 등록, metrics에 tasks_remaining=0 기재 |
| 일일 JSON 로그 | `logs/task_execution_20250929.log` | 스프린트 로그북과 동일 항목을 JSON 라인으로 추가 |
| Tasklist | `Tasklist.md` | 모든 체크박스 완료 상태 재확인, 잔여 작업 0건 보고 |

## 4. 잔여 작업 수량 보고

* Tasklist 기준 남은 작업: **0건**
* 후속 권고: 로그 자동 검증 스크립트 도입 여부 검토(승인 대기)

## 5. 결론

* 사용자 지시 사항에 따른 전체 워크플로우 중복/이상 점검을 완료하였으며, manifest/registry 등 주요 계약 지점에서 충돌이 없음을 재확인했다.
* 절대 지령에 맞춰 시간대 로그, 스프린트 로그북, 일일 JSON 로그를 모두 갱신하고 남은 작업 수량 0건을 보고했다.
* 현 단계에서 구조를 크게 흔들지 않고 목표한 유지보수성·UX·시각화·설치 자동화·개발 난이도 완화 요건을 충족했다.
