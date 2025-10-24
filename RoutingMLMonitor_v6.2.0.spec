# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec file for Routing ML Monitor v6.2.0
# Modularized version using monitor package
# Removed all permission/admin rights checks - no permissions required

a = Analysis(
    ['scripts\\server_monitor_v6.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'monitor',
        'monitor.config',
        'monitor.models',
        'monitor.utils',
        'monitor.api',
        'monitor.api.client',
        'monitor.api.errors',
        'monitor.services',
        'monitor.services.checker',
        'monitor.ui',
        'monitor.ui.dashboard',
        'monitor.ui.components',
        'monitor.ui.components.service_card',
        'monitor.ui.components.workflow_canvas',
        'monitor.ui.components.chart',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='RoutingMLMonitor_v6.2.0',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='NONE',
)
