# Environment Setup Fix Guide

Based on environment diagnostic results from 2025-10-15

## Critical Issues Identified

### 1. Python Package Conflicts (Global vs Virtual Environment)

**Problem**:
- Global Python 3.12.6 has many conflicting packages
- Multiple version conflicts detected:
  - `pyxnat` → requires `pathlib` (metadata conflict)
  - `google-cloud-documentai` → requires `protobuf 3.x`, found `5.27.2`
  - `selenium` → requires `urllib3[socks]>=2.5.0`, found `2.3.0`
  - `tensorflow-cpu` → requires `ml-dtypes>=0.5.1`, found `0.4.1`
  - `tensorflow-cpu` → requires `tensorboard~=2.19.0`, found `2.18.0`

**Solution**:
```bat
REM 1. Activate project virtual environment
cd c:\Users\syyun\Documents\GitHub\Routing_ML_251014
.venv\Scripts\activate

REM 2. Reinstall requirements with clean state
pip install --upgrade pip
pip install -r requirements.txt

REM 3. Verify no conflicts
pip check
```

### 2. Console Encoding Issues (CP949 → UTF-8)

**Problem**:
- PowerShell code page is 949 (ANSI)
- `pip show` commands fail with `UnicodeEncodeError`
- Script emoji output fails

**Solution - Temporary (Per Session)**:
```powershell
chcp 65001
```

**Solution - Permanent (Environment Variables)**:
```powershell
# Run in PowerShell as Administrator
[System.Environment]::SetEnvironmentVariable('PYTHONUTF8', '1', 'User')
[System.Environment]::SetEnvironmentVariable('PYTHONIOENCODING', 'utf-8', 'User')
```

### 3. MSSQL Connection Failure

**Problem**:
- Cannot connect to `prod-db.internal,14330`
- Network/DNS/Firewall issue

**Diagnostic Commands**:
```powershell
# Test hostname resolution
nslookup prod-db.internal

# Test port connectivity
Test-NetConnection -ComputerName prod-db.internal -Port 14330

# Ping test
ping prod-db.internal
```

**Possible Solutions**:
1. Verify VPN connection if required
2. Check Windows Firewall rules
3. Verify correct hostname in `.env` file
4. Check if database server is accessible from current network
5. Verify ODBC driver configuration

### 4. pytest SQLite Path Issue

**Problem**:
- `pytest` execution blocked by SQLite file path/permission errors

**Solution**:
```bat
REM 1. Check SQLite database permissions
dir /a data\

REM 2. Create missing directories
if not exist "data" mkdir data

REM 3. Run pytest with verbose output to identify exact error
.venv\Scripts\python.exe -m pytest -v --tb=short

REM 4. If permission denied, run cmd as Administrator
```

### 5. Node.js Version Compatibility

**Current**: Node 22.18.0 (too new)
**Recommended**: Node 20.x LTS for better compatibility

**Check if issues occur**:
```bat
node -v
npm -v

REM If problems occur, consider downgrading to LTS
REM Download from: https://nodejs.org/en/download/
```

## Quick Fix Script

Create `setup_environment.bat`:

```bat
@echo off
REM ============================================================================
REM Environment Setup Fix Script
REM ============================================================================

echo Setting UTF-8 encoding...
chcp 65001 >nul

cd /d "%~dp0"

echo.
echo [1/5] Activating virtual environment...
call .venv\Scripts\activate

echo.
echo [2/5] Upgrading pip...
python -m pip install --upgrade pip

echo.
echo [3/5] Installing requirements...
pip install -r requirements.txt

echo.
echo [4/5] Checking for conflicts...
pip check

echo.
echo [5/5] Verifying installation...
python -c "import fastapi, uvicorn, sqlalchemy; print('Core packages OK')"

echo.
echo ============================================================================
echo Setup complete!
echo ============================================================================
echo.
echo Next steps:
echo   1. Set environment variables for UTF-8: setx PYTHONUTF8 1
echo   2. Verify database connectivity: python scripts/check_odbc.py
echo   3. Run tests: pytest
echo.

pause
```

## Verification Checklist

After running fixes, verify:

- [ ] Virtual environment activated (`.venv\Scripts\activate`)
- [ ] No package conflicts (`pip check` returns clean)
- [ ] UTF-8 encoding working (`python -c "print('✅ UTF-8 OK')"`)
- [ ] MSSQL connection works (`python scripts/check_odbc.py`)
- [ ] Tests run successfully (`pytest --maxfail=1 -q`)
- [ ] Backend starts without errors (`run_backend_main.bat`)
- [ ] Frontend builds successfully (`cd frontend-prediction && npm run dev`)

## Long-term Recommendations

1. **Always use virtual environment** - Never install packages globally
2. **UTF-8 by default** - Set `PYTHONUTF8=1` and `PYTHONIOENCODING=utf-8`
3. **Node LTS version** - Use Node 20.x instead of 22.x for stability
4. **Regular cleanup** - Run `pip check` after each package installation
5. **Database access** - Ensure VPN/network access before running services

## References

- [Python UTF-8 Mode](https://docs.python.org/3/using/cmdline.html#envvar-PYTHONUTF8)
- [Virtual Environments](https://docs.python.org/3/library/venv.html)
- [Node.js LTS Schedule](https://github.com/nodejs/release#release-schedule)
