"""Dummy model classes for emergency recovery."""

import numpy as np


class DummySimilarityEngine:
    """Dummy similarity engine that returns mock results."""

    def __init__(self, n_dimensions: int = 37):
        self.index_built = True
        self.item_codes = [
            "DUMMY-SEAL-001",
            "DUMMY-SEAL-002",
            "DUMMY-SEAL-003",
            "DUMMY-GASKET-001",
            "DUMMY-GASKET-002",
            "DUMMY-PART-001",
            "DUMMY-PART-002",
            "DUMMY-PART-003",
        ]
        self.vectors = np.random.randn(len(self.item_codes), n_dimensions).astype(np.float32)
        self.index_data = None
        self.index_ids = list(range(len(self.item_codes)))

    def search(self, query_vector, k: int = 10, threshold: float = 0.0):
        """Return mock search results with deterministic structure."""
        results = []
        max_k = min(k, len(self.item_codes))
        for idx, code in enumerate(self.item_codes[:max_k]):
            similarity = float(max(0.0, 0.95 - idx * 0.05))
            distance = float(max(0.0, 1.0 - similarity))
            results.append(
                {
                    "item_code": code,
                    "similarity": similarity,
                    "distance": distance,
                    "vector": self.vectors[idx].tolist() if idx < len(self.vectors) else [],
                }
            )
        return results

    def build_index(self, vectors, item_codes):
        """Store provided vectors and labels to mimic a trained engine."""
        self.vectors = np.asarray(vectors, dtype=np.float32)
        self.item_codes = list(item_codes)
        self.index_ids = list(range(len(self.item_codes)))
        self.index_built = True
        return self


class DummyEncoder:
    """Dummy encoder that passes through data."""

    def __init__(self):
        self.categories_ = {}
        self.feature_names_ = []

    def transform(self, X):
        """Return input as-is."""
        return X

    def fit(self, X, y=None):
        return self


class DummyScaler:
    """Dummy scaler that passes through data."""

    def __init__(self, n_features=37):
        self.mean_ = np.zeros(n_features)
        self.scale_ = np.ones(n_features)
        self.var_ = np.ones(n_features)
        self.n_features_in_ = n_features
        self.n_samples_seen_ = 1000

    def transform(self, X):
        """Return input as-is."""
        return X

    def fit(self, X, y=None):
        return self
