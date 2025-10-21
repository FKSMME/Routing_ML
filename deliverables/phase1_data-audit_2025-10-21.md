# Phase 1 데이터 감사 보고서 (Routing ML Enhancement) — 2025-10-21

## 1. 개요
- **목표**: ITEM_INFO 중심 모델을 유지하면서 ROUTING_VIEW, WORK_ORDER_RESULTS 데이터를 보조 스코어로 활용하기 위한 현재 데이터 상태 파악.
- **참고 문서**:  
  - PRD: `docs/planning/PRD_2025-10-21_routing-ml-training-prediction-review.md`  
  - 체크리스트: `docs/planning/CHECKLIST_2025-10-21_routing-ml-training-prediction-review.md`

## 2. ITEM_INFO 임베딩 현황
- 최신 학습(2025-10-21 11:40:56) 결과 요약:  
  - 총 품목: 324,919  
  - 활성 피처: 36 (원본 39)  
  - 임베딩 차원: 128  
  - 학습 시간: 29.98초  
  - 주요 런타임 설정: similarity_threshold=0.85, trim_std 활성(3%~97%), HNSW M=32, ef_construction=200  
- **주요 결측률 Top 6**  
  | 피처 | 결측률 |
  | --- | --- |
  | DRAW_USE | 100% |
  | ITEM_NM_ENG | 100% |
  | GROUP3 | 99.07% |
  | RAW_MATL_KINDNM | 96.97% |
  | SealTypeGrup | 84.22% |
  | ROTATE_CTRCLOCKWISE | 75.84% |
- **피처 가중치 하이라이트**  
  - 최상위: ITEM_TYPE, PART_TYPE, SealTypeGrup (2.5)  
  - 활성 해제: ITEM_CD, ITEM_NM, ITEM_NM_ENG, PartNm, DRAW_SHEET_NO, DRAW_USE 등 식별자/결측 과다 컬럼

## 3. ROUTING_VIEW / WORK_ORDER_RESULTS 샘플 분석
- 최근 API Export(`deliverables/exports/routing_operations_20251021000425.csv`, 4건)에 대한 요약:
  - 공정 시간 계열(SETUP_TIME, RUN_TIME 등) **비제로 레코드 0건** → ML 생성 라우팅이 실제 값을 채우지 못하고 있음.
  - SIMILARITY_SCORE, ROUT_ORDER 등 메타 필드만 값이 존재.
  - 결론: 현재 파이프라인은 유사 품목 찾은 뒤에도 실제 라우팅/실적 데이터를 주입하지 못하며, 보조 스코어 단계가 필요함.

## 4. 외주 공정 데이터 상태 (로그 기반)
- `logs/audit/api.audit_20251021.log` 확인 결과:  
  - 동일 품목 반복 요청에 대해 `returned_candidates=1`이며, 모두 `ML_PREDICTED` 라우팅만 포함.  
  - 외주 공정 식별 및 사내 대체 여부를 확인할 실제 ROUTING 데이터가 응답에 미포함.
- TODO: ROUTING_VIEW에서 외주 공정 코드(예: 외주8/외주2)와 사내 공정 매핑 테이블 확보 필요.

## 5. 우선 과제 정리
1. **데이터 파이프라인**
   - ROUTING_VIEW, WORK_ORDER_RESULTS에서 사내/외주 여부, 최근 사용 일시, 실적 통계를 빠르게 조회할 수 있는 캐시 설계.
   - 보류시간(HOLD) 차감 로직 구현 전, 소스 컬럼 명칭 및 계산 규칙 확인.
2. **공정 매핑**
   - 외주8/외주2 → 사내 공정 대체 규칙 정의 (엔지니어링 팀 협의 필요).
3. **통계 옵션 명세**
   - Trim 평균, 가중 평균, 표준편차 기반 안전계수 등 Config 정의 → Phase 2 설계 문서에 반영.
4. **데이터 품질 라벨링**
   - ROUTING/WORK 데이터에 대해 “사용 가능/주의/제외” 기준 마련 (결측률, 샘플 수, 최근성).

## 6. 산출물 및 다음 단계
- **산출물**:  
  - 본 보고서 (`deliverables/phase1_data-audit_2025-10-21.md`)  
  - 분석 스크립트 출력 로그 (PowerShell history)
- **다음 단계 (Phase 2 착수 조건)**  
  - 체크리스트 Phase 1 항목 [x] 처리  
  - 외주 공정 매핑/통계 옵션 초안 작성 → 설계 문서에 반영  
  - 캐시/재랭킹 알고리즘 설계 착수

---
- 작성자: Codex QA  
- 작성일: 2025-10-21  
- 비고: `.claude/WORKFLOW_DIRECTIVES.md` 절차에 따라 Phase 1 완료 후 Monitor 빌드 시퀀스 수행 예정
