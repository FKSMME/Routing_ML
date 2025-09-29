"""Minimal FAISS stub for test environments without the real dependency."""
from __future__ import annotations

import numpy as np


def normalize_L2(array: np.ndarray) -> None:  # pragma: no cover - simple stub
    """Normalize vectors in-place if possible (no-op stub)."""

    if array.size == 0:
        return
    norms = np.linalg.norm(array, axis=-1, keepdims=True)
    norms[norms == 0] = 1.0
    array /= norms


class _HNSWState:
    def __init__(self) -> None:
        self.efConstruction: int = 0
        self.efSearch: int = 0


class IndexHNSWFlat:  # pragma: no cover - used only in tests
    def __init__(self, dimension: int, m: int) -> None:
        self.dimension = dimension
        self.m = m
        self.hnsw = _HNSWState()
        self._vectors: np.ndarray | None = None

    def add(self, vectors: np.ndarray) -> None:
        self._vectors = np.asarray(vectors, dtype=np.float32)

    def search(self, queries: np.ndarray, top_k: int):
        if self._vectors is None or self._vectors.size == 0:
            distances = np.full((queries.shape[0], top_k), 1.0, dtype=np.float32)
            indices = -np.ones((queries.shape[0], top_k), dtype=np.int64)
            return distances, indices

        count = queries.shape[0]
        distances = np.zeros((count, top_k), dtype=np.float32)
        indices = np.zeros((count, top_k), dtype=np.int64)
        return distances, indices


__all__ = ["IndexHNSWFlat", "normalize_L2"]
