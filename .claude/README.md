# Claude Code Workflow Configuration

This directory contains workflow directives and configurations for Claude Code operations.

---

## Absolute Directive

**ALL TASKS** must follow the workflow defined in:

📋 **[WORKFLOW_DIRECTIVES.md](.claude/WORKFLOW_DIRECTIVES.md)**

This is an **ABSOLUTE REQUIREMENT** with **NO EXCEPTIONS**.

---

## Key Requirements

### Every Task Must:

1. ✅ Start with PRD creation (`docs/planning/PRD_*.md`)
2. ✅ Create Checklist (`docs/planning/CHECKLIST_*.md`)
3. ✅ Execute tasks sequentially
4. ✅ Update checkboxes `[ ]` → `[x]` immediately after each task
5. ✅ **Immediately before any Git workflow step (commit / push / merge), run the Monitor build validation sequence:**
   - `.\.venv\Scripts\python.exe -m PyInstaller --clean --noconfirm RoutingMLMonitor_v5.2.5.spec`
   - Ensure `deploy\build_monitor_v5.bat` reads the script version and outputs `RoutingMLMonitor_v5.2.5.exe`
   - For quick verification, run `.\.venv\Scripts\python.exe scripts\server_monitor_dashboard_v5_1.py`
6. ✅ Commit & merge to main after **each Phase**
7. ✅ Return to 251014 branch after merging
8. ✅ Continue until all checkboxes are `[x]`


---

## Enforcement

This workflow is **MANDATORY** and applies to:

- New features
- Bug fixes
- Refactoring
- Documentation
- Testing
- All code changes

**No exceptions allowed.**

---

## Reference

See [WORKFLOW_DIRECTIVES.md](WORKFLOW_DIRECTIVES.md) for complete details.
