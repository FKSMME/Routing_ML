# -*- mode: python ; coding: utf-8 -*-
# Routing ML Monitor v5.0.0 - Modern UI - PyInstaller Spec File
# Build Date: 2025-01-15
# Design: Material Design 3 + Fluent Design

from PyInstaller.utils.hooks import collect_submodules, collect_dynamic_libs

block_cipher = None

# Collect psutil dependencies
psutil_hidden = collect_submodules('psutil')
psutil_binaries = collect_dynamic_libs('psutil')

a = Analysis(
    ['scripts\\server_monitor_dashboard_v2.py'],
    pathex=[],
    binaries=psutil_binaries,
    datas=[],
    hiddenimports=psutil_hidden + [
        'tkinter',
        'tkinter.ttk',
        'urllib.request',
        'urllib.error',
        'urllib.parse',
        'socket',
        'threading',
        'queue',
        'json',
        'subprocess',
        'os',
        'webbrowser',
        'collections',
        'dataclasses',
        'functools',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='MCS_Server_Dashboard_v5.0.0',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
    version='5.0.0',
)
