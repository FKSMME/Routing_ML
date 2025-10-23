# PRD: Critical Runtime Errors Fix

**문서 버전**: 1.0
**작성일**: 2025-10-23
**작성자**: Claude (Sonnet 4.5)
**프로젝트**: Routing ML
**우선순위**: P0 (Critical - Production Down)

---

## 1. Executive Summary

### 1.1 문제 정의
현재 프로덕션 환경에서 3가지 Critical 에러가 동시 발생하여 시스템이 완전히 작동하지 않음:

1. **Backend API 500 Error** (P0): 예측 API 완전 중단
   - `AttributeError: 'PredictionService' object has no attribute '_model_registry_url'`
   - 모든 `/api/predict` 요청이 실패

2. **Frontend Module Error** (P0): React 앱 완전 중단
   - `SyntaxError: The requested module '/node_modules/use-sync-external-store/shim/with-selector.js?v=5f465393' does not provide an export named 'default'`
   - 메인 화면 ErrorBoundary 트리거

3. **Korean Text Encoding Issue** (P1): UI 가독성 상실
   - 메뉴 한글이 `���`로 표시
   - 사용자 경험 심각 저하

### 1.2 비즈니스 임팩트
- **사용자**: 시스템 완전 사용 불가 (0% 가용성)
- **비즈니스**: 생산 중단, 라우팅 예측 불가
- **타임라인**: 즉시 수정 필요 (다운타임 최소화)

### 1.3 목표
- Backend API 정상화 (예측 API 복구)
- Frontend 앱 정상 로드
- 한글 텍스트 정상 표시
- **목표 완료 시간**: 30분 이내

---

## 2. Root Cause Analysis

### 2.1 Backend Error Root Cause
**파일**: `backend/api/services/prediction_service.py`
**위치**: Lines 218-226

**코드 분석**:
```python
215  def _build_user_token(self, username: Optional[str], session_id: Optional[str]) -> str:
216      primary = self._sanitize_token(username, fallback="user")
217      secondary = self._sanitize_token(session_id, fallback="session")
218      return f"{primary}_{secondary}"
219      self._compatibility_notes: List[str] = []  # ❌ Unreachable code!
220      self._loader_strategy: str = "default"
221
222      self._model_registry_url = self.settings.model_registry_url  # ❌ Never executed!
223      initialize_schema(self._model_registry_url)
224      self._model_reference = self._resolve_model_reference()
225      self._model_manifest: Optional[ModelManifest] = None
226      self._model_root: Optional[Path] = None
```

**문제**:
- 줄 218에서 `return` 후, 줄 219-226이 **절대 실행되지 않음**
- 줄 219-226은 `__init__` 메소드 내부에 있어야 하는데, `_build_user_token` 메소드 내부에 잘못 배치됨
- 이로 인해 `self._model_registry_url` 속성이 초기화되지 않아 줄 242에서 `AttributeError` 발생

**영향**:
- PredictionService 객체 생성 시 속성 초기화 실패
- 첫 번째 `predict()` 호출 시 `_resolve_model_reference()` 호출 → `_model_registry_url` 접근 → AttributeError

**발생 시점**:
- 최근 코드 리팩토링 중 메소드 경계 실수 (줄 바꿈 또는 들여쓰기 오류)

### 2.2 Frontend Error Root Cause
**파일**: 미확인 (Vite import resolution 문제)
**에러**: `use-sync-external-store/shim/with-selector.js` 기본 export 누락

**가능한 원인**:
1. `zustand` 또는 `react-redux` 버전 불일치
2. `use-sync-external-store` 패키지 손상
3. Vite 캐시 문제
4. `node_modules` 불완전한 설치

**진단 필요**:
- `package.json` 의존성 확인
- `node_modules` 재설치
- Vite dev server 재시작

### 2.3 Korean Encoding Root Cause
**증상**: 한글이 `���`로 표시

**가능한 원인**:
1. **터미널 인코딩**: 사용자 터미널이 UTF-8이 아님 (CP949/EUC-KR)
2. **브라우저 인코딩**: HTML meta charset 누락
3. **파일 인코딩**: 소스 파일이 UTF-8로 저장되지 않음
4. **Vite 서버 설정**: 응답 헤더에 charset 누락

**진단 필요**:
- 브라우저 개발자 도구에서 응답 헤더 확인
- HTML `<meta charset="UTF-8">` 확인
- Vite 서버 로그 인코딩 확인

---

## 3. Solution Design

### 3.1 Backend Fix

#### 3.1.1 코드 수정
**파일**: `backend/api/services/prediction_service.py`

**변경 전** (Lines 196-227):
```python
class PredictionService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._model_lock: bool = False
        self._last_metrics: Dict[str, Any] = {}
        self._manifest_loader = ManifestLoader()
        self._json_artifacts = JsonArtifactCache()
        self.time_aggregator = TimeAggregator()

    @staticmethod
    def _sanitize_token(value: Optional[str], fallback: str = "anonymous") -> str:
        token = value or fallback
        token = re.sub(r"[^A-Za-z0-9_-]", "-", token)
        token = token.strip("-") or fallback
        return token[:80]

    @staticmethod
    def _unique_token() -> str:
        return f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{uuid4().hex}"

    def _build_user_token(self, username: Optional[str], session_id: Optional[str]) -> str:
        primary = self._sanitize_token(username, fallback="user")
        secondary = self._sanitize_token(session_id, fallback="session")
        return f"{primary}_{secondary}"
        self._compatibility_notes: List[str] = []  # ❌ Unreachable!
        self._loader_strategy: str = "default"

        self._model_registry_url = self.settings.model_registry_url
        initialize_schema(self._model_registry_url)
        self._model_reference = self._resolve_model_reference()
        self._model_manifest: Optional[ModelManifest] = None
        self._model_root: Optional[Path] = None
```

**변경 후**:
```python
class PredictionService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._model_lock: bool = False
        self._last_metrics: Dict[str, Any] = {}
        self._manifest_loader = ManifestLoader()
        self._json_artifacts = JsonArtifactCache()
        self.time_aggregator = TimeAggregator()

        # Model registry and manifest initialization
        self._compatibility_notes: List[str] = []
        self._loader_strategy: str = "default"
        self._model_registry_url = self.settings.model_registry_url
        initialize_schema(self._model_registry_url)
        self._model_reference = self._resolve_model_reference()
        self._model_manifest: Optional[ModelManifest] = None
        self._model_root: Optional[Path] = None

    @staticmethod
    def _sanitize_token(value: Optional[str], fallback: str = "anonymous") -> str:
        token = value or fallback
        token = re.sub(r"[^A-Za-z0-9_-]", "-", token)
        token = token.strip("-") or fallback
        return token[:80]

    @staticmethod
    def _unique_token() -> str:
        return f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{uuid4().hex}"

    def _build_user_token(self, username: Optional[str], session_id: Optional[str]) -> str:
        primary = self._sanitize_token(username, fallback="user")
        secondary = self._sanitize_token(session_id, fallback="session")
        return f"{primary}_{secondary}"
```

**변경 사항**:
- 줄 219-226을 `__init__` 메소드 내부 (줄 202 이후)로 이동
- 주석 추가하여 명확성 확보

#### 3.1.2 테스트 계획
```bash
# 1. Backend API 재시작 (자동 reload)
# 2. 로그 확인: 초기화 성공 여부
# 3. 예측 API 테스트
curl -X POST https://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"items": ["ITEM-001"], "top_k": 10}'
```

**기대 결과**: 200 OK, 예측 결과 반환

### 3.2 Frontend Fix

#### 3.2.1 진단 단계
1. `package.json` 확인: `use-sync-external-store`, `zustand` 버전
2. Vite 캐시 삭제: `rm -rf node_modules/.vite`
3. `node_modules` 재설치: `npm install`
4. Dev server 재시작

#### 3.2.2 수정 옵션

**Option A: 패키지 재설치 (가장 가능성 높음)**
```bash
cd frontend-prediction
rm -rf node_modules/.vite
npm install
```

**Option B: use-sync-external-store 명시적 설치**
```bash
npm install use-sync-external-store
```

**Option C: Zustand 버전 고정**
```json
{
  "dependencies": {
    "zustand": "^4.5.0"
  },
  "resolutions": {
    "use-sync-external-store": "^1.2.0"
  }
}
```

### 3.3 Korean Encoding Fix

#### 3.3.1 진단
1. 브라우저 Network 탭에서 응답 헤더 확인
2. `index.html` 확인: `<meta charset="UTF-8">`
3. Vite 설정 확인

#### 3.3.2 수정

**파일**: `frontend-prediction/index.html`
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">  <!-- ✅ 확인 필요 -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Routing ML</title>
</head>
```

**Vite 설정** (`vite.config.ts`):
```ts
export default defineConfig({
  server: {
    // Ensure UTF-8 encoding in responses
    headers: {
      'Content-Type': 'text/html; charset=UTF-8'
    }
  }
})
```

**터미널 인코딩** (Windows):
```cmd
chcp 65001  # UTF-8로 설정
```

---

## 4. Implementation Plan

### Phase 0: Emergency Backend Fix (5분)
**목표**: 예측 API 즉시 복구

**Tasks**:
- [ ] `prediction_service.py` 수정 (줄 219-226 이동)
- [ ] Backend 자동 reload 확인
- [ ] 로그 확인: AttributeError 사라짐
- [ ] 예측 API 수동 테스트 (curl)

**Git**: Emergency commit (no PRD/Checklist)

### Phase 1: Frontend Diagnosis (10분)
**목표**: Frontend 에러 원인 파악

**Tasks**:
- [ ] `package.json` 읽기
- [ ] `node_modules/.vite` 삭제
- [ ] `npm install` 실행
- [ ] Dev server 재시작
- [ ] 브라우저 확인

### Phase 2: Frontend Fix (10분)
**목표**: React 앱 정상 로드

**Tasks**:
- [ ] Phase 1 실패 시 Option B/C 시도
- [ ] ErrorBoundary 사라짐 확인
- [ ] 콘솔 에러 0개 확인

### Phase 3: Korean Encoding Fix (5분)
**목표**: 한글 정상 표시

**Tasks**:
- [ ] `index.html` 확인
- [ ] 브라우저 Network 탭 확인
- [ ] 필요 시 Vite 설정 수정
- [ ] 메뉴 한글 정상 표시 확인

### Phase 4: Documentation (10분)
**Tasks**:
- [ ] Root Cause Analysis 문서 작성
- [ ] Work History 업데이트
- [ ] Git commit with detailed message

---

## 5. Success Criteria

### 5.1 Backend API
- ✅ Backend 서버 시작 시 AttributeError 없음
- ✅ `/api/predict` 요청 시 200 OK 반환
- ✅ 로그에 "예측 요청" 및 "예측 완료" 메시지
- ✅ 500 Error 0건

### 5.2 Frontend
- ✅ 브라우저에서 앱 정상 로드 (ErrorBoundary 없음)
- ✅ 콘솔 에러 0건 (use-sync-external-store 관련)
- ✅ 로그인 및 메인 화면 접근 가능

### 5.3 Korean Text
- ✅ 메뉴 한글 정상 표시
- ✅ 모든 UI 텍스트 깨짐 없음
- ✅ 브라우저 Network 탭에서 `Content-Type: text/html; charset=UTF-8` 확인

### 5.4 Overall
- ✅ 전체 시스템 정상 작동 (E2E 테스트)
- ✅ 다운타임 < 30분
- ✅ 문서화 완료

---

## 6. Risk Assessment

### 6.1 High Risk
**Backend 수정 실패**:
- **확률**: Low (단순 코드 이동)
- **영향**: Critical (API 계속 중단)
- **완화**: 즉시 git revert

### 6.2 Medium Risk
**Frontend 수정 복잡화**:
- **확률**: Medium (의존성 문제)
- **영향**: High (프론트 계속 중단)
- **완화**: 여러 옵션 준비 (A→B→C)

### 6.3 Low Risk
**한글 인코딩 수정 실패**:
- **확률**: Low
- **영향**: Medium (가독성만 저하)
- **완화**: 브라우저 인코딩 수동 설정 안내

---

## 7. Rollback Plan

### 7.1 Backend Rollback
```bash
git log -1  # Get commit hash
git revert <hash>
git push origin 251014
```

### 7.2 Frontend Rollback
```bash
cd frontend-prediction
git restore package.json package-lock.json
npm install
```

---

## 8. Post-Deployment

### 8.1 Monitoring (30분)
- Backend 로그 모니터링 (500 Error 발생 여부)
- Frontend 사용자 피드백 수집
- 성능 메트릭 확인

### 8.2 Documentation
- Root Cause Analysis 문서 작성
- Prevention 가이드 추가
- CI/CD에 unreachable code 감지 추가

---

## 9. Prevention Measures

### 9.1 Code Quality
1. **Linter 강화**: pylint unreachable code 체크 활성화
2. **Pre-commit Hook**:
   ```bash
   pylint --enable=unreachable backend/
   ```

### 9.2 Testing
1. **Unit Test 추가**:
   ```python
   def test_prediction_service_initialization():
       service = PredictionService()
       assert hasattr(service, '_model_registry_url')
   ```

2. **Integration Test**: `/api/predict` smoke test

### 9.3 Dependency Management
1. `package-lock.json` 항상 커밋
2. `npm ci` 사용 (deterministic install)
3. Dependabot 활성화

---

## 10. References

### 10.1 Related Files
- `backend/api/services/prediction_service.py` (Lines 196-227)
- `frontend-prediction/package.json`
- `frontend-prediction/index.html`
- `frontend-prediction/vite.config.ts`

### 10.2 Error Logs
- Backend: AttributeError at line 242
- Frontend: SyntaxError in use-sync-external-store

### 10.3 Related Documents
- WORKFLOW_DIRECTIVES.md (Emergency Protocol 추가 예정)
- Previous PRD: 2025-10-23_routingmlmonitor-membership-management.md

---

**작성 완료**: 2025-10-23
**다음 단계**: Checklist 작성 → Phase 0 Emergency Fix 즉시 실행
