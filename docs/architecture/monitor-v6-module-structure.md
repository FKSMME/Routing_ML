# Monitor v6.0.0 Module Structure

**Version**: 6.0.0
**Date**: 2025-10-20
**Status**: Production Ready

---

## Overview

The Monitor application has been refactored from a monolithic 1,676-line file into a modular package structure with clear separation of concerns and improved maintainability.

---

## Package Structure

```
scripts/
├── server_monitor_v6.py              # New entry point (14 lines)
└── monitor/                          # Main package
    ├── __init__.py                   # Package initialization
    ├── config.py                     # Configuration and constants (70 lines)
    ├── models.py                     # Data models (67 lines)
    ├── utils.py                      # Utility functions (18 lines)
    │
    ├── api/                          # API communication layer
    │   ├── __init__.py              # API module exports
    │   ├── errors.py                # Custom exceptions (8 lines)
    │   └── client.py                # ApiClient class (121 lines)
    │
    ├── services/                     # Service health checking
    │   ├── __init__.py              # Services module exports
    │   └── checker.py               # check_service function (48 lines)
    │
    └── ui/                          # User interface components
        ├── __init__.py              # UI module exports
        ├── dashboard.py             # Main application class (1,045 lines)
        └── components/              # Reusable UI widgets
            ├── __init__.py          # Component exports
            ├── service_card.py      # CompactServiceCard (141 lines)
            ├── workflow_canvas.py   # WorkflowCanvas (161 lines)
            └── chart.py             # CompactChart (82 lines)
```

**Total Files**: 18
**Total Lines**: ~1,767 lines (excluding __init__.py boilerplate)
**Average Module Size**: ~98 lines (excluding dashboard)

---

## Module Descriptions

### Core Modules

#### `config.py`
**Purpose**: Central configuration and constants
**Exports**:
- Version information: `__version__`, `__build_date__`, `__author__`, `__app_name__`
- Settings: `POLL_INTERVAL_SECONDS`, `PERFORMANCE_HISTORY_SIZE`
- API configuration: `API_BASE_URL`, `MONITOR_ADMIN_USERNAME`, etc.
- Color system: All UI colors (BG_*, TEXT_*, ACCENT_*, STATUS_*, etc.)

**Usage**:
```python
from monitor.config import __version__, BG_PRIMARY, API_BASE_URL
```

#### `models.py`
**Purpose**: Data structures and domain models
**Exports**:
- `Service` dataclass: Represents a monitored service endpoint
- `SERVICES` tuple: List of all monitored services

**Usage**:
```python
from monitor.models import Service, SERVICES

for service in SERVICES:
    print(f"{service.name}: {service.check_url}")
```

#### `utils.py`
**Purpose**: Utility functions
**Exports**:
- `blend_color(hex_a, hex_b, t)`: Linear interpolation between two hex colors

**Usage**:
```python
from monitor.utils import blend_color

hover_color = blend_color("#ff0000", "#00ff00", 0.5)
```

---

### API Module (`monitor.api`)

#### `api/errors.py`
**Purpose**: Custom exception classes
**Exports**:
- `ApiError`: Raised when API interaction fails

#### `api/client.py`
**Purpose**: HTTP client for backend API communication
**Exports**:
- `ApiClient`: Full-featured API client with authentication

**Features**:
- Cookie-based session management
- SSL certificate handling (self-signed certs)
- Automatic authentication on initialization
- JSON request/response handling

**Usage**:
```python
from monitor.api import ApiClient, ApiError

try:
    client = ApiClient(
        base_url="https://localhost:8000",
        username="admin",
        password="password"
    )
    data = client.get_json("/api/users")
except ApiError as e:
    print(f"API error: {e}")
```

---

### Services Module (`monitor.services`)

#### `services/checker.py`
**Purpose**: Service health checking
**Exports**:
- `check_service(service)`: Check if a service is online

**Features**:
- HTTP/HTTPS endpoint checking
- SSL certificate bypass for self-signed certs
- Fallback to TCP port check
- Response time measurement

**Usage**:
```python
from monitor.models import SERVICES
from monitor.services import check_service

state, message = check_service(SERVICES[0])
print(f"Backend API: {state} ({message})")
# Output: "Backend API: online (127ms)"
```

---

### UI Module (`monitor.ui`)

#### `ui/dashboard.py`
**Purpose**: Main application window and logic
**Exports**:
- `RoutingMLDashboard`: Main application class

**Features**:
- Service status monitoring
- Performance charts (CPU, Memory, Disk)
- Workflow visualization
- User management
- Audit log viewing

**Usage**:
```python
from monitor.models import SERVICES
from monitor.ui.dashboard import RoutingMLDashboard

app = RoutingMLDashboard(SERVICES)
app.run()
```

#### `ui/components/service_card.py`
**Purpose**: Service status card widget
**Exports**:
- `CompactServiceCard`: Tkinter Frame showing service status

**Features**:
- Icon and service name display
- Color-coded status indicator (online/warning/offline)
- Start button (if service has start command)
- Quick links (Local, Domain)

**Usage**:
```python
from monitor.ui.components import CompactServiceCard

card = CompactServiceCard(
    parent=frame,
    service=SERVICES[0],
    start_callback=lambda s: start_service(s)
)
card.pack()
card.update_status("online", "127ms")
```

#### `ui/components/workflow_canvas.py`
**Purpose**: Node-based workflow visualization
**Exports**:
- `WorkflowCanvas`: Tkinter Canvas with workflow nodes

**Features**:
- Node drawing with icons and labels
- Arrow connections between nodes
- Click event handling
- Node state management (enabled/disabled)
- Highlight animation on click

**Usage**:
```python
from monitor.ui.components import WorkflowCanvas

canvas = WorkflowCanvas(parent=frame, width=800, height=200)
canvas.pack()
canvas.update_node_state("start", enabled=True, color=NODE_ENABLED)
```

#### `ui/components/chart.py`
**Purpose**: Performance chart widget
**Exports**:
- `CompactChart`: Tkinter Canvas showing performance data

**Features**:
- Time-series line chart
- Automatic scaling
- Smooth curve interpolation
- Current value display
- Configurable max value and unit

**Usage**:
```python
from monitor.ui.components import CompactChart
from monitor.config import CHART_CPU

chart = CompactChart(
    parent=frame,
    title="CPU",
    color=CHART_CPU,
    unit="%",
    max_value=100.0
)
chart.pack()
chart.add_data(45.2)  # Add data point
```

---

## Dependency Graph

```
server_monitor_v6.py
    └── monitor.models (SERVICES)
    └── monitor.ui.dashboard (RoutingMLDashboard)
            ├── monitor.config (all constants)
            ├── monitor.models (Service)
            ├── monitor.utils (blend_color)
            ├── monitor.api
            │   ├── monitor.api.client (ApiClient)
            │   └── monitor.api.errors (ApiError)
            ├── monitor.services
            │   └── monitor.services.checker (check_service)
            └── monitor.ui.components
                ├── service_card (CompactServiceCard)
                ├── workflow_canvas (WorkflowCanvas)
                └── chart (CompactChart)
```

**Key Design Principles**:
- No circular dependencies
- Clear dependency hierarchy
- Config and models have no internal dependencies
- UI layer depends on all other layers
- API and services layers are independent

---

## Import Conventions

### Recommended Import Style

```python
# Core modules
from monitor.config import __version__, BG_PRIMARY, TEXT_SECONDARY
from monitor.models import Service, SERVICES
from monitor.utils import blend_color

# API layer
from monitor.api import ApiClient, ApiError

# Services layer
from monitor.services import check_service

# UI layer
from monitor.ui.dashboard import RoutingMLDashboard
from monitor.ui.components import CompactServiceCard, WorkflowCanvas, CompactChart
```

### Alternative Import Style

```python
# Import entire modules
import monitor.config as config
import monitor.models as models

# Use with module prefix
print(config.__version__)
for service in models.SERVICES:
    print(service.name)
```

---

## Testing

### Unit Testing

Each module can be tested independently:

```python
# Test config module
from monitor.config import __version__
assert __version__ == "6.0.0"

# Test models module
from monitor.models import SERVICES
assert len(SERVICES) == 4
assert SERVICES[0].key == "backend"

# Test utils module
from monitor.utils import blend_color
result = blend_color("#ff0000", "#00ff00", 0.5)
assert result == "#7f7f00"

# Test API error handling
from monitor.api import ApiError
try:
    raise ApiError("Test error")
except ApiError as e:
    assert str(e) == "Test error"
```

### Integration Testing

```python
# Test service checking
from monitor.models import SERVICES
from monitor.services import check_service

state, message = check_service(SERVICES[0])
assert state in ["online", "warning", "offline"]
assert isinstance(message, str)
```

---

## Extension Points

### Adding New Services

Edit `monitor/models.py`:

```python
SERVICES: Tuple[Service, ...] = (
    # ... existing services ...
    Service(
        key="new_service",
        name="New Service",
        icon="🆕",
        check_url="https://localhost:9000/health",
        start_command="run_new_service.bat",
        links=(
            ("Local", "https://localhost:9000"),
        ),
    ),
)
```

### Adding New UI Components

Create `monitor/ui/components/new_component.py`:

```python
"""
New UI component
"""

import tkinter as tk
from monitor.config import BG_PRIMARY, TEXT_PRIMARY

class NewComponent(tk.Frame):
    """Description of new component"""

    def __init__(self, parent):
        super().__init__(parent, bg=BG_PRIMARY)
        # Component implementation
```

Update `monitor/ui/components/__init__.py`:

```python
from monitor.ui.components.new_component import NewComponent

__all__ = [..., "NewComponent"]
```

### Adding New Configuration

Edit `monitor/config.py`:

```python
# Add new constant
NEW_SETTING = os.getenv("NEW_SETTING", "default_value")
```

---

## Performance Considerations

### Module Import Time
- Total import time for full application: ~0.5-1.0 seconds
- Core modules (config, models, utils): <0.1 seconds
- UI modules load on-demand

### Memory Footprint
- Base package (no UI): ~5 MB
- Full application with UI: ~30-40 MB
- Similar to v5 monolithic version

### Code Organization Benefits
- **Faster development**: Easier to locate and modify specific functionality
- **Better IDE support**: Smaller files = better autocomplete and navigation
- **Easier debugging**: Isolated modules simplify troubleshooting
- **Team collaboration**: Multiple developers can work on different modules

---

## Backward Compatibility

### Legacy Entry Point

The original `server_monitor_dashboard_v5_1.py` is preserved and still functional:

```bash
# Run v5 (monolithic)
python scripts/server_monitor_dashboard_v5_1.py

# Run v6 (modular)
python scripts/server_monitor_v6.py
```

Both versions can coexist in the same codebase.

---

## Build and Deployment

### PyInstaller Build

```bash
# Build using spec file
pyinstaller RoutingMLMonitor_v6.0.0.spec

# Or use build script
build_monitor_v6.bat
```

**Output**: `dist/RoutingMLMonitor_v6.0.0.exe`

### Hidden Imports

The spec file explicitly lists all monitor submodules to ensure they're included:

```python
hiddenimports=[
    'monitor',
    'monitor.config',
    'monitor.models',
    # ... all submodules ...
]
```

---

## Maintenance Guide

### Adding Features
1. Identify appropriate module (or create new one)
2. Implement feature following existing patterns
3. Update `__init__.py` if adding new exports
4. Add tests
5. Update documentation

### Refactoring
1. Maintain existing public APIs
2. Update imports if moving code between modules
3. Run full test suite
4. Update this document

### Version Updates
1. Update `monitor/config.py` → `__version__`
2. Update `monitor/config.py` → `__build_date__`
3. Create new PyInstaller spec file
4. Update build scripts

---

## Troubleshooting

### Import Errors

**Problem**: `ModuleNotFoundError: No module named 'monitor'`

**Solution**: Ensure you're running from the correct directory:
```bash
cd scripts
python server_monitor_v6.py
```

### PyInstaller Build Failures

**Problem**: Module not found in built executable

**Solution**: Add to `hiddenimports` in spec file

### Missing Constants

**Problem**: `NameError: name 'SOME_CONSTANT' is not defined`

**Solution**: Add import in `monitor/config.py` and update imports

---

## Related Documentation

- [Migration Guide](../migration/monitor-v5-to-v6-migration.md)
- [PRD: Monitor App Modularization](../planning/PRD_monitor_app_modularization.md)
- [Work History: Phases 1-3](../work-history/2025-10-20-monitor-modularization-phases-1-3.md)

---

**Last Updated**: 2025-10-20
**Maintainer**: Routing ML Team
**Version**: 6.0.0
