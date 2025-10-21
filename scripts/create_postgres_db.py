"""
Create PostgreSQL database 'routing_ml_rsl' for RSL tables.

This script connects to PostgreSQL using psycopg2 and creates
the routing_ml_rsl database if it doesn't exist.
"""
import sys
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT


def create_database():
    """Create routing_ml_rsl database."""
    # Database connection parameters
    db_params = {
        'host': 'localhost',
        'port': 5432,
        'user': 'postgres',
        'password': '!tndyd2625',
        'database': 'postgres'  # Connect to default 'postgres' database first
    }

    target_db_name = 'routing_ml_rsl'

    conn = None
    try:
        # Connect to PostgreSQL server (default 'postgres' database)
        print(f"Connecting to PostgreSQL server at {db_params['host']}:{db_params['port']}...")
        conn = psycopg2.connect(**db_params)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        # Check if database already exists
        cursor.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (target_db_name,)
        )
        exists = cursor.fetchone()

        if exists:
            print(f"[OK] Database '{target_db_name}' already exists.")
            return True

        # Create database
        print(f"Creating database '{target_db_name}'...")
        cursor.execute(
            sql.SQL("CREATE DATABASE {} WITH OWNER = postgres ENCODING = 'UTF8'").format(
                sql.Identifier(target_db_name)
            )
        )

        print(f"[OK] Database '{target_db_name}' created successfully!")

        # Verify creation
        cursor.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (target_db_name,)
        )
        if cursor.fetchone():
            print(f"[OK] Verified: Database '{target_db_name}' exists.")
            return True
        else:
            print(f"[ERROR] Database '{target_db_name}' was not created.")
            return False

    except psycopg2.OperationalError as e:
        print(f"[ERROR] Connection Error: {e}")
        print("\nPossible issues:")
        print("  1. PostgreSQL server is not running")
        print("  2. Wrong host/port (check if PostgreSQL is on localhost:5432)")
        print("  3. Wrong username/password")
        print("  4. PostgreSQL not installed")
        return False

    except psycopg2.Error as e:
        print(f"[ERROR] Database Error: {e}")
        return False

    except Exception as e:
        print(f"[ERROR] Unexpected Error: {e}")
        return False

    finally:
        if conn:
            cursor.close()
            conn.close()
            print("\nConnection closed.")


def main():
    """Main entry point."""
    print("=" * 60)
    print("PostgreSQL Database Creation Script")
    print("Target: routing_ml_rsl")
    print("=" * 60)
    print()

    success = create_database()

    print()
    print("=" * 60)
    if success:
        print("[SUCCESS] Database is ready!")
        print()
        print("Next steps:")
        print("  1. Restart backend service")
        print("  2. Tables will be auto-created by bootstrap_schema()")
        print("     - rsl_group")
        print("     - rsl_step")
        print("     - rsl_rule_ref")
        print("     - users")
    else:
        print("[FAILED] Database creation failed.")
        print()
        print("Alternative method:")
        print("  1. Install pgAdmin or use existing PostgreSQL client")
        print("  2. Run SQL: CREATE DATABASE routing_ml_rsl;")
    print("=" * 60)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
