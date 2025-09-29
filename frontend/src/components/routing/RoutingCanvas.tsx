import "reactflow/dist/style.css";

import type { DraggableOperationPayload, TimelineStep } from "@store/routingStore";
import { useRoutingStore } from "@store/routingStore";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { Edge, Node, NodeProps, ReactFlowInstance } from "reactflow";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";

const NODE_GAP = 240;

interface TimelineNodeData {
  step: TimelineStep;
  onRemove: (stepId: string) => void;
}

interface RoutingCanvasProps {
  className?: string;
  /**
   * Automatically calls fitView when the canvas is initialized and when the
   * timeline length changes. Enabled by default.
   */
  autoFit?: boolean;
  /**
   * Padding applied when auto fitting the viewport. Defaults to 0.2.
   */
  fitPadding?: number;
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

const nodeTypes = { timeline: TimelineNode } as const;

interface CanvasViewProps extends RoutingCanvasProps {
  timeline: TimelineStep[];
  moveStep: (stepId: string, toIndex: number) => void;
  insertOperation: (payload: DraggableOperationPayload, index?: number) => void;
  removeStep: (stepId: string) => void;
}

function RoutingCanvasView({
  className,
  autoFit = true,
  fitPadding = 0.2,
  timeline,
  moveStep,
  insertOperation,
  removeStep,
}: CanvasViewProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<TimelineNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isReady, setIsReady] = useState(false);

  const containerClassName = useMemo(
    () => (className ? `timeline-flow ${className}` : "timeline-flow"),
    [className],
  );

  const flowNodes = useMemo<Node<TimelineNodeData>[]>(
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

  const flowEdges = useMemo<Edge[]>(
    () =>
      timeline.slice(1).map((step, index) => ({
        id: `edge-${timeline[index].id}-${step.id}`,
        source: timeline[index].id,
        target: step.id,
      })),
    [timeline],
  );

  const handleInit = useCallback(
    (instance: ReactFlowInstance) => {
      instanceRef.current = instance;
      setIsReady(true);
      if (autoFit) {
        instance.fitView({ padding: fitPadding, duration: 200 });
      }
    },
    [autoFit, fitPadding],
  );

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
        const bounds = wrapperRef.current?.getBoundingClientRect();
        if (bounds && instanceRef.current) {
          const position = instanceRef.current.project({
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
    (_event: unknown, node: Node<TimelineNodeData>) => {
      const newIndex = Math.max(0, Math.round(node.position.x / NODE_GAP));
      moveStep(node.id, newIndex);
    },
    [moveStep],
  );

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  useEffect(() => {
    if (autoFit && isReady && instanceRef.current) {
      instanceRef.current.fitView({ padding: fitPadding, duration: 200 });
    }
  }, [autoFit, fitPadding, timeline.length, isReady]);

  return (
    <div className={containerClassName} ref={wrapperRef} onDrop={handleDrop} onDragOver={handleDragOver}>
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

export function RoutingCanvas(props: RoutingCanvasProps) {
  const timeline = useRoutingStore((state) => state.timeline);
  const moveStep = useRoutingStore((state) => state.moveStep);
  const insertOperation = useRoutingStore((state) => state.insertOperation);
  const removeStep = useRoutingStore((state) => state.removeStep);

  return (
    <ReactFlowProvider>
      <RoutingCanvasView
        timeline={timeline}
        moveStep={moveStep}
        insertOperation={insertOperation}
        removeStep={removeStep}
        {...props}
      />
    </ReactFlowProvider>
  );
}

export default RoutingCanvas;
