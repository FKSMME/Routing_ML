# Routing ML 서비스 종합 점검 보고서
- 작성일시: 2025-10-15 17:00:06 +09:00
- 작성자: Codex (내부 지원)
- 적용 범위: Routing ML 플랫폼 (백엔드, 프런트엔드, 배포/모니터링)

## 1. 운영 환경 요약
- **망 구성**: 사내망 전용, 외부 접속 차단. `.env` 비밀 사용 가능하나 파일 권한 및 백업/로그 관리 필요.
- **백엔드**: FastAPI 0.103.2, 총 136개 REST/웹소켓 엔드포인트(예측·워크플로·데이터/DB 관리·모니터링).
- **데이터 계층**: MSSQL(주 저장소, pyodbc 풀 기본 5커넥션) + SQLite(RSL·세션).
- **프런트엔드**: 예측/학습 React(Vite) 앱 2종, 정적 홈(algorithm-map.html), Electron 기반 Windows 모니터.
- **설정 관리**: `.env` + `config/workflow_settings.json`(`common/config_store.py`) 이중 관리, `/api/database/config`가 `.env` 파일을 직접 갱신.
- **배포 현황**: VERSION.txt 기준 v5.1.0 (2025-10-15), 포터블 실행파일 15.3 MB.

## 2. 정량 지표 (2025-10-15 기준)
| 영역 | 파일 수 | LOC | 비고 |
|------|--------|-----|------|
| Backend (Python) | 81 | 26,299 | `python -c` 커맨드로 집계 |
| Common | 9 | 1,702 | 〃 |
| Scripts | 18 | 6,992 | 〃 |
| Tests | 24 | 3,218 | 〃 |
| Frontend Prediction (TS/TSX) | 109 | 32,660 | 〃 |
| Frontend Training (TS/TSX) | 113 | 34,212 | 〃 |

- 주요 자산: `frontend-prediction/src/index.css` 115 KB, `frontend-home/algorithm-map.html` 27 KB, `frontend-home/background.glb` 90 KB.
- 테스트: `python -m pytest --maxfail=1 --disable-warnings -q` 실행 시 `sqlite3.OperationalError: unable to open database file`로 전체 테스트 실패.
- 배포물: `dist/RoutingML_AutoGen_v5.1.0_Portable.exe` 약 15.3 MB.

## 3. 위험 및 이슈
### 높은 우선순위
1. **인증 미적용 웹소켓**: `/api/blueprint/realtime`은 인증·인가 없이 연결 가능해 내부라도 정보 유출 위험.
2. **테스트 스위트 비가동**: SQLite 파일 경로 문제로 pytest 전체 실패 → 회귀 검증 공백.
3. **모델 서비스 동시성 결함**: `PredictionService`의 `_model_lock`이 불린값이라 다중 요청 시 캐시/익스포트 경쟁 상태 발생 가능.

### 중간 우선순위
4. **모니터링 지표 불안정**: `/api/health` 카운터가 전역 변수로만 관리되고 `/metrics`는 `psutil.cpu_percent(interval=0.1)` 사용 → 멀티 워커/고빈도 스크랩 시 레이스와 응답 지연.
5. **데이터 매핑/벌크 업로드 미완성**: TODO가 남아 실제 라우팅 그룹 데이터를 로드하지 않음.
6. **`.env` 갱신 로직**: 내부망 전제라도 `/api/database/config`가 `.env`를 직접 덮어쓰는 구조는 파일 잠금/오입력 시 위험.

### 낮은 우선순위·향후 고려
7. JWT 쿠키 `Secure` 옵션 미적용, 비밀번호 검증 부재(향후 외부 확장 대비 필요).
8. Electron 모니터 배포물 코드 서명·배포 경로 통제 미확인.
9. `frontend-home/server.js`에 HTTPS/보안 헤더 미구현.

## 4. 통신 및 운영 현황
- **인증·세션**: `/api/auth` 하위에서 가입/승인/로그인.
- **예측/모델**: `/api/predict`, `/api/similarity/search`, `/api/routing/*`.
- **데이터/설정 관리**: `/api/database/*`, `/api/workflow/*`, `/api/data-mapping/*`.
- **모니터링**: `/api/health`, `/api/metrics`, `/metrics`, `/api/dashboard/*`.
- **정적 홈 제공**: `frontend-home/server.js`에서 HTTPS 미적용 상태.

## 5. 권장 후속 조치
1. 웹소켓 포함 모든 실시간 경로에 인증/인가 적용, 감사 로그 확보.
2. pytest가 SQLite 파일을 열 수 있도록 경로·권한 조정 또는 임시 디렉터리 지정, CI에 테스트 재도입.
3. `PredictionService`에 `threading.Lock()` 등 동시성 제어 도입, 모델/익스포트 로직 점검.
4. `/metrics` 비차단 수집(`cpu_percent(interval=None)` 등)과 원자 카운터 사용, 멀티 워커 대응 방안 마련.
5. 데이터 매핑·벌크 업로드 TODO 해결(실제 라우팅 그룹 데이터 연동) 또는 명시적 비활성화.
6. `.env` continued 사용 시: 파일 권한 최소화, 백업/로그 노출 점검, `/api/database/config`는 안전한 저장소로 리팩터링.
7. JWT `Secure` 옵션 적용과 비밀번호 정책 검토, Electron 배포물 검증, 정적 서버 보안 헤더 추가.

## 6. 참고 로그/명령
- `python -c` LOC 집계, `python -m pytest --maxfail=1 --disable-warnings -q` 실패 로그.
- `Get-ChildItem dist`로 배포물 크기 확인.
- `.env`, `backend/api/routes/*.py`, `backend/api/services/*.py` 등 주요 소스 위치.

## 7. 결론
사내망 환경 덕분에 즉각적인 외부 침입 위험은 낮으나, 테스트 미가동·인증 미적용 웹소켓·동시성 결함 등 내부 품질 리스크가 큽니다. 상기 후속 조치를 1~2주 내 순차적으로 처리하고, 처리 결과를 다시 문서화하여 운영 기록을 최신 상태로 유지하시기 바랍니다.
