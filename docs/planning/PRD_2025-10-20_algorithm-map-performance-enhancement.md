# PRD: Algorithm Map Performance Enhancement & API Visualization

**Date**: 2025-10-20
**Status**: In Progress
**Related Checklist**: docs/planning/CHECKLIST_2025-10-20_algorithm-map-performance-enhancement.md

---

## Executive Summary

https://rtml.ksm.co.kr:5176/algorithm-map.html 페이지의 성능을 개선하고, FastAPI 백엔드의 거의 모든 엔드포인트를 포함한 데이터 흐름 및 명칭을 시각화합니다. 현재 로딩 성능 문제를 해결하고, API 문서에서 자동으로 노드를 생성하여 전체 시스템 아키텍처를 명확하게 표현합니다.

---

## Problem Statement

### 현재 문제점

1. **성능 저하**:
   - 페이지 로딩이 매우 느림
   - 대량의 노드/엣지 렌더링 시 브라우저 성능 저하
   - DOM 조작 과다로 인한 렌더링 블로킹

2. **불완전한 시각화**:
   - API 문서의 모든 엔드포인트가 표시되지 않음
   - 수동으로 노드를 정의해야 함
   - 데이터 흐름이 명확하지 않음

3. **유지보수 어려움**:
   - 새로운 API 추가 시 수동 업데이트 필요
   - 엔드포인트 변경 사항 추적 어려움

---

## Goals and Objectives

### Primary Goals

1. **성능 최적화**:
   - 초기 로딩 시간 70% 단축
   - 60 FPS 유지하는 부드러운 인터랙션
   - 대량 노드(100+) 처리 가능

2. **완전한 API 시각화**:
   - OpenAPI/Swagger 스펙에서 자동으로 엔드포인트 추출
   - 모든 API 라우트의 데이터 흐름 표시
   - RESTful 패턴 시각화

3. **개선된 UX**:
   - 가상 스크롤링 적용
   - 레이지 로딩
   - 검색 및 필터링 기능

### Success Metrics

- ✅ 초기 로딩 시간: 5초 이내
- ✅ 노드 렌더링: 100개 노드를 1초 이내
- ✅ 스크롤 FPS: 60 FPS 유지
- ✅ API 엔드포인트 커버리지: 95% 이상

---

## Requirements

### Functional Requirements

#### FR1: Performance Optimization
- 가상 스크롤링 구현 (뷰포트 밖 노드는 렌더링 제외)
- SVG 엣지를 Canvas로 변경 고려
- 노드 레이지 로딩
- 디바운싱/쓰로틀링 적용
- RequestAnimationFrame 최적화

#### FR2: Auto API Node Generation
- FastAPI OpenAPI 스펙 파싱
- /api/openapi.json 엔드포인트 활용
- 자동 노드 생성 (엔드포인트별)
- HTTP 메소드별 색상 구분
- 경로 패턴 그룹핑

#### FR3: Enhanced Data Flow Visualization
- 요청 → 백엔드 → 데이터베이스 플로우
- 인증/권한 플로우
- 모델 학습/예측 플로우
- 파일 업로드/다운로드 플로우

#### FR4: Interactive Features
- 검색 (노드 이름, 엔드포인트 경로)
- 필터링 (카테고리, HTTP 메소드, 상태)
- 노드 확대/축소
- 미니맵

### Non-Functional Requirements

- 초기 렌더링: < 3초
- 인터랙션 응답: < 100ms
- 메모리 사용: < 200MB
- 브라우저 호환성: Chrome 90+, Firefox 88+, Edge 90+

---

## Phase Breakdown

### Phase 1: Performance Analysis & Setup
**Estimated Time**: 1 hour

1. 현재 성능 프로파일링
2. 병목 구간 파악
3. OpenAPI 스펙 수집
4. PRD & Checklist 작성

### Phase 2: Core Performance Improvements
**Estimated Time**: 2 hours

1. 가상 스크롤링 구현
2. 노드 레이지 로딩
3. SVG to Canvas 전환 (엣지)
4. RAF 최적화
5. 디바운싱/쓰로틀링

### Phase 3: Auto API Node Generation
**Estimated Time**: 2 hours

1. OpenAPI 스펙 파서 구현
2. 엔드포인트별 노드 자동 생성
3. HTTP 메소드별 스타일링
4. 카테고리 자동 분류
5. 데이터 흐름 자동 추론

### Phase 4: Enhanced Visualization
**Estimated Time**: 1.5 hours

1. 검색 기능 추가
2. 필터링 UI
3. 미니맵 구현
4. 줌/팬 개선
5. 툴팁 성능 최적화

### Phase 5: Testing & Documentation
**Estimated Time**: 1 hour

1. 성능 테스트
2. 브라우저 호환성 테스트
3. 사용자 가이드 작성
4. Git 커밋 & 머지

---

## Technical Implementation

### Performance Optimizations

#### 1. Virtual Scrolling
```javascript
// Render only visible nodes
function renderVisibleNodes() {
  const viewport = {
    top: graphScroll.scrollTop,
    left: graphScroll.scrollLeft,
    width: graphScroll.clientWidth,
    height: graphScroll.clientHeight
  };

  const visibleNodes = nodes.filter(node =>
    isInViewport(node.bounds, viewport)
  );

  // Only render visible nodes
  updateDOM(visibleNodes);
}
```

#### 2. Canvas Rendering for Edges
```javascript
// Replace SVG edges with Canvas for better performance
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

function drawEdges(edges) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  edges.forEach(edge => {
    drawCubicBezier(ctx, edge.start, edge.end);
  });
}
```

#### 3. Lazy Loading
```javascript
// Load nodes in chunks
async function loadNodesInChunks(nodes, chunkSize = 20) {
  for (let i = 0; i < nodes.length; i += chunkSize) {
    const chunk = nodes.slice(i, i + chunkSize);
    await renderChunk(chunk);
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
}
```

### Auto API Node Generation

#### OpenAPI Parser
```javascript
async function fetchOpenAPISpec() {
  const response = await fetch('/api/openapi.json');
  const spec = await response.json();
  return spec;
}

function parseEndpoints(spec) {
  const nodes = [];
  const paths = spec.paths || {};

  Object.entries(paths).forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, details]) => {
      nodes.push({
        id: `${method.toUpperCase()}_${path}`,
        label: details.summary || path,
        category: categorizeEndpoint(path),
        method: method.toUpperCase(),
        path: path,
        metrics: {
          method: method.toUpperCase(),
          parameters: details.parameters?.length || 0,
          responses: Object.keys(details.responses || {}).join(', ')
        }
      });
    });
  });

  return nodes;
}

function categorizeEndpoint(path) {
  if (path.includes('/auth')) return 'auth';
  if (path.includes('/user')) return 'users';
  if (path.includes('/predict')) return 'prediction';
  if (path.includes('/train')) return 'training';
  if (path.includes('/model')) return 'model';
  if (path.includes('/database')) return 'database';
  if (path.includes('/system')) return 'system';
  return 'other';
}
```

### Data Flow Inference
```javascript
function inferDataFlow(nodes, spec) {
  const edges = [];

  // Infer edges based on API dependencies
  nodes.forEach(node => {
    // Check if response references other endpoints
    const method = spec.paths[node.path]?.[node.method.toLowerCase()];
    const responses = method?.responses || {};

    // Example: /predict might depend on /model
    if (node.path.includes('/predict')) {
      const modelNode = nodes.find(n => n.path.includes('/model'));
      if (modelNode) {
        edges.push({
          source: node.id,
          target: modelNode.id,
          label: 'uses model',
          protocol: 'internal'
        });
      }
    }
  });

  return edges;
}
```

---

## Files to Modify

### Frontend
- `frontend-home/algorithm-map.html`
  - Add virtual scrolling
  - Replace SVG with Canvas for edges
  - Add search/filter UI
  - Implement OpenAPI parser
  - Add lazy loading

### Backend (Optional)
- Ensure `/api/openapi.json` is accessible
- Add CORS headers if needed

---

## Success Criteria

### Must Have
- [ ] 초기 로딩 시간 < 3초
- [ ] 100개 노드 렌더링 < 1초
- [ ] 60 FPS 스크롤
- [ ] OpenAPI에서 자동 노드 생성
- [ ] 검색 기능
- [ ] 필터링 (HTTP 메소드, 카테고리)

### Should Have
- [ ] 미니맵
- [ ] 줌 인/아웃 개선
- [ ] 노드 애니메이션 최적화
- [ ] 툴팁 성능 개선

### Nice to Have
- [ ] 엣지 애니메이션 방향 표시
- [ ] 노드 클러스터링
- [ ] 익스포트 기능 (PNG, SVG)
- [ ] 다크/라이트 모드 토글

---

## Timeline Estimates

| Phase | Estimated | Dependencies |
|-------|-----------|--------------|
| Phase 1 | 1 hour | None |
| Phase 2 | 2 hours | Phase 1 |
| Phase 3 | 2 hours | Phase 1 |
| Phase 4 | 1.5 hours | Phase 2, 3 |
| Phase 5 | 1 hour | All |
| **Total** | **7.5 hours** | |

---

## Risks and Mitigation

### Risk 1: Canvas rendering complexity
**Mitigation**: 시작은 간단한 직선으로, 점진적으로 Bezier 커브 추가

### Risk 2: OpenAPI 스펙 불완전
**Mitigation**: 수동 노드 정의와 자동 생성 병행, fallback 메커니즘

### Risk 3: 대량 데이터 처리 시 메모리 초과
**Mitigation**: 페이지네이션, 가상화, 청크 로딩

---

## Dependencies

- Browser APIs: IntersectionObserver, RequestAnimationFrame, Canvas
- FastAPI OpenAPI spec endpoint
- Existing graph rendering logic

---

## Future Considerations

1. WebGL 기반 렌더링 (더 많은 노드 처리)
2. 실시간 API 호출 통계 표시
3. 에러율, 응답 시간 등 메트릭 통합
4. 노드 간 의존성 자동 분석

---

**Document Status**: In Progress
**Next Steps**: Create checklist, start Phase 1
