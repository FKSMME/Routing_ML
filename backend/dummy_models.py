"""Dummy model classes for emergency recovery."""

import numpy as np


class DummySimilarityEngine:
    """Dummy similarity engine that returns mock results."""

    def __init__(self):
        self.index_data = None
        self.index_ids = []

    def search(self, query_vector, k=10):
        """Return mock search results."""
        # Return mock similarities and indices
        mock_distances = np.random.random(k) * 0.5  # Random values 0-0.5
        mock_indices = np.arange(k)
        return mock_distances, mock_indices


class DummyEncoder:
    """Dummy encoder that passes through data."""

    def __init__(self):
        self.categories_ = {}
        self.feature_names_ = []

    def transform(self, X):
        """Return input as-is."""
        return X


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
