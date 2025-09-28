> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 34 | Completed 8 | Blockers 0

# 절대 지령 준수 안내
- 기존 절대 지령을 동일하게 적용하며 착수·완료 시 승인 절차를 따른다.
- 작업 로그와 산출물을 문서화하고 Tasklist와 연동한다.

# Step 4 Plan: 학습 데이터 현황 대시보드

## 단계 목표
- [ ] TensorBoard 링크, 가중치 히트맵, 피처 선택/저장, 시각화 탭 구조를 구현한다.

## 세부 Task Checklist
- [ ] 데이터 요구 정리: 모델 메타데이터, 추천 가중치, TensorBoard URL 수집
- [ ] 시각화 도구 선정: 히트맵/차트 라이브러리 PoC 계획 수립
- [ ] TensorBoard 연동 전략: 인증·프록시·iframe 정책 검토 문서화
- [ ] 피처 선택 저장 흐름: `feature_profiles.json` 업데이트 로직·감사 로그 설계
- [ ] UI 구조 설계: 5개 탭(Weights/Metric/Visualization/Data Source/Workflow) 정보 구조 정의
- [ ] QA 계획: 데이터 없음/에러 fallback, 접근성, 성능 시나리오 수립

## 계획 산출물
- [ ] 학습 대시보드 설계 문서 초안
- [ ] 테스트/보안 체크리스트
- [ ] 승인 단계 보고서

