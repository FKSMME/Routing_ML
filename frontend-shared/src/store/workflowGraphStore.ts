import type { WorkflowGraphEdge, WorkflowGraphNode } from "@app-types/workflow";
import { create } from "zustand";

const MAX_HISTORY = 40;

export type WorkflowGraphSnapshotReason =
  | "initial-load"
  | "insert-node"
  | "update-node"
  | "delete-node"
  | "connect"
  | "disconnect"
  | "position"
  | "undo"
  | "redo";

interface GraphSnapshot {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  reason: WorkflowGraphSnapshotReason;
  timestamp: string;
}

interface GraphState {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
}

const cloneNodes = (nodes: WorkflowGraphNode[]): WorkflowGraphNode[] =>
  nodes.map((node) => ({
    ...node,
    position: node.position ? { ...node.position } : undefined,
    settings: { ...node.settings },
    metrics: { ...node.metrics },
    doc_refs: [...node.doc_refs],
  }));

const cloneEdges = (edges: WorkflowGraphEdge[]): WorkflowGraphEdge[] =>
  edges.map((edge) => ({ ...edge }));

const toSnapshot = (
  state: GraphState,
  reason: WorkflowGraphSnapshotReason,
): GraphSnapshot => ({
  nodes: cloneNodes(state.nodes),
  edges: cloneEdges(state.edges),
  reason,
  timestamp: new Date().toISOString(),
});

interface WorkflowGraphHistoryState {
  past: GraphSnapshot[];
  future: GraphSnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  pushSnapshot: (state: GraphState, reason: WorkflowGraphSnapshotReason) => void;
  undo: (current: GraphState) => GraphState | null;
  redo: (current: GraphState) => GraphState | null;
  reset: () => void;
}

export const useWorkflowGraphHistory = create<WorkflowGraphHistoryState>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,
  pushSnapshot: (state, reason) => {
    const nextPast = [...get().past, toSnapshot(state, reason)];
    if (nextPast.length > MAX_HISTORY) {
      nextPast.shift();
    }
    set({
      past: nextPast,
      future: [],
      canUndo: nextPast.length > 0,
      canRedo: false,
    });
  },
  undo: (current) => {
    const { past, future } = get();
    if (past.length === 0) {
      return null;
    }
    const previous = past[past.length - 1];
    const remainingPast = past.slice(0, -1);
    const nextFuture = [toSnapshot(current, "undo"), ...future];
    set({
      past: remainingPast,
      future: nextFuture,
      canUndo: remainingPast.length > 0,
      canRedo: nextFuture.length > 0,
    });
    return {
      nodes: cloneNodes(previous.nodes),
      edges: cloneEdges(previous.edges),
    };
  },
  redo: (current) => {
    const { past, future } = get();
    if (future.length === 0) {
      return null;
    }
    const [next, ...restFuture] = future;
    const nextPast = [...past, toSnapshot(current, "redo")];
    if (nextPast.length > MAX_HISTORY) {
      nextPast.shift();
    }
    set({
      past: nextPast,
      future: restFuture,
      canUndo: nextPast.length > 0,
      canRedo: restFuture.length > 0,
    });
    return {
      nodes: cloneNodes(next.nodes),
      edges: cloneEdges(next.edges),
    };
  },
  reset: () => {
    set({ past: [], future: [], canUndo: false, canRedo: false });
  },
}));
