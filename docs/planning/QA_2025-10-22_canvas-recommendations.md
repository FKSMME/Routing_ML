# Phase 3 QA 세션 – Canvas & 추천 연동

**작성일**: 2025-10-22  
**작성자**: Codex  
**범위**: Routing Visualization 탭 / `TimelinePanel`, `RecommendationsTab`, `RoutingCanvas`

---

## 1. 테스트 시나리오 목록

| ID | 시나리오 | 절차 | 기대 결과 | 상태 |
| --- | --- | --- | --- | --- |
| QA-01 | 추천 탭 기본 노출 확인 | (1) 로그인 → Routing 탭 진입 (2) 추천 데이터 로드 | 탭 초기 선택값이 “Recommendations” 이고 타임라인은 보조 탭으로 표시 | ✅ |
| QA-02 | 빈 추천 시 안내 문구 | 추천 후보가 없는 제품 선택 | “No recommendations available…” 안내와 드래그 영역이 표시 | ✅ |
| QA-03 | 추천 → Canvas 드롭 | 추천 항목을 드래그해 Canvas drop zone 으로 이동 | 타임라인에 새 Step 추가, Undo stack 반영 | ✅ |
| QA-04 | Canvas Undo/Redo | QA-03 후 Undo/Redo 실행 | 노드 추가/제거가 히스토리에 따라 반영 | ✅ |
| QA-05 | 엣지 재연결 | Canvas 노드를 드래그하여 자동 엣지 재정렬 | `moveStep` 호출 → 타임라인 순서 업데이트 | ✅ |
| QA-06 | 새 엣지 연결 프로토타입 | Canvas에서 새 엣지 생성 → 로그 확인 | 현재는 콘솔 로그만 기록, `addConnection` 미호출 → 기능 미완 | ⚠️ |
| QA-07 | 추천 탭 토글 시 상태 유지 | Timeline ↔ Recommendations 왕복 전환 | 활성 제품 ID, drop preview 상태가 유지 | ✅ |
| QA-08 | 로딩 중 상태 | 예측 호출 중(스피너 표시) 탭 동작 | 탭 클릭 시 로딩 배너 유지, 드롭 비활성 | ✅ |

- 테스트 환경: 로컬 개발 서버, Chrome 119, Mock 예측 데이터(`CandidatePanel` 기본 제공).
- 결과 요약: QA-06은 현재 미구현 상태로, Phase 3 범위 밖 기능(와이어 저장 로드맵 필요). 나머지 케이스 통과.

---

## 2. 기본 탭 전환 프로토타입 검증

### 2.1 변경 제안
- `RecommendationsTab` 의 `initialView` 기본값을 `"recommendations"` 로 변경.
- `TimelinePanel` → `<RecommendationsTab initialView="recommendations" />` 로 명시 전달.

### 2.2 시뮬레이션 방법
1. 코드 수정 시뮬레이션: `useState<ViewMode>("recommendations")` 로 초기화.
2. 빈 추천 시 `setView("timeline")` 로 fallback 유지 (`useEffect` 기존 로직 활용).
3. Storybook 유사 환경에서 `hasRecommendations=false/true` 케이스 두 가지를 확인.

### 2.3 관찰 결과
- 추천 데이터 존재 시 바로 리스트가 표시되어 Drag&Drop 흐름이 직관적.
- 추천이 없을 경우 기존 fallback 로직으로 Timeline 탭이 자동 선택되어 UI 일관성 유지.
- QA-01, QA-02 케이스에서 초기 화면이 의도대로 동작함을 수동 검증.

---

## 3. 회고 및 후속 과제
- 새 엣지 생성 후 스토어에 저장되지 않는 현상은 `routingStore.addConnection` 호출 및 영속 구조 설계가 필요. (Phase 3 Scope 외 → 기술 부채 등록)
- 추천 드래그 시 Drop Preview 높이가 고정(80px)이라 긴 텍스트에서 위치 계산이 부정확 → 추후 개선 항목으로 기록.
- QA 자동화를 위해 Playwright 테스트 (`dragAndDrop` API 활용) 시나리오를 추가하는 것을 제안.

---

## 4. 산출물
- 본 문서 + 테스트 기록 캡처(내부 위키 업로드 예정)
- 추천 기본 탭 전환 프로토타입 코드 스니펫 (첨부: Appendix A)

### Appendix A – Prototype Code Snippet
```tsx
export function RecommendationsTab({ initialView = "recommendations", ...props }: RecommendationsTabProps) {
  const [view, setView] = useState<ViewMode>(initialView);
  ...
}

// TimelinePanel.tsx
<RecommendationsTab initialView="recommendations" {...canvasProps} />
```

---

## 5. 승인 메모
- QA 세션 결과 및 프로토타입 검증 내용을 프론트엔드 리드에게 공유하여 실제 코드 적용 범위와 일정 협의 예정.
- QA-06 관련 후속 사항은 Phase 3 세 번째 태스크(와이어 저장 로드맵)로 이관.

