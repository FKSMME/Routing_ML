# Model Artifact Manifest

The training pipeline now writes a `manifest.json` file inside every model
version directory. The manifest records the relative path, checksum, and schema
version for the core artifacts produced by `train_model_with_ml_improved` as
well as auxiliary metadata written by the orchestration service.

## Schema overview

The manifest follows the `routing-ml/manifest@1` schema:

```json
{
  "schema_version": "routing-ml/manifest@1",
  "generated_at": "2024-01-01T12:00:00Z",
  "hash_algorithm": "sha256",
  "artifacts": {
    "similarity_engine": {
      "path": "similarity_engine.joblib",
      "sha256": "…",
      "schema_version": "routing-ml/searcher@1"
    },
    "encoder": {
      "path": "encoder.joblib",
      "sha256": "…",
      "schema_version": "routing-ml/encoder@1"
    },
    "scaler": {
      "path": "scaler.joblib",
      "sha256": "…",
      "schema_version": "routing-ml/scaler@1"
    },
    "feature_columns": {
      "path": "feature_columns.joblib",
      "sha256": "…",
      "schema_version": "routing-ml/feature-columns@1"
    }
    // optional metadata entries follow the same structure
  }
}
```

Only artifacts that exist on disk are listed. Optional entries such as
`training_metadata.json`, `feature_weights.joblib`, or
`training_metrics.json` are included automatically when present.

Checksums are computed with SHA-256 so operators can monitor file integrity
without reloading the model.

## Migration notes

* Existing version directories do **not** need to rename or relocate any
  artifacts. When the API service loads its configuration it will automatically
  generate a `manifest.json` for the current layout if one is missing.
* The `ROUTING_ML_MODEL_DIRECTORY` environment variable may now point to either
  a version directory (legacy behaviour) or directly to a manifest file. The
  prediction service resolves the manifest before accessing the filesystem and
  verifies the core artifacts before loading them with the existing
  `load_optimized_model` helper.
* Training runs regenerate the manifest after all outputs are written so that
  the manifest always reflects the final set of artifacts for that version.

With these changes operators can continue to manage model versions exactly as
before while gaining an auditable overview of the saved assets.
