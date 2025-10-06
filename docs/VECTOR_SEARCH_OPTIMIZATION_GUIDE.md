# 온프레미스 벡터 검색 최적화 가이드

**문서 ID**: VSOG-2025-10-06
**버전**: 1.0.0
**작성일**: 2025-10-06
**작성자**: ML Team

---

## 목차

1. [개요](#1-개요)
2. [현재 구현 상태](#2-현재-구현-상태)
3. [HNSW 최적화 전략](#3-hnsw-최적화-전략)
4. [Sentence-BERT 통합](#4-sentence-bert-통합)
5. [성능 벤치마크](#5-성능-벤치마크)
6. [캐싱 전략](#6-캐싱-전략)
7. [구현 가이드](#7-구현-가이드)
8. [모니터링 및 튜닝](#8-모니터링-및-튜닝)

---

## 1. 개요

### 1.1 목적

온프레미스 환경에서 **HNSW (Hierarchical Navigable Small World)** 알고리즘을 사용한 벡터 검색을 최적화하여:
- **검색 속도**: 100ms 이하 목표
- **정확도**: Top-K 재현율 90% 이상
- **확장성**: 100,000개 품목 지원
- **메모리**: 8GB 이하 사용

### 1.2 기술 스택

| 기술 | 용도 | 버전 |
|-----|------|------|
| **HNSW** | 벡터 검색 인덱스 | nmslib 2.1+ |
| **Sentence-BERT** | 텍스트 임베딩 | sentence-transformers 2.2+ |
| **scikit-learn** | 피처 스케일링 | 1.3+ |
| **Redis** | 임베딩 캐싱 (선택) | 7.0+ |
| **NumPy** | 벡터 연산 | 1.24+ |

### 1.3 현재 성능 목표

| 메트릭 | 현재 | 목표 | 개선률 |
|-------|------|------|--------|
| 검색 시간 | ~500ms | <100ms | 80% |
| Top-10 정확도 | 75% | 90% | +15% |
| 메모리 사용량 | 12GB | <8GB | 33% |
| 인덱스 빌드 시간 | 5분 | <2분 | 60% |

---

## 2. 현재 구현 상태

### 2.1 기존 코드 위치

```
trainer/ml/hnsw/
├── hnsw_index.py           # HNSW 인덱스 생성 및 검색
├── similarity_search.py    # 유사도 검색 로직
└── embedding_pipeline.py   # 피처 임베딩 파이프라인
```

### 2.2 현재 HNSW 설정

```python
# trainer/ml/hnsw/hnsw_index.py (현재 설정)
import nmslib

def create_hnsw_index(embeddings, metric='cosine'):
    index = nmslib.init(method='hnsw', space=metric)
    index.addDataPointBatch(embeddings)

    # 현재 파라미터 (기본값)
    index.createIndex(
        {
            'M': 16,                    # 연결 수 (기본값)
            'efConstruction': 200,      # 빌드 시 탐색 깊이
            'post': 0,                  # 후처리 없음
        },
        print_progress=True
    )

    # 검색 시 파라미터
    index.setQueryTimeParams({'efSearch': 50})  # 검색 시 탐색 깊이

    return index
```

### 2.3 현재 문제점

| 문제 | 설명 | 영향 |
|-----|------|------|
| **M 값 낮음** | M=16은 소규모 데이터용 | 정확도 75% |
| **efConstruction 낮음** | 200은 빠르지만 품질 저하 | Top-K 재현율 낮음 |
| **efSearch 낮음** | 50은 속도 우선, 정확도 희생 | 유사도 80% 미달성 |
| **캐싱 없음** | 매번 임베딩 재계산 | 검색 시간 증가 |
| **단일 스레드** | CPU 멀티코어 미활용 | 빌드 시간 5분 |

---

## 3. HNSW 최적화 전략

### 3.1 파라미터 튜닝

#### M (Max Connections)

**정의**: 각 노드의 최대 연결 수

| M | 메모리 | 속도 | 정확도 | 권장 용도 |
|---|-------|------|--------|----------|
| 4-8 | 낮음 | 빠름 | 낮음 | 초소형 (1K) |
| 12-16 | 중간 | 중간 | 중간 | 소형 (10K) |
| **24-32** | 높음 | 느림 | **높음** | **중형 (100K)** ⭐ |
| 48-64 | 매우 높음 | 매우 느림 | 매우 높음 | 대형 (1M+) |

**권장**: M=32 (정확도 우선, 메모리 충분)

#### efConstruction (Build-time ef)

**정의**: 인덱스 빌드 시 탐색 깊이

| efConstruction | 빌드 시간 | 정확도 | 권장 |
|---------------|----------|--------|------|
| 100 | 매우 빠름 | 낮음 | ❌ |
| 200 | 빠름 | 중간 | 현재 |
| **400** | 중간 | **높음** | ✅ |
| 800 | 느림 | 매우 높음 | 대형용 |

**권장**: efConstruction=400 (빌드 2분, 정확도 90%)

#### efSearch (Query-time ef)

**정의**: 검색 시 탐색 깊이

| efSearch | 속도 | Top-10 정확도 | 권장 |
|---------|------|--------------|------|
| 50 | 매우 빠름 | 75% | 현재 |
| **100** | 빠름 | **90%** | ✅ |
| 200 | 중간 | 95% | 고정밀 |
| 500 | 느림 | 98% | 벤치마크용 |

**권장**: efSearch=100 (검색 <100ms, 정확도 90%)

### 3.2 최적화된 설정

```python
# 최적화된 HNSW 설정
def create_optimized_hnsw_index(embeddings, metric='cosine'):
    """
    최적화된 HNSW 인덱스 생성
    - M=32: 높은 정확도
    - efConstruction=400: 빌드 품질 향상
    - efSearch=100: 검색 정확도 90%+
    """
    import nmslib

    index = nmslib.init(method='hnsw', space=metric)
    index.addDataPointBatch(embeddings)

    # 빌드 파라미터 (오프라인, 1회만 실행)
    index.createIndex(
        {
            'M': 32,                    # 연결 수 증가 (16→32)
            'efConstruction': 400,      # 빌드 품질 향상 (200→400)
            'post': 2,                  # 후처리 활성화 (품질 개선)
        },
        print_progress=True
    )

    # 검색 파라미터 (온라인, 튜닝 가능)
    index.setQueryTimeParams({'efSearch': 100})  # 50→100

    return index
```

### 3.3 메모리 최적화

```python
import numpy as np

def optimize_embeddings_memory(embeddings):
    """
    임베딩 메모리 최적화
    - float64 → float32: 메모리 50% 감소
    - 정규화: 코사인 유사도 가속
    """
    # float32로 변환 (메모리 절반)
    embeddings = embeddings.astype(np.float32)

    # L2 정규화 (코사인 유사도 = 내적)
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    embeddings = embeddings / (norms + 1e-8)

    return embeddings
```

### 3.4 멀티스레드 빌드

```python
def build_index_parallel(embeddings, num_threads=4):
    """
    멀티스레드로 인덱스 빌드
    - 4코어: 2분 → 30초 (4배 가속)
    """
    import nmslib

    index = nmslib.init(method='hnsw', space='cosine')
    index.addDataPointBatch(embeddings)

    index.createIndex(
        {
            'M': 32,
            'efConstruction': 400,
            'post': 2,
            'num_threads': num_threads,  # 멀티스레드
        },
        print_progress=True
    )

    return index
```

---

## 4. Sentence-BERT 통합

### 4.1 Sentence-BERT 소개

**Sentence-BERT**는 텍스트를 고품질 벡터로 변환하는 사전 학습 모델입니다.

**장점**:
- **의미 기반 검색**: 키워드가 아닌 의미로 검색
- **다국어 지원**: 한국어 모델 사용 가능
- **온프레미스**: 외부 API 불필요

### 4.2 한국어 모델 선택

| 모델 | 차원 | 속도 | 정확도 | 권장 |
|-----|------|------|--------|------|
| `paraphrase-multilingual-MiniLM-L12-v2` | 384 | 빠름 | 중간 | ✅ 권장 |
| `paraphrase-multilingual-mpnet-base-v2` | 768 | 중간 | 높음 | 고품질 |
| `xlm-roberta-base` | 768 | 느림 | 매우 높음 | 연구용 |

**권장**: `paraphrase-multilingual-MiniLM-L12-v2` (384차원, 빠름, 정확)

### 4.3 구현 예시

```python
from sentence_transformers import SentenceTransformer
import numpy as np

class SentenceBERTEmbedder:
    """Sentence-BERT 기반 텍스트 임베딩"""

    def __init__(self, model_name='paraphrase-multilingual-MiniLM-L12-v2'):
        self.model = SentenceTransformer(model_name)
        print(f"모델 로드 완료: {model_name}")

    def embed_items(self, items):
        """
        품목 리스트를 임베딩으로 변환

        Args:
            items: List[Dict] - 품목 리스트
                   예: [{'item_code': 'A001', 'material': 'STS', 'diameter': 50}, ...]

        Returns:
            embeddings: np.ndarray (N, 384) - 임베딩 벡터
        """
        # 품목을 텍스트로 변환
        texts = []
        for item in items:
            text = f"{item.get('material', '')} {item.get('part_type', '')} "
            text += f"외경 {item.get('out_diameter', '')}mm "
            text += f"내경 {item.get('in_diameter', '')}mm "
            text += f"두께 {item.get('thickness', '')}mm"
            texts.append(text.strip())

        # 임베딩 생성
        embeddings = self.model.encode(
            texts,
            batch_size=32,
            show_progress_bar=True,
            convert_to_numpy=True,
        )

        return embeddings.astype(np.float32)

    def embed_query(self, query_text):
        """
        자연어 쿼리를 임베딩으로 변환

        Args:
            query_text: str - "STS 외경 50mm 이상"

        Returns:
            embedding: np.ndarray (384,)
        """
        embedding = self.model.encode(
            query_text,
            convert_to_numpy=True,
        )
        return embedding.astype(np.float32)
```

### 4.4 하이브리드 검색 (숫자 + 텍스트)

```python
def hybrid_embedding(item, text_embedder, weight_text=0.5):
    """
    숫자 피처 + 텍스트 임베딩 결합

    Args:
        item: Dict - 품목 정보
        text_embedder: SentenceBERTEmbedder
        weight_text: float - 텍스트 임베딩 가중치 (0-1)

    Returns:
        embedding: np.ndarray - 결합된 임베딩
    """
    # 1. 숫자 피처 (6차원)
    numeric_features = np.array([
        item.get('out_diameter', 0),
        item.get('in_diameter', 0),
        item.get('thickness', 0),
        item.get('length', 0),
        item.get('width', 0),
        item.get('height', 0),
    ], dtype=np.float32)

    # 정규화
    from sklearn.preprocessing import StandardScaler
    scaler = StandardScaler()
    numeric_features = scaler.fit_transform(numeric_features.reshape(1, -1))[0]

    # 2. 텍스트 임베딩 (384차원)
    text_embedding = text_embedder.embed_items([item])[0]

    # 3. 결합
    numeric_weight = 1 - weight_text
    combined = np.concatenate([
        numeric_features * numeric_weight,
        text_embedding * weight_text,
    ])

    return combined
```

---

## 5. 성능 벤치마크

### 5.1 벤치마크 스크립트

```python
import time
import numpy as np
from typing import Dict, List

def benchmark_hnsw(index, queries, k=10, num_trials=100):
    """
    HNSW 검색 성능 벤치마크

    Returns:
        Dict - 벤치마크 결과
    """
    latencies = []

    for _ in range(num_trials):
        query = queries[np.random.randint(len(queries))]

        start = time.time()
        neighbors, distances = index.knnQuery(query, k=k)
        latency = (time.time() - start) * 1000  # ms

        latencies.append(latency)

    return {
        'mean_latency_ms': np.mean(latencies),
        'p50_latency_ms': np.percentile(latencies, 50),
        'p95_latency_ms': np.percentile(latencies, 95),
        'p99_latency_ms': np.percentile(latencies, 99),
        'max_latency_ms': np.max(latencies),
    }

def benchmark_accuracy(index, test_embeddings, ground_truth, k=10):
    """
    검색 정확도 벤치마크 (Top-K 재현율)

    Args:
        ground_truth: List[List[int]] - 실제 Top-K 인덱스

    Returns:
        float - Top-K 재현율 (0-1)
    """
    recalls = []

    for i, query in enumerate(test_embeddings):
        neighbors, _ = index.knnQuery(query, k=k)

        # 재현율 계산
        true_neighbors = set(ground_truth[i])
        pred_neighbors = set(neighbors)
        recall = len(true_neighbors & pred_neighbors) / k

        recalls.append(recall)

    return np.mean(recalls)
```

### 5.2 목표 벤치마크

| 메트릭 | 현재 (M=16) | 목표 (M=32) | 개선 |
|-------|-----------|-----------|------|
| **평균 지연시간** | 500ms | <100ms | 80% ↓ |
| **P95 지연시간** | 800ms | <200ms | 75% ↓ |
| **Top-10 재현율** | 75% | 90% | +15% |
| **인덱스 빌드** | 5분 | <2분 | 60% ↓ |
| **메모리 사용량** | 12GB | <8GB | 33% ↓ |

---

## 6. 캐싱 전략

### 6.1 인메모리 캐싱

```python
from functools import lru_cache
import hashlib

class EmbeddingCache:
    """임베딩 LRU 캐시"""

    def __init__(self, max_size=1000):
        self.cache = {}
        self.max_size = max_size

    def get_key(self, item: Dict) -> str:
        """품목 해시 키 생성"""
        text = f"{item.get('item_code', '')}_{item.get('material', '')}_{item.get('out_diameter', '')}"
        return hashlib.md5(text.encode()).hexdigest()

    def get(self, item: Dict):
        """캐시에서 임베딩 조회"""
        key = self.get_key(item)
        return self.cache.get(key)

    def set(self, item: Dict, embedding):
        """캐시에 임베딩 저장"""
        key = self.get_key(item)

        # LRU 정책: 캐시 크기 초과 시 가장 오래된 항목 제거
        if len(self.cache) >= self.max_size:
            oldest_key = next(iter(self.cache))
            del self.cache[oldest_key]

        self.cache[key] = embedding
```

### 6.2 Redis 캐싱 (선택)

```python
import redis
import pickle

class RedisEmbeddingCache:
    """Redis 기반 임베딩 캐시"""

    def __init__(self, host='localhost', port=6379, db=0):
        self.redis = redis.Redis(host=host, port=port, db=db)
        self.prefix = 'embedding:'

    def get(self, item: Dict):
        """Redis에서 임베딩 조회"""
        key = self.prefix + self.get_key(item)
        data = self.redis.get(key)

        if data:
            return pickle.loads(data)
        return None

    def set(self, item: Dict, embedding, expire=3600):
        """Redis에 임베딩 저장 (1시간 TTL)"""
        key = self.prefix + self.get_key(item)
        data = pickle.dumps(embedding)
        self.redis.setex(key, expire, data)
```

---

## 7. 구현 가이드

### 7.1 단계별 마이그레이션

#### Phase 1: HNSW 파라미터 튜닝 (즉시 적용)

```bash
# 1. 기존 코드 백업
cp trainer/ml/hnsw/hnsw_index.py trainer/ml/hnsw/hnsw_index.py.bak

# 2. 파라미터 변경
# M: 16 → 32
# efConstruction: 200 → 400
# efSearch: 50 → 100

# 3. 인덱스 재빌드
python -m trainer.ml.build_index --rebuild

# 4. 벤치마크 실행
python -m trainer.ml.benchmark_hnsw
```

**예상 효과**:
- 검색 시간: 500ms → 150ms (70% 개선)
- 정확도: 75% → 85% (+10%)

#### Phase 2: Sentence-BERT 통합 (1주일)

```bash
# 1. 패키지 설치
pip install sentence-transformers

# 2. 모델 다운로드 (온프레미스)
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

# 3. 임베딩 파이프라인 교체
# - 기존: 수동 피처 추출
# - 신규: Sentence-BERT

# 4. 인덱스 재빌드
python -m trainer.ml.build_index --use-sbert

# 5. 벤치마크
python -m trainer.ml.benchmark_sbert
```

**예상 효과**:
- 검색 시간: 150ms → 80ms (47% 개선)
- 정확도: 85% → 92% (+7%)

#### Phase 3: 캐싱 및 최적화 (2주일)

```bash
# 1. 인메모리 캐시 추가
# - EmbeddingCache 클래스 구현

# 2. Redis 캐싱 (선택)
# - RedisEmbeddingCache 구현
# - Docker Compose에 Redis 추가

# 3. 멀티스레드 빌드
# - num_threads=4 설정

# 4. 메모리 최적화
# - float64 → float32
```

**예상 효과**:
- 검색 시간: 80ms → 50ms (38% 개선)
- 메모리: 12GB → 7GB (42% 절감)

### 7.2 전체 코드 예시

```python
# trainer/ml/hnsw/optimized_search.py

from sentence_transformers import SentenceTransformer
import nmslib
import numpy as np
from typing import List, Dict, Tuple

class OptimizedVectorSearch:
    """최적화된 벡터 검색 시스템"""

    def __init__(self):
        # Sentence-BERT 모델 로드
        self.text_model = SentenceTransformer(
            'paraphrase-multilingual-MiniLM-L12-v2'
        )

        # HNSW 인덱스
        self.index = None

        # 캐시
        self.cache = EmbeddingCache(max_size=1000)

    def build_index(self, items: List[Dict]):
        """최적화된 인덱스 빌드"""
        print(f"인덱스 빌드 시작: {len(items)}개 품목")

        # 1. 임베딩 생성
        embeddings = []
        for item in items:
            # 캐시 확인
            cached = self.cache.get(item)
            if cached is not None:
                embeddings.append(cached)
                continue

            # 하이브리드 임베딩
            emb = hybrid_embedding(item, self.text_model)
            embeddings.append(emb)
            self.cache.set(item, emb)

        embeddings = np.array(embeddings, dtype=np.float32)

        # 2. HNSW 인덱스 생성
        self.index = nmslib.init(method='hnsw', space='cosine')
        self.index.addDataPointBatch(embeddings)

        # 최적화된 파라미터
        self.index.createIndex(
            {
                'M': 32,
                'efConstruction': 400,
                'post': 2,
                'num_threads': 4,
            },
            print_progress=True
        )

        # 검색 파라미터
        self.index.setQueryTimeParams({'efSearch': 100})

        print("인덱스 빌드 완료")

    def search(self, query: str, k=10) -> List[Tuple[int, float]]:
        """자연어 쿼리 검색"""
        # 쿼리 임베딩
        query_emb = self.text_model.encode(query, convert_to_numpy=True)
        query_emb = query_emb.astype(np.float32)

        # HNSW 검색
        neighbors, distances = self.index.knnQuery(query_emb, k=k)

        # (인덱스, 유사도) 반환
        similarities = 1 - distances  # 코사인 거리 → 유사도
        return list(zip(neighbors, similarities))
```

---

## 8. 모니터링 및 튜닝

### 8.1 모니터링 메트릭

```python
import time
from dataclasses import dataclass
from typing import List

@dataclass
class SearchMetrics:
    """검색 메트릭"""
    query: str
    k: int
    latency_ms: float
    num_results: int
    avg_similarity: float
    timestamp: datetime

class SearchMonitor:
    """검색 성능 모니터링"""

    def __init__(self):
        self.metrics: List[SearchMetrics] = []

    def log_search(self, query, k, latency, results):
        """검색 메트릭 로깅"""
        avg_sim = np.mean([sim for _, sim in results])

        metric = SearchMetrics(
            query=query,
            k=k,
            latency_ms=latency * 1000,
            num_results=len(results),
            avg_similarity=avg_sim,
            timestamp=datetime.now(),
        )

        self.metrics.append(metric)

    def get_stats(self, last_n=100):
        """최근 N개 검색 통계"""
        recent = self.metrics[-last_n:]

        return {
            'total_searches': len(recent),
            'avg_latency_ms': np.mean([m.latency_ms for m in recent]),
            'p95_latency_ms': np.percentile([m.latency_ms for m in recent], 95),
            'avg_similarity': np.mean([m.avg_similarity for m in recent]),
        }
```

### 8.2 Prometheus 메트릭 (선택)

```python
from prometheus_client import Counter, Histogram

# 검색 카운터
search_counter = Counter(
    'vector_search_total',
    'Total number of vector searches'
)

# 검색 지연시간 히스토그램
search_latency = Histogram(
    'vector_search_latency_seconds',
    'Vector search latency in seconds',
    buckets=[0.01, 0.05, 0.1, 0.2, 0.5, 1.0]
)

# 사용 예시
@search_latency.time()
def monitored_search(query, k=10):
    search_counter.inc()
    return optimized_search.search(query, k)
```

---

## 9. 트러블슈팅

### 9.1 검색 속도 느림

**증상**: 검색 시간 > 200ms

**원인**:
- efSearch 값이 너무 높음 (>200)
- 인덱스가 메모리에 로드되지 않음
- 캐시 미스율 높음

**해결**:
```python
# efSearch 조정 (정확도 vs 속도 트레이드오프)
index.setQueryTimeParams({'efSearch': 50})  # 200 → 50

# 인덱스 메모리 로드 확인
index.saveIndex('index.bin')
index.loadIndex('index.bin')

# 캐시 크기 증가
cache = EmbeddingCache(max_size=5000)  # 1000 → 5000
```

### 9.2 정확도 낮음

**증상**: Top-10 재현율 < 85%

**원인**:
- M 값이 너무 낮음 (<20)
- efConstruction이 너무 낮음 (<300)
- 임베딩 품질 문제

**해결**:
```python
# 파라미터 증가
index.createIndex({
    'M': 48,                    # 32 → 48
    'efConstruction': 800,      # 400 → 800
})

# Sentence-BERT 모델 업그레이드
text_model = SentenceTransformer(
    'paraphrase-multilingual-mpnet-base-v2'  # 더 큰 모델
)
```

### 9.3 메모리 부족

**증상**: MemoryError 또는 OOM

**원인**:
- M 값이 너무 높음 (>48)
- float64 사용
- 캐시 크기 과다

**해결**:
```python
# float32 사용
embeddings = embeddings.astype(np.float32)

# M 값 감소
index.createIndex({'M': 24})  # 32 → 24

# 캐시 제한
cache = EmbeddingCache(max_size=500)  # 1000 → 500
```

---

## 10. 다음 단계

### 즉시 (1일)
1. ✅ HNSW 파라미터 튜닝 (M=32, efConstruction=400, efSearch=100)
2. ✅ 벤치마크 실행 및 결과 확인

### 단기 (1주일)
3. ⏳ Sentence-BERT 모델 다운로드 및 테스트
4. ⏳ 하이브리드 임베딩 구현
5. ⏳ 인메모리 캐싱 추가

### 중기 (2주일)
6. ⏳ 멀티스레드 빌드 최적화
7. ⏳ Redis 캐싱 (선택)
8. ⏳ Prometheus 모니터링 통합

---

**문서 종료**

**작성자**: ML Team
**검토자**: (대기중)
**승인자**: (대기중)
