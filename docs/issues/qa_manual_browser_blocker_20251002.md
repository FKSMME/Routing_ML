# Issue: Manual Browser QA Blocked (2025-10-02)

## Summary
Manual verification steps in `docs/sprint/routing_enhancement_qa.md` that require a Chrome 127+ browser at ≥1440px width could not be executed in the current CI/container environment. Only automated builds and test suites are available.

## Impacted Checklist Items
- Layout measurements for 20/60/20 columns at 1440px and 1280px breakpoints.
- Browser-based regression flows (`PredictionControls`, Metrics/Visualization panel, `WorkflowGraphPanel` navigation).
- API integration confirmation that requires UI-driven captures (dirty reset, ERP toggle payload captures, audit log sampling).

## Current Status
Automated build (`npm run build`), backend pytest suite, and frontend Vitest e2e scenarios all pass. Without a GUI-capable browser session, the remaining manual validations remain pending.

## Proposed Follow-up
1. Schedule a QA slot on a workstation with Chrome 127+ and 1440px+ resolution.
2. Capture screenshots/logs for each pending checklist item.
3. Attach outputs to `docs/sprint/routing_enhancement_qa.md` and close this issue.

## Owner / Next Action
- **Owner**: QA Ops (김서윤) / Engineering Support
- **Next Action**: Execute manual verification on physical lab device during the 2025-10-04 QA slot and update documentation accordingly.
