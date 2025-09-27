# 모델 번들 배포 가이드

이 디렉터리에는 모델 메타데이터(JSON)만 Git에 포함되어 있으며, Joblib 바이너리는 용량 문제로 제외된다. 배포 준비 시 아래 파일을 NAS에서 내려받아 동일한 경로에 배치한다.

- `encoder.joblib`
- `scaler.joblib`
- `feature_columns.joblib`
- `feature_weights.joblib`
- `default/feature_weights.joblib`

NAS 경로: `NAS://sccm/share/routing_ml/v1.0/models/`

필요 시 `git update-index --skip-worktree`를 사용해 로컬 배치 파일이 Git 상태에 나타나지 않도록 관리한다.
