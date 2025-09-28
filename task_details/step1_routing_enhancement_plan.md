> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 34 | Completed 8 | Blockers 0

# 절대 지령 준수 안내
- 기존 절대 지령(단계별 승인, 오류 재확인, 백그라운드 수행, 로그 유지)을 이 단계에도 동일하게 적용한다.
- 착수 전 범위 재검토/문서화, 승인 후 구현, 오류 발견 시 즉시 보고·재승인 절차를 따른다.
- Tasklist와 본 문서에 진행 로그를 남기고, 결과 제출 시 승인 요청서를 함께 준비한다.

# Step 1 Plan: 라우팅 생성 고도화

## 단계 목표
- [ ] 드래그·드롭 추천 워크플로우를 Access/추천 API와 실시간 연동한다.
- [ ] 라우팅 그룹 저장/불러오기 및 ERP 인터페이스 옵션 제어를 완성한다.

## 세부 Task Checklist
- [ ] 현황 점검: `task_details/menu2_routing_builder_detail.md` 요구사항, Access/추천 API 스키마 재검토
- [ ] API 연계 설계: 그룹 저장/불러오기, ERP 옵션 연계에 필요한 백엔드 엔드포인트/스키마 정의
- [ ] 프런트 상태 모델링: drag-drop 상태, 멀티 탭, 그룹 Persistence, 에러 처리 흐름 설계
- [ ] 데이터 영속성 설계: 로컬/서버 저장, 감사 로그(`action=routing.group.*`) 정의 및 보안 검토
- [ ] ERP 옵션 통합 계획: Options 메뉴와의 의존성 매트릭스, 토글 시 Validation 로직 문서화
- [ ] QA & 리스크 플랜: DnD 충돌, 동시 편집, 롤백/회복 시나리오 정리

## 계획 산출물
- [ ] 라우팅 고도화 기술 설계 초안 (신규 문서)
- [ ] API 명세 추가안 (`docs/backend_api_overview.md` 갱신 초안)
- [ ] Tasklist/로그 업데이트 및 승인 요청서 초안
