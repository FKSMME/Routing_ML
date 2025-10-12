# SQLite Local Development Guide

## Overview

This guide explains how to set up and use SQLite for local development of the Routing ML system. SQLite is recommended for:

- **Local development**: No database server required
- **CI/CD testing**: Fast, isolated test environments
- **Containerized deployments**: Simplified Docker setup
- **Portable demos**: Database as a single file

## Quick Start

### 1. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and set DB_TYPE to SQLITE (or leave default)
```

Update your `.env` file:

```bash
# Database Configuration
DB_TYPE=SQLITE

# SQLite Database Paths (default locations)
RSL_DATABASE_URL=sqlite:///logs/rsl_store.db
ROUTING_GROUPS_DATABASE_URL=sqlite:///logs/routing_groups.db
```

### 2. Start the Backend

```bash
# Activate virtual environment
source venv-linux/bin/activate  # Linux/macOS
# or
venv-windows\Scripts\activate  # Windows

# Start FastAPI server
python -m backend.api.app
```

The backend will automatically:
- Create `logs/` directory if it doesn't exist
- Initialize SQLite database files
- Create required tables on first run

### 3. Verify Setup

```bash
# Check database files exist
ls -lh logs/*.db

# Expected output:
# logs/rsl_store.db
# logs/routing_groups.db
# logs/audit/ui_actions.log
```

## Database Architecture

### RSL Store Database

**File**: `logs/rsl_store.db`
**Purpose**: Routing Sequence List (RSL) data storage

**Tables**:
- `items` - Master item data (품목 마스터)
- `routing_sequences` - Routing operation sequences
- `process_time_aggregates` - Cached aggregation results
- `quality_metrics` - Data quality KPIs

### Routing Groups Database

**File**: `logs/routing_groups.db`
**Purpose**: Routing group configurations and snapshots

**Tables**:
- `routing_groups` - Group definitions
- `routing_rules` - Rule assignments
- `routing_snapshots` - Version history
- `audit_events` - Change tracking

## Development Workflow

### Database Reset

```bash
# Stop backend server (Ctrl+C)

# Delete existing databases
rm -f logs/*.db

# Restart backend (auto-creates fresh databases)
python -m backend.api.app
```

### Inspecting Data

**Option 1: SQLite CLI**

```bash
# Install sqlite3 (if not available)
sudo apt install sqlite3  # Ubuntu/Debian
brew install sqlite3      # macOS

# Open database
sqlite3 logs/rsl_store.db

# Useful commands:
.tables              # List all tables
.schema items        # Show table schema
SELECT * FROM items LIMIT 10;
.quit
```

**Option 2: DB Browser for SQLite (GUI)**

Download: https://sqlitebrowser.org/

1. Open `logs/rsl_store.db`
2. Browse data in visual interface
3. Run SQL queries
4. Export data to CSV

**Option 3: Python Script**

```python
import sqlite3
from pathlib import Path

db_path = Path("logs/rsl_store.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Query items
cursor.execute("SELECT item_code, item_name FROM items LIMIT 5")
for row in cursor.fetchall():
    print(row)

conn.close()
```

### Seeding Test Data

**Manual SQL Insert**:

```bash
sqlite3 logs/rsl_store.db <<EOF
INSERT INTO items (item_code, item_name, material_code, part_type)
VALUES
    ('TEST-001', 'Test Item 1', 'MAT-001', 'ASSEMBLY'),
    ('TEST-002', 'Test Item 2', 'MAT-002', 'PART');
EOF
```

**Python Script** (recommended):

```python
# scripts/seed_test_data.py
from backend.database_rsl import get_session_factory
from backend.models.items import Item
from datetime import datetime

session_factory = get_session_factory()
session = session_factory()

test_items = [
    Item(
        item_code="TEST-001",
        item_name="Test Assembly",
        material_code="MAT-001",
        part_type="ASSEMBLY",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    ),
    Item(
        item_code="TEST-002",
        item_name="Test Part",
        material_code="MAT-002",
        part_type="PART",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    ),
]

session.add_all(test_items)
session.commit()
session.close()

print("✅ Test data seeded successfully")
```

Run the script:

```bash
python scripts/seed_test_data.py
```

## Testing with SQLite

### Unit Tests

SQLite is automatically used for tests via `pytest` fixtures:

```python
# tests/backend/api/test_items.py
import pytest
from pathlib import Path

@pytest.fixture
def test_db(tmp_path: Path, monkeypatch):
    """Isolated test database."""
    db_path = tmp_path / "test_rsl.db"
    monkeypatch.setenv("RSL_DATABASE_URL", f"sqlite:///{db_path}")

    from backend.api.config import get_settings
    get_settings.cache_clear()

    yield db_path

    # Cleanup happens automatically (tmp_path)

def test_create_item(test_db):
    from backend.database_rsl import get_session_factory
    from backend.models.items import Item

    session_factory = get_session_factory()
    session = session_factory()

    item = Item(item_code="TEST-001", item_name="Test")
    session.add(item)
    session.commit()

    assert session.query(Item).count() == 1
    session.close()
```

### CI/CD Integration

Example `.github/workflows/test.yml`:

```yaml
name: Backend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt

      - name: Run tests with SQLite
        env:
          DB_TYPE: SQLITE
          RSL_DATABASE_URL: sqlite:///test_rsl.db
          ROUTING_GROUPS_DATABASE_URL: sqlite:///test_routing.db
          JWT_SECRET_KEY: test-secret-key-min-32-chars-long
        run: |
          pytest tests/backend -v --cov=backend
```

## SQLite Limitations

### When to Use SQLite

✅ **Recommended for**:
- Local development
- Automated testing
- Proof-of-concept demos
- Single-user scenarios
- Read-heavy workloads

### When to Use MSSQL Instead

❌ **Not recommended for**:
- Production deployments with >10 concurrent users
- High write concurrency
- Multi-server setups
- Enterprise authentication (Windows/LDAP)
- Data sizes >100GB

See [MSSQL_MIGRATION.md](./MSSQL_MIGRATION.md) for migration guide.

## Performance Tuning

### Optimize SQLite for Development

Add to your application startup:

```python
# backend/database_rsl.py
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """Optimize SQLite for development."""
    cursor = dbapi_conn.cursor()

    # Enable WAL mode (better concurrency)
    cursor.execute("PRAGMA journal_mode=WAL")

    # Increase cache size (10MB)
    cursor.execute("PRAGMA cache_size=-10000")

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys=ON")

    # Synchronous mode (faster writes)
    cursor.execute("PRAGMA synchronous=NORMAL")

    cursor.close()
```

### Backup SQLite Databases

```bash
# Create backup directory
mkdir -p backups

# Backup databases with timestamp
timestamp=$(date +%Y%m%d_%H%M%S)
cp logs/rsl_store.db backups/rsl_store_${timestamp}.db
cp logs/routing_groups.db backups/routing_groups_${timestamp}.db

echo "✅ Backup created: backups/*_${timestamp}.db"
```

## Troubleshooting

### Database Locked Error

**Error**: `sqlite3.OperationalError: database is locked`

**Solutions**:

1. **Enable WAL mode** (recommended):
   ```python
   # Add to database_rsl.py connection setup
   cursor.execute("PRAGMA journal_mode=WAL")
   ```

2. **Increase timeout**:
   ```python
   from sqlalchemy import create_engine

   engine = create_engine(
       "sqlite:///logs/rsl_store.db",
       connect_args={"timeout": 30}  # 30 seconds
   )
   ```

3. **Close connections properly**:
   ```python
   # Always use try/finally
   session = session_factory()
   try:
       # Your code here
       session.commit()
   finally:
       session.close()
   ```

### Database File Corruption

**Prevention**:
- Enable WAL mode
- Don't kill processes during writes
- Use `session.commit()` instead of auto-commit

**Recovery**:
```bash
# Check integrity
sqlite3 logs/rsl_store.db "PRAGMA integrity_check"

# Repair (if possible)
sqlite3 logs/rsl_store.db ".recover" | sqlite3 repaired.db

# Restore from backup
cp backups/rsl_store_YYYYMMDD_HHMMSS.db logs/rsl_store.db
```

### Missing Tables

**Symptom**: `sqlite3.OperationalError: no such table: items`

**Solution**: Run database migrations

```bash
# If using Alembic
alembic upgrade head

# Or restart backend (auto-creates tables)
python -m backend.api.app
```

## Migration Path

### From Access to SQLite

See migration script: `scripts/migrate_access_to_sqlite.py`

```bash
# Export Access data to CSV
python scripts/export_access_to_csv.py --input routing_data/KsmErp.accdb

# Import CSV to SQLite
python scripts/import_csv_to_sqlite.py --input exports/*.csv
```

### From SQLite to MSSQL

See: [MSSQL_MIGRATION.md](./MSSQL_MIGRATION.md)

```bash
# Export SQLite to SQL dump
sqlite3 logs/rsl_store.db .dump > backup.sql

# Import to MSSQL (requires manual conversion)
# See MSSQL_MIGRATION.md for detailed steps
```

## Additional Resources

- **SQLite Documentation**: https://www.sqlite.org/docs.html
- **SQLAlchemy SQLite Dialect**: https://docs.sqlalchemy.org/en/20/dialects/sqlite.html
- **DB Browser for SQLite**: https://sqlitebrowser.org/
- **SQLite Performance Tuning**: https://www.sqlite.org/pragma.html#pragma_optimize

## Support

For issues or questions:
- Check [DIAGNOSIS_AND_IMPROVEMENT_PLAN.md](../DIAGNOSIS_AND_IMPROVEMENT_PLAN.md)
- Review backend logs: `logs/*.log`
- Open GitHub issue with `[SQLite]` tag
