# -*- mode: python ; coding: utf-8 -*-
# Routing ML Auto-Generation System Monitor v5.1.0 - Installer
# Node-based Workflow + Compact Design

from PyInstaller.utils.hooks import collect_submodules, collect_dynamic_libs

block_cipher = None

psutil_hidden = collect_submodules('psutil')
psutil_binaries = collect_dynamic_libs('psutil')

a = Analysis(
    ['scripts\\server_monitor_dashboard_v5_1.py'],
    pathex=[],
    binaries=psutil_binaries,
    datas=[
        ('VERSION.txt', '.'),
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
    name='RoutingML_AutoGen',
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
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='RoutingML_AutoGen_v5.1.0',
)
