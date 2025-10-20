# Checklist: Timeline Wire Connections (Phase 5)

**Date**: 2025-10-20
**PRD**: [PRD_2025-10-20_timeline-wire-connections.md](./PRD_2025-10-20_timeline-wire-connections.md)

---

## Progress Overview

- **Total Tasks**: 45
- **Completed**: 0
- **In Progress**: 0
- **Pending**: 45

---

## Phase 5.1: Wire Rendering (12 tasks)

### Data Model Design
- [ ] Define `NodeConnection` interface in types
- [ ] Extend `TimelineStep` interface with connection fields
- [ ] Add connection types to routingStore state
- [ ] Test connection type definitions

### State Management
- [ ] Add `connections` array to routingStore
- [ ] Add `selectedConnectionId` state
- [ ] Implement `addConnection` action
- [ ] Implement `removeConnection` action
- [ ] Implement `updateConnection` action
- [ ] Implement `setSelectedConnection` action
- [ ] Implement `autoGenerateConnections` function
- [ ] Test state actions with mock data

### Wire Component
- [ ] Create `TimelineWire.tsx` component
- [ ] Add SVG overlay to TimelinePanel
- [ ] Implement wire path calculation (Bezier curve)
- [ ] Render wires for sequential timeline nodes
- [ ] Test wire rendering with 3-5 nodes

---

## Phase 5.2: Basic Interaction (8 tasks)

### Wire Selection
- [ ] Add click handler to wire SVG paths
- [ ] Update selectedConnectionId on wire click
- [ ] Add selected state styling (highlighted color)
- [ ] Show draggable handles on selected wire
- [ ] Test wire selection with mouse clicks

### Wire Deletion
- [ ] Add keyboard event listener for Delete key
- [ ] Implement wire deletion on Delete key press
- [ ] Add confirmation modal for deletion
- [ ] Update timeline state after deletion
- [ ] Test wire deletion flow

---

## Phase 5.3: Drag-and-Drop (15 tasks)

### Drag Setup
- [ ] Add drag event handlers to wire endpoints
- [ ] Create draggable handle components (circles)
- [ ] Implement `onDragStart` handler
- [ ] Store dragging state in component

### Temporary Wire During Drag
- [ ] Create `TemporaryWire` component
- [ ] Track mouse position during drag
- [ ] Render temporary wire from source to cursor
- [ ] Style temporary wire (dashed, semi-transparent)
- [ ] Test temporary wire follows cursor smoothly

### Node Ports
- [ ] Add output port to right side of timeline nodes
- [ ] Add input port to left side of timeline nodes
- [ ] Style ports (circles, 8px diameter)
- [ ] Add hover effect to ports (scale, color change)
- [ ] Test port visibility and hover states

### Drop Target Validation
- [ ] Implement drop target detection (mouse over port)
- [ ] Highlight valid drop targets (green glow)
- [ ] Show invalid drop targets (red or disabled)
- [ ] Implement snap-to-port animation
- [ ] Test drop target feedback

### Connection Creation
- [ ] Implement `onDrop` handler
- [ ] Validate drop target (not same node, not duplicate)
- [ ] Create new connection in store
- [ ] Update wire rendering
- [ ] Show toast notification on success/failure
- [ ] Test connection creation with various scenarios

---

## Phase 5.4: Connection Management (5 tasks)

### State Persistence
- [ ] Store connections alongside timeline in routingStore
- [ ] Persist connections when saving routing group
- [ ] Load connections when loading routing group
- [ ] Test save/load cycle preserves connections

### Validation
- [ ] Validate no self-connections (source !== target)
- [ ] Validate no duplicate connections
- [ ] Prevent cyclic connections (optional)
- [ ] Show validation errors to user
- [ ] Test validation with edge cases

---

## Phase 5.5: Timeline-Recommendation Sync (5 tasks)

### Analysis
- [ ] Read TimelinePanel component to understand current state
- [ ] Read Recommendation-related components
- [ ] Identify data source discrepancies
- [ ] Document current sync issues

### Implementation
- [ ] Unify data source to timeline state
- [ ] Update Recommendation panel to read from timeline
- [ ] Test nodes added to Timeline appear in Recommendation
- [ ] Test changes sync bidirectionally
- [ ] Verify no duplicate nodes

---

## Testing & Quality (0 tasks - continuous)

### Manual Testing
- Manual test with 3 nodes
- Manual test with 10 nodes
- Manual test with 50 nodes
- Test drag-and-drop accuracy
- Test wire deletion
- Test connection persistence
- Cross-browser testing (Chrome, Firefox, Edge)

### Bug Fixes
- Fix any rendering issues
- Fix any interaction bugs
- Fix any state management issues

---

## Documentation (0 tasks - final step)

- Update component documentation
- Add JSDoc comments to new functions
- Update README with wire connection feature
- Create user guide for wire editing

---

## Notes

- **Priority**: Focus on Phase 5.1 first (wire rendering)
- **Performance**: Monitor render performance with many wires
- **UX**: Get user feedback after Phase 5.2 before continuing
- **Complexity**: Phase 5.3 is most complex, budget extra time

---

**Last Updated**: 2025-10-20
