> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 36 | Completed 5 | Blockers 0

# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

# 전달물 패키지 구조

```
deliverables/
  README.md                  # 본 문서
  routing_ml_v1.0.tar.gz     # v1.0 패키지 아카이브 (NAS 업로드용, Git 미포함)
  reports/
    stage7_operations.pdf    # Stage 7 운영 보고서 (Git 미포함)
    stage8_documentation.pdf # Stage 8 문서화 보고서 (Git 미포함)
  v1.0/
    models/                  # 학습 결과 (Git에 metadata만 보관, 모델 바이너리는 제외)
    reports/
      kpi_weekly.csv
    docs/
      quickstart_guide.pdf   # 빠른 시작 가이드 (Git 미포함)
      release_notes.pdf      # 릴리스 노트 (Git 미포함)
```

> **주의**: 용량이 큰 PDF/Joblib/TAR 파일은 GitHub PR 생성이 차단되어 Git에 포함하지 않는다. 실제 배포 시에는 각 디렉터리의 README 지침에 따라 사내 NAS에서 파일을 확보해 패키징한다.

## 구성 원칙
- 모든 파일은 사내망 NAS에 업로드하며, 외부 공유 금지.
- 모델/보고서/문서를 버전 폴더로 묶고, README에 변경 내역 링크를 남긴다.
- SQL 샘플은 Stage 5 스키마를 따르고, 개인정보는 제거한다.
- 보고서(PDF)는 각 Stage 문서를 PDF로 내보낸 후 포함한다.

## 주요 산출물 안내
- Stage 7 운영·배포 보고서(PDF): `reports/stage7_operations.pdf` (Git 미포함, [보고서 README](reports/README.md) 참고)
- Stage 8 문서화 보고서(PDF): `reports/stage8_documentation.pdf` (Git 미포함, [보고서 README](reports/README.md) 참고)
- 주간 KPI 리포트(CSV): [`v1.0/reports/kpi_weekly.csv`](v1.0/reports/kpi_weekly.csv)
- 릴리스 노트(PDF): `v1.0/docs/release_notes.pdf` (Git 미포함, [문서 README](v1.0/docs/README.md) 참고)
- 빠른 시작 가이드(PDF): `v1.0/docs/quickstart_guide.pdf` (Git 미포함, [문서 README](v1.0/docs/README.md) 참고)
- 모델 번들: [`v1.0/models/`](v1.0/models) (JSON 메타데이터만 Git에 포함, Joblib은 [모델 README](v1.0/models/README.md) 참고)
- NAS 업로드 아카이브: `routing_ml_v1.0.tar.gz` (Git 미포함, [패키징 가이드](v1.0/README.md) 참고)

## Stage 6 KPI 베이스라인 검증
`v1.0/reports/kpi_weekly.csv`의 Stage Match Rate와 Time Deviation MAE는 Stage 6에서 정의한 룰 기반 베이스라인(단계 일치율 0.68,
시간 오차 ±28분)과 일치함을 확인했다.

## PDF 산출물 생성 기록
- `docs/stage7_operations_report.md` → NAS의 `reports/stage7_operations.pdf`
- `docs/stage8_documentation_report.md` → NAS의 `reports/stage8_documentation.pdf`
- `docs/release_notes.md` → NAS의 `v1.0/docs/release_notes.pdf`
- `docs/quickstart_guide.md` → NAS의 `v1.0/docs/quickstart_guide.pdf`

## NAS 업로드 및 무결성 확인
- 업로드 패키지: `routing_ml_v1.0.tar.gz` (Git 미포함)
- SHA256: `b99c9a656ebf0352b49a31bb2ab3014cbd4fcdd769cc546ed71b4f75ef020514`
- 확인 로그: `logs/package_upload_20250930.log`에 2025-09-30 검증 기록 보관

## 배포 체크리스트
- [x] Stage 7/8 보고서를 PDF로 변환하여 `reports/`에 저장했다. (Git 미포함)
- [x] 최신 모델 아티팩트를 `models/`에 저장했다. (Joblib은 Git 미포함)
- [x] KPI CSV가 Stage 6 지표와 동일한지 검증했다.
- [x] 릴리스 노트와 빠른 시작 가이드를 PDF로 변환했다. (Git 미포함)
- [x] NAS 업로드 후 무결성(SHA256) 확인을 완료했다.
