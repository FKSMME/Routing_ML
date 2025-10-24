import "reactflow/dist/style.css";

import type { DraggableOperationPayload, RuleViolation, TimelineStep } from "@store/routingStore";
import { useRoutingStore } from "@store/routingStore";
import { Edit2,Trash2 } from "lucide-react";
import { type DragEvent, memo, type UIEvent,useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Connection, Edge, Node, NodeProps, ReactFlowInstance, Viewport } from "reactflow";
import ReactFlow, {
  Background,
  ConnectionLineType,
  Controls,
  MarkerType,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";

import { CandidateNodeTabs } from "./CandidateNodeTabs";
import { CustomNodeList } from "./CustomNodeList";
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
  const [showTooltip, setShowTooltip] = useState(false);

  // 유사도/신뢰도 계산
  const similarity = step.confidence ?? step.similarity ?? null;
  const similarityPercent = similarity !== null ? Math.round(similarity * 100) : null;
  const workSamples = step.workOrderCount ?? null;
  const workOrderConfidence = step.workOrderConfidence;
  const workConfidencePercent =
    typeof workOrderConfidence === "number"
      ? Math.round(workOrderConfidence * 100)
      : null;
  const runStd = step.timeStd ?? null;
  const timeCvPercent = step.timeCv !== null && step.timeCv !== undefined
    ? Math.round(step.timeCv * 100)
    : null;
  const setupStd = step.setupStd ?? null;
  const trimMean = step.trimMean ?? null;
  const sampleCount = step.sampleCount ?? null;
  const hasWorkData = step.hasWorkData ?? false;
  const outsourcingReplaced = Boolean(step.outsourcingReplaced);

  // Quality badges
  const isHighConfidence = workConfidencePercent !== null && workConfidencePercent >= 80;
  const isLowSamples = sampleCount !== null && sampleCount < 3;

  return (
    <div
      className="timeline-node"
      onDoubleClick={() => onEdit(step.id)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* 공정 정보 툴팁 */}
      {showTooltip && (
        <div
          className="timeline-node__tooltip"
          style={{
            position: 'absolute',
            top: '-130px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: '6px', borderBottom: '1px solid #475569', paddingBottom: '4px' }}>
            {step.processCode}
          </div>
          <div style={{ color: '#94a3b8', marginBottom: '3px' }}>
            <span style={{ color: '#cbd5e1', fontWeight: 500 }}>준비:</span> {step.setupTime ?? '-'}분
          </div>
          <div style={{ color: '#94a3b8', marginBottom: '3px' }}>
            <span style={{ color: '#cbd5e1', fontWeight: 500 }}>가공:</span> {step.runTime ?? '-'}분
          </div>
          <div style={{ color: '#94a3b8', marginBottom: '3px' }}>
            <span style={{ color: '#cbd5e1', fontWeight: 500 }}>대기:</span> {step.waitTime ?? '-'}분
          </div>
          {step.moveTime !== null && (
            <div style={{ color: '#94a3b8', marginBottom: '3px' }}>
              <span style={{ color: '#cbd5e1', fontWeight: 500 }}>이동:</span> {step.moveTime}분
            </div>
          )}
          {(step.optimalTime !== null || step.standardTime !== null || step.safeTime !== null) && (
            <div style={{ borderTop: '1px solid #475569', marginTop: '6px', paddingTop: '6px' }}>
              {step.optimalTime !== null && (
                <div style={{ color: '#94a3b8', marginBottom: '3px' }}>
                  <span style={{ color: '#10b981', fontWeight: 500 }}>최적:</span> {step.optimalTime}분
                </div>
              )}
              {step.standardTime !== null && (
                <div style={{ color: '#94a3b8', marginBottom: '3px' }}>
                  <span style={{ color: '#3b82f6', fontWeight: 500 }}>표준:</span> {step.standardTime}분
                </div>
              )}
              {step.safeTime !== null && (
                <div style={{ color: '#94a3b8' }}>
                  <span style={{ color: '#f59e0b', fontWeight: 500 }}>안전:</span> {step.safeTime}분
                </div>
              )}
            </div>
          )}
          {(hasWorkData || workSamples || workConfidencePercent !== null || runStd !== null || setupStd !== null || trimMean !== null || sampleCount !== null) && (
            <div style={{ borderTop: '1px solid #475569', marginTop: '6px', paddingTop: '6px' }}>
              <div style={{ color: '#94a3b8', marginBottom: '3px' }}>
                <span style={{ color: hasWorkData ? '#22d3ee' : '#f87171', fontWeight: 500 }}>실적 데이터:</span> {hasWorkData ? '있음' : '없음'}
              </div>
              {(workSamples !== null || sampleCount !== null) && (
                <div style={{ color: '#94a3b8', marginBottom: '3px' }}>
                  <span style={{ color: '#cbd5e1', fontWeight: 500 }}>샘플 수:</span> {sampleCount ?? workSamples ?? 0}
                  {isLowSamples && <span style={{ color: '#f59e0b', marginLeft: '4px' }}>⚠️ 낮음</span>}
                </div>
              )}
              {workConfidencePercent !== null && (
                <div style={{ color: '#94a3b8', marginBottom: '3px' }}>
                  <span style={{ color: '#34d399', fontWeight: 500 }}>신뢰도:</span> {workConfidencePercent}%
                  {isHighConfidence && <span style={{ color: '#10b981', marginLeft: '4px' }}>✓ 높음</span>}
                </div>
              )}
              {trimMean !== null && (
                <div style={{ color: '#94a3b8', marginBottom: '3px' }}>
                  <span style={{ color: '#60a5fa', fontWeight: 500 }}>Trim-평균:</span> {trimMean.toFixed(2)}분
                </div>
              )}
              {runStd !== null && (
                <div style={{ color: '#94a3b8', marginBottom: '3px' }}>
                  <span style={{ color: '#facc15', fontWeight: 500 }}>RUN 표준편차:</span> {runStd.toFixed(2)}
                  {timeCvPercent !== null ? ` (CV ${timeCvPercent}%)` : ''}
                </div>
              )}
              {setupStd !== null && (
                <div style={{ color: '#94a3b8', marginBottom: '3px' }}>
                  <span style={{ color: '#facc15', fontWeight: 500 }}>SETUP 표준편차:</span> {setupStd.toFixed(2)}
                </div>
              )}
            </div>
          )}
          {outsourcingReplaced && (
            <div
              style={{
                marginTop: '6px',
                padding: '4px 6px',
                backgroundColor: '#f97316',
                color: '#0f172a',
                borderRadius: '6px',
                fontWeight: 600,
              }}
            >
              외주 공정을 사내 공정으로 대체했습니다.
            </div>
          )}
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
          {outsourcingReplaced && (
            <span className="timeline-node__badge" data-severity="warning">
              사내전환
            </span>
          )}
          {!hasWorkData && (
            <span className="timeline-node__badge" data-severity="info">
              실적없음
            </span>
          )}
          {isHighConfidence && (
            <span className="timeline-node__badge" data-severity="success" title="신뢰도 80% 이상">
              고신뢰도
            </span>
          )}
          {isLowSamples && (
            <span className="timeline-node__badge" data-severity="warning" title="샘플 수 3개 미만">
              샘플부족
            </span>
          )}
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
            title="시간 조정"
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
        <span className="timeline-node__meta-item">
          <strong>자원(Res):</strong> {step.resourceGroupName || "미지정"}
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
  productTabs: Array<{ id: string; productCode: string; productName?: string | null; candidateId?: string | null; timeline: TimelineStep[] }>;
  activeProductId: string | null;
  onCandidateSelect: (tabId: string) => void;
  // Connection management props
  connections: Array<{ id: string; sourceNodeId: string; targetNodeId: string; metadata?: { createdBy?: string } }>;
  addConnection: (sourceId: string, targetId: string) => void;
  removeConnection: (connectionId: string) => void;
  updateConnection: (connectionId: string, updates: { sourceNodeId: string; targetNodeId: string }) => void;
  setSelectedConnection: (connectionId: string | null) => void;
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
  productTabs,
  activeProductId,
  onCandidateSelect,
  onProfileReady,
  // Connection props
  connections,
  addConnection,
  removeConnection,
  updateConnection,
  setSelectedConnection,
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
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

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
      connections.map((connection) => {
        const isSelected = connection.id === selectedEdgeId;
        const createdBy = connection.metadata?.createdBy ?? "auto";
        const isManual = createdBy === "manual";
        const baseColor = isManual ? "rgba(251, 191, 36, 0.9)" : "rgba(148, 163, 184, 0.8)";
        const highlightColor = isManual ? "rgb(250, 204, 21)" : "rgb(56, 189, 248)";
        return {
          id: connection.id,
          source: connection.sourceNodeId,
          target: connection.targetNodeId,
          animated: isSelected,
          selectable: true,
          data: { createdBy },
          style: {
            stroke: isSelected ? highlightColor : baseColor,
            strokeWidth: isManual ? (isSelected ? 3 : 2.5) : isSelected ? 3 : 2,
            strokeDasharray: isManual ? "4 2" : "none",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isSelected ? highlightColor : baseColor,
          },
        };
      }),
    [connections, selectedEdgeId],
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
      // Task 3.3: RoutingCanvas 초기화 로그
      console.log("[RoutingCanvas] ReactFlow 초기화 완료", {
        nodeCount: flowNodes.length,
        autoFit,
        fitPadding,
      });

      instanceRef.current = instance;
      setIsReady(true);
      ensureProfileController();
      if (autoFit) {
        instance.fitView({ padding: fitPadding, duration: 200, maxZoom: 0.8 });
        scheduleFrame(() => {
          const viewport = instance.getViewport();
          viewportRef.current = viewport;
          syncScrollToViewport(viewport);
          console.log("[RoutingCanvas] Auto-fit viewport 적용:", viewport);
        });
      }
    },
    [autoFit, fitPadding, ensureProfileController, scheduleFrame, syncScrollToViewport, flowNodes.length],
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

  // Edge selection handler
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id);
      const createdBy = edge.data?.createdBy ?? "auto";
      if (createdBy === "manual") {
        setSelectedConnection(edge.id);
      } else {
        setSelectedConnection(null);
      }
    },
    [setSelectedConnection],
  );

  // Delete key handler for removing selected edge
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Delete" && selectedEdgeId) {
        const connection = connections.find((item) => item.id === selectedEdgeId);
        if (connection && connection.metadata?.createdBy === "manual") {
          removeConnection(selectedEdgeId);
        }
        setSelectedEdgeId(null);
        setSelectedConnection(null);
      }
      if (event.key === "Escape" && selectedEdgeId) {
        setSelectedEdgeId(null);
        setSelectedConnection(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connections, removeConnection, selectedEdgeId, setSelectedConnection]);

  // Connection handler - creates new edge when dragging from one node to another
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return;
      }
      addConnection(connection.source, connection.target);
    },
    [addConnection],
  );

  // Reconnection handler - updates existing edge when reconnecting
  const handleReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!newConnection.source || !newConnection.target) return;

      const existing = connections.find((conn) => conn.id === oldEdge.id);
      if (existing && (existing.metadata?.createdBy ?? "auto") === "manual") {
        updateConnection(oldEdge.id, {
          sourceNodeId: newConnection.source,
          targetNodeId: newConnection.target,
        });
        setSelectedEdgeId(oldEdge.id);
        setSelectedConnection(oldEdge.id);
        return;
      }

      // Validate: no self-connections
      if (newConnection.source === newConnection.target) {
        console.warn('Cannot connect node to itself');
        return;
      }

      // Find the node being reconnected in timeline
      const reconnectedNodeId = oldEdge.target; // The node whose input is being changed
      const newSourceNodeId = newConnection.source;

      // Find indices in timeline
      const reconnectedNodeIndex = timeline.findIndex(step => step.id === reconnectedNodeId);
      const newSourceIndex = timeline.findIndex(step => step.id === newSourceNodeId);

      if (reconnectedNodeIndex === -1 || newSourceIndex === -1) {
        console.warn('Could not find nodes in timeline');
        return;
      }

      // Calculate new position: right after the new source
      const newIndex = newSourceIndex + 1;

      // Only move if position actually changes
      if (reconnectedNodeIndex !== newIndex) {
        moveStep(reconnectedNodeId, newIndex);
      }
    },
    [connections, moveStep, setSelectedConnection, timeline, updateConnection],
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
      {/* Custom Process Nodes - User-managed custom nodes */}
      <CustomNodeList className="mb-4" />

      {/* Candidate Node Tabs - Shows similar item candidates */}
      <CandidateNodeTabs className="mb-4" />

      {/* Similar Items Candidate List */}
      {productTabs.length > 1 && (
        <div className="candidate-list" style={{
          display: 'flex',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #475569',
          overflowX: 'auto',
          alignItems: 'center',
        }}>
          <span style={{
            color: '#94a3b8',
            fontSize: '13px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}>
            유사 품목:
          </span>
          {productTabs.map((tab, index) => {
            const isActive = tab.id === activeProductId;
            // Calculate similarity score from first timeline step
            const firstStep = tab.timeline[0];
            const similarity = firstStep?.confidence ?? firstStep?.similarity ?? null;
            const similarityPercent = similarity !== null ? Math.round(similarity * 100) : null;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onCandidateSelect(tab.id)}
                className="candidate-node"
                data-active={isActive}
                data-testid={`candidate-node-${index}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '8px 12px',
                  backgroundColor: isActive ? '#3b82f6' : '#334155',
                  border: isActive ? '2px solid #60a5fa' : '1px solid #475569',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  minWidth: '80px',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#475569';
                    e.currentTarget.style.borderColor = '#64748b';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#334155';
                    e.currentTarget.style.borderColor = '#475569';
                  }
                }}
              >
                <span style={{
                  color: isActive ? '#fff' : '#e2e8f0',
                  fontSize: '12px',
                  fontWeight: 600,
                }}>
                  {tab.productCode}
                </span>
                {similarityPercent !== null && (
                  <span style={{
                    color: isActive ? '#dbeafe' : '#94a3b8',
                    fontSize: '11px',
                    fontWeight: 500,
                  }}>
                    {similarityPercent}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

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
            onEdgeClick={handleEdgeClick}
            onConnect={handleConnect}
            onReconnect={handleReconnect}
            onInit={handleInit}
            onMove={handleMove}
            onNodeDragStop={handleNodeDragStop}
            nodesDraggable
            nodesConnectable={true}
            reconnectRadius={20}
            elementsSelectable
            proOptions={{ hideAttribution: true }}
            defaultViewport={{ x: 0, y: 50, zoom: 0.8 }}
            minZoom={0.5}
            maxZoom={1.5}
            className="timeline-flow__reactflow"
            style={{ width: "100%", height: "100%" }}
            connectionLineStyle={{
              stroke: 'rgb(56, 189, 248)',
              strokeWidth: 2,
            }}
            connectionLineType={ConnectionLineType.SmoothStep}
          >
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
          currentResourceGroupId={editingStep.resourceGroupId ?? undefined}
          currentResourceGroupName={editingStep.resourceGroupName ?? undefined}
          onSave={handleSaveTimeEdit}
          onSaveResourceGroup={(stepId, resourceGroupId, resourceGroupName) => {
            updateStepResourceGroup(stepId, resourceGroupId, resourceGroupName);
          }}
        />
      )}
    </>
  );
}

export function RoutingCanvas(props: RoutingCanvasProps) {
  const timeline = useRoutingStore((state) => state.timeline);
  const connections = useRoutingStore((state) => state.connections);
  const moveStep = useRoutingStore((state) => state.moveStep);
  const insertOperation = useRoutingStore((state) => state.insertOperation);
  const removeStep = useRoutingStore((state) => state.removeStep);
  const updateStepTimes = useRoutingStore((state) => state.updateStepTimes);
  const updateStepResourceGroup = useRoutingStore((state) => state.updateStepResourceGroup);
  const addConnection = useRoutingStore((state) => state.addConnection);
  const removeConnection = useRoutingStore((state) => state.removeConnection);
  const updateConnection = useRoutingStore((state) => state.updateConnection);
  const setSelectedConnection = useRoutingStore((state) => state.setSelectedConnection);
  const productTabs = useRoutingStore((state) => state.productTabs);
  const activeProductId = useRoutingStore((state) => state.activeProductId);
  const setActiveProduct = useRoutingStore((state) => state.setActiveProduct);

  return (
    <ReactFlowProvider>
      <RoutingCanvasView
        timeline={timeline}
        moveStep={moveStep}
        insertOperation={insertOperation}
        removeStep={removeStep}
        updateStepTimes={updateStepTimes}
        productTabs={productTabs}
        activeProductId={activeProductId}
        onCandidateSelect={setActiveProduct}
        connections={connections}
        addConnection={addConnection}
        removeConnection={removeConnection}
        updateConnection={updateConnection}
        setSelectedConnection={setSelectedConnection}
        {...props}
      />
    </ReactFlowProvider>
  );
}

export default RoutingCanvas;
export type { RoutingCanvasProfileController,RoutingCanvasProps };
