# PyODBC 리팩토링 가이드

**문서 ID**: PRG-2025-10-06  
**버전**: 1.0.0  
**작성일**: 2025-10-06  

---

## 개요

Task #10-11에서 작성한 API 서비스들(anomaly, weekly_report, data_quality)이 SQLAlchemy Session을 가정하고 구현되었으나, 이 프로젝트는 **pyodbc를 직접 사용**합니다. 

이 문서는 해당 서비스들을 pyodbc 기반으로 리팩토링하는 방법을 설명합니다.

---

## 현재 상태

### ✅ 완료된 작업
1. `backend.database` 모듈에 `get_db_connection()` FastAPI 의존성 함수 추가
2. 문제 라우터들을 임시로 비활성화 (backend/api/app.py)
3. 백엔드 서버 정상 작동 (포트 8000)

### ⏸️ 비활성화된 라우터들
```python
# backend/api/app.py
# from backend.api.routes.anomaly import router as anomaly_router  # TODO: Fix database session dependency
# from backend.api.routes.weekly_report import router as weekly_report_router  # TODO: Fix database session dependency
# from backend.api.routes.data_quality import router as data_quality_router  # TODO: Fix database session dependency
```

---

## 리팩토링 가이드

### 1. backend/api/routes/anomaly.py

#### 변경 전 (SQLAlchemy)
```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_session

@router.post("/train")
def train_anomaly_model(
    contamination: float = Query(0.1, ge=0.01, le=0.5),
    n_estimators: int = Query(100, ge=50, le=500),
    session: Session = Depends(get_session),
):
    service = AnomalyDetectionService(session, config)
    result = service.train_model()
    return result
```

#### 변경 후 (PyODBC)
```python
from fastapi import APIRouter, Depends, HTTPException, Query
import pyodbc

from backend.database import get_db_connection

@router.post("/train")
def train_anomaly_model(
    contamination: float = Query(0.1, ge=0.01, le=0.5),
    n_estimators: int = Query(100, ge=50, le=500),
    conn: pyodbc.Connection = Depends(get_db_connection),
):
    service = AnomalyDetectionService(conn, config)
    result = service.train_model()
    return result
```

### 2. backend/api/services/anomaly_detection_service.py

#### 변경 전 (SQLAlchemy)
```python
from sqlalchemy.orm import Session

class AnomalyDetectionService:
    def __init__(self, session: Session, config: Optional[AnomalyDetectionConfig] = None):
        self.session = session
        self.config = config or AnomalyDetectionConfig()
        
    def train_model(self) -> Dict[str, Any]:
        # SQLAlchemy 쿼리
        items = self.session.query(ItemMaster).all()
        # ...
```

#### 변경 후 (PyODBC)
```python
import pyodbc
import pandas as pd

class AnomalyDetectionService:
    def __init__(self, conn: pyodbc.Connection, config: Optional[AnomalyDetectionConfig] = None):
        self.conn = conn
        self.config = config or AnomalyDetectionConfig()
        
    def train_model(self) -> Dict[str, Any]:
        # pandas.read_sql 사용
        query = """
            SELECT ITEM_CD, out_diameter, in_diameter, thickness, length, width, height
            FROM dbo_BI_ITEM_INFO_VIEW
            WHERE out_diameter IS NOT NULL
        """
        df = pd.read_sql(query, self.conn)
        
        # 기존 Isolation Forest 로직은 동일
        features = df[['out_diameter', 'in_diameter', 'thickness', 'length', 'width', 'height']].values
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(features)
        
        self.model = IsolationForest(
            contamination=self.config.contamination,
            n_estimators=self.config.n_estimators,
            random_state=self.config.random_state,
            n_jobs=-1,
        )
        self.model.fit(X_scaled)
        
        # 결과 반환 로직 동일
        # ...
```

### 3. backend/api/services/weekly_report_service.py

#### 변경 전 (SQLAlchemy)
```python
from sqlalchemy.orm import Session

class WeeklyReportService:
    def __init__(self, session: Session):
        self.session = session
        
    def _collect_weekly_stats(self, week_start, week_end) -> WeeklyStats:
        # SQLAlchemy 쿼리
        total_items = self.session.query(ItemMaster).count()
        # ...
```

#### 변경 후 (PyODBC)
```python
import pyodbc
import pandas as pd

class WeeklyReportService:
    def __init__(self, conn: pyodbc.Connection):
        self.conn = conn
        
    def _collect_weekly_stats(self, week_start, week_end) -> WeeklyStats:
        # 집계 쿼리 직접 실행
        query = """
            SELECT 
                COUNT(DISTINCT ITEM_CD) as total_items,
                COUNT(CASE WHEN INSRT_DT >= ? AND INSRT_DT < ? THEN 1 END) as items_added
            FROM dbo_BI_ITEM_INFO_VIEW
        """
        df = pd.read_sql(query, self.conn, params=[week_start, week_end])
        
        total_items = int(df['total_items'].iloc[0]) if not df.empty else 0
        items_added = int(df['items_added'].iloc[0]) if not df.empty else 0
        
        # WeeklyStats 생성 로직 동일
        # ...
```

---

## 주요 변경 포인트

### 1. Import 변경
```python
# 제거
from sqlalchemy.orm import Session

# 추가
import pyodbc
import pandas as pd
from backend.database import get_db_connection
```

### 2. 생성자 시그니처
```python
# 변경 전
def __init__(self, session: Session, ...)

# 변경 후
def __init__(self, conn: pyodbc.Connection, ...)
```

### 3. 데이터 조회 방법
```python
# 변경 전 (SQLAlchemy ORM)
items = session.query(ItemMaster).filter(ItemMaster.item_cd == 'ABC').all()

# 변경 후 (pandas + SQL)
query = "SELECT * FROM dbo_BI_ITEM_INFO_VIEW WHERE ITEM_CD = ?"
df = pd.read_sql(query, conn, params=['ABC'])
```

### 4. 테이블/뷰 이름
```python
# backend.database에서 import
from backend.database import (
    VIEW_ITEM_MASTER,    # "dbo_BI_ITEM_INFO_VIEW" (Access) or "dbo.BI_ITEM_INFO_VIEW" (MSSQL)
    VIEW_ROUTING,        # "dbo_BI_ROUTING_VIEW" (Access) or "dbo.BI_ROUTING_HIS_VIEW" (MSSQL)
    VIEW_WORK_RESULT,    # "dbo_BI_WORK_ORDER_RESULTS"
)

# 쿼리에서 사용
query = f"SELECT * FROM {VIEW_ITEM_MASTER} WHERE ITEM_CD = ?"
```

---

## 실행 순서

### Phase 1: anomaly.py 리팩토링
1. `backend/api/services/anomaly_detection_service.py` 수정:
   - `__init__(self, session: Session)` → `__init__(self, conn: pyodbc.Connection)`
   - SQLAlchemy 쿼리 → `pandas.read_sql()` 쿼리로 변경
   
2. `backend/api/routes/anomaly.py` 수정:
   - Import 변경: `get_session` → `get_db_connection`
   - 파라미터 변경: `session: Session` → `conn: pyodbc.Connection`

3. `backend/api/app.py`에서 주석 해제:
   ```python
   from backend.api.routes.anomaly import router as anomaly_router
   app.include_router(anomaly_router)
   ```

4. 백엔드 재시작 및 테스트:
   ```bash
   curl -X POST "http://localhost:8000/api/anomaly/train?contamination=0.1&n_estimators=100"
   ```

### Phase 2: weekly_report.py 리팩토링
(Phase 1과 동일한 패턴)

### Phase 3: data_quality.py 리팩토링
(Phase 1과 동일한 패턴)

---

## 테스트 체크리스트

### anomaly.py
- [ ] `POST /api/anomaly/train` - 모델 학습
- [ ] `POST /api/anomaly/detect` - 이상치 탐지
- [ ] `GET /api/anomaly/score/{item_id}` - 개별 품목 점수
- [ ] `GET /api/anomaly/stats` - 전체 통계

### weekly_report.py
- [ ] `POST /api/weekly-report/generate` - 리포트 생성
- [ ] `GET /api/weekly-report/list` - 리포트 목록
- [ ] `GET /api/weekly-report/{report_id}` - 특정 리포트 조회
- [ ] `GET /api/weekly-report/{report_id}/html` - HTML 다운로드

### data_quality.py
- [ ] 모든 API 엔드포인트 정상 작동 확인

---

## 예상 소요 시간

| 작업 | 예상 시간 |
|------|----------|
| anomaly_detection_service.py 리팩토링 | 30분 |
| anomaly.py 라우터 수정 | 10분 |
| weekly_report_service.py 리팩토링 | 30분 |
| weekly_report.py 라우터 수정 | 10분 |
| data_quality.py 리팩토링 | 20분 |
| 통합 테스트 | 30분 |
| **총 예상 시간** | **2시간 10분** |

---

## 참고 자료

### backend.database 모듈 함수들
```python
# 연결 함수
def get_db_connection() -> pyodbc.Connection:
    """FastAPI 의존성 함수 (context manager)"""
    with _connection_pool.get_connection() as conn:
        yield conn

# 조회 함수들
def fetch_item_master(columns: Optional[List[str]] = None) -> pd.DataFrame
def fetch_single_item(item_cd: str) -> pd.DataFrame
def fetch_routing_for_item(item_cd: str) -> pd.DataFrame
def fetch_work_results_for_item(item_cd: str) -> pd.DataFrame

# 배치 조회 함수들
def fetch_items_batch(item_codes: List[str]) -> Dict[str, pd.DataFrame]
def fetch_routings_for_items(item_codes: List[str]) -> Dict[str, pd.DataFrame]
```

### SQL 쿼리 예시
```python
# 품목 마스터 조회
query = f"""
    SELECT ITEM_CD, out_diameter, in_diameter, thickness
    FROM {VIEW_ITEM_MASTER}
    WHERE ITEM_CD = ?
"""
df = pd.read_sql(query, conn, params=['ITEM001'])

# 집계 쿼리
query = f"""
    SELECT 
        COUNT(*) as total_items,
        AVG(out_diameter) as avg_diameter
    FROM {VIEW_ITEM_MASTER}
    WHERE INSRT_DT >= ? AND INSRT_DT < ?
"""
df = pd.read_sql(query, conn, params=[week_start, week_end])
```

---

**작성자**: Claude AI  
**다음 작업**: Phase 1 (anomaly.py) 리팩토링 시작
