# Changelog

All notable changes to the Routing ML project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [5.2.4] - 2025-10-20

### Added
- ✨ **Hyperspeed 3D Animation Background** to login pages
  - 6 customizable theme presets (Cyberpunk, Akira, Golden, Split, Highway, Matrix)
  - Real-time theme switching with dropdown selector
  - Three.js based WebGL particle rendering
  - Trail effects and dynamic camera movement
  - Responsive design with auto-resize
  - Performance optimizations (pixel ratio limiting, additive blending)
- 📦 New dependencies: `three@^0.170.0`, `postprocessing@^6.36.4`
- 📝 Comprehensive documentation:
  - `docs/features/hyperspeed-animation-guide.md`
  - `docs/releases/RELEASE_v5.2.4.md`
  - `docs/CHANGELOG.md` (this file)

### Changed
- 🔄 Updated Server Monitor to v5.2.4
- 🔄 Updated build date to 2025-10-20
- 🔄 Replaced `FullScreen3DBackground` with `HyperspeedBackground` in login pages
- 🔄 Updated `RoutingMLMonitor.spec` to build v5.2.4

### Fixed
- 🐛 **Critical**: Fixed server stop functionality in Server Monitor
  - Fixed `NameError: name 'expanded_pids' is not defined`
  - Changed variable reference from `expanded_pids` to `candidate_pids`
  - Location: `scripts/server_monitor_dashboard_v5_1.py:732`
- 🐛 Fixed TypeScript compilation errors in Hyperspeed components
  - Removed unused `EffectComposer` import and variable
  - Clean compilation with zero errors

### Removed
- ❌ Deleted entire `electron-app/` directory (legacy code cleanup)
  - electron-app/README.md
  - electron-app/main.js
  - electron-app/package.json
  - electron-app/package-lock.json
  - electron-app/preload.js
  - electron-app/renderer.js
  - electron-app/start.bat
- ❌ Removed `BackgroundControls` component from login pages

### Technical
- 📦 Built `RoutingMLMonitor_v5.2.4.exe` (12 MB)
- 🔧 PyInstaller 6.16.0, Python 3.12.6
- 🚀 68 files changed: +3,624 insertions, -5,557 deletions
- 🔀 Merged to main branch (commit: 49b820c9)

---

## [5.2.3] - 2025-10-17

### Added
- 🔒 HTTPS support for all services
- 📜 SSL certificate configuration with rtml.ksm.co.kr
- 📝 HTTPS certificate installation guide
- 📝 Port forwarding guide for standard HTTPS (443)

### Changed
- 🔄 Updated all service URLs to use HTTPS
- 🔄 Modified batch files to include SSL options
- 🔄 Updated START_ALL_WINDOWS.bat for HTTPS

### Fixed
- 🐛 Fixed environment variable order in batch files
- 🐛 Fixed Frontend Home HTTPS configuration

---

## [5.2.2] - 2025-10-16

### Added
- 🎨 Enhanced UI/UX improvements
- 📊 Workflow graph visualization enhancements

### Changed
- 🔄 Updated server monitor dashboard design

---

## [5.2.0] - 2025-10-15

### Added
- 🚀 Initial release of Server Monitor v5.2.0
- 📊 Real-time service monitoring
- 🎯 4-service dashboard (Backend, Home, Routing, Training)
- 📈 Performance charts (CPU, Memory, Response Time, Disk)
- 👥 User management tab
- 🎨 GitHub Dark + Material Design 3 theme
- 🔄 Workflow node visualization

### Technical
- 🐍 Python 3.12.6
- 📦 PyInstaller 6.16.0
- 🪟 Windows 11 compatibility

---

## Legend

- ✨ New features
- 🔄 Changes
- 🐛 Bug fixes
- ❌ Removals
- 🔒 Security
- 📝 Documentation
- 🎨 UI/UX
- 📦 Dependencies
- 🔧 Technical
- 🚀 Deployment
- 📊 Data/Analytics
- 👥 User management
- 🔀 Git operations

---

**Maintained by**: Routing ML Team
**Contact**: syyun@ksm.co.kr
**License**: © 2025 KSM. All rights reserved.
