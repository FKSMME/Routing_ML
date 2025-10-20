# Analysis: Timeline-Recommendation Synchronization

**Date**: 2025-10-20
**Phase**: 5.5
**Status**: Analysis Complete

---

## Problem Statement

**User Requirement**:
> "Timeline이나 Recommendation에 후보공정노드를 추가할 수 있어야하는데, Timeline에는 추가 되는데 Recommendation에는 표현 안됨"

Translation: Nodes can be added to Timeline, but they don't appear in Recommendation panel. Need bidirectional synchronization.

---

## Current Architecture Analysis

### Data Flow Overview

```
loadRecommendations (API Response)
    ↓
┌─────────────────────────────────────────────┐
│ routingStore State                          │
├─────────────────────────────────────────────┤
│ 1. recommendations: RecommendationBucket[]  │  ← Immutable after load
│    - itemCode                               │
│    - candidateId                            │
│    - operations: OperationStep[]            │
│                                             │
│ 2. productTabs: RoutingProductTab[]         │  ← Has timeline per tab
│    - id                                     │
│    - productCode                            │
│    - candidateId                            │
│    - timeline: TimelineStep[]               │  ← Per-tab timeline
│                                             │
│ 3. timeline: TimelineStep[]                 │  ← Active timeline (global)
│    - Updated on setActiveProduct()          │
│    - Cloned from productTabs[active]        │
└─────────────────────────────────────────────┘
         ↓                          ↓
    Timeline View           Recommendation View
    (RoutingCanvas)         (operations list)
    - Reads: timeline       - Reads: recommendations
    - Editable             - Read-only display
```

### Key Components

#### 1. routingStore.ts (State Management)

**Initial Load** (`loadRecommendations` - lines 1194-1239):
```typescript
loadRecommendations: (response) => {
  // Creates BOTH recommendations and productTabs from API response
  const buckets: RecommendationBucket[] = response.items.map((item) => ({
    itemCode: item.ITEM_CD,
    candidateId: item.CANDIDATE_ID ?? null,
    operations: item.operations,  // ← Original operations
  }));

  const tabs: RoutingProductTab[] = response.items.map((item) => {
    const operations = item.operations ?? [];
    const timeline = normalizeSequence(
      operations.map((operation) =>
        toTimelineStep(operation, {...})
      ),
    );
    return {
      id: item.ITEM_CD,
      productCode: item.ITEM_CD,
      candidateId: item.CANDIDATE_ID ?? null,
      timeline,  // ← Per-tab editable timeline
    };
  });

  const activeTabId = tabs[0]?.id ?? null;
  const activeTimeline = activeTabId ? cloneTimeline(tabs[0].timeline) : [];

  set({
    recommendations: buckets,  // ← Separate, immutable
    productTabs: tabs,         // ← Per-tab timelines
    timeline: activeTimeline,  // ← Active global timeline
    activeProductId: activeTabId,
    // ...
  });
}
```

**Tab Switching** (`setActiveProduct` - lines 1355-1369):
```typescript
setActiveProduct: (tabId) =>
  set((state) => {
    const tab = state.productTabs.find((item) => item.id === tabId);
    if (!tab) return state;

    const timeline = cloneTimeline(tab.timeline);  // ← Clones tab's timeline
    return {
      activeProductId: tabId,
      timeline,  // ← Updates global timeline
      history: { past: [], future: [] },
      // ...
    };
  }),
```

#### 2. RecommendationsTab.tsx (View Component)

**Recommendation View** (lines 21-27):
```typescript
const activeBucket = useMemo(
  () => recommendations.find((bucket) => bucket.itemCode === activeProductId) ?? null,
  [activeProductId, recommendations],
);

const operations = activeBucket?.operations ?? [];  // ← Reads from recommendations
```

**Timeline View** (line 126):
```typescript
<RoutingCanvas {...canvasProps} />  // ← Reads from global timeline state
```

---

## Root Cause Analysis

### The Problem

**Two Separate Data Sources**:
1. **Timeline view** reads from `state.timeline` (global, synced with `productTabs[active].timeline`)
2. **Recommendation view** reads from `state.recommendations[itemCode].operations` (immutable)

**Why Timeline Changes Don't Appear in Recommendations**:
- When user adds/removes/reorders nodes in Timeline (RoutingCanvas):
  - Updates `state.timeline` ✅
  - Updates `productTabs[active].timeline` (through actions) ✅
  - Does NOT update `state.recommendations` ❌

**Result**: Recommendation view shows original operations from API, never reflects Timeline edits.

### Why This Architecture Exists

Looking at the code history, this design was intentional:
1. **Recommendations** = Original AI predictions (immutable, for reference)
2. **Timeline** = User's editable working copy (mutable, per product)

However, this creates confusion when user expects both views to show the same data.

---

## Solution Options

### Option 1: Recommendations Read from Timeline (Recommended)

**Change**: Make Recommendation view read from `timeline` instead of `recommendations`

**Pros**:
- Simple implementation
- Single source of truth
- No duplicate state
- Automatic synchronization

**Cons**:
- Loses original predictions after editing (can't compare before/after)

**Implementation**:
```typescript
// In RecommendationsTab.tsx
const activeBucket = useMemo(
  () => {
    // OLD: Read from recommendations
    // return recommendations.find((bucket) => bucket.itemCode === activeProductId) ?? null;

    // NEW: Read from timeline (via productTabs)
    const tab = productTabs.find(t => t.id === activeProductId);
    if (!tab) return null;

    return {
      itemCode: tab.productCode,
      candidateId: tab.candidateId,
      operations: tab.timeline.map(step => fromTimelineStep(step)),  // Convert back
    };
  },
  [activeProductId, productTabs],  // ← Dependency change
);
```

### Option 2: Sync Timeline Changes Back to Recommendations

**Change**: Update `recommendations` state whenever `timeline` changes

**Pros**:
- Keeps both data structures
- Can maintain original predictions separately

**Cons**:
- Complex synchronization logic
- Duplicate state management
- More bug-prone
- Performance overhead

**Implementation**: Add sync logic to every timeline action (addStep, removeStep, moveStep, etc.)

### Option 3: Unified Data Structure

**Change**: Remove `recommendations` entirely, keep only `productTabs.timeline`

**Pros**:
- Cleanest architecture
- No synchronization needed
- Clear single source of truth

**Cons**:
- Requires refactoring multiple components
- Larger code change

---

## Recommended Solution

**Use Option 1**: Make Recommendation view read from timeline state

**Rationale**:
1. **Minimal Code Change**: Only modify `RecommendationsTab.tsx`
2. **Clear Semantics**: "Recommendation" is just a different view of timeline
3. **Automatic Sync**: No manual synchronization logic needed
4. **Matches User Expectation**: User thinks Timeline and Recommendation are same data

**Note**: If preserving original predictions is needed later, can add separate "Show Original" toggle.

---

## Implementation Plan

### Step 1: Create Conversion Helper

Add to `routingStore.ts`:
```typescript
// Convert TimelineStep back to OperationStep for display
function fromTimelineStep(step: TimelineStep): OperationStep {
  return {
    PROC_SEQ: step.seq,
    PROC_CD: step.processCode,
    PROC_DESC: step.description ?? undefined,
    SETUP_TIME: step.setupTime ?? undefined,
    RUN_TIME: step.runTime ?? undefined,
    WAIT_TIME: step.waitTime ?? undefined,
    ...step.metadata,
  };
}
```

### Step 2: Update RecommendationsTab.tsx

Change data source from `recommendations` to `productTabs`:
```typescript
const activeBucket = useMemo(
  () => {
    const tab = productTabs.find(t => t.id === activeProductId);
    if (!tab) return null;

    return {
      itemCode: tab.productCode,
      candidateId: tab.candidateId,
      operations: tab.timeline.map(step => fromTimelineStep(step)),
    };
  },
  [activeProductId, productTabs],
);
```

### Step 3: Test Scenarios

1. Add node to Timeline → Check Recommendation view updates
2. Remove node from Timeline → Check Recommendation view updates
3. Reorder nodes in Timeline → Check Recommendation view updates
4. Switch between products → Check each shows correct data
5. Drag node from Candidate to Recommendation → Check Timeline updates

---

## Alternative: Keep Current Behavior

If the current behavior is actually desired (Recommendation = immutable original, Timeline = editable):

**Solution**: Better UI/UX to clarify difference
1. Rename "Recommendation" to "Original Prediction"
2. Make it obvious Timeline is the editable version
3. Add "Reset to Original" button to restore from recommendations

However, user's requirement clearly states they expect synchronization, so Option 1 is recommended.

---

## Files to Modify

1. **frontend-prediction/src/components/routing/RecommendationsTab.tsx**
   - Change activeBucket to read from productTabs instead of recommendations
   - Update dependencies in useMemo

2. **frontend-prediction/src/store/routingStore.ts** (optional)
   - Add `fromTimelineStep` helper function
   - Or export conversion in types file

---

## Testing Checklist

- [ ] Add node to Timeline → appears in Recommendation
- [ ] Remove node from Timeline → removed from Recommendation
- [ ] Reorder nodes in Timeline → order updates in Recommendation
- [ ] Switch products → each shows correct timeline
- [ ] Reconnect edges → Recommendation updates
- [ ] Undo/Redo → Recommendation reflects history state
- [ ] No duplicate nodes between views
- [ ] Performance: No lag with 50+ nodes

---

**Analysis Complete**: Ready for implementation.
