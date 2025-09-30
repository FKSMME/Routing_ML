> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 34 | Completed 8 | Blockers 0

# Routing Enhancement 설계 개편안

## 진행 체크리스트
- [x] 샘플(`docs/Design/samples`) UI 반영 수준 합의
- [x] 메뉴별 레이아웃/기능 상세 확정
- [x] Access/ERP/저장/로그 연동 설계
- [x] QA/배포 전략 문서화

## 1. 공통 UX 원칙
- 파스텔 하늘 그라데이션 배경 + 글라스모피즘 카드(`card-gradient`), 샘플 톤 재활용.
- 마우스 오버 시 박스 그림자·테두리 강조, 메뉴는 연한 톤 유지.
- 반응형: ≥1440px 기준 3컬럼, 1024px 미만 2컬럼, 768px 이하 스택 배치.
- 모든 메뉴 공통 헤더에 상태 요약·마지막 저장 시간 표시, `lucide-react` 아이콘 통일.

## 2. 상단 네비게이션
- 메뉴 순서: 기준정보 확인 → 라우팅 생성 → 알고리즘 → 데이터 출력 설정 → 학습 데이터 현황 → 옵션.
- 좌측 로고/프로젝트명, 우측 유저/로그/배포 상태.
- 모바일: 햄버거 + Drawer, 데스크탑: Tabs + Breadcrumb (`shadcn navigation-menu`).

## 3. 기준정보 확인 (Reference Data)
- 좌측: Access DB 연결 패널(파일 경로/테이블 선택) + 즐겨찾기/최근 리스트.
- 중앙: Siemens Teamcenter 유사 트리(TreeView) + 마스터 행렬(Grid). 검색/필터 Combobox.
- 우측: 품목 상세(이미지/속성), 관련 라우팅 히스토리, Access 컬럼 ↔ UI 필드 매핑 요약.
- Access 연결: OLEDB/ODBC 경로 저장 + 연결 테스트 버튼, 성공 시 감사 로그 기록.

## 4. 라우팅 생성 (Routing Generation)
- 레이아웃: 좌 20%(입력/행렬), 센터 60%(캔버스), 우 20%(후보/저장).
- 좌상단: 다중 품목 Textarea + 업로드(CSV). 좌하단: Access 컬럼 vs 값 행렬, ScrollArea.
- 센터: 품목 탭(TabsList 상단), 각 탭 내 가로 타임라인(`reactflow` 기반 블록). 블록은 Drag&Drop, 시간축 스케일 표시.
- 센터 하단: 라우팅 요약(총 시간, 공정 수) + 감사 로그 뷰어.
- 우상단: 후보 공정 카드(검색/필터 포함) Drag → 센터 삽입. 우하단: SAVE(포맷 선택, 로컬/클립보드) + INTERFACE(ERP 옵션 ON 시 활성).
- 그룹 관리: 저장 시 로컬(IndexedDB)/서버(`/api/routing/groups`) 이중 저장, 버전/Dirty 표시.

## 5. 알고리즘 (Algorithm)
- Unreal Blueprint 스타일 그래프: 노드(Trainer/Predictor 함수) + Edge.
- 더블 클릭: 설정 Drawer (입력/출력/하이퍼파라미터). 저장 시 Python 코드 템플릿 업데이트 -> Git diff 파일 생성.
- 템플릿: `models/blueprints/*.json` 관리, 프런트에서 렌더 → 백엔드로 PATCH.

## 6. 데이터 출력 설정 (Data Output)
- 컬럼 매핑 매트릭스: 원본 필드/표준 필드/출력 타입/포맷.
- 미리보기: 샘플 데이터 10행.
- 저장: `/api/routing/output-profiles` POST, 라우팅 SAVE 시 선택 프로필 적용 (CSV/Access/XML 등).

## 7. 학습 데이터 현황 (Learning Data Status)
- 카드: 모델 버전/학습 시각/데이터셋.
- 시각화: TensorBoard IFrame 링크, Heatmap, Feature Importance Bar Chart.
- 체크박스: 학습에 포함할 피처 선택 -> `/api/trainer/features` PATCH.
- 로그: 최근 학습 이벤트, 실행 시간.

## 8. 옵션 (System Options)
- 표준편차(Z-score 등), 유사 품목 설정, 충돌 옵션(토글 + 규칙) UI.
- 라우팅 생성 컬럼/라벨/Key, 학습/출력 매핑 테이블 관리.
- ERP 인터페이스, Access 경로 공유, Docker 빌드 옵션.

## 9. 저장/로그/배포
- 설정 저장소: 서버(PostgreSQL) + 로컬 fallback(IndexedDB). `settings_version` 필드.
- 감사 로그: IP, 사용자, action, payload hash. `logs/audit/ui_actions.log`.
- 배포: Dockerfile 작성, 내부망 배포 가이드 문서화. 외부 의존 금지.
- 모델 학습 콘솔: 별도 앱/서버로 분리, 현재 프로젝트는 REST 호출만.

## 10. 향후 작업 우선순위
1. UI 토큰/레이아웃 시스템 정리 (`theme.css`)
2. 라우팅 생성 화면 1차 프로토타입 제작 -> 리뷰
3. 나머지 메뉴 그래프/시각화 구현
4. Access/ERP/저장 백엔드 스펙 정의 -> API 확장
5. QA 체크리스트 실검증 + Docker PoC

## Codex 리뷰 메모 (2025-09-29)
- `docs/Design/samples` 내 Stage 2 캔버스 목업 대비 현재 20/60/20 배치 및 파스텔 톤 토큰 구성이 일치함을 확인하였다. 캔버스 상호작용은 ReactFlow 기반으로 유지하며 manifest 기반 모델 재사용 방안과 충돌하지 않는다.
- 메뉴별 기능 분류가 Tasklist Stage 1~3 범위와 맞물리는지 교차 검토했고, Access 연결·ERP 인터페이스·로그 경로가 각 섹션에서 일관되게 명시되어 있어 구현 시 새 산출물 생성 없이 기존 백엔드 확장으로 처리 가능하다.
- QA/배포 전략은 `docs/sprint/routing_enhancement_qa.md` 및 `deploy/` 스크립트와 연결되어 있으며 절대 지령의 백그라운드 테스트 요구를 충족하도록 단계별 체크포인트를 유지한다. 추가 보완 필요 사항은 없음.
