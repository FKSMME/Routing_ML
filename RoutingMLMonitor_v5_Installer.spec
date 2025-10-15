# -*- mode: python ; coding: utf-8 -*-
# MCS Server Dashboard v5.0.0 - Installer Edition
# PyInstaller Spec File for Directory-based Distribution
# Build Date: 2025-01-15

from PyInstaller.utils.hooks import collect_submodules, collect_dynamic_libs
import os

block_cipher = None

# Collect psutil dependencies
psutil_hidden = collect_submodules('psutil')
psutil_binaries = collect_dynamic_libs('psutil')

a = Analysis(
    ['scripts\\server_monitor_dashboard_v2.py'],
    pathex=[],
    binaries=psutil_binaries,
    datas=[
        ('VERSION.txt', '.'),
        ('DASHBOARD_V5_RELEASE_NOTES.md', 'docs'),
    ],
    hiddenimports=psutil_hidden + [
        'tkinter',
        'tkinter.ttk',
        'tkinter.filedialog',
        'tkinter.messagebox',
        'tkinter.simpledialog',
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
        'time',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'PIL',
        'wx',
    ],
    noarchive=False,
    optimize=2,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='MCS_Server_Dashboard',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='MCS_Server_Dashboard_v5.0.0',
)
