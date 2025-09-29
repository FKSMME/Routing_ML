#backend\index_hnws
"""
Faiss + HNSW 검색 엔진 래퍼 (cosine-similarity)
──────────────────────────────────────────────
* 입력 벡터는 float32 로 L2-정규화해 보관
* cosine ≃ 1 – ‖x – y‖² / 2 변환으로 유사도 환산
* 기존 EfficientSimilaritySearch 와 동일하게
  `find_similar(query, top_k)` API 제공
  └ top_k = 1  → (item_code, similarity)
  └ top_k > 1 → ([item_codes], [similarities])
"""

from __future__ import annotations

from typing import Sequence

import faiss                    # pip install faiss-cpu
import numpy as np


class HNSWSearch:
    """
    Parameters
    ----------
    vectors : np.ndarray, float32, shape (N, D)
        품목 임베딩 행렬 (**L2-정규화되지 않은** 원본도 OK).
    item_codes : Sequence[str]
        vectors 행과 1:1 매핑되는 ITEM_CD 리스트.
    M : int, optional
        각 노드가 유지할 최대 근접 이웃수 (기본 32).
    ef_construction : int, optional
        그래프 구축 시 탐색 폭 (기본 200).
    ef_search : int | None, optional
        질의 시 탐색 폭. None이면 max(ef_construction, 64).
    """

    def __init__(
        self,
        vectors: np.ndarray,
        item_codes: Sequence[str],
        *,
        M: int = 32,
        ef_construction: int = 200,
        ef_search: int | None = None,
    ) -> None:
        # -- 데이터 준비 --------------------------------------------------
        if vectors.dtype != np.float32:
            vectors = vectors.astype("float32", copy=False)

        faiss.normalize_L2(vectors)                 # cosine ↔ L2 변환 전제

        self.item_codes = np.asarray(item_codes)

        # -- HNSW 인덱스 구축 --------------------------------------------
        d = vectors.shape[1]
        self.index = faiss.IndexHNSWFlat(d, M)
        self.index.hnsw.efConstruction = ef_construction
        self.index.add(vectors)
        self.index.hnsw.efSearch = ef_search or max(ef_construction, 64)

    # ------------------------------------------------------------------
    def find_similar(
        self,
        query: np.ndarray,
        top_k: int = 1,
    ) -> tuple[str, float] | tuple[list[str], list[float]]:
        """
        Parameters
        ----------
        query : np.ndarray, shape (D,) or (1, D)
            **L2-정규화 안 돼 있어도** 내부에서 처리.
        top_k : int
            반환할 상위 개수 (기본 1).

        Returns
        -------
        (item_code, sim)  또는  ([codes], [sims])
        """
        q = query.astype("float32", copy=False).reshape(1, -1)
        faiss.normalize_L2(q)

        distances_sq, indices = self.index.search(q, top_k)  # L2 거리 제곱 반환
        sims = 1.0 - (distances_sq[0] / 2.0)                  # cosine 환산

        if top_k == 1:
            return self.item_codes[int(indices[0, 0])], float(sims[0])

        return list(self.item_codes[indices[0]]), sims.tolist()
