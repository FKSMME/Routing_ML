# Routing ML 통합 점검 리포트 (2025-10-20 07:40 KST)

## 1. 요약
- 백엔드 테스트와 프런트엔드 빌드가 모두 실패 상태로, 현재 브랜치는 배포 준비가 되지 않은 것으로 확인되었습니다.
- 정적 HTML 기반 `frontend-home`이 HTTPS 환경에서도 일관된 프로토콜을 사용하지 않아 기능적 혼선이 발생하고 있습니다.
- 프런트 모듈 간 스타일과 컴포넌트가 중복되며, 3D/데이터 뷰가 흩어져 있어 사용자 경험이 단절되는 문제가 있습니다.
- Windows용 모니터 EXE는 기능 분리가 안 된 단일 스크립트 구조로 유지보수와 테스트가 어렵습니다.

## 2. 정량 지표
| 구분 | 명령 | 결과 |
| --- | --- | --- |
| 백엔드 테스트 | `python -m pytest` | 수집 78개, 실패 4개 (SQLite 파일 열기 오류, 모듈 임포트 시 AuthService 강제 초기화) |
| 프런트 빌드 | `npm run build` (`frontend-prediction`) | TypeScript 컴파일 실패 (`FullScreen3DBackground.tsx`에서 GLTF 타입 처리 오류) |
| 프런트 린트 | `npm run lint` (`frontend-prediction`) | 오류 236건 (React Three Fiber 속성 미스매치, 미사용 컴포넌트/타입) |
| 번들 크기 | `frontend-prediction/dist` | 1,952,664 bytes |
| 번들 크기 | `frontend-training/dist` | 2,905,347 bytes |
| 모니터 EXE | `dist/RoutingMLMonitor_v5.2.4.exe` | 12,019,843 bytes |

## 3. 기능상 취약점
1. **테스트 환경 경로 고정** (`backend/api/services/auth_service.py:439`, `backend/database_rsl.py`)<br>
   - `auth_service`가 모듈 임포트 시점에 SQLite 파일을 열도록 고정되어 백엔드 자동 테스트가 즉시 실패합니다.<br>
   - 개선: 서비스 인스턴스를 지연 생성하고, PoC 환경에서는 불필요한 테스트 모듈 임포트를 비활성화하거나 실제 MSSQL 연결 설정을 사용하도록 조정.

2. **GLTF 로더 타입 가드 누락** (`frontend-prediction/src/components/FullScreen3DBackground.tsx`)<br>
   - `useGLTF` 반환값이 배열일 가능성을 고려하지 않아 `.scene` 접근 시 TypeScript/런타임 오류가 발생합니다.<br>
   - 개선: 배열 케이스를 병렬 처리하고, 형식을 명시적으로 좁혀서 3D 배경 초기화 안정화.

3. **린트/빌드 불일치** (`frontend-prediction/src/*.tsx` 전반)<br>
   - React Three Fiber 요소에 DOM 속성을 그대로 사용하면서 `react/no-unknown-property` 경고가 오류로 승격되어 있습니다.<br>
   - 개선: `meshPhysicalMaterial` 등 정식 속성으로 교체하고, 미사용 패널/스토어 로직을 정리해 번들 크기 축소.

4. **HTTPS 기능 혼선** (`frontend-home/index.html:382`, `frontend-home/server.js`)<br>
   - API 요청이 항상 `http://localhost:8000`을 가리켜 HTTPS 접속 시 혼합 콘텐츠가 발생합니다.<br>
   - 개선: `window.location.protocol` 기반으로 API 베이스 URL을 동적으로 결정하고, 배치 스크립트에서 `SSL_*_PATH`를 명시.

5. **모니터 애플리케이션 단일 스크립트** (`scripts/server_monitor_dashboard_v5_1.py`)<br>
   - 1,200+ 라인의 단일 파일이 GUI, 서비스 제어, 네트워킹을 모두 담당해 변경 및 테스트가 어렵습니다.<br>
   - 개선: 서비스 정의, Tk UI, 상태 폴링을 모듈로 분리하고 PyInstaller 엔트리 스크립트는 최소화.

## 4. 디자인 및 UX 개선 제안
- **단일 대시보드 경험**: `frontend-home`의 700줄 HTML을 React 레이아웃으로 흡수하여 예측/학습 화면과 동일한 내비게이션과 테마를 유지하십시오.
- **3D/데이터 컴포넌트 공유화**: `frontend-shared`에 Three.js 배경, GLB 뷰어, 공용 차트 컴포넌트를 추출해 스타일 일관성을 확보합니다.
- **데이터 탐색 통합**: 알고리즘 맵과 SQL 뷰 탐색기를 React 라우트로 이관하여 로그인된 사용자 플로우 안에서 탐색 가능하도록 구성합니다.
- **모니터 UI 개선**: 현재 Tk 카드에 추가로 지연 시간 스파크라인과 상태 변동 히스토리를 제공하면 운영자가 문제를 빠르게 식별할 수 있습니다.

## 5. 배포/운영 개선
- **SSL 자산 패키징**: `certs` 폴더를 배포 아티팩트에 포함하거나 `run_frontend_home.bat`에서 절대 경로를 `USE_HTTPS=true`와 함께 주입하여 HTTPS 강제 시 파일 탐색 실패를 막습니다.
- **오프라인 스모크 테스트**: PyInstaller 빌드 후 `--noconfirm` 실행 스크립트와 함께 UI 기본 동작을 자동으로 검증하는 단위 스모크 테스트를 추가하십시오.
- **로그 구조화 강화**: `logs/` 하위에 백엔드/프런트 상태 요약을 저장하는 CLI 스크립트를 마련하면 릴리스 준비 체크리스트와 연동이 수월합니다.

## 6. 권장 후속 작업 (우선순위 순)
1. 테스트용 DB 경로 구성 + `AuthService` 지연 생성 → `pytest` 정상화.
2. `FullScreen3DBackground.tsx` 타입 수정 및 React Three Fiber 속성 정비 후 `npm run build`/`npm run lint` 재실행.
3. `frontend-home`의 API 베이스 URL 동적화 및 HTTPS 배포 스크립트 정비.
4. 3D/데이터 공용 컴포넌트 모듈화 착수, React 기반 홈 대시보드 작업 계획 수립.
5. 모니터 앱 모듈 분리와 PyInstaller 스모크 테스트 파이프라인 설계.

---
작성: 2025-10-20 07:40:42 KST
