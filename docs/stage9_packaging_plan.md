# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

## Stage 9 Packaging Research & Plan

### 게이트 요약
- 승인 필요 범위: 파이썬 미설치 Windows PC 대상 설치 패키지 요구 정의, 패키징 대안 비교, 설치 후 검증 프로세스, 문서 업데이트 계획.
- 선행 조건: Stage 7 운영/배포 산출물 재검토(네트워크·ODBC 정책, Docker 배포 절차), Stage 8 문서화 정비 확인.

### 요구 정의 {#요구-정의}
1. **사용자 유형**
   - 최종 사용자: 사내 생산/품질 엔지니어, Windows 10/11(64bit) 표준 이미지, 로컬 관리자 권한 제한적.
   - 배포 담당: 생산 IT팀(사내망 배포 도구 사용 가능), 유지보수 담당(설정/업데이트 적용).
2. **환경 제약**
   - 파이썬/Node 런타임 미설치 전제, 인터넷 차단(사내망 전용), Access ODBC 드라이버는 기본 이미지에 포함되나 버전 편차 존재.
   - SQL Server/Access 등 사내 DB는 VPN 내부망에서만 접근 가능, 방화벽 포트는 사전 등록 필요.
3. **필수 기능**
   - 백엔드 FastAPI 서비스와 프런트엔드 정적 리소스를 동일 머신에서 실행.
   - 모델/설정 파일 배포 및 초기화 마법사 제공(Trimmed-STD 파라미터, 유사도 임계값, SQL 컬럼 프로파일 선택 적용).
   - 서비스 기동/중지, 로그 보기, 문제 보고서 자동 수집 스크립트 포함.
4. **보안/정책**
   - 설치 패키지는 사내 코드서명 인증서로 서명.
   - 로그/설정은 사용자 홈 디렉터리 하위 `AppData\Roaming\RoutingML`로 저장, 개인정보 미포함.
   - 업데이트 시 이전 버전 백업 및 롤백 선택지 제공.

### 기술 대안 비교 {#기술-대안}
| 구분 | 개요 | 장점 | 유의사항 |
| --- | --- | --- | --- |
| PyInstaller + Inno Setup | FastAPI를 PyInstaller 단일 실행 파일로 빌드 후 Inno Setup으로 설치 마법사 구성 | 구현 난이도 낮음, 커스텀 UI/설정 마법사 구현 용이, 단일 EXE 배포 가능 | 빌드 용량 증가, 백그라운드 서비스 등록 스크립트 필요, 바이러스 오탐 가능 |
| MSIX 패키지 | Windows 공식 앱 패키징, UWP/데스크톱 브리지 활용 | 자동 업데이트 채널, 샌드박스 권한 제어, 서명 강제 | 사내 배포 도구 연계 필요, 서비스 등록 제약(백그라운드 실행 설정 필요) |
| WiX Toolset (MSI) | 전통적 MSI 설치 프로그램 빌드 | 그루핑/피쳐 기반 설치, 서비스/작업 스케줄러 등록 용이, SCCM 연계 우수 | XML 스크립트 작성 복잡, 빌드 파이프라인 설정 필요 |
| Chocolatey/SCCM 스크립트 | 사내 배포 자동화 도구에 패키지 등록 | 중앙 관리, 버전 추적, 무인 설치 | 초기 설치 프로그램 생성은 별도로 필요, 보안 정책 승인 필수 |

**선호안**: 1차 릴리스는 `PyInstaller + Inno Setup` 조합으로 PoC 패키지 제작 → 이후 정식 배포는 WiX 기반 MSI(사내 서명·SCCM 배포)로 전환.

### 번들 구성 설계 {#번들-구성}
1. **디렉터리 구조**
   ```
   RoutingML-Installer/
   ├─ backend/ (PyInstaller 빌드 결과)
   ├─ frontend/ (Vite build 결과)
   ├─ models/ (최신 학습 모델, training_metadata.json)
   ├─ config/
   │  ├─ workflow_settings.template.json
   │  └─ sql_profiles/
   ├─ scripts/
   │  ├─ install_service.ps1
   │  ├─ verify_odbc.ps1
   │  └─ collect_logs.ps1
   ├─ docs/
   │  ├─ INSTALL_GUIDE_ko.pdf
   │  └─ TROUBLESHOOTING.md
   └─ licenses/
   ```
2. **설치 마법사 단계**
   - 경로 선택 → 사내망 DB 연결 정보 입력(암호화 저장) → SQL 프로파일 선택/신규 업로드 → Trimmed-STD/유사도 임계값 초기값 설정 → 서비스 실행 계정 지정 → 설치/검증 로그.
3. **서비스 등록**
   - Windows Service(`RoutingMLPredictor`)로 FastAPI 실행, `nssm` 또는 PowerShell `New-Service` 사용.
   - 프런트엔드는 `http.server` 기반 내장 서버 또는 `FastAPI` static mount 활용.
4. **업데이트 전략**
   - `update.bat` 스크립트로 서비스 중지 → 파일 교체 → 마이그레이션 → 서비스 재시작 → 상태 체크.
   - 버전 메타(`config/version.json`) 관리, 이전 버전 백업은 `backup/`에 자동 저장.

### 테스트 전략 {#테스트-전략}
- **기능 검증**: 설치 후 자동 실행 스모크 테스트 스크립트(`scripts/post_install_test.ps1`)에서 `/api/health`, 워크플로우 SAVE, SQL export, TensorBoard 파일 경로 생성 여부 확인.
- **성능 검증**: 로컬 장비 기준 단건 예측 ≤ 1분, 10건 배치 ≤ 10분 유지 확인.
- **회귀 검증**: Trimmed-STD 파라미터 변경 → 예측 재실행 → 로그 비교 자동화.
- **보안 검증**: 코드 서명 검토, 실행 파일 무결성 체크샘(SHA256), 로그 저장 경로 권한 확인.
- **릴리스 게이트**: QA 체크리스트 통과, 설치/업데이트/제거 시나리오 기록, 이슈 트래킹.

### 문서화 및 배포 정책 {#문서화}
1. **Quickstart 갱신**: `docs/quickstart_guide.md`에 설치형 배포 챕터 추가(설치, 설정, 검증 절차). 기존 Docker/수동 설치 섹션과 비교표 제공.
2. **운영 매뉴얼**: `docs/stage7_operations_report.md` 부록에 설치형 운영 절차, 롤백 방법, 로그 수집/제출 지침 추가.
3. **배포 정책**: IT Change Management 프로세스 준수, 릴리스 전 보안팀 서명, 배포 후 사용자 교육 세션 계획.
4. **테스트 일정**: 설치 패키지 알파(내부 QA) → 베타(선발 사용자) → GA(전 사내) 3단계, 각 단계별 승인 기록.
5. **추가 과제**: 자동 업데이트 채널 연구(MSIX/Intune) 및 온보딩 영상 제작.

### 다음 단계
- Stage 9 착수 전 PRD/Tasklist 업데이트 내역 사용자 승인 획득.
- 패키징 PoC 빌드 환경 준비(Windows 빌드 에이전트, 코드 서명 인증서 확보).
- Stage 9 진행 중 각 게이트 통과 시 보고 및 승인 절차 준수.

### 구현 산출물 (2025-09-30 업데이트)
- `deploy/installer/build_windows_installer.py`: PyInstaller 빌드, 프런트엔드 배포본, 모델/설정/PowerShell 스크립트를 묶어 `build/windows/installer` 페이로드와 Inno Setup 스크립트를 자동 생성.
- `deploy/installer/scripts/*.ps1`: 서비스 등록/제거(`install_service.ps1`), ODBC 검증(`verify_odbc.ps1`), 로그 수집(`collect_logs.ps1`), 설치 후 헬스체크(`post_install_test.ps1`). 모든 스크립트는 `%APPDATA%\RoutingML\logs`에 실행 로그를 남긴다.
- `config/workflow_settings.template.json`, `config/sql_profiles/access_7_1.json`: 신규 설치 시 기본 설정 및 Power Query 매핑 템플릿 제공.
- `config/version.json`: 설치 파일 버전 메타데이터 관리.
- `deploy/installer/templates/installer.iss.tpl`: Inno Setup 설치 마법사 템플릿. 빌드 스크립트에서 실제 경로/버전으로 변환한다.
- `docs/install_guide_ko.md`, `docs/TROUBLESHOOTING.md`: 설치 절차, 검증, 장애 대응 문서.

### 테스트 권장 시나리오 갱신
1. Windows 빌드 노드에서 `python deploy/installer/build_windows_installer.py --clean` 실행.
2. 생성된 `RoutingMLInstaller.iss`를 Inno Setup Compiler로 빌드하여 PoC 인스톨러 획득.
3. 테스트 PC에 설치 후 PowerShell에서 `post_install_test.ps1` 실행하여 `/api/health` 응답 및 설정 파일 생성 여부 확인.
4. 워크플로우 UI에서 SAVE → `%APPDATA%\RoutingML\config\workflow_settings.json` 타임스탬프 변경 확인.
5. `collect_logs.ps1`로 로그 ZIP 생성 및 QA 시스템에 첨부.
