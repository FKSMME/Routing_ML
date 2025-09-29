# Routing ML Internal Deployment SOP (v2025-09-29)

## 1. Scope & Roles
- **Scope**: Routing ML Windows 패키지(백엔드 FastAPI + 프런트엔드 빌드 + ML 모델) 배포 및 업데이트.
- **Roles**:
  - *Release Owner*: QA 승인 및 릴리즈 노트 게시.
  - *Deployment Engineer*: 패키지 빌드, 무결성 검증, 사내 포털 업로드.
  - *Support Engineer*: 롤백/장애 대응.

## 2. Pre-deployment Checklist
1. `npm run build --prefix frontend` 성공 로그 확보 (TypeScript 오류 해결 필수). 【F:docs/sprint/routing_enhancement_qa.md†L1-L33】
2. `pytest tests/test_rsl_routing_groups.py` 통과 스크린샷 또는 로그 보관. 【66517b†L1-L33】
3. 최신 릴리즈 노트 작성 및 승인. 【F:deliverables/release_notes_2025-09-29.md†L1-L34】
4. Access DB 경로/환경 변수 확인 (`ROUTING_ML_RSL_DATABASE_URL`).

## 3. Deployment Flow
1. **Alpha**: 내부 QA 환경에 설치 → 릴리즈 노트 공유, QA 체크리스트 업데이트.
2. **Beta**: 제한된 사용자 그룹 대상 배포 → 피드백 수집, 이슈 레지스터 업데이트.
3. **GA**: 전체 대상 배포 → 설치 가이드/릴리즈 노트 최종 버전 배포.

## 4. Distribution & Integrity Controls
1. 빌드 산출물: `build/windows/RoutingMLInstaller_<버전>.exe`.
2. 무결성 검증: `Get-FileHash -Algorithm SHA256`로 해시값 산출 후 릴리즈 노트 및 포털에 게시.
3. 사내 포털 업로드: NAS 또는 SCCM에 설치 파일과 해시 파일(`.sha256`) 동시 업로드.
4. 기록 보관: 업로드 로그/스크린샷을 JIRA 태스크에 첨부.

## 5. Rollback & Backup
1. 기존 버전은 배포 전 `\share\routing_ml\backup\<버전>`에 복제.
2. 롤백 시 `install_service.ps1 -RemoveOnly` 실행 후 백업된 설치 파일 재설치.
3. `backup/` 폴더와 `update.bat` 스크립트를 동일 버전으로 맞춰 재배포.
4. 롤백 결과를 릴리즈 노트에 업데이트하고 이해관계자에게 공유.

## 6. Post-deployment Verification
1. `http://<host>:8000/api/health` 응답 확인.
2. `/api/rsl/groups` POST/GET 스팟 테스트 수행.
3. 감사 로그(`logs/audit/ui_actions.log`, `logs/audit/rsl.audit.log`)에 시간/IP 기록 확인.
