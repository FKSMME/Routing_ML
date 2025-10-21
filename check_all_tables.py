import psycopg2

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    user='postgres',
    password='!tndyd2625',
    database='routing_ml_rsl'
)
cur = conn.cursor()

# Check all tables in all schemas
cur.execute("""
SELECT schemaname, tablename
FROM pg_tables
ORDER BY schemaname, tablename
""")
tables = cur.fetchall()
print("All tables in routing_ml_rsl database:")
for schema, table in tables:
    print(f"  {schema}.{table}")
print(f"\nTotal: {len(tables)} tables")

# Check specifically for model_versions
cur.execute("""
SELECT schemaname, tablename
FROM pg_tables
WHERE tablename = 'model_versions'
""")
model_versions = cur.fetchall()
print(f"\nmodel_versions table found in: {model_versions if model_versions else 'NOT FOUND'}")

conn.close()
