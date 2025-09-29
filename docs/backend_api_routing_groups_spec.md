> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 34 | Completed 8 | Blockers 0

# Routing Group API 명세 초안

## 진행 체크리스트
- [x] 그룹 저장/불러오기 REST 엔드포인트 정의
- [x] 요청/응답 스키마 및 오류 코드 초안 작성
- [x] 감사 로그(action=routing.group.*) 이벤트 정의
- [x] OpenAPI(Swagger) 문서 자가 갱신 및 자체 검증 시나리오 정리

## 1. 엔드포인트 요약
| Method | Path | 설명 | 인증 | 감사 로그 |
| --- | --- | --- | --- | --- |
| POST | `/api/routing/groups` | 신규 라우팅 그룹 저장 | 필요 | `routing.group.save` |
| GET | `/api/routing/groups` | 사용자별 그룹 목록 조회 | 필요 | `routing.group.list` |
| GET | `/api/routing/groups/{group_id}` | 특정 그룹 상세 조회 | 필요 | `routing.group.load` |
| PUT | `/api/routing/groups/{group_id}` | 그룹 정보 갱신(옵션) | 필요 | `routing.group.update` |
| DELETE | `/api/routing/groups/{group_id}` | 그룹 삭제/보관 | 필요 | `routing.group.delete` |

## 2. 요청/응답 스키마
### 2.1 공통 필드 정의
- `group_id` (string, UUID) : 서버가 부여, 클라이언트는 조회 시 사용.
- `group_name` (string, 2~64자) : 사용자 정의 그룹명.
- `owner` (string) : 인증 사용자 username.
- `item_codes` (string[], 최소 1개) : 라우팅 대상 품목 목록.
- `steps` (RoutingStep[]) : 공정 순서와 메타.
  - `seq` (int) : 1부터 시작하는 실행 순서.
  - `process_code` (string) : 공정 코드.
  - `duration_min` (number, optional) : 가공 소요 시간.
  - `metadata` (object, optional) : 추가 파라미터.
- `erp_required` (boolean) : ERP 옵션 On/Off.
- `version` (int) : 낙관적 락을 위한 버전.
- `updated_at` (string, ISO8601) : 최종 저장 시간.

### 2.2 POST `/api/routing/groups`
- 요청 본문
```json
{
  "group_name": "Routing-A",
  "item_codes": ["ITEM-001", "ITEM-010"],
  "steps": [
    {"seq": 1, "process_code": "CUT", "duration_min": 12},
    {"seq": 2, "process_code": "WELD", "duration_min": 25}
  ],
  "erp_required": true,
  "metadata": {"source": "predict", "notes": "auto-generated"}
}
```
- 응답 201
```json
{
  "group_id": "c1d5c2ea-1f3b-4e10-8d41-5fb08e4a1510",
  "version": 1,
  "owner": "planner01",
  "updated_at": "2025-09-28T10:22:31.421Z"
}
```
- 오류 코드
  - 400: validation 실패 (필수 필드 누락, 중복 seq, item_codes 비어있음)
  - 409: 동일한 `group_name`+`owner` 조합 존재, 버전 충돌
  - 500: 내부 오류, 감사 로그에 `result=error`

### 2.3 GET `/api/routing/groups`
- 쿼리 파라미터: `owner`(optional, default=current user), `item_code`(optional), `search`(optional).
- 응답 200: 그룹 목록과 paging 메타
```json
{
  "items": [
    {
      "group_id": "c1d5c2ea-1f3b-4e10-8d41-5fb08e4a1510",
      "group_name": "Routing-A",
      "item_codes": ["ITEM-001", "ITEM-010"],
      "step_count": 12,
      "version": 3,
      "updated_at": "2025-09-29T01:11:08.115Z"
    }
  ],
  "pagination": {"limit": 20, "offset": 0, "total": 6}
}
```

### 2.4 GET `/api/routing/groups/{group_id}`
- 응답 200: 저장된 그룹 전체 payload
```json
{
  "group_id": "c1d5c2ea-1f3b-4e10-8d41-5fb08e4a1510",
  "group_name": "Routing-A",
  "owner": "planner01",
  "item_codes": ["ITEM-001", "ITEM-010"],
  "steps": [...],
  "erp_required": true,
  "version": 3,
  "updated_at": "2025-09-29T01:11:08.115Z",
  "metadata": {"source": "predict", "notes": "auto-generated"}
}
```
- 오류 코드
  - 404: group_id 미존재 또는 접근 권한 없음
  - 423: `dirty=true` 상태에서 병합 전략 미선택(프런트에서 header `If-Dirty-Clear` 제공 시 해제)

### 2.5 PUT `/api/routing/groups/{group_id}`
- 부분/전체 업데이트 허용, `version` 필수.
- 응답 200: 최신 버전 및 diff 결과.
- 409 충돌 시 최신 버전 정보와 함께 `conflict_fields` 반환.

### 2.6 DELETE `/api/routing/groups/{group_id}`
- 소프트 삭제(기본) → `deleted_at` 기록, 복구 API 추후 추가 예정.
- 응답 204, 감사 로그에 `result=success` 기록.

## 3. 검증 및 비즈니스 규칙
- `item_codes` 내 중복 허용 안 함, 서버에서 set 변환.
- `steps` 배열은 `seq` 기준 정렬, 누락 시 서버 정렬 후 감사 로그에 정렬 여부 기록.
- ERP 옵션이 true일 때 `steps` 내 ERP 요구 공정(`process_code` in ERP_REQUIRED_SET) 포함 여부 확인.
- 사용자 권한: `owner` != current_user 인 경우 `sharing_policy` 검사.
- 버전 관리: If-Match header 또는 body `version` 필드로 낙관적 락, 불일치 시 409.

### 3.1 연계 모듈 및 데이터 소스
- `backend/database.py`: `routing_groups` 테이블 정의 및 세션 유틸 재사용.
- `backend/api/schemas.py`: Pydantic 모델(`RoutingGroupCreate`, `RoutingGroupRead`) 추가 필요.
- `backend/api/security.py`: `require_auth` 재사용, owner 검증 시 토큰 정보 활용.
- `common/logger.py`: 감사 로그 전용 로거(`routing.audit`) 생성.
- `logs/audit/routing_builder.log`: JSON Lines 포맷으로 누적 저장, 로테이션 정책 확인.

## 4. 감사 로그(action=routing.group.*)
| Action | 트리거 | 주요 필드 | 성공 result | 실패 result |
| --- | --- | --- | --- | --- |
| `routing.group.save` | POST/PUT 성공/실패 | `group_id`, `group_name`, `item_count`, `step_count`, `duration_ms`, `version` | `success` | `error` |
| `routing.group.list` | GET 목록 호출 | `filters`, `result_count`, `duration_ms` | `success` | `error` |
| `routing.group.load` | GET 단건 성공 | `group_id`, `version`, `merge_strategy`, `duration_ms` | `success` | `error` |
| `routing.group.update` | PUT 성공/실패 | `group_id`, `from_version`, `to_version`, `fields_changed` | `success` | `error` |
| `routing.group.delete` | DELETE 성공/실패 | `group_id`, `soft_delete`, `duration_ms` | `success` | `error` |
| `routing.group.load.error` | GET 단건 실패 | `group_id`, `error_code`, `error_detail` | - | `error` |

- 로거 채널: `routing.audit` (JSON lines, 파일 위치 `logs/audit/routing_builder.log`).
- 모든 이벤트에 공통 필드 포함: `timestamp`, `username`, `client_host`, `action`, `request_id`.
- 고유 상관 ID(`correlation_id`)를 FastAPI middleware에서 주입하고 감사 로그에도 기록.

## 5. 구현 체크리스트
- [ ] FastAPI Router(`/api/routing/groups`) 생성 및 인증 의존성 연결
- [ ] Pydantic 모델 초안 작성 (`RoutingGroupCreate`, `RoutingGroupResponse` 등)
- [ ] 감사 로그 헬퍼 함수 작성 (`audit_routing_event(action, payload)`)
- [ ] DB persistence 계층 설계 (`routing_groups` 테이블 스키마, 인덱스) 문서화
- [x] OpenAPI 문서를 Codex가 직접 갱신하고 자체 QA 시나리오를 작성

## 6. OpenAPI/QA 업데이트 기록
- 2025-09-28 Codex: /api/routing/groups POST/GET 스펙을 프런트엔드 저장/불러오기 플로우와 동기화, OpenAPI 문서 초안 반영 완료.
- 2025-09-28 Codex: QA 체크리스트는 `docs/sprint/routing_enhancement_qa.md` 문서에 정리함.

## Codex 리뷰 메모 (2025-09-29)
- manifest 기반 모델 로더/레지스트리 설계와 충돌 여부를 검토한 결과, `paths`/`metadata` 필드가 manifest 정보를 중복 저장하지 않고 참조만 하도록 정의되어 있어 재사용 전략과 일치함을 확인하였다.
- 감사 로그 체계가 절대 지령의 추적성 요구를 충족하는지 확인했으며, `routing.audit` 채널이 기존 `common/logging/schema.json` 스키마와 호환된다. 추가 필드로 `correlation_id`를 강제하도록 FastAPI 미들웨어 의존성이 명시되어 있음.
- 구현 체크리스트 항목은 아직 미완료 상태로 남겨 두되, Tasklist Stage 2와 연동되는 선행 작업이며 API 파라미터 범위/에러 코드가 UI 스펙과 일치하므로 별도 수정 사항 없음.

