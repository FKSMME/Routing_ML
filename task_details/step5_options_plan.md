> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 34 | Completed 8 | Blockers 0

# 절대 지령 준수 안내
- 기존 절대 지령을 동일하게 적용하며 착수·완료 시 승인 절차를 따른다.
- 작업 로그와 산출물을 문서화하고 Tasklist와 연동한다.

# Step 5 Plan: 옵션 메뉴 고도화

## 단계 목표
- [ ] 표준편차/유사 품목 옵션 충돌 관리, 컬럼 매핑 편집기, ERP 토글 연계를 구현한다.

## 세부 Task Checklist
- [ ] 옵션 목록 정비: 상호 배타 규칙 명세, 기본값 재정의
- [ ] 상태 모델링: 옵션 저장 구조, Validation/Dependency graph 설계
- [ ] 컬럼 매핑 편집기 설계: Drag & Drop UI, 검색, 검증 흐름 문서화
- [ ] ERP 연계 로직: ERP 옵션 ON 시 필수 체크 규칙 작성
- [ ] 감사 로그 설계: `options.update`, 충돌 경고, 롤백 전략 정의
- [ ] 테스트 계획: 충돌 조합, 저장/적용, 라우팅·출력 메뉴 연동 테스트 정의

## 계획 산출물
- [ ] 옵션 상태/데이터 모델 설계 문서
- [ ] UI/QA 플랜 및 승인 자료

