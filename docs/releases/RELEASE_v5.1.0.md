# Release Notes - v5.1.0

**Release Date:** 2025-10-15
**Build:** RoutingML_AutoGen_v5.1.0
**Type:** Major Update

---

## Overview

v5.1.0은 프로젝트명 변경, 노드 기반 워크플로우 시각화, 컴팩트한 4-컬럼 디자인 등 대규모 UI/UX 개선을 포함한 메이저 업데이트입니다.

## Project Rebranding

### Name Change
- **이전:** MCS Server Dashboard
- **이후:** 라우팅 자동생성 시스템 모니터 (Routing ML Auto-Generation System Monitor)

### File Naming
- **Portable:** `RoutingML_AutoGen_v5.1.0_Portable.exe`
- **Installer:** `RoutingML_AutoGen_v5.1.0/RoutingML_AutoGen.exe`

---

## New Features

### 1. Node-Based Workflow Visualization

시각적 워크플로우 캔버스가 추가되어 주요 작업을 노드 클릭으로 실행할 수 있습니다.

**Workflow Nodes:**
- 📁 **폴더 선택** - 프로젝트 폴더 선택
- ▶ **서버 시작** - 모든 서비스 일괄 시작
- ⏹ **서버 일괄 정지** - 모든 서비스 일괄 중지
- 🗑 **캐시 정리** - 캐시 및 임시 파일 정리

**Implementation:**
```python
class WorkflowCanvas(tk.Canvas):
    """Node-based workflow visualization"""
    def __init__(self, parent, width=800, height=200):
        # 4 workflow nodes with connecting arrows
        self.workflow_nodes = [
            {"id": "folder", "label": "📁\n폴더 선택", "color": NODE_DEFAULT},
            {"id": "start", "label": "▶\n서버 시작", "color": NODE_DEFAULT},
            {"id": "stop", "label": "⏹\n일괄 정지", "color": NODE_DEFAULT},
            {"id": "clear", "label": "🗑\n캐시 정리", "color": NODE_DEFAULT},
        ]
```

**Location:** [scripts/server_monitor_dashboard_v5_1.py:129-218](../scripts/server_monitor_dashboard_v5_1.py#L129-L218)

---

### 2. 4-Column Service Grid Layout

서비스 카드가 4개씩 가로로 배치되어 화면 공간을 효율적으로 사용합니다.

**Changes:**
- **이전:** 2-column grid with large cards
- **이후:** 4-column grid with compact cards

**Space Optimization:**
- Card padding: 20x16 → 12x10
- Icon size: 28pt → 20pt
- Title font: 14pt → 11pt
- Horizontal spacing: 10px → 6px

**Implementation:**
```python
def _create_services_section(self, parent):
    """Create services in 4-column grid"""
    columns = 4
    for index, service in enumerate(self.services):
        card = CompactServiceCard(services_frame, service)
        row = index // columns
        column = index % columns
        card.grid(row=row, column=column, padx=6, pady=6, sticky="nsew")
        services_frame.grid_columnconfigure(column, weight=1, uniform="service")
```

**Location:** [scripts/server_monitor_dashboard_v5_1.py:380-391](../scripts/server_monitor_dashboard_v5_1.py#L380-L391)

---

### 3. Single-Row Performance Charts

4개의 성능 차트가 단일 행에 표시됩니다.

**Charts:**
- **CPU** - CPU 사용률 (%)
- **메모리** - 메모리 사용률 (%)
- **응답시간** - API 응답시간 (ms)
- **디스크** - 디스크 사용률 (%)

**Changes:**
- **이전:** 2x2 grid (4 charts in 2 rows)
- **이후:** 1x4 grid (4 charts in single row)

**Implementation:**
```python
charts_config = [
    ("CPU", ACCENT_INFO, "%", 100.0),
    ("메모리", ACCENT_PRIMARY, "%", 100.0),
    ("응답시간", ACCENT_WARNING, "ms", 1000.0),
    ("디스크", ACCENT_SUCCESS, "%", 100.0),
]

for title, color, unit, max_val in charts_config:
    chart = CompactChart(row_frame, title, color, unit, max_val)
    chart.pack(side="left", fill="both", expand=True, padx=3)
```

**Location:** [scripts/server_monitor_dashboard_v5_1.py:410-428](../scripts/server_monitor_dashboard_v5_1.py#L410-L428)

---

### 4. Standard Windows Tab Design

표준 Windows 탭 디자인으로 변경되었습니다.

**Features:**
- 선택된 탭에 음영 효과 (elevation)
- 선택된 탭이 더 크게 표시
- 호버 시 배경색 변경
- 일반적인 Windows UI 패턴 준수

**Implementation:**
```python
style.configure('Custom.TNotebook.Tab',
               background=BG_SECONDARY,
               foreground=TEXT_SECONDARY,
               padding=[20, 10],
               font=('Segoe UI', 10, 'bold'),
               borderwidth=0)

style.map('Custom.TNotebook.Tab',
         background=[('selected', BG_TERTIARY), ('active', BG_ELEVATED)],
         foreground=[('selected', TEXT_PRIMARY), ('active', TEXT_PRIMARY)],
         expand=[('selected', [2, 2, 2, 2])])
```

**Location:** [scripts/server_monitor_dashboard_v5_1.py:117-126](../scripts/server_monitor_dashboard_v5_1.py#L117-L126)

---

### 5. Mouse Wheel Scrolling Support

마우스 휠 스크롤링이 작동합니다.

**Implementation:**
```python
def _on_mousewheel(event):
    canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

canvas.bind_all("<MouseWheel>", _on_mousewheel)
```

**Location:** [scripts/server_monitor_dashboard_v5_1.py:352-355](../scripts/server_monitor_dashboard_v5_1.py#L352-L355)

---

## Build System Improvements

### Automated Build Process

새로운 완전 자동화 빌드 스크립트가 추가되었습니다.

**Script:** [deploy/build_v5_1_complete.bat](../deploy/build_v5_1_complete.bat)

**Features:**
1. 기존 빌드를 `dist/old/` 폴더로 자동 이동
2. VERSION.txt 자동 업데이트
3. Portable 버전 빌드 (단일 실행 파일)
4. Installer 버전 빌드 (디렉토리 기반)
5. 상세한 진행 상황 출력

**Usage:**
```batch
deploy\build_v5_1_complete.bat
```

### PyInstaller Specs

**Portable Spec:** [RoutingMLMonitor_v5_1_Portable.spec](../RoutingMLMonitor_v5_1_Portable.spec)
- Single-file executable
- Bytecode optimization level: 2
- Output: `dist/RoutingML_AutoGen_v5.1.0_Portable.exe`

**Installer Spec:** [RoutingMLMonitor_v5_1_Installer.spec](../RoutingMLMonitor_v5_1_Installer.spec)
- Directory-based distribution
- Faster startup than portable
- Output: `dist/RoutingML_AutoGen_v5.1.0/`

---

## Build Artifacts

### Portable Version
- **File:** `dist/RoutingML_AutoGen_v5.1.0_Portable.exe`
- **Size:** 15.3 MB (16,075,179 bytes)
- **Type:** Single-file executable
- **Use Case:** Quick deployment, testing, portable usage

### Installer Version
- **Directory:** `dist/RoutingML_AutoGen_v5.1.0/`
- **Executable:** `RoutingML_AutoGen.exe`
- **Files:** 1,011 files
- **Use Case:** Permanent installation, faster startup

### Archived Builds
Old builds are automatically moved to `dist/old/`:
- `RoutingMLMonitor_v4.1.0.exe`
- `MCS_Server_Dashboard_v5.0.0_Portable.exe`

---

## Technical Details

### Environment
- **Python:** 3.12.6
- **PyInstaller:** 6.16.0
- **Platform:** Windows 11 (10.0.26100)
- **Optimization:** Level 2 bytecode optimization

### Dependencies
- psutil (system monitoring)
- tkinter (GUI framework, built-in)
- urllib (HTTP requests, built-in)
- threading (concurrent operations, built-in)
- json (configuration, built-in)
- subprocess (service management, built-in)

### UI Framework
- Material Design 3 color system
- Fluent Design elevation effects
- Segoe UI typography
- Custom Tkinter components

---

## Files Changed

### New Files
1. `scripts/server_monitor_dashboard_v5_1.py` - Main application with all new features
2. `deploy/build_v5_1_complete.bat` - Automated build script
3. `RoutingMLMonitor_v5_1_Portable.spec` - PyInstaller spec for portable
4. `RoutingMLMonitor_v5_1_Installer.spec` - PyInstaller spec for installer
5. `docs/releases/RELEASE_v5.1.0.md` - This release document

### Modified Files
1. `VERSION.txt` - Updated to 5.1.0 with new release notes

---

## Upgrade Guide

### From v5.0.0

1. **Backup your configuration:**
   ```
   Copy config/ folder to safe location
   ```

2. **Download v5.1.0:**
   - Portable: `dist/RoutingML_AutoGen_v5.1.0_Portable.exe`
   - Installer: `dist/RoutingML_AutoGen_v5.1.0/` directory

3. **Run the new version:**
   - Your previous settings will be preserved
   - Service configurations will be migrated automatically

4. **Explore new features:**
   - Try the workflow nodes for quick actions
   - Notice the more compact 4-column layout
   - Check out the single-row performance charts
   - Test the mouse wheel scrolling

---

## Known Issues

### Warnings During Build
- `cryptography.hazmat.backends.openssl`: ImportError warnings during PyInstaller build
  - **Impact:** None - warning only, does not affect functionality
  - **Reason:** Cryptography library compatibility check

- `numpy` hook import warning
  - **Impact:** None - numpy is not used by the application
  - **Reason:** PyInstaller hook detection

### Build Notes
- Build time: ~30-40 seconds for each version
- Temporary build artifacts stored in `build/` directory
- Cache cleaned automatically before each build

---

## Testing Checklist

- [x] Node-based workflow visualization renders correctly
- [x] All 4 workflow nodes clickable and functional
- [x] Service grid displays 4 columns
- [x] Compact cards show all information
- [x] Performance charts display in single row
- [x] Standard Windows tabs with elevation effect
- [x] Mouse wheel scrolling works
- [x] Portable executable runs standalone
- [x] Installer version runs from directory
- [x] Old builds moved to dist/old/ folder
- [x] VERSION.txt updated correctly

---

## Performance

### Startup Time
- **Portable:** ~2-3 seconds
- **Installer:** ~1-2 seconds

### Memory Usage
- **Idle:** ~80-100 MB
- **Active Monitoring:** ~120-150 MB

### Executable Size
- **Portable:** 15.3 MB (single file)
- **Installer:** ~40 MB (directory with 1,011 files)

---

## Credits

- **Development:** Routing ML Team
- **Design:** Material Design 3 + Fluent Design principles
- **Build System:** PyInstaller 6.16.0
- **Testing:** Windows 11 platform

---

## Next Steps

### Planned for v5.2.0
- Enhanced workflow automation
- Service dependency visualization
- Real-time log streaming
- Performance analytics dashboard
- Export/import configuration

### Feedback
Please report any issues or suggestions through the project's GitHub repository.

---

## License

Copyright (c) 2025 Routing ML Team. All rights reserved.

---

**End of Release Notes v5.1.0**
