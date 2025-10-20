# PRD: Timeline Wire Connections (Phase 5)

**Date**: 2025-10-20
**Status**: Planning
**Priority**: High
**Complexity**: High

---

## 1. Overview

Implement drag-and-drop wire connections in the Timeline panel to visualize and edit routing sequences. Users should be able to see connections between process nodes, drag wire endpoints to reconnect nodes, and manage node relationships interactively.

---

## 2. User Requirements (Original)

> "Timeline이나 Recommendation에 후보공정노드를 추가할 수 있어야하는데, Timeline에는 추가 되는데 Recommendation에는 표현 안됨. 그리고 Timeline에는 라우팅 순서대로 노드가 연결되어야하고 추가된 노드는 내가 그 와이어 시작점과 끝점을 끌어서 수정, 노드끼리 연결, 해제 가능해야함"

**Translation**:
- Timeline should show nodes connected in routing sequence order
- Wire connections should be visible between sequential nodes
- Users should be able to drag wire start/end points to reconnect nodes
- Users should be able to connect/disconnect nodes
- Nodes added to Timeline should also appear in Recommendation panel

---

## 3. Goals

### Primary Goals
1. **Visual Wire Connections**: Display lines/wires connecting sequential nodes in Timeline
2. **Drag-and-Drop Editing**: Enable users to drag wire endpoints to change connections
3. **Connection Management**: Allow users to create new connections and remove existing ones
4. **Timeline-Recommendation Sync**: Ensure both panels show the same node data

### Secondary Goals
- Smooth animations for wire movements
- Visual feedback during drag operations
- Connection validation (prevent invalid connections)
- Undo/redo support for connection changes

---

## 4. User Stories

### Story 1: View Wire Connections
**As a** routing engineer
**I want to** see visual connections between process nodes in the Timeline
**So that** I can understand the routing sequence flow

**Acceptance Criteria**:
- Wires are drawn between consecutive nodes in the timeline
- Wire style clearly indicates direction (start → end)
- Wires are color-coded or styled to show connection type

### Story 2: Drag Wire Endpoints
**As a** routing engineer
**I want to** drag wire endpoints to reconnect nodes
**So that** I can quickly modify the routing sequence

**Acceptance Criteria**:
- Wire endpoints have draggable handles
- Dragging shows temporary wire position
- Dropping on a valid node creates new connection
- Invalid drop targets are visually indicated

### Story 3: Create New Connections
**As a** routing engineer
**I want to** connect nodes by dragging from one node to another
**So that** I can add new routing paths

**Acceptance Criteria**:
- Drag from node output port to node input port
- Visual line follows cursor during drag
- Connection created on successful drop
- Connection state persisted in store

### Story 4: Remove Connections
**As a** routing engineer
**I want to** delete wire connections
**So that** I can remove unnecessary routing paths

**Acceptance Criteria**:
- Click on wire to select it
- Delete key or context menu to remove
- Visual confirmation before deletion
- State updated in store

### Story 5: Timeline-Recommendation Sync
**As a** routing engineer
**I want to** see nodes added to Timeline also appear in Recommendation
**So that** I have consistent data across panels

**Acceptance Criteria**:
- Nodes added to Timeline automatically appear in Recommendation
- Recommendation panel shows same node sequence
- Changes in one panel reflect in the other
- No duplicate nodes between panels

---

## 5. Technical Requirements

### 5.1 Data Model

#### Connection Type
```typescript
interface NodeConnection {
  id: string;                    // Unique connection ID
  sourceNodeId: string;          // Source timeline step ID
  targetNodeId: string;          // Target timeline step ID
  sourcePort?: 'output';         // Source connection point
  targetPort?: 'input';          // Target connection point
  metadata?: {
    createdAt: string;
    createdBy: 'auto' | 'manual';
  };
}
```

#### Timeline Step Extension
```typescript
interface TimelineStep {
  // ... existing fields
  connections?: {
    incoming: string[];  // IDs of nodes connecting to this one
    outgoing: string[];  // IDs of nodes this one connects to
  };
}
```

### 5.2 State Management

Add to `routingStore.ts`:
```typescript
interface RoutingStoreState {
  // ... existing fields
  connections: NodeConnection[];
  selectedConnectionId: string | null;

  // Actions
  addConnection: (source: string, target: string) => void;
  removeConnection: (connectionId: string) => void;
  updateConnection: (connectionId: string, patch: Partial<NodeConnection>) => void;
  setSelectedConnection: (connectionId: string | null) => void;
  autoGenerateConnections: (timeline: TimelineStep[]) => void;
}
```

### 5.3 Wire Rendering

**Technology Options**:
1. **SVG** (Recommended)
   - Pros: Scalable, precise path control, easy event handling
   - Cons: Slight performance overhead for many wires

2. **Canvas**
   - Pros: High performance for many wires
   - Cons: More complex event handling, no built-in DOM events

**Decision**: Use SVG for better interactivity and maintainability

#### Wire Component
```typescript
interface WireProps {
  id: string;
  sourceNode: HTMLElement;
  targetNode: HTMLElement;
  selected?: boolean;
  dragging?: boolean;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
}
```

### 5.4 Drag-and-Drop Implementation

**Drag Sources**:
- Wire endpoints (circles/handles at start/end of wire)
- Node output port (right side of node card)

**Drop Targets**:
- Node input port (left side of node card)
- Timeline canvas (for repositioning)

**Drag Feedback**:
- Temporary wire follows cursor
- Valid drop targets highlighted (green glow)
- Invalid drop targets dimmed or crossed out
- Snap-to-port when hovering over valid target

### 5.5 Timeline-Recommendation Sync

Current state: Timeline and Recommendation use separate data sources from `routingStore`.

**Solution**:
- Both panels should read from `timeline` state
- Recommendation panel filters/groups timeline data
- Changes to timeline automatically update Recommendation
- No separate "recommendation" vs "timeline" data structure

---

## 6. UI/UX Design

### 6.1 Wire Appearance

**Default State**:
- Color: `rgba(148, 163, 184, 0.4)` (slate-400 with opacity)
- Width: 2px
- Style: Curved Bezier path
- Direction indicator: Arrow at target end

**Hover State**:
- Color: `rgba(56, 189, 248, 0.8)` (sky-400)
- Width: 3px
- Glow effect: `drop-shadow(0 0 4px rgba(56, 189, 248, 0.6))`

**Selected State**:
- Color: `rgb(56, 189, 248)` (sky-400 solid)
- Width: 3px
- Glow effect: `drop-shadow(0 0 8px rgba(56, 189, 248, 0.8))`
- Endpoints show draggable handles (circles)

**Dragging State**:
- Color: `rgba(125, 211, 252, 0.6)` (sky-300 with opacity)
- Width: 2px
- Dashed line style
- Follows cursor smoothly

### 6.2 Node Ports

**Output Port** (right side of node):
- Position: Center-right of node card
- Visual: Small circle, 8px diameter
- Color: `rgba(148, 163, 184, 0.5)`
- Hover: Scale to 12px, color `rgb(56, 189, 248)`

**Input Port** (left side of node):
- Position: Center-left of node card
- Visual: Small circle, 8px diameter
- Color: `rgba(148, 163, 184, 0.5)`
- Hover: Scale to 12px, color `rgb(34, 197, 94)` (green)

### 6.3 Interaction States

**Drag Start**:
1. User clicks on wire endpoint or node output port
2. Cursor changes to `grab` → `grabbing`
3. Temporary wire appears following cursor
4. Original wire dims to 50% opacity

**Drag Over Valid Target**:
1. Target port highlights with green glow
2. Snap-to-port animation (wire endpoint jumps to port center)
3. Target port scales to 14px

**Drag Over Invalid Target**:
1. Cursor changes to `not-allowed`
2. Temporary wire shows in red color
3. No snap effect

**Drop**:
1. If valid: New connection created, wire animates to final position
2. If invalid: Wire snaps back to original position
3. Toast notification: "Connection updated" or "Invalid connection"

---

## 7. Implementation Phases

### Phase 5.1: Wire Rendering
- [x] Design connection data model
- [ ] Add SVG overlay to Timeline panel
- [ ] Implement Wire component
- [ ] Auto-generate connections from timeline sequence
- [ ] Render wires for all sequential nodes

### Phase 5.2: Basic Interaction
- [ ] Add wire selection on click
- [ ] Show draggable handles on selected wire
- [ ] Implement wire deletion (Delete key)
- [ ] Visual feedback for hover/selection

### Phase 5.3: Drag-and-Drop
- [ ] Add drag handlers to wire endpoints
- [ ] Implement temporary wire during drag
- [ ] Add node input/output ports
- [ ] Highlight valid drop targets
- [ ] Create new connection on drop

### Phase 5.4: Connection Management
- [ ] Store connections in routingStore
- [ ] Persist connections with timeline
- [ ] Validate connections (no cycles, valid nodes)
- [ ] Undo/redo support

### Phase 5.5: Timeline-Recommendation Sync
- [ ] Analyze current Recommendation panel data source
- [ ] Unify data source to timeline state
- [ ] Update Recommendation to filter/display timeline nodes
- [ ] Test bidirectional sync

---

## 8. Success Metrics

### Functional Metrics
- [ ] Wires render correctly for all timeline nodes
- [ ] Drag-and-drop success rate > 95%
- [ ] Zero connection data loss on save/load
- [ ] Timeline-Recommendation sync accuracy 100%

### Performance Metrics
- [ ] Wire rendering < 16ms per frame (60 FPS)
- [ ] Drag response time < 50ms
- [ ] Handle up to 50 nodes with 49 connections without lag

### UX Metrics
- [ ] User can complete connection edit in < 5 seconds
- [ ] Clear visual feedback for all interaction states
- [ ] Intuitive drag-and-drop (no training required)

---

## 9. Risks and Mitigations

### Risk 1: Performance with Many Nodes
**Impact**: High
**Probability**: Medium
**Mitigation**:
- Use SVG with virtual scrolling for large timelines
- Implement connection culling (only render visible wires)
- Debounce wire position updates during scroll

### Risk 2: Complex State Management
**Impact**: High
**Probability**: Medium
**Mitigation**:
- Use Zustand store for centralized connection state
- Implement clear action creators for all operations
- Add comprehensive unit tests for state mutations

### Risk 3: Cross-Browser Compatibility
**Impact**: Medium
**Probability**: Low
**Mitigation**:
- Test on Chrome, Firefox, Edge
- Use standard SVG/DOM APIs only
- Polyfill if needed for older browsers

### Risk 4: Undo/Redo Complexity
**Impact**: Medium
**Probability**: High
**Mitigation**:
- Use existing history state in routingStore
- Store connection changes as reversible actions
- Implement in Phase 5.4 after basic features stable

---

## 10. Open Questions

1. **Should wires be clickable for deletion or require selection first?**
   - Decision: Require selection first for safety

2. **How to handle overlapping wires?**
   - Decision: Use z-index, selected wire always on top

3. **Should we support multi-select for bulk operations?**
   - Decision: Phase 2 feature, not in initial implementation

4. **What happens to connections when a node is deleted?**
   - Decision: Auto-remove all connections to/from deleted node

5. **Should Recommendation panel be editable or read-only?**
   - Decision: TBD - needs clarification from user

---

## 11. Out of Scope

- Branching/conditional routing (Phase 6+)
- Wire labels or annotations
- Multi-path routing visualization
- Connection performance metrics
- Export wire connections to separate format

---

## 12. References

- [routingStore.ts](../../frontend-prediction/src/store/routingStore.ts)
- [TimelinePanel.tsx](../../frontend-prediction/src/components/TimelinePanel.tsx)
- [Algorithm Map Wire Implementation](../../frontend-home/algorithm-map.html) - Reference for wire rendering

---

**Document Version**: 1.0
**Last Updated**: 2025-10-20
**Author**: Claude Code
