> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 36 | Completed 5 | Blockers 0

# v1.0 패키징 가이드

`routing_ml_v1.0.tar.gz` 아카이브는 Git에서 제외되어 있으며, 실제 배포 시 아래 절차로 생성한다.

1. `deliverables/v1.0/` 디렉터리에 NAS에서 내려받은 PDF 및 Joblib 파일을 모두 배치한다.
2. 루트에서 `tar -czf routing_ml_v1.0.tar.gz v1.0` 명령으로 아카이브를 생성한다.
3. 생성된 파일의 해시를 `sha256sum routing_ml_v1.0.tar.gz`로 계산하고 `logs/package_upload_20250930.log`에 기록된 값과 일치하는지 확인한다.
4. 검증이 완료되면 NAS `NAS://sccm/share/routing_ml/` 경로에 업로드하고 로그를 갱신한다.

> PR 제출 시에는 `routing_ml_v1.0.tar.gz`를 Git 추적에서 제외해야 한다.
