# UI 단순화 계획서

**작성일**: 2025-10-06
**버전**: 1.0.0
**목표**: 70개 버튼 → 10개 핵심 버튼

---

## 📋 현황 분석

### 현재 메뉴 구조 (5개)

#### Prediction Frontend
1. **기준정보 확인** (`master-data`)
   - Access 연결
   - 트리/행렬 탐색
   - 즐겨찾기 히스토리

2. **라우팅 생성** (`routing`)
   - Drag&Drop 타임라인
   - 후보 공정 카드
   - SAVE 패널

3. **라우팅 조합 관리** (`routing-matrix`)
   - 라우팅 세트
   - Variant 조합 편집

4. **공정 그룹 관리** (`process-groups`)
   - 대체 경로 컬럼
   - 후공정 고정값 구성

5. **데이터 출력 설정** (`data-output`)
   - 컬럼 매핑 매트릭스
   - 미리보기
   - 프로필 저장

### 컴포넌트 통계

| Frontend | 컴포넌트 수 | TSX 파일 |
|----------|------------|---------|
| **Prediction** | 48 | 47개 |
| **Training** | 44 | 44개 |
| **총합** | **92** | **91개** |

### 버튼/액션 추정

각 컴포넌트에 평균 3-5개의 버튼/액션이 있다고 가정하면:
- **최소**: 48 × 3 = 144개
- **최대**: 48 × 5 = 240개
- **실제 추정**: 70-100개 (중복 제외)

---

## 🎯 단순화 목표

### Before (현재)
- ❌ 메뉴 5개, 버튼 70+개
- ❌ 새 사용자 학습 곡선 가파름
- ❌ 사용 빈도 낮은 기능이 눈에 띔
- ❌ 핵심 기능 찾기 어려움

### After (목표)
- ✅ 핵심 메뉴 3개, 버튼 10개
- ✅ 5분 내 핵심 기능 학습
- ✅ 80/20 법칙 적용 (80% 작업 = 20% 기능)
- ✅ 고급 기능은 "고급 모드" 숨김

---

## 📊 사용 빈도 분석 (예상)

### High Frequency (80% 사용)
1. **품목 검색** - 일일 100회+
2. **라우팅 추천 실행** - 일일 50회+
3. **타임라인 편집** (Drag&Drop) - 일일 30회+
4. **저장** - 일일 20회+
5. **미리보기/내보내기** - 일일 15회+

### Medium Frequency (15% 사용)
6. Feature Weight 조정 - 주간 10회
7. 공정 그룹 설정 - 주간 5회
8. 라우팅 행렬 편집 - 주간 3회
9. 사용자 정의 공정 추가 - 주간 2회
10. 시각화 (TensorBoard, Neo4j) - 주간 1회

### Low Frequency (5% 사용)
11. 알고리즘 워크플로우 편집 - 월 1회
12. 데이터 출력 프로필 수정 - 월 1회
13. Access DB 직접 연결 - 분기 1회

---

## 🎨 단순화 전략

### 1. 핵심 메뉴 재구성 (5개 → 3개)

#### ✅ 추천 (Recommendations) - 메인
- 품목 검색 → 추천 실행 → 결과 확인
- 통합:
  - 기준정보 확인 (간소화)
  - 라우팅 생성 (핵심만)
  - 미리보기/내보내기

#### ✅ 편집 (Editor) - 서브
- 타임라인 Drag&Drop
- 후보 공정 카드
- 저장/INTERFACE

#### ⚙️ 고급 설정 (Advanced) - 숨김
- 라우팅 조합 관리
- 공정 그룹 관리
- 데이터 출력 설정
- Feature Weights
- 알고리즘 워크플로우

### 2. 핵심 버튼 10개

#### Main Actions (5개)
1. **🔍 검색** - 품목 코드 입력
2. **▶️ 추천 실행** - ML 예측 트리거
3. **👁️ 미리보기** - 결과 확인
4. **💾 저장** - 타임라인 저장
5. **📤 내보내기** - ERP/Excel 출력

#### Secondary Actions (5개)
6. **➕ 공정 추가** - 사용자 정의 공정
7. **↩️ 되돌리기** (Undo)
8. **↪️ 다시 실행** (Redo)
9. **⚙️ 고급 모드** - 토글 버튼
10. **❓ 도움말** - 튜토리얼 링크

### 3. Progressive Disclosure

```
┌─────────────────────────────────────┐
│ [검색] [실행] [미리보기] [저장] [내보내기] │  ← 항상 표시
├─────────────────────────────────────┤
│  Quick Actions (자주 쓰는 기능)        │
│  [공정 추가] [Undo] [Redo]           │
├─────────────────────────────────────┤
│  [⚙️ 고급 모드 켜기]  [❓ 도움말]      │  ← 접을 수 있음
└─────────────────────────────────────┘

                  ⬇️
           (고급 모드 ON)
                  ⬇️

┌─────────────────────────────────────┐
│ [검색] [실행] [미리보기] [저장] [내보내기] │
├─────────────────────────────────────┤
│ Advanced Settings                   │
│ - Feature Weights                   │
│ - Routing Matrix                    │
│ - Process Groups                    │
│ - Data Output Profiles              │
│ - Algorithm Workflow                │
├─────────────────────────────────────┤
│  [⚙️ 고급 모드 끄기]  [❓ 도움말]      │
└─────────────────────────────────────┘
```

---

## 🔧 구현 계획

### Phase 1: 사용 빈도 추적 (1주)

#### 1.1 PostHog/Mixpanel 통합

```typescript
// frontend-prediction/src/lib/analytics.ts
import posthog from 'posthog-js';

export const analytics = {
  init() {
    if (import.meta.env.PROD) {
      posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
        api_host: 'https://app.posthog.com',
      });
    }
  },

  track(event: string, properties?: Record<string, unknown>) {
    if (import.meta.env.PROD) {
      posthog.capture(event, properties);
    } else {
      console.log('[Analytics]', event, properties);
    }
  },

  trackButtonClick(buttonId: string, context?: string) {
    this.track('button_click', {
      button_id: buttonId,
      context,
      timestamp: new Date().toISOString(),
    });
  },
};
```

#### 1.2 버튼에 추적 코드 추가

```tsx
// Before
<button onClick={handleSave}>저장</button>

// After
<button onClick={() => {
  analytics.trackButtonClick('save_button', 'routing_editor');
  handleSave();
}}>저장</button>
```

#### 1.3 자동 추적 (HOC)

```tsx
// frontend-prediction/src/hooks/useTrackedClick.ts
export function useTrackedClick(eventName: string, context?: string) {
  return useCallback((handler: () => void) => {
    return () => {
      analytics.trackButtonClick(eventName, context);
      handler();
    };
  }, [eventName, context]);
}

// 사용
const handleSave = useTrackedClick('save_button', 'routing_editor')(saveRoutine);
```

### Phase 2: 데이터 수집 (2주)

**수집 지표**:
1. Button Click Count
2. Feature Usage Frequency
3. Time Spent per Screen
4. User Flow (Funnel)
5. Error Rate per Feature

**PostHog 대시보드**:
- Top 20 Most Clicked Buttons
- Heatmap (페이지별)
- Funnel: 검색 → 추천 → 저장 → 내보내기
- Retention: Weekly Active Users

### Phase 3: UI 재설계 (1주)

#### 3.1 SimplifiedNavigation 컴포넌트

```tsx
// frontend-prediction/src/components/SimplifiedNavigation.tsx
interface SimplifiedNavigationProps {
  mode: 'simple' | 'advanced';
  onToggleMode: () => void;
}

export function SimplifiedNavigation({ mode, onToggleMode }: SimplifiedNavigationProps) {
  const coreActions = [
    { id: 'search', label: '검색', icon: <Search />, shortcut: 'Ctrl+K' },
    { id: 'predict', label: '추천 실행', icon: <Play />, shortcut: 'Ctrl+Enter' },
    { id: 'preview', label: '미리보기', icon: <Eye />, shortcut: 'Ctrl+P' },
    { id: 'save', label: '저장', icon: <Save />, shortcut: 'Ctrl+S' },
    { id: 'export', label: '내보내기', icon: <Download />, shortcut: 'Ctrl+E' },
  ];

  return (
    <div className="simplified-nav">
      <div className="core-actions">
        {coreActions.map(action => (
          <ActionButton key={action.id} {...action} />
        ))}
      </div>

      {mode === 'advanced' && (
        <div className="advanced-panel">
          <FeatureWeightPanel />
          <RoutingMatrixPanel />
          <ProcessGroupsPanel />
        </div>
      )}

      <button onClick={onToggleMode}>
        {mode === 'simple' ? '⚙️ 고급 모드' : '🔙 간단한 모드'}
      </button>
    </div>
  );
}
```

#### 3.2 LocalStorage 설정 저장

```typescript
// frontend-prediction/src/lib/uiPreferences.ts
export const uiPreferences = {
  getMode(): 'simple' | 'advanced' {
    return (localStorage.getItem('ui_mode') as 'simple' | 'advanced') || 'simple';
  },

  setMode(mode: 'simple' | 'advanced') {
    localStorage.setItem('ui_mode', mode);
  },

  // 첫 방문자는 simple mode
  isFirstVisit(): boolean {
    return !localStorage.getItem('ui_mode_initialized');
  },

  markInitialized() {
    localStorage.setItem('ui_mode_initialized', 'true');
  },
};
```

### Phase 4: A/B 테스트 (2주)

#### Group A: 기존 UI (70+ 버튼)
#### Group B: 단순화 UI (10 버튼)

**측정 지표**:
1. Time to First Action (검색 → 추천)
2. Task Completion Rate
3. User Satisfaction (NPS)
4. Support Ticket 감소율

**PostHog Feature Flags**:
```typescript
if (posthog.isFeatureEnabled('simplified_ui')) {
  return <SimplifiedNavigation />;
} else {
  return <MainNavigation items={NAVIGATION_ITEMS} />;
}
```

### Phase 5: 배포 (1주)

**롤아웃 전략**:
1. Week 1: Internal Beta (ML Team)
2. Week 2: 파일럿 부서 (생산 1팀)
3. Week 3: 50% 사용자
4. Week 4: 100% 롤아웃

---

## 📊 예상 효과

### KPI 목표

| 지표 | Before | After | 개선율 |
|------|--------|-------|--------|
| **학습 시간** | 30분 | 5분 | 83% ↓ |
| **첫 작업 완료** | 10분 | 2분 | 80% ↓ |
| **오류율** | 15% | 5% | 67% ↓ |
| **NPS 점수** | 30 | 60 | 100% ↑ |
| **지원 티켓** | 주 20건 | 주 5건 | 75% ↓ |

### ROI 추정

**절감 효과**:
- 교육 시간 절감: 30분 → 5분 = 25분/사용자
- 10명 × 25분 × ₩50,000/시간 = **₩208,333/월**
- 연간: **₩2,500,000**

**생산성 향상**:
- 작업 시간 10% 단축
- 일일 20건 × 10분 × ₩50,000/시간 = **₩166,667/일**
- 월간 (20일): **₩3,333,334**
- 연간: **₩40,000,000**

**Total ROI**: **₩42,500,000/년**

---

## 🚧 리스크 및 완화

### 리스크 1: 파워 유저 반발
- **완화**: 고급 모드 유지, 키보드 단축키 제공
- **피드백**: 2주간 의견 수렴 기간

### 리스크 2: 기존 워크플로우 중단
- **완화**: 점진적 롤아웃, A/B 테스트
- **롤백 계획**: Feature Flag로 즉시 복원 가능

### 리스크 3: 새로운 버그 발생
- **완화**: E2E 테스트 추가, QA 2주
- **모니터링**: Sentry 에러 추적

---

## 📝 체크리스트

### 준비 단계
- [ ] PostHog/Mixpanel 계정 생성
- [ ] 분석 SDK 설치
- [ ] 환경 변수 설정 (`VITE_POSTHOG_KEY`)
- [ ] 현재 버튼/기능 목록 작성

### Phase 1: 추적 (1주)
- [ ] `analytics.ts` 라이브러리 구현
- [ ] 주요 버튼에 추적 코드 추가
- [ ] `useTrackedClick` Hook 개발
- [ ] PostHog 대시보드 설정

### Phase 2: 수집 (2주)
- [ ] 실사용자 데이터 수집
- [ ] Weekly Report 생성
- [ ] Top 20 기능 식별
- [ ] 사용 패턴 분석

### Phase 3: 재설계 (1주)
- [ ] `SimplifiedNavigation` 컴포넌트
- [ ] `uiPreferences` 유틸리티
- [ ] 고급 모드 토글 구현
- [ ] 키보드 단축키 추가

### Phase 4: 테스트 (2주)
- [ ] Feature Flag 설정
- [ ] A/B 그룹 분할
- [ ] 지표 추적
- [ ] 피드백 수집

### Phase 5: 배포 (1주)
- [ ] Internal Beta
- [ ] 파일럿 부서
- [ ] 50% 롤아웃
- [ ] 100% 배포

---

## 🔗 관련 문서

- [ROI 계산서](ROI_계산서.md)
- [사용자 온보딩 가이드](user_onboarding.md)
- [키보드 단축키 가이드](keyboard_shortcuts.md)
- [Feature Flags 관리](feature_flags.md)

---

## 📞 문의

- **담당자**: UX/UI 팀
- **분석**: Data Team
- **이슈**: GitHub Issues #ui-simplification
- **Slack**: #routing-ml-ux

---

**마지막 업데이트**: 2025-10-06 02:50
**다음 리뷰**: 2025-10-13 (PostHog 데이터 수집 현황)
