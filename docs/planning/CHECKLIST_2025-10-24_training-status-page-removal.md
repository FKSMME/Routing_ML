## Phase 1 – 문서화
- [x] PRD 작성 (Est. 0.5h)  
  - Acceptance: 필수 섹션 포함, 공유 경로에 저장.
- [x] 체크리스트 작성 (Est. 0.5h)  
  - Acceptance: 단계별 작업/시간/의존성 표기, 진행도 섹션 포함.

## Phase 2 – 영향 범위 파악
- [x] 네비게이션/라우트 구조 조사 (Est. 1.0h)  
  - Dependencies: Phase 1 완료  
  - Acceptance: 삭제 대상 파일 및 연결 API 목록.
- [x] 백엔드 의존성 확인 (Est. 1.0h)  
  - Dependencies: 네비 구조 조사  
  - Acceptance: 관련 API/서비스 존폐 여부 보고.

## Phase 3 – 구현
- [x] 네비게이션/라우트에서 페이지 제거 (Est. 1.0h)  
  - Dependencies: Phase 2 결과  
  - Acceptance: 메뉴/라우터 수정, 린트 통과.
- [x] 페이지 컴포넌트 및 스타일 삭제 (Est. 1.0h)  
  - Dependencies: 라우트 제거  
  - Acceptance: 불필요 자산 제거, 빌드 확인.
- [x] 딥링크 리다이렉션 처리 (Est. 0.5h)  
  - Dependencies: 라우트 정리  
  - Acceptance: `/...?menu=training-status` 접근 시 기본 메뉴 로드.
- [ ] 불필요한 API 호출 정리 (Est. 0.5h)  
  - Dependencies: 백엔드 의존성 확인  
  - Acceptance: 네트워크 탭/로그에 해당 호출 미발생.

## Phase 4 – QA & 보고
- [ ] 수동 QA 및 스크린샷 갱신 (Est. 0.5h)  
  - Dependencies: Phase 3 완료  
  - Acceptance: 주요 사용자 흐름 확인, 캡처 저장.
- [ ] 결과 보고 및 문서 업데이트 (Est. 0.5h)  
  - Dependencies: QA 통과  
  - Acceptance: 작업 요약 공유, 진행도 100%.

## Progress Tracking

Phase 1: [##########] 100% (2/2 tasks)  
Phase 2: [##########] 100% (2/2 tasks)  
Phase 3: [#######   ] 75% (3/4 tasks)  
Phase 4: [          ] 0% (0/2 tasks)

Total: [#######   ] 64% (7/11 tasks)
