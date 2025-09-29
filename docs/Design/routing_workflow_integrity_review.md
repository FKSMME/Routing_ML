# Routing ML 워크플로우 중복·이상 점검 보고서

## 1. 개요
- 사용자 지침에 따라 라우팅 ML 리팩토링 전체 단계(훈련/추론/운영/설치)를 한 번에 재검토했다.
- 기존 산출물(`manifest`, `registry`, `mapping profile`, `blueprinter`) 중심으로 중복과 이상 여부를 확인했다.
- 점검 결과를 머메이드 다이어그램과 표 형태로 정리해 추적 가능성을 높였다.

## 2. 엔드투엔드 워크플로우 다이어그램
```mermaid
graph TD
    A[사용자 지침 수신] --> B[단계 범위 검토 및 로그 준비]
    B --> C[Training Service]
    C --> C1[Access 데이터 수집]
    C1 --> C2[전처리/특성 엔지니어링]
    C2 --> C3[임베딩 계산]
    C3 --> C4[HNSW 인덱스 작성]
    C4 --> C5[models/<version> 산출물 저장]
    C5 --> C6[manifest.json 생성]
    C6 --> C7[registry.db 등록]
    C --> D[training_metadata.json 버전 기록]
    D --> E[설치/배포 자동화]
    B --> F[Inference Service]
    F --> F1[registry.db active_version 로드]
    F1 --> F2[모델 및 인덱스 적재]
    F2 --> F3[예측 API 응답]
    F3 --> F4[관측성 지표 수집(JSON 로그, 대시보드)]
    F --> G[Config 관리(runtime_config, mapping profile)]
    B --> H[UI/UX 강화(Drag&Drop, 검증, 시각화)]
    H --> H1[규칙 검증 배지/토스트]
    H --> H2[매핑 프로파일 프리뷰]
    H --> H3[블루프린터 그래프 저장]
    H3 --> C
    H3 --> F
    E --> I[Installer(WinSW/Inno Setup) 배포]
    I --> J[설치 후 /health 자동 검사]
    B --> K[품질 훅(pre-commit, pytest)]
    K --> F
    K --> C
```

## 3. 중복 점검 결과
| 점검 대상 | 발견 여부 | 조치 |
| --- | --- | --- |
| `Tasklist.md` Step 1 항목 | 중복 없음 (10개 체크박스 고유 유지) | 추가 조치 불필요 |
| `docs/sprint` 로그 시트 | 시간대별 1건 기록 유지 | 신규 20시 기록 추가 예정 |
| `manifest`/`registry` 계약 문서 | 파일명 및 섹션 중복 없음 | 유지 |
| `blueprinter`/`mapping` 문서 | 기능별 고유 섹션 유지 | 유지 |

## 4. 이상 징후 점검
- **계약 불일치**: manifest와 registry의 활성 버전 규칙이 문서 전반에서 일관됨을 재확인했다.
- **로그 누락**: 19시 이후 지시사항에 대한 로그 행이 없어서 20시 블록을 추가한다.
- **다이어그램 오차**: 기존 워크플로우 감사 다이어그램과 비교해 단계 누락 없음.
- **설치 자동화**: Inno Setup/WiX 절차가 두 문서 이상에서 중복 기술되지 않도록 참조 링크만 유지했다.

## 5. 후속 권고
1. 20시 로그 추가 후 잔여 작업량이 0건임을 재보고한다.
2. `scripts/update_logbook.py`를 통한 자동화 사용 시, JSON/Markdown 일관성을 검증하는 간단한 스키마 검사를 추가할 것을 제안한다.
3. 향후 Step 2 진행 시에도 동일한 다이어그램 포맷을 재사용해 변경분 대비치를 신속히 파악한다.
