# v1.0 문서 배포 가이드

릴리스 노트와 빠른 시작 가이드는 Git PR 생성 시 용량 문제가 발생하므로 저장소에서 제외한다. 배포 또는 패키징 시 다음 경로에서 최신 PDF를 내려받아 `deliverables/v1.0/docs/`에 배치한다.

- 릴리스 노트: `NAS://sccm/share/routing_ml/v1.0/docs/release_notes.pdf`
- 빠른 시작 가이드: `NAS://sccm/share/routing_ml/v1.0/docs/quickstart_guide.pdf`

PDF를 추가한 뒤에는 Git 추적 목록에 올라가지 않도록 `git update-index --assume-unchanged` 또는 `.gitignore` 규칙을 유지한다.
