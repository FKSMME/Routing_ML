"""Lightweight FAISS stub for testing environments.

This stub provides minimal functionality required by the repository's unit
tests without requiring the heavy ``faiss-cpu`` dependency. It is **not** a
drop-in replacement for production use.
"""

from __future__ import annotations

import numpy as np


def normalize_L2(vectors: np.ndarray) -> None:
    """In-place L2 normalization similar to :func:`faiss.normalize_L2`."""

    if vectors.ndim == 1:
        vectors = vectors.reshape(1, -1)
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    vectors /= norms


class _HNSWState:
    def __init__(self) -> None:
        self.efConstruction = 0
        self.efSearch = 0


class IndexHNSWFlat:
    """Simplified index storing vectors in-memory for nearest-neighbour lookups."""

    def __init__(self, dim: int, M: int) -> None:
        self.dim = dim
        self.M = M
        self._vectors: np.ndarray | None = None
        self.hnsw = _HNSWState()

    def add(self, vectors: np.ndarray) -> None:
        vectors = np.asarray(vectors, dtype=np.float32)
        if vectors.size == 0:
            self._vectors = np.empty((0, self.dim), dtype=np.float32)
            return
        if vectors.shape[1] != self.dim:
            raise ValueError("Vector dimensionality mismatch")
        self._vectors = vectors.copy()

    def search(self, query: np.ndarray, top_k: int):  # pragma: no cover - trivial
        if self._vectors is None or self._vectors.size == 0:
            raise ValueError("Index is empty")
        query = np.asarray(query, dtype=np.float32)
        if query.ndim == 1:
            query = query.reshape(1, -1)
        if query.shape[1] != self.dim:
            raise ValueError("Query dimensionality mismatch")

        normalize_L2(query)
        vectors = self._vectors
        normalize_L2(vectors)

        distances = ((vectors - query[0]) ** 2).sum(axis=1)
        order = np.argsort(distances)[:top_k]
        distances_sq = distances[order].reshape(1, -1)
        indices = order.reshape(1, -1)
        return distances_sq.astype(np.float32), indices.astype(np.int64)


__all__ = ["IndexHNSWFlat", "normalize_L2"]
