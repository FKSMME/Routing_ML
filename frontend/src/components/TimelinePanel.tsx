import "reactflow/dist/style.css";

import type { TimelineStep } from "@store/routingStore";
import { useRoutingStore } from "@store/routingStore";
import { BadgeCheck, Clock3, Redo2, Trash2, Undo2 } from "lucide-react";
import type { DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeProps } from "reactflow";
import {
  Background,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlow,
  ReactFlowInstance,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";

const NODE_GAP = 240;

interface TimelineNodeData {
  step: TimelineStep;
  onRemove: (stepId: string) => void;
}

function TimelineNode({ data }: NodeProps<TimelineNodeData>) {
  const { step, onRemove } = data;

  return (
    <div className="timeline-node">
      <header className="timeline-node__header">
        <span className="timeline-node__title">
          #{step.seq} · {step.processCode}
        </span>
        <button type="button" className="timeline-node__remove" onClick={() => onRemove(step.id)}>
          <Trash2 size={14} />
        </button>
      </header>
      {step.description ? <p className="timeline-node__desc">{step.description}</p> : null}
      <div className="timeline-node__meta">
        <span>Setup {step.setupTime ?? "-"}</span>
        <span>Run {step.runTime ?? "-"}</span>
        <span>Wait {step.waitTime ?? "-"}</span>
      </div>
    </div>
  );
}

const nodeTypes = { timeline: TimelineNode };

function TimelineCanvas() {
  const timeline = useRoutingStore((state) => state.timeline);
  const moveStep = useRoutingStore((state) => state.moveStep);
  const insertOperation = useRoutingStore((state) => state.insertOperation);
  const removeStep = useRoutingStore((state) => state.removeStep);

  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isReady, setIsReady] = useState(false);

  const initialNodes = useMemo<Node[]>(
    () =>
      timeline.map((step, index) => ({
        id: step.id,
        type: "timeline",
        position: { x: step.positionX ?? index * NODE_GAP, y: 0 },
        data: { step, onRemove: removeStep },
        draggable: true,
      })),
    [timeline, removeStep],
  );

  const initialEdges = useMemo<Edge[]>(
    () =>
      timeline.slice(1).map((step, index) => ({
        id: `edge-${timeline[index].id}-${step.id}`,
        source: timeline[index].id,
        target: step.id,
        animated: false,
      })),
    [timeline],
  );

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
    setIsReady(true);
    instance.fitView({ padding: 0.2, duration: 200 });
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const transfer = event.dataTransfer.getData("application/routing-operation");
      if (!transfer) {
        return;
      }
      try {
        const payload = JSON.parse(transfer);
        if (!payload?.operation) {
          return;
        }
        let dropIndex = timeline.length;
        const bounds = reactFlowWrapper.current?.getBoundingClientRect();
        if (bounds && reactFlowInstance.current) {
          const position = reactFlowInstance.current.project({
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          });
          dropIndex = Math.max(0, Math.min(timeline.length, Math.round(position.x / NODE_GAP)));
        }
        insertOperation(payload, dropIndex);
      } catch (error) {
        console.warn("Failed to parse drag payload", error);
      }
    },
    [insertOperation, timeline.length],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      const newIndex = Math.max(0, Math.round(node.position.x / NODE_GAP));
      moveStep(node.id, newIndex);
    },
    [moveStep],
  );

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  useEffect(() => {
    if (isReady && reactFlowInstance.current) {
      reactFlowInstance.current.fitView({ padding: 0.2, duration: 200 });
    }
  }, [timeline, isReady]);

  return (
    <div className="timeline-flow" ref={reactFlowWrapper} onDrop={handleDrop} onDragOver={handleDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={handleInit}
        onNodeDragStop={handleNodeDragStop}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <MiniMap pannable zoomable nodeColor={() => "#5b76d8"} />
        <Controls showZoom={false} showInteractive={false} />
        <Background gap={32} size={1} />
      </ReactFlow>
    </div>
  );
}

function useTimelineSelectors() {
  return useRoutingStore((state) => ({
    timeline: state.timeline,
    loading: state.loading,
    dirty: state.dirty,
    validationErrors: state.validationErrors,
    activeGroupName: state.activeGroupName,
    lastSavedAt: state.lastSavedAt,
    productTabs: state.productTabs,
    activeProductId: state.activeProductId,
    historyCount: state.history.past.length,
    futureCount: state.history.future.length,
  }));
}

export function TimelinePanel() {
  const {
    timeline,
    loading,
    dirty,
    validationErrors,
    activeGroupName,
    lastSavedAt,
    productTabs,
    activeProductId,
    historyCount,
    futureCount,
  } = useTimelineSelectors();
  const undo = useRoutingStore((state) => state.undo);
  const redo = useRoutingStore((state) => state.redo);

  const canUndo = historyCount > 0;
  const canRedo = futureCount > 0;
  const totalDuration = useMemo(() => timeline.reduce((acc, step) => acc + (step.runTime ?? 0), 0), [timeline]);

  return (
    <section className="panel-card interactive-card routing-timeline">
      <header className="timeline-header">
        <div>
          <h2 className="panel-title">Routing Canvas</h2>
          <p className="panel-subtitle">Adjust recommended order and save as groups.</p>
        </div>
        <div className="timeline-actions">
          <button type="button" className="timeline-action" onClick={undo} disabled={!canUndo}>
            <Undo2 size={16} />
            <span>Undo</span>
          </button>
          <button type="button" className="timeline-action" onClick={redo} disabled={!canRedo}>
            <Redo2 size={16} />
            <span>Redo</span>
          </button>
        </div>
      </header>

      <div className="timeline-status">
        <div className={`timeline-status__indicator ${dirty ? "is-dirty" : "is-clean"}`}>
          <span className="timeline-dot" />
          <span>{dirty ? "Unsaved changes" : "Saved"}</span>
        </div>
        <div className="timeline-status__meta">
          <span className="timeline-meta-item">
            <Clock3 size={14} /> Total runtime {totalDuration.toFixed(1)} 분
          </span>
          {activeGroupName ? (
            <span className="timeline-meta-item">
              <BadgeCheck size={14} /> Active group: {activeGroupName}
            </span>
          ) : null}
          {lastSavedAt ? <span className="timeline-meta-item">Last saved {new Date(lastSavedAt).toLocaleString()}</span> : null}
        </div>
      </div>

      {validationErrors.length > 0 ? (
        <div className="timeline-errors">
          <h3>Validation failed</h3>
          <ul>
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading && productTabs.length === 0 ? (
        <div className="timeline-placeholder">Loading timeline...</div>
      ) : productTabs.length === 0 ? (
        <div className="timeline-placeholder">Search items to generate routing.</div>
      ) : (
        <ReactFlowProvider>
          <TimelineCanvas />
        </ReactFlowProvider>
      )}

      {activeProductId ? (
        <p className="timeline-footer">Active item: {activeProductId}</p>
      ) : null}
    </section>
  );
}
















