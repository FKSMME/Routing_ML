> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 34 | Completed 8 | Blockers 0

# 절대 지령 준수 안내
- 기존 절대 지령을 동일하게 적용하며 착수·완료 시 승인 절차를 따른다.
- 작업 로그와 산출물을 문서화하고 Tasklist와 연동한다.

# Step 3 Plan: 데이터 출력 템플릿 시스템

## 단계 목표
- [ ] 템플릿 CRUD/유효성 검사/ERP 매핑을 완성하고 라우팅 SAVE와 연동한다.

## 세부 Task Checklist
- [ ] 요구사항 재정의: `menu4_output_config_detail.md` 기반 필수 컬럼·포맷 정리
- [ ] 백엔드 설계: `/api/output/templates` CRUD, 버전 관리, 감사 로그 정의
- [ ] 프런트 UI 설계: 템플릿 목록, 컬럼 DnD, 미리보기/검증 UX 와이어프레임 작성
- [ ] ERP 매핑 로직: ERP 옵션 의존성 설계, 필수 필드 검증 규칙 정의
- [ ] 라우팅 SAVE 연동: 템플릿 선택→검증→저장 흐름 설계
- [ ] 테스트 계획: 유효성 검사 케이스, 회귀 테스트, 실패 롤백 전략

## 계획 산출물
- [ ] 템플릿 데이터 모델/엔드포인트 명세 초안
- [ ] UI/QA 체크리스트 및 승인 요청 자료

