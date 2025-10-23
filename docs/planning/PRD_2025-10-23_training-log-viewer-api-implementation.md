# PRD: Training Log Viewer API 구현

**Date**: 2025-10-23
**Author**: Claude
**Status**: Active
**Priority**: High

---

## Executive Summary

Frontend-training의 log-viewer 메뉴가 `/api/training/logs` 엔드포인트를 호출하지만 404 에러가 발생합니다. 본 작업은 해당 API 엔드포인트를 구현하여 log-viewer가 정상 동작하도록 하는 것을 목표로 합니다. 9개의 메뉴는 모두 고유한 기능을 가지고 있으므로 통합하지 않고 그대로 유지합니다.

---

## Problem Statement

### 현재 상황

**Log-Viewer 메뉴**:
- 위치: App.tsx line 78-83
- 컴포넌트: `@components/quality/LogViewer`
- 목적: 훈련 및 예측 관련 로그 조회

**발견된 문제**:
- API 호출: `GET /api/training/logs?limit=500`
- 백엔드 응답: **404 Not Found**
- 로그 (2025-10-23 16:51:48~51):
  ```
  GET /api/training/logs - 404
  GET /api/training/logs?limit=500 HTTP/1.1" 404 Not Found
  ```

### 영향

- log-viewer 메뉴가 사용 불가
- 사용자가 훈련/예측 로그를 UI에서 확인할 수 없음
- 디버깅 및 문제 해결이 어려움

---

## Goals and Objectives

### Primary Goals

1. **API 구현**: `/api/training/logs` 엔드포인트 구현
2. **로그 제공**: 백엔드 로그 파일 또는 메모리에서 로그 조회
3. **정상 동작**: log-viewer 메뉴에서 로그 표시

### Secondary Goals

1. **로그 필터링**: level, timestamp, limit 파라미터 지원
2. **성능 최적화**: 대용량 로그 처리
3. **실시간 로그**: (선택) WebSocket 또는 polling으로 실시간 로그

---

## Requirements

### Functional Requirements

#### FR1: API 엔드포인트 구현

**엔드포인트**: `GET /api/training/logs`

**Query Parameters**:
- `limit` (optional, default=500): 반환할 로그 개수
- `level` (optional): 로그 레벨 필터 (DEBUG, INFO, WARNING, ERROR)
- `since` (optional): 특정 시간 이후 로그만 반환 (ISO 8601 format)

**Response**:
```json
{
  "logs": [
    {
      "timestamp": "2025-10-23T16:50:09",
      "level": "INFO",
      "module": "trainer_ml",
      "message": "트레이너 런타임 설정 갱신: threshold=0.85"
    },
    ...
  ],
  "total": 1234,
  "limit": 500
}
```

#### FR2: 로그 소스

**옵션 1: 파일 기반** (추천):
- 백엔드 로그 파일 읽기 (예: `logs/training.log`)
- tail -n 방식으로 최근 로그부터 읽기
- 파일 로테이션 지원

**옵션 2: 메모리 기반**:
- Python logging handler를 커스터마이징하여 메모리에 저장
- 순환 버퍼 (circular buffer) 사용
- 재시작 시 로그 유실

**선택**: 파일 기반 (로그 보존 및 재시작 안정성)

#### FR3: LogViewer 컴포넌트 호환성

LogViewer.tsx가 기대하는 응답 형식에 맞춰야 함:
- 컴포넌트 분석 필요
- 필요 시 LogViewer 업데이트

---

## Phase Breakdown

### Phase 1: LogViewer 컴포넌트 분석 (0.5 hour)

**Tasks**:
1. LogViewer.tsx 코드 분석
   - API 호출 방식
   - 기대하는 응답 형식
   - UI 구성 (테이블, 필터, pagination)
2. 필요한 데이터 구조 확정

**Deliverables**:
- LogViewer 분석 문서

### Phase 2: 백엔드 로그 파일 확인 (0.5 hour)

**Tasks**:
1. 백엔드 로그 파일 위치 확인
   - 현재 로깅 설정 분석 (app.py, logging config)
   - 로그 파일 경로 및 형식 확인
2. 로그 파싱 전략 수립
   - 로그 파일 형식 (JSON, plain text)
   - 파싱 라이브러리 선택

**Deliverables**:
- 로그 파일 위치 및 형식 문서

### Phase 3: API 엔드포인트 구현 (1.5 hours)

**Tasks**:
1. 새 API 라우터 생성
   - 위치: `backend/api/routes/training_logs.py` (신규)
   - 또는 기존 `training.py`에 추가

2. 로그 조회 함수 구현
   - 로그 파일 읽기
   - 파싱 및 필터링
   - limit, level, since 파라미터 처리

3. API 엔드포인트 등록
   - FastAPI router에 추가
   - app.py에 include_router

4. 응답 스키마 정의
   - Pydantic model: `TrainingLogEntry`, `TrainingLogsResponse`

**Deliverables**:
- backend/api/routes/training_logs.py (또는 training.py 업데이트)
- backend/api/schemas.py (스키마 추가)

### Phase 4: LogViewer 업데이트 (선택, 0.5 hour)

**Tasks**:
1. LogViewer.tsx 응답 형식 매칭
   - 필요 시 interface 업데이트
   - Error handling 추가

2. UI 개선 (선택)
   - 로그 레벨 색상 코딩
   - 검색 기능

**Deliverables**:
- 업데이트된 LogViewer.tsx (필요 시)

### Phase 5: 테스트 및 검증 (1 hour)

**Tasks**:
1. API 단위 테스트
   - curl/Postman으로 API 테스트
   - 다양한 파라미터 조합 테스트

2. UI 통합 테스트
   - log-viewer 메뉴 동작 확인
   - 로그 표시 확인
   - 필터 및 pagination 동작 확인

3. 성능 테스트
   - 대용량 로그 파일 처리 시간 측정
   - 응답 시간 <2초 확인

**Deliverables**:
- 테스트 결과 보고서

---

## Success Criteria

### Quantitative Metrics

- ✅ API 응답 시간: <2초 (limit=500)
- ✅ 404 에러: 1개 → 0개
- ✅ 로그 표시: log-viewer에 로그 정상 표시

### Qualitative Metrics

- ✅ 로그가 읽기 쉽게 표시됨 (timestamp, level, message)
- ✅ 필터링 기능이 정상 동작
- ✅ 에러 없이 안정적으로 동작

---

## Timeline Estimates

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1 | 0.5h | None |
| Phase 2 | 0.5h | None |
| Phase 3 | 1.5h | Phase 1, 2 |
| Phase 4 | 0.5h (선택) | Phase 3 |
| Phase 5 | 1.0h | Phase 3 (4) |
| **Total** | **4.0h** | |

---

## Technical Design

### API Route Structure

```python
# backend/api/routes/training_logs.py

from fastapi import APIRouter, Query
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

router = APIRouter(prefix="/api/training", tags=["training-logs"])

class TrainingLogEntry(BaseModel):
    timestamp: str
    level: str
    module: Optional[str] = None
    message: str

class TrainingLogsResponse(BaseModel):
    logs: List[TrainingLogEntry]
    total: int
    limit: int

@router.get("/logs", response_model=TrainingLogsResponse)
async def get_training_logs(
    limit: int = Query(500, ge=1, le=10000),
    level: Optional[str] = Query(None),
    since: Optional[str] = Query(None)
):
    """
    훈련 및 예측 관련 로그를 조회합니다.
    """
    # Implementation here
    pass
```

### Log Parsing Strategy

**로그 형식 (예상)**:
```
2025-10-23 16:50:09 | trainer_ml | INFO     | [trainer_ml.py:199] | apply_trainer_runtime_config | MainThread | 트레이너 런타임 설정 갱신: threshold=0.85
```

**파싱 로직**:
- 정규식 또는 split으로 파싱
- timestamp, module, level, message 추출
- 필터 적용 (level, since)
- limit만큼 최근 로그 반환

---

## Risks and Mitigations

### Risk 1: 로그 파일이 너무 큼
- **Mitigation**: tail 방식으로 파일 끝부터 읽기, limit 제한

### Risk 2: 로그 형식이 일관되지 않음
- **Mitigation**: 예외 처리, best-effort 파싱

### Risk 3: 파일 접근 권한 문제
- **Mitigation**: 로그 파일 경로 및 권한 확인, 환경 변수로 경로 설정

---

## Open Questions

1. **로그 파일 위치?**
   - Phase 2에서 확인 필요

2. **로그 보관 기간?**
   - 모든 로그 vs 최근 N일

3. **실시간 로그 필요?**
   - 현재: polling으로 충분
   - 향후: WebSocket 고려

---

## References

- App.tsx: lines 78-83 (log-viewer 메뉴)
- Backend logs: 2025-10-23 16:51:48 (404 에러)
- LogViewer.tsx: frontend-training/src/components/quality/LogViewer.tsx
- WORKFLOW_DIRECTIVES.md

---

**End of PRD**
