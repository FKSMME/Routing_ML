# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

# Routing ML Windows 설치 가이드 (주니어도 쉽게)

## 0. 지금 해야 할 일 한눈에 보기
- [ ] 설치 파일(`RoutingMLInstaller_<버전>.exe`)을 관리자 권한으로 실행한다.
- [ ] 설치 마법사 안내대로 기본 경로 그대로 진행한다.
- [ ] 설치가 끝나면 자동으로 뜨는 확인 창에서 **완료** 버튼을 누른다.
- [ ] 브라우저를 열고 `http://localhost:8000/api/health` 에 접속해 "ok" 메시지를 확인한다.

> 💡 처음부터 자세히 알고 싶다면 아래 순서대로 천천히 따라오세요.

## 1. 왜 이 설치가 필요한가요?
- 최종 사용자는 파이썬을 설치하지 않아도 됩니다.
- 이 설치 파일 하나로 **백엔드 서비스**, **웹 화면**, **ML 모델**, **필요한 스크립트**가 모두 들어갑니다.
- 목표: Windows 10/11 64비트 PC에서 Routing ML 예측 서비스를 바로 실행할 수 있도록 하기.

## 2. 설치 전에 꼭 확인하세요 (체크리스트)
- [ ] **관리자 권한**이 있는 계정으로 로그인했나요?
- [ ] "Microsoft Access Driver (*.mdb, *.accdb)" (64비트)가 설치되어 있나요?
  - 없다면 사내 소프트웨어 센터에서 `AccessDatabaseEngine_X64.exe`를 설치하세요.
- [ ] 회사 내부망 또는 VPN이 연결되어 있나요?
- [ ] Windows 방화벽에서 포트 8000을 허용했나요?
  - 설치 중 자동 설정되지만, 막혀 있으면 IT팀에 예외 등록을 요청하세요.
- [ ] (선택) 설치 파일에 사내 코드 서명 인증서를 적용했나요?

## 3. 설치 파일 준비 (빌드 담당자용)
> 설치 파일을 새로 만들 때만 필요합니다. 이미 받은 실행 파일이 있다면 이 단계를 건너뛰세요.

1. Windows 빌드 PC에서 `pip install -r requirements.txt pyinstaller`를 실행합니다.
2. 프런트엔드를 한 번만 준비하면 됩니다.
   - `npm install --prefix frontend`
   - `npm run build --prefix frontend`
3. 아래 명령으로 설치 자원을 모읍니다.
   ```powershell
   python deploy/installer/build_windows_installer.py --clean
   ```
   - 결과: `build/windows/installer` 폴더, `build/windows/RoutingMLInstaller.iss`
4. Inno Setup Compiler(6.x 이상)로 `RoutingMLInstaller.iss`를 열어 빌드합니다.
   - 결과: `build/windows/RoutingMLInstaller_<버전>.exe`
5. 빌드 로그는 `logs/installer_build.log`에 남습니다.

## 4. 설치하기 (사용자 PC)
1. `RoutingMLInstaller_<버전>.exe`를 **마우스 오른쪽 → 관리자 권한으로 실행**합니다.
2. 설치 마법사 화면은 모두 한글 안내가 포함되어 있습니다.
   - 기본 경로(`C:\Program Files\FKSM\RoutingML`)를 유지하면 추가 설정이 필요 없습니다.
   - 바로가기나 시작 메뉴 등록은 기본값 그대로 두어도 됩니다.
3. 설치가 끝나면 자동으로 PowerShell 스크립트가 실행되어 Windows 서비스 `RoutingMLPredictor`가 등록되고 시작됩니다.
4. 마지막 화면에서 **로그 위치**와 **테스트 결과**를 확인할 수 있습니다.
   - 로그 폴더: `%APPDATA%\RoutingML\logs`
   - 설정 파일: `%APPDATA%\RoutingML\config\workflow_settings.json`
5. "완료" 버튼을 누르면 설치가 마무리됩니다.

## 5. 설치 후 바로 해보는 점검
- [ ] 인터넷 브라우저에서 `http://localhost:8000/api/health`에 접속해 상태가 `ok`인지 확인한다.
- [ ] `http://localhost:8000/api/workflow/graph`에 접속해 JSON 구조가 보이는지 확인한다.
- [ ] 워크플로우 UI에서 **SAVE** 버튼을 눌러보고 설정 파일의 수정 시간이 바뀌는지 확인한다.
- [ ] 샘플 품목으로 `/api/predict`를 호출해 3~4개의 라우팅 제안이 나오는지 확인한다.
- [ ] `models/tb_projector/` 폴더에 TensorBoard 파일(`projector_config.json` 등)이 있는지 확인한다.

## 6. 문제가 생겼나요?
자주 나오는 문제는 아래 표를 참고하세요. 각 항목은 간단한 언어로 정리했습니다.

| 증상 | 빠른 해결 방법 |
| --- | --- |
| 서비스가 바로 멈춘다 | `%APPDATA%\RoutingML\logs`에서 `install_service.log`를 열어 오류 메시지를 확인하고, `install_service.ps1 -RemoveOnly`로 삭제 후 다시 실행합니다. |
| 8000 포트를 다른 프로그램이 쓰고 있다 | `netstat -ano | findstr :8000`으로 사용 중인 프로그램을 확인하고 종료하거나, `install_service.ps1 -Port 8050`으로 새 포트를 지정해 다시 등록합니다. |
| DB 연결이 되지 않는다 | `verify_odbc.ps1`를 실행해 드라이버 설치 상태를 확인하고, 필요하면 Access ODBC 드라이버를 다시 설치합니다. |
| 모델을 못 찾는다 | 설치 폴더의 `models` 안에 최신 모델 파일(`training_metadata.json` 등)을 복사한 뒤 서비스를 재시작합니다. |
| TensorBoard 자료가 없다 | 트레이너 서비스를 한 번 실행해 최신 임베딩을 다시 만들고, `post_install_test.ps1` 로그에 경고가 없는지 확인합니다. |

더 많은 해결 방법은 아래 `문제 해결 가이드` 문서를 참고하세요.

## 7. 삭제(롤백)하려면
1. 제어판 → 프로그램 → Routing ML → 제거를 실행합니다.
2. 제거 마법사가 Windows 서비스를 자동으로 제거합니다.
3. 남은 파일이 있으면 `%APPDATA%\RoutingML` 폴더를 수동으로 삭제합니다.

## 8. 배포 정책 요약
- [ ] 알파 → 베타 → 정식(GA) 순서로 진행하고, 각 단계마다 QA 체크리스트와 설치 로그를 JIRA에 첨부합니다.
- [ ] 설치 파일은 사내 배포 포털(NAS 또는 SCCM)에 올리고, 함께 제공된 SHA256 해시값으로 위변조 여부를 확인합니다.
- [ ] 새 버전을 배포할 때는 기존 버전을 `backup/` 폴더에 옮겨 두고, 필요하면 `update.bat` 스크립트로 덮어씁니다.

## 9. 추가 참고 자료
- PowerShell 스크립트 요약: `deploy/installer/scripts/` 폴더 참조
- SQL 컬럼 매핑 템플릿: `config/sql_profiles/access_7_1.json`
- 상세 장애 대응: `docs/TROUBLESHOOTING.md`
