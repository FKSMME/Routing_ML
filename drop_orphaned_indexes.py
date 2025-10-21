"""Drop orphaned indexes that exist without their tables."""
import psycopg2

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    user='postgres',
    password='!tndyd2625',
    database='routing_ml_rsl'
)
cur = conn.cursor()

# Check for orphaned indexes
cur.execute("""
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'model_versions'
""")
indexes = cur.fetchall()
print(f"Indexes for model_versions table: {indexes}")

if indexes:
    print(f"\nDropping {len(indexes)} orphaned indexes...")
    for (index_name,) in indexes:
        print(f"  Dropping index: {index_name}")
        cur.execute(f"DROP INDEX IF EXISTS {index_name}")
    conn.commit()
    print("[OK] Orphaned indexes dropped")
else:
    print("[INFO] No orphaned indexes found")

conn.close()
