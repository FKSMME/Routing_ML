# 저장소 거버넌스 및 승인 체계 제안

## 브랜치 전략
- 기본 브랜치: `main`
- 기능 브랜치 네이밍: `feature/<stage>-<short-desc>`
- 긴급 수정: `hotfix/<issue-id>`
- 브랜치 보호 규칙(제안)
  - 최소 2명 리뷰어 승인 필수(ML 리드 + 도메인 담당)
  - 필수 상태 체크: `lint`, `tests`, `docs-links`
  - 병합 전 최신 `main`과 충돌 검사 필수
  - 관리자도 규칙 우회 불가

## CODEOWNERS 후보
```
# 경로                     리뷰어(역할)
/backend/                 @ml-lead        # ML API 총괄
/common/                  @data-eng       # 데이터 파이프라인
/gui/                     @frontend-lead  # 프런트엔드
/models/                  @ml-lead @data-eng
/task_details/            @pm-owner       # 문서/프로세스
/docs/                    @pm-owner @qa-lead
```
- 실제 GitHub 핸들은 승인 단계에서 확정 예정.

## 승인 워크플로우 요약
1. 작성자는 단계 전체 범위 리뷰 후 이슈/PR을 등록하고 게이트 체크리스트 완료.
2. 자동화된 템플릿을 통해 절대 지령 준수 여부를 명시.
3. 리뷰어가 문서/코드/테스트를 점검하고 이슈 발견 시 재승인 요청.
4. 승인자는 Stage 완료 보고서 및 테스트 결과를 확인 후 승인.
5. 승인 로그는 `logs/task_execution_*.log`에 기록하여 감사 추적 가능하도록 유지.

## 요구 추적 및 승인 아카이브
- `docs/requirements_traceability_matrix.md`에 요구-태스크-전달물 매핑 관리.
- Stage 종료 시 `docs/stage*_report.md` 형태로 보고서를 축적.
- 승인 결재 이력은 PR 코멘트 + 로그 파일로 보존.

## 향후 일정
- Stage 1 승인 획득 후 CODEOWNERS 파일 초안 업로드.
- CI 파이프라인 정비(테스트/린트) 작업을 Stage 2 이전에 계획.

