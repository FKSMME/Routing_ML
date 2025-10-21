import psycopg2

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    user='postgres',
    password='!tndyd2625',
    database='routing_ml_rsl'
)
cur = conn.cursor()
cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public'")
tables = cur.fetchall()
print("Tables in routing_ml_rsl database:")
for table in tables:
    print(f"  - {table[0]}")
print(f"\nTotal: {len(tables)} tables")
conn.close()
