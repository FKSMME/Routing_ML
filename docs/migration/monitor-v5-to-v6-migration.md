# Monitor v5 to v6 Migration Guide

**From**: v5.2.4 (Monolithic)
**To**: v6.0.0 (Modular)
**Date**: 2025-10-20

---

## Overview

Monitor v6 represents a complete architectural refactoring from a single-file application to a modular package structure. This guide helps users and developers migrate from v5 to v6.

---

## What's Changed

### Architecture

| Aspect | v5.2.4 | v6.0.0 |
|--------|--------|---------|
| Structure | Single file (1,676 lines) | Modular package (18 files) |
| Entry point | `server_monitor_dashboard_v5_1.py` | `server_monitor_v6.py` |
| Import style | All in one file | Import from `monitor` package |
| Build output | `RoutingMLMonitor_v5.2.4.exe` | `RoutingMLMonitor_v6.0.0.exe` |

### File Structure

**v5.2.4**:
```
scripts/
└── server_monitor_dashboard_v5_1.py  (everything in one file)
```

**v6.0.0**:
```
scripts/
├── server_monitor_v6.py              (entry point)
└── monitor/                          (modular package)
    ├── config.py
    ├── models.py
    ├── utils.py
    ├── api/
    ├── services/
    └── ui/
```

---

## For End Users

### Running the Application

**v5 (Old)**:
```bash
python scripts/server_monitor_dashboard_v5_1.py
```

**v6 (New)**:
```bash
python scripts/server_monitor_v6.py
```

Or use the executable:
```bash
# v5
dist/RoutingMLMonitor_v5.2.4.exe

# v6
dist/RoutingMLMonitor_v6.0.0.exe
```

### Functional Changes

**Good News**: Zero functional changes!

- All features from v5 work exactly the same in v6
- Same UI layout and design
- Same keyboard shortcuts
- Same workflow nodes
- Same service monitoring logic
- Same API integration

### Performance

- **Startup time**: Similar (~0.5-1.0 seconds)
- **Memory usage**: Similar (~30-40 MB)
- **Responsiveness**: Identical

### Configuration

No changes to environment variables or configuration:
- `ROUTING_ML_API_URL`
- `MONITOR_ADMIN_USERNAME`
- `MONITOR_ADMIN_PASSWORD`
- All work the same way

---

## For Developers

### Import Changes

If you were importing from the old monolithic file:

**v5 (Old)**:
```python
# Everything was in one file
from scripts.server_monitor_dashboard_v5_1 import (
    Service,
    SERVICES,
    ApiClient,
    check_service,
)
```

**v6 (New)**:
```python
# Import from organized modules
from monitor.models import Service, SERVICES
from monitor.api import ApiClient
from monitor.services import check_service
```

### Code Modifications

#### Example 1: Using Service Models

**v5**:
```python
from scripts.server_monitor_dashboard_v5_1 import SERVICES

for service in SERVICES:
    print(service.name)
```

**v6**:
```python
from monitor.models import SERVICES

for service in SERVICES:
    print(service.name)
```

#### Example 2: API Client Usage

**v5**:
```python
from scripts.server_monitor_dashboard_v5_1 import ApiClient, ApiError

try:
    client = ApiClient(base_url, username, password)
    data = client.get_json("/api/users")
except ApiError:
    pass
```

**v6**:
```python
from monitor.api import ApiClient, ApiError

try:
    client = ApiClient(base_url, username, password)
    data = client.get_json("/api/users")
except ApiError:
    pass
```

#### Example 3: Service Checking

**v5**:
```python
from scripts.server_monitor_dashboard_v5_1 import check_service, SERVICES

state, msg = check_service(SERVICES[0])
```

**v6**:
```python
from monitor.models import SERVICES
from monitor.services import check_service

state, msg = check_service(SERVICES[0])
```

#### Example 4: Configuration Access

**v5**:
```python
from scripts.server_monitor_dashboard_v5_1 import (
    __version__,
    BG_PRIMARY,
    API_BASE_URL,
)
```

**v6**:
```python
from monitor.config import (
    __version__,
    BG_PRIMARY,
    API_BASE_URL,
)
```

### Creating Custom Integrations

**v5** - Everything in one place:
```python
# Had to import from massive file
from scripts.server_monitor_dashboard_v5_1 import (
    Service, check_service, CompactServiceCard
)

# Create custom service
my_service = Service(
    key="custom",
    name="My Service",
    icon="🔥",
    check_url="http://localhost:5000"
)

# Check it
status = check_service(my_service)
```

**v6** - Clean modular imports:
```python
# Import only what you need from organized modules
from monitor.models import Service
from monitor.services import check_service
from monitor.ui.components import CompactServiceCard

# Same usage as before
my_service = Service(
    key="custom",
    name="My Service",
    icon="🔥",
    check_url="http://localhost:5000"
)

status = check_service(my_service)
```

---

## Migration Steps

### Step 1: Update Imports

Replace old imports with new modular imports:

```bash
# Find all imports from old file
grep -r "from scripts.server_monitor_dashboard" .

# Replace with new imports based on mapping below
```

**Import Mapping**:

| Old Import | New Import |
|------------|------------|
| `from scripts.server_monitor_dashboard_v5_1 import Service, SERVICES` | `from monitor.models import Service, SERVICES` |
| `from scripts.server_monitor_dashboard_v5_1 import ApiClient, ApiError` | `from monitor.api import ApiClient, ApiError` |
| `from scripts.server_monitor_dashboard_v5_1 import check_service` | `from monitor.services import check_service` |
| `from scripts.server_monitor_dashboard_v5_1 import __version__` | `from monitor.config import __version__` |
| `from scripts.server_monitor_dashboard_v5_1 import BG_PRIMARY` | `from monitor.config import BG_PRIMARY` |
| `from scripts.server_monitor_dashboard_v5_1 import CompactServiceCard` | `from monitor.ui.components import CompactServiceCard` |
| `from scripts.server_monitor_dashboard_v5_1 import WorkflowCanvas` | `from monitor.ui.components import WorkflowCanvas` |
| `from scripts.server_monitor_dashboard_v5_1 import CompactChart` | `from monitor.ui.components import CompactChart` |
| `from scripts.server_monitor_dashboard_v5_1 import RoutingMLDashboard` | `from monitor.ui.dashboard import RoutingMLDashboard` |

### Step 2: Update Entry Point

If you have custom launch scripts:

**v5**:
```python
# main.py
from scripts.server_monitor_dashboard_v5_1 import main

if __name__ == "__main__":
    main()
```

**v6**:
```python
# main.py
from monitor.models import SERVICES
from monitor.ui.dashboard import RoutingMLDashboard

if __name__ == "__main__":
    app = RoutingMLDashboard(SERVICES)
    app.run()
```

Or simply:
```python
# main.py
import server_monitor_v6

if __name__ == "__main__":
    server_monitor_v6.main()
```

### Step 3: Update Build Scripts

**v5** build script:
```batch
pyinstaller RoutingMLMonitor_v5.2.4.spec
```

**v6** build script:
```batch
pyinstaller RoutingMLMonitor_v6.0.0.spec
```

Or use the new build script:
```batch
build_monitor_v6.bat
```

### Step 4: Test

Run your updated code:

```bash
# 1. Test imports
python -c "from monitor.models import SERVICES; print(f'Found {len(SERVICES)} services')"

# 2. Test application
python scripts/server_monitor_v6.py

# 3. Test build
build_monitor_v6.bat
```

---

## Breaking Changes

### None for End Users

If you only run the executable, there are **zero breaking changes**.

### For Developers

**Only Breaking Change**: Import paths have changed

**Before (v5)**:
```python
from scripts.server_monitor_dashboard_v5_1 import *
```

**After (v6)**:
```python
from monitor.models import SERVICES, Service
from monitor.api import ApiClient, ApiError
from monitor.services import check_service
from monitor.config import __version__, BG_PRIMARY
from monitor.ui.dashboard import RoutingMLDashboard
from monitor.ui.components import CompactServiceCard, WorkflowCanvas, CompactChart
```

**Mitigation**: Update imports as shown in Step 1 above.

---

## Benefits of Migrating

### For End Users

1. **More reliable**: Better code organization = fewer bugs
2. **Faster updates**: Developers can work more efficiently
3. **Better support**: Easier to diagnose and fix issues

### For Developers

1. **Better maintainability**: Find and modify code faster
2. **Easier testing**: Test modules independently
3. **Cleaner imports**: Import only what you need
4. **Better IDE support**: Autocomplete and navigation work better
5. **Team collaboration**: Multiple developers can work on different modules
6. **Reusability**: Use UI components in other projects

### Example: Before vs After

**Before (v5)** - Want to use service checker in another project:
```python
# Have to import the entire 1,676-line file
from scripts.server_monitor_dashboard_v5_1 import check_service
# Also imports: Dashboard, API client, UI components, everything!
```

**After (v6)** - Clean imports:
```python
# Import only what you need
from monitor.services import check_service
# Only imports: check_service and its dependencies (~50 lines)
```

---

## Backward Compatibility

### Coexistence

Both v5 and v6 can run side-by-side:

```
scripts/
├── server_monitor_dashboard_v5_1.py  ← v5 still works
├── server_monitor_v6.py              ← v6 new entry
└── monitor/                          ← v6 modules
```

You can:
- Keep using v5 while testing v6
- Gradually migrate custom code
- Roll back if needed

### Rollback Plan

If you encounter issues:

```bash
# Run v5 instead
python scripts/server_monitor_dashboard_v5_1.py

# Or use v5 executable
dist/RoutingMLMonitor_v5.2.4.exe
```

---

## Troubleshooting

### Issue: Import Error

**Symptom**:
```
ModuleNotFoundError: No module named 'monitor'
```

**Solution**:
Ensure you're running from the correct directory:
```bash
cd /path/to/Routing_ML_251014
python scripts/server_monitor_v6.py
```

### Issue: Missing Attribute

**Symptom**:
```
AttributeError: module 'monitor.config' has no attribute 'SOME_CONSTANT'
```

**Solution**:
Check if the constant was renamed. See [Module Structure](../architecture/monitor-v6-module-structure.md) for full list of exports.

### Issue: Build Fails

**Symptom**:
```
PyInstaller build fails with missing module
```

**Solution**:
Ensure `RoutingMLMonitor_v6.0.0.spec` has all modules in `hiddenimports`.

---

## FAQ

### Q: Do I have to migrate?

**A**: No. v5 continues to work. Migrate when you're ready.

### Q: Will v5 be deprecated?

**A**: Eventually, but it will remain available for backward compatibility.

### Q: Is v6 stable?

**A**: Yes. All v5 functionality has been preserved and tested.

### Q: Can I mix v5 and v6 code?

**A**: Not recommended, but possible with careful import management.

### Q: What if I find a bug in v6?

**A**: Report it and use v5 while it's being fixed.

### Q: Is performance different?

**A**: No significant difference. Startup and runtime performance are similar.

---

## Getting Help

### Resources

- [Module Structure Documentation](../architecture/monitor-v6-module-structure.md)
- [Work History](../work-history/2025-10-20-monitor-modularization-phases-1-3.md)
- [PRD](../planning/PRD_monitor_app_modularization.md)

### Contact

For migration support, contact the Routing ML Team.

---

## Checklist

Use this checklist to track your migration:

```
Migration Checklist:

Phase 1: Preparation
[ ] Read this migration guide
[ ] Review module structure documentation
[ ] Identify all code that imports from v5
[ ] Create backup of current code

Phase 2: Code Updates
[ ] Update imports to v6 style
[ ] Update entry points
[ ] Update build scripts
[ ] Run linter/type checker

Phase 3: Testing
[ ] Test imports work
[ ] Test application runs
[ ] Test PyInstaller build
[ ] Test all functionality
[ ] Compare with v5 behavior

Phase 4: Deployment
[ ] Update deployment scripts
[ ] Update documentation
[ ] Inform users of changes
[ ] Deploy v6

Phase 5: Cleanup (optional)
[ ] Remove v5 code (if no longer needed)
[ ] Archive v5 builds
[ ] Update references in documentation
```

---

**Last Updated**: 2025-10-20
**Version**: 1.0
**Status**: Complete
