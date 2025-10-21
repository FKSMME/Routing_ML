"""Manually create the model_versions table."""
from backend.maintenance.model_registry import initialize_schema

# This will create the model_versions table
MODEL_REGISTRY_URL = "postgresql+psycopg2://postgres:!tndyd2625@localhost:5432/routing_ml_rsl"

print(f"Initializing schema for: {MODEL_REGISTRY_URL}")
try:
    initialize_schema(MODEL_REGISTRY_URL)
    print("[OK] Schema initialized successfully!")
except Exception as e:
    print(f"[ERROR] Schema initialization failed: {e}")
    import traceback
    traceback.print_exc()
