import "reactflow/dist/style.css";

import type { DraggableOperationPayload, RuleViolation, TimelineStep } from "@store/routingStore";
import { useRoutingStore } from "@store/routingStore";
import { Edit2,Trash2 } from "lucide-react";
import { type DragEvent, memo, type UIEvent,useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node, NodeProps, ReactFlowInstance, Viewport } from "reactflow";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";

import { TimeEditModal } from "./TimeEditModal";

const NODE_GAP = 240;

interface TimelineNodeData {
  step: TimelineStep;
  onRemove: (stepId: string) => void;
  onEdit: (stepId: string) => void;
}

interface RoutingCanvasProfileController {
  moveNode: (nodeId: string, position: { x: number; y: number }) => void;
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
  /**
   * Optional callback that exposes internal helpers for profiling scenarios.
   */
  onProfileReady?: (controller: RoutingCanvasProfileController) => void;
}

function TimelineNodeComponent({ data }: NodeProps<TimelineNodeData>) {
  const { step, onRemove, onEdit } = data;
  const violations = step.violations ?? [];
  const [showTooltip, setShowTooltip] = useState(true);

  // 유사도 계산 (confidence 또는 similarity)
  const similarity = step.confidence ?? step.similarity ?? null;
  const similarityPercent = similarity !== null ? Math.round(similarity * 100) : null;

  return (
    <div className="timeline-node" onDoubleClick={() => onEdit(step.id)}>
      {/* 말풍선 툴팁 */}
      {showTooltip && (
        <div
          className="timeline-node__tooltip"
          style={{
            position: 'absolute',
            top: '-60px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ color: '#94a3b8', marginBottom: '2px' }}>표준시간: {step.runTime ?? '-'}분</div>
          <div style={{ color: '#94a3b8' }}>셋업시간: {step.setupTime ?? '-'}분</div>
          <div
            style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #475569',
            }}
          />
        </div>
      )}

      <header className="timeline-node__header">
        <div className="timeline-node__title-group">
          <span className="timeline-node__seq">#{step.seq}</span>
          <span className="timeline-node__title">{step.processCode}</span>
        </div>
        <div className="timeline-node__actions">
          {similarityPercent !== null && (
            <span
              className="timeline-node__similarity"
              data-level={similarityPercent >= 90 ? "high" : similarityPercent >= 70 ? "medium" : "low"}
              title={`유사도: ${similarityPercent}%`}
            >
              {similarityPercent}%
            </span>
          )}
          <button
            type="button"
            className="timeline-node__edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(step.id);
            }}
            title="시간 수정"
          >
            <Edit2 size={14} />
          </button>
          <button type="button" className="timeline-node__remove" onClick={() => onRemove(step.id)}>
            <Trash2 size={14} />
          </button>
        </div>
      </header>
      {violations.length > 0 ? (
        <div className="timeline-node__violations" data-testid={`timeline-node-violations-${step.id}`}>
          {violations.map((violation: RuleViolation) => (
            <span
              key={`${step.id}-${violation.ruleId}-${violation.message}`}
              className="timeline-node__badge"
              data-severity={violation.severity ?? "error"}
              data-testid={`rule-badge-${violation.ruleId}`}
              title={`${violation.ruleId}: ${violation.message}`}
            >
              <span className="timeline-node__badge-code">{violation.ruleId}</span>
              <span className="timeline-node__badge-message">{violation.message}</span>
            </span>
          ))}
        </div>
      ) : null}
      {step.description ? <p className="timeline-node__desc">{step.description}</p> : null}
      <div className="timeline-node__meta">
        <span className="timeline-node__meta-item">
          <strong>Setup:</strong> {step.setupTime ?? "-"}분
        </span>
        <span className="timeline-node__meta-item">
          <strong>Run:</strong> {step.runTime ?? "-"}분
        </span>
        <span className="timeline-node__meta-item">
          <strong>Wait:</strong> {step.waitTime ?? "-"}분
        </span>
      </div>
    </div>
  );
}

const TimelineNode = memo(TimelineNodeComponent);
TimelineNode.displayName = "TimelineNode";

const nodeTypes = { timeline: TimelineNode } as const;

interface CanvasViewProps extends RoutingCanvasProps {
  timeline: TimelineStep[];
  moveStep: (stepId: string, toIndex: number) => void;
  insertOperation: (payload: DraggableOperationPayload, index?: number) => void;
  removeStep: (stepId: string) => void;
  updateStepTimes: (stepId: string, times: { setupTime?: number; runTime?: number; waitTime?: number }) => void;
}

function RoutingCanvasView({
  className,
  autoFit = true,
  fitPadding = 0.2,
  timeline,
  moveStep,
  insertOperation,
  removeStep,
  updateStepTimes,
  onProfileReady,
}: CanvasViewProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ReactFlowInstance | null>(null);
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const syncingScrollRef = useRef(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<TimelineNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isReady, setIsReady] = useState(false);
  const profileControllerRef = useRef<RoutingCanvasProfileController | null>(null);
  const [dropPreviewIndex, setDropPreviewIndex] = useState<number | null>(null);
  const [editingStep, setEditingStep] = useState<TimelineStep | null>(null);

  const ensureProfileController = useCallback(() => {
    if (profileControllerRef.current || !onProfileReady) {
      return;
    }
    const controller: RoutingCanvasProfileController = {
      moveNode: (nodeId, position) => {
        setNodes((current) =>
          current.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  position,
                  positionAbsolute: position,
                }
              : node,
          ),
        );
      },
    };
    profileControllerRef.current = controller;
    onProfileReady(controller);
  }, [onProfileReady, setNodes]);

  const containerClassName = useMemo(
    () => (className ? `timeline-flow ${className}` : "timeline-flow"),
    [className],
  );

  const scheduleFrame = useCallback((callback: () => void) => {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(callback);
    } else {
      callback();
    }
  }, []);

  const handleEdit = useCallback((stepId: string) => {
    const step = timeline.find((s) => s.id === stepId);
    if (step) {
      setEditingStep(step);
    }
  }, [timeline]);

  const handleSaveTimeEdit = useCallback((stepId: string, times: { setupTime?: number; runTime?: number; waitTime?: number }) => {
    updateStepTimes(stepId, times);
    setEditingStep(null);
  }, [updateStepTimes]);

  const flowNodes = useMemo<Node<TimelineNodeData>[]>(
    () =>
      timeline.map((step, index) => ({
        id: step.id,
        type: "timeline",
        position: { x: step.positionX ?? index * NODE_GAP, y: 0 },
        data: { step, onRemove: removeStep, onEdit: handleEdit },
        draggable: true,
      })),
    [timeline, removeStep, handleEdit],
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

  const canvasDimensions = useMemo(() => {
    if (flowNodes.length === 0) {
      return { height: 320 };
    }

    const maxY = flowNodes.reduce((acc, node) => Math.max(acc, node.position.y), 0);

    return {
      height: Math.max(320, maxY + NODE_GAP * 1.5),
    };
  }, [flowNodes]);

  const syncScrollToViewport = useCallback(
    (viewport?: Viewport) => {
      const element = wrapperRef.current;
      if (!element) {
        return;
      }
      const current = viewport ?? viewportRef.current;
      viewportRef.current = current;
      const targetLeft = -current.x;
      const targetTop = -current.y;
      if (Math.abs(element.scrollLeft - targetLeft) < 0.5 && Math.abs(element.scrollTop - targetTop) < 0.5) {
        return;
      }
      syncingScrollRef.current = true;
      element.scrollLeft = targetLeft;
      element.scrollTop = targetTop;
      scheduleFrame(() => {
        syncingScrollRef.current = false;
      });
    },
    [scheduleFrame],
  );

  const handleInit = useCallback(
    (instance: ReactFlowInstance) => {
      instanceRef.current = instance;
      setIsReady(true);
      ensureProfileController();
      if (autoFit) {
        instance.fitView({ padding: fitPadding, duration: 200, maxZoom: 0.8 });
        scheduleFrame(() => {
          const viewport = instance.getViewport();
          viewportRef.current = viewport;
          syncScrollToViewport(viewport);
        });
      }
    },
    [autoFit, fitPadding, ensureProfileController, scheduleFrame, syncScrollToViewport],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDropPreviewIndex(null);
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

    // 드롭 위치 미리보기 계산
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (bounds && instanceRef.current) {
      const position = instanceRef.current.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      const previewIndex = Math.max(0, Math.min(timeline.length, Math.round(position.x / NODE_GAP)));
      setDropPreviewIndex(previewIndex);
    }
  }, [timeline.length]);

  const handleDragLeave = useCallback(() => {
    setDropPreviewIndex(null);
  }, []);

  const handleNodeDragStop = useCallback(
    (_event: unknown, node: Node<TimelineNodeData>) => {
      const newIndex = Math.max(0, Math.round(node.position.x / NODE_GAP));
      moveStep(node.id, newIndex);
    },
    [moveStep],
  );

  const handleMove = useCallback(
    (_event: unknown, viewport: Viewport) => {
      viewportRef.current = viewport;
      syncScrollToViewport(viewport);
    },
    [syncScrollToViewport],
  );

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (!instanceRef.current || syncingScrollRef.current) {
        return;
      }
      const { scrollLeft, scrollTop } = event.currentTarget;
      const currentViewport = viewportRef.current;
      const zoom = currentViewport.zoom ?? instanceRef.current.getZoom();
      instanceRef.current.setViewport({ x: -scrollLeft, y: -scrollTop, zoom }, { duration: 0 });
    },
    [],
  );

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  useEffect(() => {
    ensureProfileController();
  }, [ensureProfileController]);

  useEffect(() => {
    if (autoFit && isReady && instanceRef.current) {
      instanceRef.current.fitView({ padding: fitPadding, duration: 200, maxZoom: 0.8 });
      scheduleFrame(() => {
        const viewport = instanceRef.current?.getViewport();
        if (viewport) {
          viewportRef.current = viewport;
          syncScrollToViewport(viewport);
        }
      });
    }
  }, [autoFit, fitPadding, timeline.length, isReady, scheduleFrame, syncScrollToViewport]);

  return (
    <>
      <div
        className={containerClassName}
        ref={wrapperRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onScroll={handleScroll}
        data-testid="routing-canvas-scroll"
      >
        <div className="timeline-flow__canvas" style={{ width: "100%", height: canvasDimensions.height }}>
          {/* 드롭 위치 미리보기 인디케이터 */}
          {dropPreviewIndex !== null && (
            <div
              className="timeline-flow__drop-indicator"
              style={{
                left: `${dropPreviewIndex * NODE_GAP - 10}px`,
                top: 0,
                height: "100%",
              }}
              data-testid="drop-indicator"
            />
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onInit={handleInit}
            onMove={handleMove}
            onNodeDragStop={handleNodeDragStop}
            nodesDraggable
            nodesConnectable={true}
            elementsSelectable
            proOptions={{ hideAttribution: true }}
            defaultViewport={{ x: 0, y: 50, zoom: 0.8 }}
            minZoom={0.5}
            maxZoom={1.5}
            className="timeline-flow__reactflow"
            style={{ width: "100%", height: "100%" }}
          >
            <MiniMap pannable zoomable nodeColor={() => "#5b76d8"} />
            <Controls showZoom={false} showInteractive={false} />
            <Background gap={32} size={1} />
          </ReactFlow>
        </div>
      </div>

      {editingStep && (
        <TimeEditModal
          isOpen={true}
          onClose={() => setEditingStep(null)}
          stepId={editingStep.id}
          processCode={editingStep.processCode}
          currentSetupTime={editingStep.setupTime ?? undefined}
          currentRunTime={editingStep.runTime ?? undefined}
          currentWaitTime={editingStep.waitTime ?? undefined}
          onSave={handleSaveTimeEdit}
        />
      )}
    </>
  );
}

export function RoutingCanvas(props: RoutingCanvasProps) {
  const timeline = useRoutingStore((state) => state.timeline);
  const moveStep = useRoutingStore((state) => state.moveStep);
  const insertOperation = useRoutingStore((state) => state.insertOperation);
  const removeStep = useRoutingStore((state) => state.removeStep);
  const updateStepTimes = useRoutingStore((state) => state.updateStepTimes);

  return (
    <ReactFlowProvider>
      <RoutingCanvasView
        timeline={timeline}
        moveStep={moveStep}
        insertOperation={insertOperation}
        removeStep={removeStep}
        updateStepTimes={updateStepTimes}
        {...props}
      />
    </ReactFlowProvider>
  );
}

export default RoutingCanvas;
export type { RoutingCanvasProfileController,RoutingCanvasProps };
