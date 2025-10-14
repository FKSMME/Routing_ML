# Routing ML Service Monitor - Build Guide

## Version 4.0.0 - Cyberpunk Edition

This guide explains how to build the Routing ML Service Monitor executable files.

---

## Overview

The Routing ML Service Monitor can be built in two different configurations:

1. **Portable Executable** - Single `.exe` file that runs standalone
2. **Installer Package** - Directory-based installation with faster startup

---

## Prerequisites

### System Requirements
- Windows 10/11 (x64)
- Python 3.11 or higher
- 4GB RAM minimum
- 500MB free disk space (for build process)

### Required Software
- Git (for version control)
- Python 3.11+ with pip
- Virtual environment (`.venv`)

---

## Setup Build Environment

### 1. Clone Repository
```bash
git clone <repository-url>
cd Routing_ML_251014
```

### 2. Create Virtual Environment
```bash
python -m venv .venv
```

### 3. Activate Virtual Environment
```bash
.venv\Scripts\activate
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
pip install pyinstaller psutil
```

---

## Build Types

### Build Type 1: Portable Executable (Recommended for Testing)

#### Description
- Single `.exe` file
- No installation required
- Extracts to temp directory on each run
- Slightly slower startup (extraction overhead)
- Perfect for: Testing, portable deployment, USB drives

#### Build Command
```bash
deploy\build_server_monitor_exe.bat
```

#### Output
```
dist\RoutingMLMonitor_v4.0.0.exe
```

#### File Size
Approximately 25-35 MB (single file)

#### Usage
1. Copy `dist\RoutingMLMonitor_v4.0.0.exe` to any location
2. Double-click to run
3. No installation needed

---

### Build Type 2: Installer Package (Recommended for Production)

#### Description
- Directory with executable and dependencies
- No extraction needed (faster startup)
- Better for permanent installation
- Can be zipped for distribution

#### Build Command
```bash
deploy\build_server_monitor_installer.bat
```

#### Output
```
dist\RoutingMLMonitor_v4.0.0\
├── RoutingMLMonitor_v4.0.0.exe
├── (various DLL files)
└── (dependency folders)
```

#### Total Size
Approximately 30-40 MB (entire folder)

#### Usage
1. Copy entire `dist\RoutingMLMonitor_v4.0.0\` folder to installation location
2. Create shortcut to `RoutingMLMonitor_v4.0.0.exe`
3. Run from shortcut or directly

---

## Build Process Details

### Step-by-Step Build Process

#### For Portable EXE:
1. Navigate to project root
2. Ensure `.venv` is created and activated
3. Run: `deploy\build_server_monitor_exe.bat`
4. Wait for PyInstaller to complete (2-5 minutes)
5. Find output in `dist\RoutingMLMonitor_v4.0.0.exe`

#### For Installer Package:
1. Navigate to project root
2. Ensure `.venv` is created and activated
3. Run: `deploy\build_server_monitor_installer.bat`
4. Wait for PyInstaller to complete (2-5 minutes)
5. Find output in `dist\RoutingMLMonitor_v4.0.0\` folder

### Build Artifacts

After building, you'll see these directories:

```
Routing_ML_251014\
├── build\              # Temporary build files (can be deleted)
├── dist\               # Output executables (distribute this)
│   ├── RoutingMLMonitor_v4.0.0.exe           # Portable version
│   └── RoutingMLMonitor_v4.0.0\              # Installer version
│       ├── RoutingMLMonitor_v4.0.0.exe
│       └── ...
└── ...
```

### Cleaning Build Artifacts

To clean build artifacts before rebuilding:
```bash
rmdir /s /q build dist
```

Both build scripts automatically run with `--clean` flag.

---

## Version Management

### Updating Version

To release a new version:

1. **Update version in source code**
   - Edit `scripts\server_monitor_dashboard.py`
   - Change `__version__`, `__build_date__`, etc.

```python
__version__ = "4.1.0"
__build_date__ = "2025-10-15"
```

2. **Update spec files**
   - Edit `RoutingMLMonitor.spec`
   - Edit `RoutingMLMonitor_Installer.spec`
   - Update version numbers and dates

3. **Update VERSION.txt**
   - Add release notes for new version
   - Document new features, bug fixes

4. **Rebuild executables**
   ```bash
   deploy\build_server_monitor_exe.bat
   deploy\build_server_monitor_installer.bat
   ```

5. **Tag release in Git**
   ```bash
   git tag -a v4.1.0 -m "Release version 4.1.0"
   git push origin v4.1.0
   ```

---

## Distribution

### Creating Distribution Package

#### Option 1: Portable EXE
1. Build portable executable
2. Copy `dist\RoutingMLMonitor_v4.0.0.exe`
3. Distribute single file via:
   - Email attachment
   - Shared drive
   - USB drive
   - Cloud storage

#### Option 2: Installer Package (Zipped)
1. Build installer package
2. Navigate to `dist\`
3. Right-click `RoutingMLMonitor_v4.0.0\` folder
4. Send to > Compressed (zipped) folder
5. Distribute `RoutingMLMonitor_v4.0.0.zip`

#### Option 3: Professional Installer (Advanced)
Create a proper installer using:
- **Inno Setup** (free, recommended)
- **NSIS** (free)
- **Advanced Installer** (paid)

---

## Troubleshooting

### Build Fails: "PyInstaller not found"
**Solution:**
```bash
.venv\Scripts\pip install pyinstaller
```

### Build Fails: "psutil not found"
**Solution:**
```bash
.venv\Scripts\pip install psutil
```

### EXE doesn't start: "VCRUNTIME140.dll missing"
**Solution:**
Install Microsoft Visual C++ Redistributable:
- Download from: https://aka.ms/vs/17/release/vc_redist.x64.exe
- Install on target machine

### EXE starts but crashes immediately
**Solution:**
1. Try running from command prompt to see error messages:
   ```bash
   dist\RoutingMLMonitor_v4.0.0.exe
   ```
2. Check Windows Event Viewer for crash details
3. Ensure all dependencies are in spec file

### Build is very slow
**Solutions:**
- Use SSD instead of HDD
- Disable antivirus temporarily during build
- Close other applications
- Increase virtual memory

### File size too large
**Solutions:**
- Check spec file excludes unused libraries
- Use UPX compression (already enabled)
- Remove debug symbols (already done)

---

## Advanced Configuration

### Customizing Icon

1. Create or obtain `.ico` file (256x256 recommended)
2. Save as `icon.ico` in project root
3. Edit spec files:
```python
icon='icon.ico',
```

### Including Additional Data Files

Edit spec files to include data files:
```python
datas=[
    ('config.json', '.'),
    ('assets/', 'assets/'),
],
```

### Optimizing Startup Time

For installer package:
- Already optimized (no extraction)
- Ensure antivirus excludes executable
- Use SSD for installation

For portable EXE:
- Consider using installer package instead
- Minimize `hiddenimports` in spec file

---

## Testing Built Executables

### Pre-Distribution Checklist

- [ ] Executable runs without errors
- [ ] All tabs load correctly
- [ ] Service monitoring works
- [ ] Performance charts display
- [ ] Log viewer functions
- [ ] User management operates
- [ ] Version number displays correctly
- [ ] Services start/stop properly
- [ ] No console windows appear
- [ ] Tested on clean Windows machine

### Test on Different Machines

1. Test on development machine
2. Test on clean Windows 10 machine
3. Test on clean Windows 11 machine
4. Test with different user permissions
5. Test with antivirus enabled

---

## Deployment Checklist

### Before Release

- [ ] Version numbers updated everywhere
- [ ] VERSION.txt updated with release notes
- [ ] Both build types tested
- [ ] Documentation updated
- [ ] Git tagged with version
- [ ] Changelog updated
- [ ] Known issues documented

### Release Process

1. Build both versions
2. Test thoroughly
3. Create distribution packages
4. Update documentation
5. Tag in Git
6. Distribute to users
7. Monitor for issues

---

## Additional Resources

- PyInstaller Documentation: https://pyinstaller.org/
- Spec File Reference: https://pyinstaller.org/en/stable/spec-files.html
- Troubleshooting Guide: https://pyinstaller.org/en/stable/when-things-go-wrong.html

---

## Support

For build-related issues:
- Check troubleshooting section above
- Review PyInstaller logs in `build/` directory
- Contact development team
- Open GitHub issue

---

**Build Date:** 2025-10-14
**Document Version:** 1.0
**Author:** Routing ML Team
