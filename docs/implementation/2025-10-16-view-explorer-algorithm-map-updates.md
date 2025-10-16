---
title: "뷰 익스플로러와 알고리즘 맵 개선, 서비스 종료 보강"
date: 2025-10-16 17:16
author: Codex Agent
---

## 작업 개요
- FastAPI `view-explorer` 엔드포인트에서 발생한 `execute_query` 누락을 해결하기 위해 `backend/database.py`에 커넥션 풀 기반 헬퍼를 추가했습니다.
- 시스템 개요 API(`backend/api/routes/system_overview.py`)가 Electron 모니터, 공유 컴포넌트, 워크플로 엔진, 배치 스크립트, 모델/피처 저장소 등 더 많은 지표를 수집하고 노드/엣지를 확장하도록 업데이트했습니다.
- `frontend-home/algorithm-map.html`의 레이아웃과 상호작용을 리디자인해 연결선 겹침을 완화하고, 선택 노드의 연결 요약과 확장된 메트릭을 제공하도록 개선했습니다.
- Electron 모니터에서 “서버 일괄정지” 기능이 포트 8000(백엔드) 등을 강제로 종료하도록 프로세스 추적 로직을 보강했습니다.

## 세부 변경 사항
### 백엔드
- `backend/database.execute_query`  
  - 커넥션 풀을 재사용해 단순 SQL 및 DML을 실행할 수 있도록 헬퍼를 추가했습니다. 자동 커밋 여부에 따라 `commit/rollback`을 처리하고 커서를 안전하게 정리합니다.
- `backend/api/routes/system_overview.py`  
  - Electron 앱, 공유 워크스페이스, 워크플로 설정, 배치 스크립트, 모델/피처 저장소 메트릭을 수집하여 `summary_metrics`와 노드/엣지 응답에 반영했습니다.  
  - `sys.views` 조회를 통해 전체 VIEW 개수를 노출하고, 새 플랫폼·서비스·데이터 노드를 추가했습니다.

### 프런트엔드
- `frontend-home/algorithm-map.html`  
  - 카테고리 그리드를 반응형 컬럼(`--lane-count`) 기반으로 재구성하고, SVG 연결선의 라벨·곡선을 조정했습니다.  
  - 선택 노드의 In/Out 연결 요약 패널과 확장된 메트릭 카드(MSSQL VIEW 수, 모델 아티팩트, 배치 스크립트 현황)를 제공하도록 업데이트했습니다.  
  - 데이터 흐름 방향을 시각적으로 보여주기 위해 연결선에 점선 애니메이션을 적용했습니다.

### Electron 모니터
- `electron-app/main.js`  
  - `stopAllServers`를 비동기로 전환하고, `taskkill` 이후에도 남을 수 있는 포트(8000 등)에 대해 `netstat` 기반 PID 탐색 → `taskkill /F /T` 플로우로 강제 종료하도록 보강했습니다.  
  - 외부 실행으로 감지된 서비스도 동일한 포트 강제 종료 절차를 수행해 “일괄정지” 버튼이 항상 포트를 해제하도록 변경했습니다.

### Python 모니터 (dist\RoutingMLMonitor_v5.2.0.exe)
- `scripts/server_monitor_dashboard_v5_1.py`  
  - “일괄 정지” 버튼이 서비스 포트(8000, 8001, 8002, 3000, 5173, 5174 등)를 기반으로 `psutil`로 PID를 조회하고, 해당 프로세스 및 부모/자식 트리를 `taskkill /F /T`로 종료하도록 개선했습니다.  
  - 기존 `python.exe`/`node.exe` 전역 종료 방식에서 포트 중심 정리 방식으로 전환해, uvicorn/Node 프로세스가 남지 않도록 했습니다.

## 테스트
- `Invoke-RestMethod http://localhost:8000/api/view-explorer/views` 호출로 500 오류 없이 VIEW 목록이 반환되는 것을 확인했습니다.
- Electron 모니터에서 “서버 일괄정지” 버튼을 실행한 뒤 `netstat -ano | find ":8000"`으로 백엔드 포트가 종료되는지 확인했습니다.

## 후속 권장 사항
1. `frontend-home` 등 프런트엔드 앱에 대해 `npm run build` 또는 기존 빌드 스크립트를 실행해 변경 내용을 번들에 반영하세요.
2. 운영 PC에서 `RoutingMLMonitor_v5.2.0.exe` 업데이트 버전을 배포한 후, 일괄 정지 기능이 모든 포트를 정상 해제하는지 수동 검증하시기 바랍니다.
