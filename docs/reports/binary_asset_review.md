> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 36 | Completed 5 | Blockers 0

# Binary Asset Review

이 저장소의 최신 커밋에서 PR 생성을 막는 바이너리 파일을 조사한 결과, 다음 자산이 문제로 확인되었습니다.

- `deliverables/workflow_overview.png`: Graphviz 워크플로 다이어그램을 이미지로 내보낸 파일로, Git이 텍스트가 아닌 바이너리로 인식합니다.

현재 커밋에서는 해당 PNG를 저장소에서 제거했으며, 동일한 정보는 텍스트 기반 소스(`deliverables/workflow_overview.dot`)와 문서로 유지합니다. 이미지가 꼭 필요하다면 외부 스토리지에 업로드한 후 문서에서는 링크로 참조하거나, `.dot` 등의 텍스트 기반 표현만 저장소에 포함시키는 것이 안전합니다.
