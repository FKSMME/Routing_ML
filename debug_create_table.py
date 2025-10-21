"""Debug table creation."""
from sqlalchemy import create_engine
from backend.maintenance.model_registry import Base

MODEL_REGISTRY_URL = "postgresql+psycopg2://postgres:!tndyd2625@localhost:5432/routing_ml_rsl"

print(f"Creating engine for: {MODEL_REGISTRY_URL}")
engine = create_engine(MODEL_REGISTRY_URL, future=True, pool_pre_ping=True)

print(f"Creating tables...")
print(f"Tables to create: {Base.metadata.tables.keys()}")

try:
    Base.metadata.create_all(engine, checkfirst=True)
    print("[OK] Tables created successfully!")
except Exception as e:
    print(f"[ERROR] Table creation failed: {e}")
    print(f"Error type: {type(e)}")
    print(f"Error message (lower): {str(e).lower()}")
    import traceback
    traceback.print_exc()
