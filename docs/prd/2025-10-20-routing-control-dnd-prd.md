# 라우팅 생성 제어판 Drag & Drop 개선 PRD

- **작성일**: 2025-10-20 11:20 (UTC-4)
- **요청자**: 사용자
- **작성자**: Codex (GPT-5)
- **버전**: v1.0

## 1. 배경
라우팅 생성 페이지의 제어판은 품목 코드를 수동으로 입력하거나 생산 접수 품목 드롭다운을 통해 일부만 선택할 수 있어 작업 효율이 낮았다. ERP View에 존재하는 ItemCode 데이터를 직관적으로 탐색하고, 복수 선택 및 Drag & Drop으로 제어판에 전달할 수 있는 경험이 요구되었다.

## 2. 목표
- ERP View 기반 ItemCode 탐색 패널을 제어판 좌측에 배치한다.
- Drag & Drop으로 품목 코드를 제어판 입력란에 추가한다.
- 필터 및 다중 선택을 지원하여 대량 품목 이동을 단순화한다.
- 기존 "생산 접수 품목" 드롭다운을 제거하여 UI를 간결하게 유지한다.

## 3. 범위
- **포함**
  - ERP View 목록 및 컬럼 조회 API 연동 (`GET /api/view-explorer/views`, `GET /api/view-explorer/views/{view}/sample`)
  - 좌측 ERP Item Explorer UI, 검색/필터/다중 선택/일괄 드래그 기능
  - PredictionControls 컴포넌트 Drag & Drop 대응 및 textarea 하이라이트
  - 제어판 좌우 2열 레이아웃 구성 및 스타일링
- **제외**
  - ERP 백엔드 스키마 변경
  - Drag & Drop 외의 자동 추천 로직 변경
  - 모바일/태블릿 뷰 최적화 (기본 반응형 정렬만 적용)

## 4. 사용자 스토리
| ID | 역할 | 시나리오 | 기대 결과 |
| --- | --- | --- | --- |
| US-1 | 라우팅 엔지니어 | ERP View에서 ItemCode를 검색 후 드래그한다 | 제어판 입력란에 ItemCode가 추가된다 |
| US-2 | 라우팅 엔지니어 | 필터 결과 전체를 한번에 제어판으로 옮긴다 | 필터링된 모든 ItemCode가 중복 없이 입력된다 |
| US-3 | 라우팅 엔지니어 | 품목 드롭다운 없이도 ERP 데이터로 작업한다 | 기존 드롭다운 없이도 동일한 흐름 유지 |
| US-4 | 라우팅 엔지니어 | Drag & Drop이 어려운 환경에서 버튼으로 추가한다 | "선택 추가/필터 추가" 버튼으로 동일 작업 수행 |

## 5. 기능 요구사항
1. **ERP View 탐색 패널**
   - View 목록 조회 및 기본 뷰 자동 선택 (ITEM, PRODUCT 키워드 우선)
   - 컬럼 선택 드롭다운 (ItemCode 컬럼 자동 추천)
   - 전역 검색(부분 일치) 및 결과 필터링, 선택 상태 유지
   - 드래그 가능한 Chip: 전체/필터 결과/선택 항목
2. **제어판 textarea Drag & Drop**
   - Drag Over 시 테두리/배경 강조
   - Drop 시 최대 50개 ItemCode 병합, 중복 제거
   - text/plain 드롭(외부 텍스트)도 허용
3. **기타 UI 요구사항**
   - 제어판 좌우 2열 레이아웃 (ERP Explorer 32%, 제어판 68%)
   - 기존 생산 품목 드롭다운 제거
   - 접근성: 버튼/Chip은 키보드 포커스 및 클릭 가능

## 6. 기술 고려사항
- React Query로 ERP View 및 샘플 데이터를 캐싱 (staleTime 2~5분)
- Drag 데이터 포맷: `application/x-routing-itemcodes` + JSON + text/plain fallback
- PredictionControls를 `forwardRef`로 전환하여 외부 append API 제공
- 최대 품목 수(50) 초과 시 잘라내기 처리로 API 요청 폭발 방지
- 스타일: 기존 panel-card 토큰 활용, index.css 확장

## 7. 성공 지표
- Drag & Drop을 통한 제어판 품목 추가 성공률 95% 이상 (내부 QA 기준)
- 품목 다중 선택 후 "선택 추가" 버튼 동작 성공률 100%
- 기존 워크플로우 대비 평균 입력 시간 40% 이상 단축 (정성 평가)

## 8. 리스크 및 대응
- **대용량 View 응답 지연**: 샘플 조회 limit 500, Refresh 버튼 제공
- **브라우저 호환성**: HTML5 Drag & Drop 지원 범위 점검 (IE 미지원 허용)
- **기존 입력 흐름 변화**: 안내 문구 및 placeholder 업데이트로 혼선 방지

## 9. 일정 (2025-10-20 기준)
1. 11:00~11:25 요구사항 정리 & PRD 초안 ✔️
2. 11:25~12:15 ERP Explorer 컴포넌트 구현 ✔️
3. 12:15~13:00 Drag & Drop 통합, PredictionControls 리팩터링 ✔️
4. 13:00~13:20 스타일/반응형 마감 ✔️
5. 13:20 이후 문서 정리 및 검증(현재 단계) ✔️

## 10. 승인
- **승인 필요자**: 사용자
- **상태**: 승인 대기
