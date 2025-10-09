#!/usr/bin/env python3
"""
ODBC Driver Validation Script
Checks if required ODBC drivers are installed and accessible.

Usage:
    python scripts/check_odbc.py

Exit codes:
    0: All required drivers found
    1: Missing drivers
    2: Configuration error
"""

import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def check_pyodbc():
    """Check if pyodbc module is available."""
    try:
        import pyodbc
        print(f"✅ pyodbc version: {pyodbc.version}")
        return True
    except ImportError as e:
        print(f"❌ pyodbc not installed: {e}")
        return False


def list_available_drivers():
    """List all available ODBC drivers."""
    try:
        import pyodbc
        drivers = pyodbc.drivers()

        if not drivers:
            print("⚠️  No ODBC drivers found")
            return []

        print(f"\n📦 Available ODBC drivers ({len(drivers)}):")
        for driver in sorted(drivers):
            print(f"   - {driver}")

        return drivers
    except Exception as e:
        print(f"❌ Error listing drivers: {e}")
        return []


def check_mssql_driver(drivers):
    """Check for SQL Server ODBC driver."""
    mssql_patterns = [
        "ODBC Driver 17 for SQL Server",
        "ODBC Driver 18 for SQL Server",
        "SQL Server Native Client",
        "FreeTDS",
    ]

    found = [d for d in drivers if any(pattern in d for pattern in mssql_patterns)]

    if found:
        print(f"\n✅ SQL Server driver found: {found[0]}")
        return True
    else:
        print("\n❌ No SQL Server ODBC driver found")
        print("   Required drivers (any):")
        for pattern in mssql_patterns:
            print(f"   - {pattern}")
        print("\n   Installation:")
        print("   Ubuntu/Debian: sudo apt-get install unixodbc unixodbc-dev")
        print("   Red Hat/CentOS: sudo yum install unixODBC unixODBC-devel")
        print("   Windows: Download from Microsoft")
        return False


def check_access_driver(drivers):
    """Check for MS Access ODBC driver (Windows only)."""
    access_patterns = [
        "Microsoft Access Driver",
        "Microsoft Excel Driver",
    ]

    found = [d for d in drivers if any(pattern in d for pattern in access_patterns)]

    if found:
        print(f"\n✅ Access driver found: {found[0]}")
        return True
    else:
        print("\n⚠️  No Access driver found (expected on Linux)")
        print("   Access drivers only available on Windows")
        print("   For Linux deployments, use DB_TYPE=MSSQL")
        return False


def check_db_config():
    """Check database configuration from environment."""
    db_type = os.getenv("DB_TYPE", "ACCESS")

    print(f"\n🔧 Database Configuration:")
    print(f"   DB_TYPE: {db_type}")

    if db_type == "MSSQL":
        server = os.getenv("MSSQL_SERVER", "")
        database = os.getenv("MSSQL_DATABASE", "")
        user = os.getenv("MSSQL_USER", "")
        password_set = bool(os.getenv("MSSQL_PASSWORD"))

        print(f"   MSSQL_SERVER: {server or '(not set)'}")
        print(f"   MSSQL_DATABASE: {database or '(not set)'}")
        print(f"   MSSQL_USER: {user or '(not set)'}")
        print(f"   MSSQL_PASSWORD: {'(set)' if password_set else '(not set)'}")

        if not all([server, database, user, password_set]):
            print("\n⚠️  Incomplete MSSQL configuration")
            return False

        print("\n✅ MSSQL configuration complete")
        return True

    elif db_type == "ACCESS":
        print("\n⚠️  ACCESS database type selected")
        print("   Note: Access requires Windows and ODBC drivers")
        print("   Recommended: Use DB_TYPE=MSSQL for production")
        return True

    else:
        print(f"\n❌ Invalid DB_TYPE: {db_type}")
        print("   Valid values: ACCESS, MSSQL")
        return False


def test_mssql_connection():
    """Test actual connection to MSSQL (if configured)."""
    db_type = os.getenv("DB_TYPE", "ACCESS")

    if db_type != "MSSQL":
        print("\n⏭️  Skipping MSSQL connection test (DB_TYPE != MSSQL)")
        return True

    try:
        import pyodbc

        server = os.getenv("MSSQL_SERVER", "")
        database = os.getenv("MSSQL_DATABASE", "")
        user = os.getenv("MSSQL_USER", "")
        password = os.getenv("MSSQL_PASSWORD", "")

        if not all([server, database, user, password]):
            print("\n⏭️  Skipping connection test (incomplete config)")
            return True

        # Find SQL Server driver
        drivers = pyodbc.drivers()
        mssql_driver = None
        for pattern in ["ODBC Driver 18", "ODBC Driver 17", "FreeTDS"]:
            found = [d for d in drivers if pattern in d]
            if found:
                mssql_driver = found[0]
                break

        if not mssql_driver:
            print("\n⚠️  No SQL Server driver found, skipping connection test")
            return False

        print(f"\n🔌 Testing MSSQL connection...")
        print(f"   Driver: {mssql_driver}")
        print(f"   Server: {server}")
        print(f"   Database: {database}")

        conn_str = (
            f"DRIVER={{{mssql_driver}}};"
            f"SERVER={server};"
            f"DATABASE={database};"
            f"UID={user};"
            f"PWD={password};"
            f"Encrypt=no;"
            f"TrustServerCertificate=yes;"
        )

        conn = pyodbc.connect(conn_str, timeout=5)
        cursor = conn.cursor()
        cursor.execute("SELECT @@VERSION")
        version = cursor.fetchone()[0]

        print(f"\n✅ Connection successful!")
        version_line = version.split('\n')[0]
        print(f"   SQL Server: {version_line}")

        cursor.close()
        conn.close()

        return True

    except Exception as e:
        print(f"\n❌ Connection failed: {e}")
        print("\n   Troubleshooting:")
        print("   1. Verify server is accessible")
        print("   2. Check credentials")
        print("   3. Ensure firewall allows connections")
        print("   4. Verify ODBC driver version")
        return False


def main():
    """Run all ODBC checks."""
    print("=" * 60)
    print("ODBC Driver Validation")
    print("=" * 60)

    exit_code = 0

    # Step 1: Check pyodbc
    if not check_pyodbc():
        print("\n❌ CRITICAL: pyodbc not available")
        return 2

    # Step 2: List drivers
    drivers = list_available_drivers()

    # Step 3: Check specific drivers
    has_mssql = check_mssql_driver(drivers)
    has_access = check_access_driver(drivers)

    # Step 4: Check configuration
    config_ok = check_db_config()

    # Step 5: Test connection (optional)
    connection_ok = test_mssql_connection()

    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)

    db_type = os.getenv("DB_TYPE", "ACCESS")

    if db_type == "MSSQL":
        if has_mssql and config_ok:
            if connection_ok:
                print("✅ MSSQL fully configured and tested")
                exit_code = 0
            else:
                print("⚠️  MSSQL configured but connection failed")
                exit_code = 1
        else:
            print("❌ MSSQL not properly configured")
            exit_code = 1

    elif db_type == "ACCESS":
        if has_access:
            print("✅ Access driver available (Windows only)")
            exit_code = 0
        else:
            print("⚠️  Access driver not found")
            print("   Recommendation: Switch to DB_TYPE=MSSQL")
            exit_code = 1

    print("\nExit code:", exit_code)
    print("=" * 60)

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
