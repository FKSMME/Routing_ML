## Phase 1 – Plan & Docs
- [x] Draft PRD (Est. 0.5h)  
  - Dependencies: None  
  - Acceptance: PRD includes all mandatory sections.
- [x] Draft Checklist (Est. 0.5h)  
  - Dependencies: PRD outline  
  - Acceptance: Checklist contains phases, estimates, dependencies, acceptance criteria, progress tracking template.

## Phase 2 – UI 문구 추가
- [ ] Audit home dashboard cards to confirm titles/data bindings (Est. 0.5h)  
  - Dependencies: Phase 1 complete  
  - Acceptance: Notes on each card’s metric definition.
- [ ] Implement supporting text components with design tokens (Est. 1.5h)  
  - Dependencies: Audit notes  
  - Acceptance: Text renders under each card, responsive and accessible.
- [ ] Copy review with stakeholders or design references (Est. 0.5h)  
  - Dependencies: Text implemented  
  - Acceptance: Final Korean copy confirmed/adjusted.

## Phase 3 – 금일 라우팅 데이터 연동
- [ ] Validate availability of API / create backend query for `dbo_ROUTING_HISTORY` (Est. 1.5h)  
  - Dependencies: Phase 2 implementation ready  
  - Acceptance: Confirmed endpoint or SQL that returns today’s counts.
- [ ] Integrate frontend data fetching and state update (Est. 1.5h)  
  - Dependencies: API contract finalized  
  - Acceptance: Card displays live count, handles loading/error.
- [ ] Unit/Integration tests or manual query validation (Est. 1.0h)  
  - Dependencies: Frontend integration  
  - Acceptance: Count matches manual DB check for sample date.

## Phase 4 – QA & 보고
- [ ] Run lint/build/test pipelines (Est. 0.5h)  
  - Dependencies: Phases 2-3 complete  
  - Acceptance: No blocking issues.
- [ ] Update documentation & summarize results (Est. 0.5h)  
  - Dependencies: QA complete  
  - Acceptance: Project notes updated, final report prepared.

## Progress Tracking

Phase 1: [##########] 100% (2/2 tasks)  
Phase 2: [          ] 0% (0/3 tasks)  
Phase 3: [          ] 0% (0/3 tasks)  
Phase 4: [          ] 0% (0/2 tasks)

Total: [##        ] 20% (2/10 tasks)
