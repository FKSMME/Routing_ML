# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

## 9단계 상세 태스크: 설치형 배포 연구/준비

### Gate Review Checklist
- [x] 절대 지령 1~7 준수 여부 재확인
- [x] Stage 7 운영/배포 산출물 재검토 및 의존성 파악
- [x] Stage 8 문서화 결과 반영 여부 확인
- [x] 설치 패키지 빌드/배포 접근 권한 승인 상태 확인
- [x] 백그라운드 Windows 빌드 환경 및 코드 서명 준비 일정 수립

### 설계(Design / Research)
1. ✅ 파이썬/Node 미설치 Windows 환경 대상 설치 프로그램 사용자 시나리오 정리 — `docs/stage9_packaging_plan.md#요구-정의`
2. ✅ 설치 대상 환경 제약(오프라인, ODBC 드라이버, 방화벽) 분석 및 대응 정책 수립 — `docs/stage9_packaging_plan.md#요구-정의`
3. ✅ 패키징 대안 비교(PyInstaller+Inno Setup, MSIX, WiX, SCCM/Chocolatey) 및 보안 검토 — `docs/stage9_packaging_plan.md#기술-대안`
4. ✅ 선호안(초기 PoC: PyInstaller+Inno Setup, 정식: WiX/SCCM) 선정 및 전환 전략 문서화 — `docs/stage9_packaging_plan.md#기술-대안`
5. ✅ 설치 마법사 UX(경로 선택, 설정 입력, 서비스 계정 지정) 정의 — `docs/stage9_packaging_plan.md#번들-구성`

### 구현(Implementation)
1. ✅ 설치 번들 디렉터리 구조 및 포함 자산 정의 — `docs/stage9_packaging_plan.md#번들-구성`
2. ✅ Windows 빌드 스크립트(`deploy/installer/build_windows_installer.py`) 작성 및 PyInstaller/프런트엔드 번들 통합
3. ✅ Inno Setup 템플릿(`deploy/installer/templates/installer.iss.tpl`) 구성 및 버전/경로 토큰화 로직 구현
4. ✅ 서비스 등록/검증/로그 수집 PowerShell 스크립트 4종 작성 — `deploy/installer/scripts/*.ps1`
5. ✅ 설치 기본 설정 템플릿과 버전 메타데이터 구성 — `config/workflow_settings.template.json`, `config/sql_profiles/access_7_1.json`, `config/version.json`
6. ✅ 설치 가이드/문제 해결 문서 초안 작성 — `docs/install_guide_ko.md`, `docs/TROUBLESHOOTING.md`

### 테스트(Test)
1. ✅ 설치 후 `/api/health`, 워크플로우 SAVE, SQL Export 검증 체크리스트 정의 — `docs/stage9_packaging_plan.md#테스트-전략`
2. ✅ PowerShell 자동화 스크립트(`post_install_test.ps1`) 기반 스모크 테스트 설계 — `deploy/installer/scripts/post_install_test.ps1`
3. ✅ Trimmed-STD 파라미터 변경 회귀 검증 및 로그 비교 전략 수립 — `docs/stage9_packaging_plan.md#테스트-전략`
4. ✅ 설치 패키지 무결성(SHA256, 코드 서명) 검증 단계 문서화 — `docs/stage9_packaging_plan.md#테스트-전략`

### 배포(Deployment)
1. ✅ Quickstart/운영 매뉴얼 Stage 9 연계 업데이트 계획 수립 — `docs/stage9_packaging_plan.md#문서화`
2. ✅ 사내 Change Management 및 보안팀 승인 절차 반영 — `docs/stage9_packaging_plan.md#문서화`
3. ✅ 설치 패키지 알파/베타/GA 단계별 승인 및 교육 커뮤니케이션 플랜 마련 — `docs/stage9_packaging_plan.md#문서화`
4. ✅ 설치 파일 버전 정책 및 롤백 절차 정의 — `config/version.json`, `docs/stage9_packaging_plan.md#문서화`

### 진행 로그 (2025-09-30)
- Stage 9 패키징 연구 보고서 정리 및 Tasklist 연결 — `docs/stage9_packaging_plan.md`, `Tasklist.md`
- Windows 설치 빌드 자동화 스크립트 및 PowerShell 도구 작성 — `deploy/installer/*`
- 설치 템플릿/설정/버전 메타데이터 구성 — `config/workflow_settings.template.json`, `config/sql_profiles/access_7_1.json`, `config/version.json`
- 설치 가이드 및 트러블슈팅 문서 초안 배포 — `docs/install_guide_ko.md`, `docs/TROUBLESHOOTING.md`
