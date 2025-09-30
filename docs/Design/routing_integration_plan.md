> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 34 | Completed 8 | Blockers 0

# Routing Integration Plan (Settings · Audit · Access · QA)

## 1. 설정 저장 전략
- **클라이언트 캐시**: IndexedDB `routing_workspace` (최근 세션 5개), 30초 debounce.
- **서버 스토어**: `/api/settings/workspace` (POST/PUT), payload `{ version, user, layout, routing, algorithm, options }`.
- **버전 관리**: optimistic lock (`If-Match` 헤더 + `settings_version`).
- **백엔드 설계**: `settings_workspace` 테이블 (id UUID, user_id, version, payload JSONB, updated_at, ip_address).

## 2. 감사 로그(action prefix)
| Action                     | Trigger                               | 필드                                                         |
|---------------------------|----------------------------------------|-------------------------------------------------------------|
| `ui.workspace.save`       | 설정 저장 성공                         | version, diff_hash, duration_ms, ip_address                 |
| `ui.workspace.rollback`   | Undo/Redo 실행                         | product_id, reason, history_depth                           |
| `ui.routing.interface`    | INTERFACE 버튼 실행                    | group_id, format, erp_enabled                               |
| `ui.options.update`       | 옵션 화면 저장                         | option_keys, conflict_resolved                              |
| `ui.access.connection`    | Access 경로 테스트                     | path_hash, table_profiles                                   |
- 로그 파일: `logs/audit/ui_actions.log` (JSON lines, 일별 롤링).
- 모든 요청 헤더에서 `X-Forwarded-For` → IP, `X-Request-ID` → correlation.

## 3. Access DB 연결 설계
- **연결 구성**: `/api/access/connection` POST `{ path, table, auth }` → 서버에서 OLEDB 연결 테스트.
- **자격 관리**: 암호화 금지, 로컬 경로만 허용. 네트워크 공유는 UNC path 구성.
- **테이블 매핑**: `/api/access/metadata` GET → 컬럼 정보 반환, UI에서 매핑 저장.
- **캐시**: 최근 성공한 경로는 서버에서 15분 캐시, 감사 로그에 path hash 저장.

## 4. `/api/routing/groups` 연동 QA 계획
1. **기본 저장 시나리오**
   - 입력: 3개 공정, ERP 옵션 off → Expect 201, audit `routing.group.save` success.
2. **중복 이름 충돌**
   - 동일 사용자 동일 이름 저장 → Expect 409, UI rollback, validation 메시지 확인.
3. **불러오기**
   - 저장된 그룹 GET → 타임라인 교체, dirty false 확인.
4. **ERP 옵션 활성**
   - 옵션 화면에서 ERP ON → 인터페이스 버튼 활성, POST 시 payload `erp_required: true`.
5. **삭제/버전** (추후 단계)
   - 버전 mismatch → 409 + 최신 버전 반환.
- 실행 순서: 로컬 dev 서버 → Swagger 문서 갱신 → QA 체크리스트에 결과 기록.

## 5. 배포 및 구성 관리
- **Docker**: `Dockerfile.ui` (Vite build → nginx) + `docker-compose.yml` (ui + api + access stub).
- **내부망 포팅**: 1인 개발자 PC를 staging 서버로 지정, Windows 서비스 등록.
- **외부 의존 차단**: CDN 미사용, 폰트/아이콘 로컬 번들.
- **릴리즈 절차**: QA 통과 → 감사 로그 확인 → Docker 이미지 태깅 → 내부 레지스트리 푸시 → 스탠드업 보고.

## 6. 참고 문서
- `docs/Design/routing_state_store_plan.md` (스토어/퍼시스턴스)
- `docs/sprint/routing_enhancement_qa.md` (QA 체크리스트)
