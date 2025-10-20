# Checklist: ERP View Pagination and UI Adjustments

## Metadata
- **작성일**: 2025-10-20
- **담당자**: Codex
- **연관 PRD**: `docs/planning/PRD_2025-10-20_erp-view-pagination-and-ui-adjustments.md`
- **외부 의존성**: ERP View 데이터 API, GLB 뷰어 컴포넌트

## Phase 1: 데이터 조회 및 페이지네이션 재설계

- [x] ERP View 데이터 제한 원인 분석 (ETA: 1.0h)  
  **Dependencies**: 기존 ERP 쿼리/서비스 접근  
  **Acceptance**: 제한 조건(TOP, LIMIT 등) 위치 및 제거 전략 문서화
- [ ] API/쿼리 수정으로 건수 제한 제거 (ETA: 1.5h)  
  **Dependencies**: 분석 결과, 백엔드 리포지토리 권한  
  **Acceptance**: 테스트 조회에서 500건 초과 결과 확인
- [ ] 페이지네이션 파라미터 및 상태 관리 구현 (ETA: 1.5h)  
  **Dependencies**: 수정된 API  
  **Acceptance**: 페이지 이동 시 올바른 데이터 세트 로드
- [ ] 검색 액션 기반 지연 로딩 로직 반영 (ETA: 1.0h)  
  **Dependencies**: 페이지네이션 상태, UI 이벤트  
  **Acceptance**: 초기 진입 시 데이터 비어 있음, 검색 후 데이터 로딩
- [ ] 1차 테스트 및 로딩 UI 확인 (ETA: 1.0h)  
  **Dependencies**: 상기 구현 완료  
  **Acceptance**: 로딩 인디케이터 노출, 에러 핸들링 로그 확인

**Estimated Time**: 6.0h  
**Status**: Not Started

**Git Operations**:
- [ ] Commit Phase 1
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 2: UI 레이아웃 및 기준정보 확장

- [ ] 기준정보 박스 레이아웃 구조 파악 (ETA: 0.5h)  
  **Dependencies**: Phase 1 데이터 구조  
  **Acceptance**: 현재 폭 하드코딩 지점 파악
- [ ] 컨테이너 CSS 100% 폭 반응형 변환 (ETA: 1.5h)  
  **Dependencies**: 레이아웃 분석  
  **Acceptance**: 상단 메뉴바와 가로폭 일치, 주요 브레이크포인트 확인
- [ ] 기준정보 데이터 페이지네이션/제한 제거 (ETA: 1.0h)  
  **Dependencies**: Phase 1 API 변경  
  **Acceptance**: 기준정보 데이터 500건 초과 조회 가능
- [ ] 시각적 회귀 테스트 및 디자인 리뷰 캡처 (ETA: 1.0h)  
  **Dependencies**: UI 반영 완료  
  **Acceptance**: 주요 화면 스크린샷, QA 체크리스트 작성

**Estimated Time**: 4.0h  
**Status**: Not Started

**Git Operations**:
- [ ] Commit Phase 2
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 3: GLB 인터랙션 복원 및 마무리 검증

- [ ] 기존 GLB 뷰어 구성 확인 (ETA: 0.5h)  
  **Dependencies**: Phase 1, 2 브랜치 상태  
  **Acceptance**: 적용 중인 라이브러리/컴포넌트 파악
- [ ] 마우스 드래그 회전 및 줌 기능 구현 (ETA: 1.5h)  
  **Dependencies**: GLB 뷰어 설정  
  **Acceptance**: 데스크톱에서 회전/휠 동작 정상
- [ ] 모바일 제스처(핀치/드래그) 대응 확인 (ETA: 0.5h)  
  **Dependencies**: 회전 기능 구현  
  **Acceptance**: 터치 시뮬레이터에서 회전/줌 동작
- [ ] 통합 QA 및 회귀 테스트 (ETA: 0.5h)  
  **Dependencies**: 전체 기능 구현  
  **Acceptance**: 주요 시나리오 테스트 결과 문서화
- [ ] 산출물 정리 및 문서 업데이트 (ETA: 0.5h)  
  **Dependencies**: QA 완료  
  **Acceptance**: 변경 요약, 테스트 결과, 릴리즈 노트 초안

**Estimated Time**: 3.5h  
**Status**: Not Started

**Git Operations**:
- [ ] Commit Phase 3
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Progress Tracking

```
Phase 1: [▓░░░░] 20% (1/5 tasks)
Phase 2: [░░░░░] 0% (0/4 tasks)
Phase 3: [░░░░░] 0% (0/5 tasks)

Total: [▓░░░░░░░░░] 7% (1/14 tasks)
```

---

## Acceptance Criteria

- [ ] ERP View 검색 시 500건 제한 없이 페이지 단위 조회 가능
- [ ] 기준정보 박스 폭 100% 적용 및 반응형 검증
- [ ] GLB 모델 마우스/터치 회전 및 줌 동작
- [ ] 체크리스트 모든 항목 [x] 처리 및 Progress 100%
- [ ] Phase별 Git 작업 순서대로 완료
- [ ] 작업 히스토리 문서 업데이트

---

**Last Updated**: 2025-10-20  
**Next Review**: Phase 1 완료 직후
