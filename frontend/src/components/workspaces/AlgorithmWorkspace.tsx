import type {
  PredictorRuntimeModel,
  SQLConfigModel,
  TrainerRuntimeModel,
  WorkflowConfigPatch,
  WorkflowConfigResponse,
  WorkflowGraphEdge,
  WorkflowGraphNode,
} from "@app-types/workflow";
import { CardShell } from "@components/common/CardShell";
import { DialogContainer } from "@components/common/DialogContainer";
import { fetchWorkflowConfig, patchWorkflowConfig, postUiAudit } from "@lib/apiClient";
import { cn } from "@lib/classNames";
import { useWorkflowGraphHistory } from "@store/workflowGraphStore";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactFlow, {
  Background,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  NodeProps,
  type NodeTypes,
  Position,
  ReactFlowInstance,
  ReactFlowProvider,
} from "reactflow";

const getConnectionLabel = (value: Connection): string | undefined => {
  if ("label" in value && typeof (value as { label?: unknown }).label === "string") {
    return (value as { label: string }).label;
  }
  return undefined;
};

interface NodeLibraryItem {
  id: string;
  label: string;
  category: string;
  description?: string;
  status?: string;
}

const NODE_LIBRARY: NodeLibraryItem[] = [
  {
    id: "trainer",
    label: "Train Model",
    category: "trainer",
    description: "유사도 임계값 · Trim 설정",
  },
  {
    id: "predictor",
    label: "Predictor",
    category: "predictor",
    description: "Top-K 조합 · 유사도",
  },
  {
    id: "sql-mapper",
    label: "SQL Mapper",
    category: "sql",
    description: "PowerQuery 프로파일",
  },
  {
    id: "data-source",
    label: "Data Source",
    category: "data",
    description: "ERP / Supabase 연동",
  },
  {
    id: "exporter",
    label: "Exporter",
    category: "export",
    description: "CSV · Excel · JSON",
  },
];

interface ModuleNodeData {
  label: string;
  category?: string;
  status?: string;
  description?: string;
  metrics?: Record<string, unknown>;
  docRefs: string[];
}

function ModuleNode({ data }: NodeProps<ModuleNodeData>) {
  const metricEntries = useMemo(() => {
    if (!data.metrics) return [] as [string, unknown][];
    return Object.entries(data.metrics).slice(0, 2);
  }, [data.metrics]);

  return (
    <CardShell className="w-60" padding="sm" tone="overlay" innerClassName="px-4 py-3" interactive={false}>
      <span className="text-xs uppercase tracking-wide text-accent-soft/90">
        {data.category ?? "module"}
      </span>
      <h3 className="mt-1 text-lg font-semibold text-accent-strong">{data.label}</h3>
      {data.status ? (
        <p className="mt-1 text-xs font-medium text-accent">상태: {data.status}</p>
      ) : null}
      {data.description ? (
        <p className="mt-2 text-xs leading-relaxed text-muted">{data.description}</p>
      ) : null}
      {metricEntries.length > 0 ? (
        <dl className="mt-3 space-y-1 text-[11px] text-muted">
          {metricEntries.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-2">
              <dt className="font-semibold text-accent-soft">{key}</dt>
              <dd className="truncate text-right text-foreground">
                {typeof value === "number" ? value.toString() : String(value ?? "-")}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {data.docRefs.length > 0 ? (
        <div className="mt-3 space-y-1 text-[11px] text-muted">
          <p className="font-semibold text-accent-soft">문서</p>
          <ul className="list-disc space-y-1 pl-4">
            {data.docRefs.slice(0, 2).map((ref) => (
              <li key={ref} className="truncate text-foreground/80" title={ref}>
                {ref}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </CardShell>
  );
}

type WorkflowEdgeData = {
  kind: WorkflowGraphEdge["kind"];
};

type WorkflowNode = Node<ModuleNodeData>;
type WorkflowEdge = Edge<WorkflowEdgeData>;
type WorkflowReactFlowInstance = ReactFlowInstance<ModuleNodeData, WorkflowEdgeData>;

const nodeTypes: NodeTypes = {
  module: ModuleNode,
};

interface NodeFormState {
  label: string;
  status: string;
  description: string;
  similarityThreshold: string;
  trimStdEnabled: boolean;
  trimLowerPercent: string;
  trimUpperPercent: string;
  predictorSimilarity: string;
  maxRoutingVariants: string;
  sqlProfile: string;
}

const INITIAL_FORM: NodeFormState = {
  label: "",
  status: "",
  description: "",
  similarityThreshold: "0.8",
  trimStdEnabled: true,
  trimLowerPercent: "0.05",
  trimUpperPercent: "0.95",
  predictorSimilarity: "0.8",
  maxRoutingVariants: "4",
  sqlProfile: "",
};

const createReactFlowNodes = (nodes: WorkflowGraphNode[]): WorkflowNode[] =>
  nodes.map((node) => ({
    id: node.id,
    type: "module",
    position: node.position ?? { x: 0, y: 0 },
    data: {
      label: node.label,
      category: node.category,
      status: node.status,
      description:
        typeof node.settings?.description === "string"
          ? (node.settings.description as string)
          : undefined,
      metrics: node.metrics,
      docRefs: node.doc_refs ?? [],
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));

const createReactFlowEdges = (edges: WorkflowGraphEdge[]): WorkflowEdge[] =>
  edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: edge.kind !== "data-flow",
    data: { kind: edge.kind },
    style: {
      stroke:
        edge.kind === "ui-flow"
          ? "#34d399"
          : edge.kind === "model-flow"
            ? "#38bdf8"
            : "#0ea5e9",
      strokeWidth: 2,
    },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 8,
    labelBgStyle: {
      fill: "rgba(15, 23, 42, 0.8)",
      stroke: "rgba(56, 189, 248, 0.4)",
    },
    labelStyle: { fill: "#e0f2fe", fontSize: 12, fontWeight: 600 },
  }));

const createLibraryNode = (
  item: NodeLibraryItem,
  position: { x: number; y: number },
): WorkflowGraphNode => ({
  id: `${item.id}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`,
  label: item.label,
  type: "module",
  category: item.category,
  status: item.status ?? "draft",
  position,
  settings: { description: item.description ?? "" },
  metrics: {},
  doc_refs: [],
});

interface NodeSettingsDialogProps {
  node: WorkflowGraphNode;
  trainer: TrainerRuntimeModel;
  predictor: PredictorRuntimeModel;
  sql: SQLConfigModel;
  form: NodeFormState;
  onChange: (form: NodeFormState) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  saving: boolean;
}

function NodeSettingsDialog({
  node,
  trainer,
  predictor,
  sql,
  form,
  onChange,
  onClose,
  onSave,
  saving,
}: NodeSettingsDialogProps) {
  const titleId = `node-settings-${node.id}`;

  return (
    <DialogContainer
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="z-50"
      surfaceClassName="flex max-h-[70vh] flex-col gap-6"
      maxWidth={720}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent-soft/80">
            {node.category ?? "module"}
          </p>
          <h2 id={titleId} className="text-2xl font-semibold text-accent-strong">
            {node.label} 설정
          </h2>
          <p className="mt-1 text-sm text-muted">
            더블클릭한 도형의 속성을 편집하고 SAVE 하면 즉시 반영됩니다.
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn-secondary">
          닫기
        </button>
      </header>
      <div className="flex-1 space-y-6 overflow-y-auto pr-2">
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-accent-strong">기본 정보</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-muted-strong">레이블</span>
              <input
                type="text"
                value={form.label}
                onChange={(event) => onChange({ ...form, label: event.target.value })}
                className="form-control"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-muted-strong">상태</span>
              <input
                type="text"
                value={form.status}
                onChange={(event) => onChange({ ...form, status: event.target.value })}
                className="form-control"
              />
            </label>
          </div>
          <label className="block space-y-2 text-sm">
            <span className="text-muted-strong">설명</span>
            <textarea
              value={form.description}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
              rows={3}
              className="form-control"
            />
          </label>
        </section>

        {node.id === "trainer" ? (
          <section className={cn("form-section form-section--dense space-y-3")}> 
            <h3 className="text-lg font-semibold text-accent-strong">트레이너 런타임</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="text-muted-strong">유사도 임계값</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={form.similarityThreshold}
                  onChange={(event) => onChange({ ...form, similarityThreshold: event.target.value })}
                  className="form-control"
                />
              </label>
              <label className="form-toggle text-sm">
                <input
                  type="checkbox"
                  checked={form.trimStdEnabled}
                  onChange={(event) => onChange({ ...form, trimStdEnabled: event.target.checked })}
                  className="form-checkbox"
                />
                <span>상/하위 Trim 표준편차 적용</span>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="text-muted-strong">하위 Trim 비율 (0~1)</span>
                <input
                  type="number"
                  min={0}
                  max={0.5}
                  step={0.01}
                  value={form.trimLowerPercent}
                  onChange={(event) => onChange({ ...form, trimLowerPercent: event.target.value })}
                  className="form-control"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-muted-strong">상위 Trim 비율 (0~1)</span>
                <input
                  type="number"
                  min={0.5}
                  max={1}
                  step={0.01}
                  value={form.trimUpperPercent}
                  onChange={(event) => onChange({ ...form, trimUpperPercent: event.target.value })}
                  className="form-control"
                />
              </label>
            </div>
            <p className="text-xs text-muted">
              현재 임계값: {trainer.similarity_threshold} · Trim: {trainer.trim_lower_percent}~
              {trainer.trim_upper_percent}
            </p>
          </section>
        ) : null}

        {node.id === "predictor" ? (
          <section className={cn("form-section form-section--dense space-y-3")}>
            <h3 className="text-lg font-semibold text-accent-strong">예측기 파라미터</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="text-muted-strong">상위 유사도 임계값</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={form.predictorSimilarity}
                  onChange={(event) => onChange({ ...form, predictorSimilarity: event.target.value })}
                  className="form-control"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-muted-strong">최대 라우팅 조합 수</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.maxRoutingVariants}
                  onChange={(event) => onChange({ ...form, maxRoutingVariants: event.target.value })}
                  className="form-control"
                />
              </label>
            </div>
            <p className="text-xs text-muted">
              현재 설정: Top {predictor.max_routing_variants}, 임계 {predictor.similarity_high_threshold}
            </p>
          </section>
        ) : null}

        {node.id === "sql-mapper" ? (
          <section className={cn("form-section form-section--dense space-y-3")}>
            <h3 className="text-lg font-semibold text-accent-strong">SQL 프로파일</h3>
            <label className="space-y-2 text-sm">
              <span className="text-muted-strong">활성 프로파일</span>
              <select
                value={form.sqlProfile}
                onChange={(event) => onChange({ ...form, sqlProfile: event.target.value })}
                className="form-control"
              >
                {sql.profiles.map((profile) => (
                  <option key={profile.name} value={profile.name}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted">
              7.1 구조와 매핑된 컬럼 수: {sql.output_columns.length}
            </p>
          </section>
        ) : null}
      </div>
      <footer className="flex items-center justify-between">
        <span className="text-xs text-muted">
          변경 사항은 SAVE 시 백엔드 Workflow JSON과 동기화됩니다.
        </span>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            취소
          </button>
          <button type="button" onClick={onSave} disabled={saving} className="btn-primary">
            {saving ? "저장 중..." : "SAVE"}
          </button>
        </div>
      </footer>
    </DialogContainer>
  );
}

export function AlgorithmWorkspace() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [workflowConfig, setWorkflowConfig] = useState<WorkflowConfigResponse | null>(null);
  const [graphNodes, setGraphNodes] = useState<WorkflowGraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<WorkflowGraphEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [formState, setFormState] = useState<NodeFormState>(INITIAL_FORM);
  const [reactFlowInstance, setReactFlowInstance] = useState<WorkflowReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<WorkflowGraphNode[]>([]);
  const edgesRef = useRef<WorkflowGraphEdge[]>([]);

  const { pushSnapshot, undo, redo, canUndo, canRedo, reset } = useWorkflowGraphHistory(
    (state) => ({
      pushSnapshot: state.pushSnapshot,
      undo: state.undo,
      redo: state.redo,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      reset: state.reset,
    }),
  );

  useEffect(() => {
    nodesRef.current = graphNodes;
  }, [graphNodes]);

  useEffect(() => {
    edgesRef.current = graphEdges;
  }, [graphEdges]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetchWorkflowConfig();
        if (cancelled) return;
        setWorkflowConfig(response);
        const nodes = response.graph?.nodes ?? [];
        const edges = response.graph?.edges ?? [];
        setGraphNodes(nodes);
        setGraphEdges(edges);
        reset();
        setStatusMessage("워크플로우 구성을 불러왔습니다.");
        const correlationId = (response as { correlation_id?: string | null }).correlation_id ?? undefined;
        void postUiAudit({
          action: "ui.algorithm.read",
          payload: {
            node_count: nodes.length,
            edge_count: edges.length,
            correlation_id: correlationId,
          },
        });
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setErrorMessage("워크플로우 설정을 불러오지 못했습니다.");
          const message = error instanceof Error ? error.message : String(error);
          void postUiAudit({
            action: "ui.algorithm.read.error",
            payload: {
              message,
            },
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [reset]);

  const reactFlowNodes = useMemo(() => createReactFlowNodes(graphNodes), [graphNodes]);
  const reactFlowEdges = useMemo(() => createReactFlowEdges(graphEdges), [graphEdges]);

  const handleInit = useCallback((instance: WorkflowReactFlowInstance) => {
    setReactFlowInstance(instance);
  }, []);

  const selectedNode = useMemo(
    () => graphNodes.find((node) => node.id === selectedNodeId) ?? null,
    [graphNodes, selectedNodeId],
  );

  const hydrateFormFromNode = useCallback(
    (node: WorkflowGraphNode, config: WorkflowConfigResponse | null) => {
      const trainer = config?.trainer;
      const predictor = config?.predictor;
      const sql = config?.sql;
      setFormState({
        label: node.label,
        status: node.status ?? "",
        description:
          typeof node.settings?.description === "string"
            ? (node.settings.description as string)
            : "",
        similarityThreshold: trainer ? trainer.similarity_threshold.toString() : INITIAL_FORM.similarityThreshold,
        trimStdEnabled: trainer ? trainer.trim_std_enabled : INITIAL_FORM.trimStdEnabled,
        trimLowerPercent: trainer ? trainer.trim_lower_percent.toString() : INITIAL_FORM.trimLowerPercent,
        trimUpperPercent: trainer ? trainer.trim_upper_percent.toString() : INITIAL_FORM.trimUpperPercent,
        predictorSimilarity: predictor
          ? predictor.similarity_high_threshold.toString()
          : INITIAL_FORM.predictorSimilarity,
        maxRoutingVariants: predictor
          ? predictor.max_routing_variants.toString()
          : INITIAL_FORM.maxRoutingVariants,
        sqlProfile: sql?.active_profile ?? sql?.profiles[0]?.name ?? INITIAL_FORM.sqlProfile,
      });
    },
    [],
  );

  useEffect(() => {
    if (selectedNode) {
      hydrateFormFromNode(selectedNode, workflowConfig);
    }
  }, [selectedNode, workflowConfig, hydrateFormFromNode]);

  const persistWorkflow = useCallback(
    async (
      payload: WorkflowConfigPatch,
      successMessage?: string,
    ): Promise<{ ok: true; response: WorkflowConfigResponse } | { ok: false; error: unknown }> => {
      setSaving(true);
      let result: { ok: true; response: WorkflowConfigResponse } | { ok: false; error: unknown } = {
        ok: false,
        error: null,
      };
      try {
        const response = await patchWorkflowConfig(payload);
        setWorkflowConfig(response);
        const nodes = response.graph?.nodes ?? [];
        const edges = response.graph?.edges ?? [];
        setGraphNodes(nodes);
        setGraphEdges(edges);
        reset();
        setStatusMessage(successMessage ?? "워크플로우 구성을 저장했습니다.");
        setErrorMessage(null);
        const correlationId = (response as { correlation_id?: string | null }).correlation_id ?? undefined;
        void postUiAudit({
          action: "ui.algorithm.save",
          payload: {
            node_count: nodes.length,
            edge_count: edges.length,
            correlation_id: correlationId,
          },
        });
        result = { ok: true, response };
      } catch (error) {
        console.error(error);
        setErrorMessage("워크플로우 저장에 실패했습니다. 입력값을 확인하세요.");
        const message = error instanceof Error ? error.message : String(error);
        const correlationId = (error as { correlation_id?: string | null } | undefined)?.correlation_id ?? undefined;
        void postUiAudit({
          action: "ui.algorithm.save.error",
          payload: {
            message,
            node_count: nodesRef.current.length,
            edge_count: edgesRef.current.length,
            correlation_id: correlationId,
          },
        });
        result = { ok: false, error };
      } finally {
        setSaving(false);
      }
      return result;
    },
    [reset],
  );

  const handleSaveGraph = useCallback(async () => {
    const result = await persistWorkflow(
      {
        graph: {
          nodes: nodesRef.current,
          edges: edgesRef.current,
        },
      },
      "그래프 레이아웃을 저장했습니다.",
    );
    const basePayload = {
      node_count: nodesRef.current.length,
      edge_count: edgesRef.current.length,
      correlation_id: result.ok
        ? ((result.response as { correlation_id?: string | null }).correlation_id ?? undefined)
        : undefined,
    };
    if (result.ok) {
      void postUiAudit({
        action: "ui.algorithm.graph.save",
        payload: basePayload,
      });
    } else {
      void postUiAudit({
        action: "ui.algorithm.graph.save.error",
        payload: {
          ...basePayload,
          message: result.error instanceof Error ? result.error.message : String(result.error),
        },
      });
    }
  }, [persistWorkflow]);

  const handleDialogSave = useCallback(async () => {
    if (!selectedNode || !workflowConfig) {
      return;
    }

    const updatedNodes = nodesRef.current.map((node) =>
      node.id === selectedNode.id
        ? {
            ...node,
            label: formState.label,
            status: formState.status || undefined,
            settings: {
              ...node.settings,
              description: formState.description,
            },
          }
        : node,
    );

    const payload: WorkflowConfigPatch = {
      graph: {
        nodes: updatedNodes,
      },
    };

    const trainer = workflowConfig.trainer;
    const predictor = workflowConfig.predictor;

    if (selectedNode.id === "trainer") {
      const similarity = Number.parseFloat(formState.similarityThreshold);
      const trimLower = Number.parseFloat(formState.trimLowerPercent);
      const trimUpper = Number.parseFloat(formState.trimUpperPercent);
      payload.trainer = {
        similarity_threshold: Number.isFinite(similarity) ? similarity : trainer.similarity_threshold,
        trim_std_enabled: formState.trimStdEnabled,
        trim_lower_percent: Number.isFinite(trimLower) ? trimLower : trainer.trim_lower_percent,
        trim_upper_percent: Number.isFinite(trimUpper) ? trimUpper : trainer.trim_upper_percent,
      };
    }

    if (selectedNode.id === "predictor") {
      const similarity = Number.parseFloat(formState.predictorSimilarity);
      const variants = Number.parseInt(formState.maxRoutingVariants, 10);
      payload.predictor = {
        similarity_high_threshold: Number.isFinite(similarity)
          ? similarity
          : predictor.similarity_high_threshold,
        max_routing_variants: Number.isFinite(variants) ? variants : predictor.max_routing_variants,
      };
    }

    if (selectedNode.id === "sql-mapper") {
      payload.sql = {
        active_profile: formState.sqlProfile,
      };
    }

    const result = await persistWorkflow(payload, `${formState.label} 설정을 저장했습니다.`);
    const correlationId = result.ok
      ? ((result.response as { correlation_id?: string | null }).correlation_id ?? undefined)
      : undefined;
    const auditPayload = {
      node_id: selectedNode.id,
      node_label: formState.label,
      node_category: selectedNode.category,
      correlation_id: correlationId,
    };
    if (result.ok) {
      void postUiAudit({
        action: "ui.algorithm.node.save",
        payload: auditPayload,
      });
    } else {
      void postUiAudit({
        action: "ui.algorithm.node.save.error",
        payload: {
          ...auditPayload,
          message: result.error instanceof Error ? result.error.message : String(result.error),
        },
      });
    }
    setDialogOpen(false);
  }, [formState, persistWorkflow, selectedNode, workflowConfig]);

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: WorkflowNode) => {
      setSelectedNodeId(node.id);
      setDialogOpen(true);
    },
    [],
  );

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: WorkflowNode) => {
    setSelectedNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: WorkflowNode) => {
      setGraphNodes((prev) => {
        const next = prev.map((item) =>
          item.id === node.id
            ? {
                ...item,
                position: node.position ?? { x: 0, y: 0 },
              }
            : item,
        );
        pushSnapshot({ nodes: next, edges: edgesRef.current }, "position");
        return next;
      });
    },
    [pushSnapshot],
  );

  const handleNodesDelete = useCallback(
    (deleted: WorkflowNode[]) => {
      if (deleted.length === 0) return;
      setGraphNodes((prev) => {
        const deletedIds = new Set(deleted.map((node) => node.id));
        const nextNodes = prev.filter((node) => !deletedIds.has(node.id));
        const nextEdges = edgesRef.current.filter(
          (edge) => !deletedIds.has(edge.source) && !deletedIds.has(edge.target),
        );
        setGraphEdges(nextEdges);
        pushSnapshot({ nodes: nextNodes, edges: nextEdges }, "delete-node");
        return nextNodes;
      });
    },
    [pushSnapshot],
  );

  const handleEdgesDelete = useCallback(
    (edgesToDelete: WorkflowEdge[]) => {
      if (edgesToDelete.length === 0) return;
      setGraphEdges((prev) => {
        const deleteIds = new Set(edgesToDelete.map((edge) => edge.id));
        const nextEdges = prev.filter((edge) => !deleteIds.has(edge.id));
        pushSnapshot({ nodes: nodesRef.current, edges: nextEdges }, "disconnect");
        return nextEdges;
      });
    },
    [pushSnapshot],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (source == null || target == null) return;
      const sourceId = typeof source === "string" ? source : String(source);
      const targetId = typeof target === "string" ? target : String(target);
      setGraphEdges((prev) => {
        const alreadyExists = prev.some(
          (edge) => edge.source === sourceId && edge.target === targetId,
        );
        if (alreadyExists) {
          return prev;
        }
        const id = `${sourceId}-${targetId}-${Date.now().toString(36)}`;
        const connectionLabel = getConnectionLabel(connection);
        const newEdge: WorkflowGraphEdge = {
          id,
          source: sourceId,
          target: targetId,
          kind: "data-flow",
          label: connectionLabel,
        };
        const nextEdges = [...prev, newEdge];
        pushSnapshot({ nodes: nodesRef.current, edges: nextEdges }, "connect");
        return nextEdges;
      });
    },
    [pushSnapshot],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!reactFlowInstance || !wrapperRef.current) return;
      const serialized = event.dataTransfer.getData("application/reactflow/node");
      if (!serialized) return;
      let parsed: NodeLibraryItem | null = null;
      try {
        parsed = JSON.parse(serialized) as NodeLibraryItem;
      } catch (error) {
        console.error("Failed to parse node payload", error);
      }
      if (!parsed) return;
      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      const newNode = createLibraryNode(parsed, position);
      setGraphNodes((prev) => {
        const next = [...prev, newNode];
        pushSnapshot({ nodes: next, edges: edgesRef.current }, "insert-node");
        return next;
      });
      setSelectedNodeId(newNode.id);
      setStatusMessage(`${parsed.label} 노드를 추가했습니다.`);
    },
    [pushSnapshot, reactFlowInstance],
  );

  const handleDragStart = useCallback((event: React.DragEvent<HTMLButtonElement>, item: NodeLibraryItem) => {
    event.dataTransfer.setData("application/reactflow/node", JSON.stringify(item));
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const handleUndo = useCallback(() => {
    const snapshot = undo({ nodes: nodesRef.current, edges: edgesRef.current });
    if (snapshot) {
      setGraphNodes(snapshot.nodes);
      setGraphEdges(snapshot.edges);
    }
  }, [undo]);

  const handleRedo = useCallback(() => {
    const snapshot = redo({ nodes: nodesRef.current, edges: edgesRef.current });
    if (snapshot) {
      setGraphNodes(snapshot.nodes);
      setGraphEdges(snapshot.edges);
    }
  }, [redo]);

  return (
    <div className="flex h-full flex-col gap-6" role="region" aria-label="알고리즘 편집 워크스페이스">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-accent-strong">워크플로우 알고리즘 편집기</h1>
          <p className="text-sm text-muted">
            ReactFlow 캔버스에서 노드를 구성하고, 더블클릭으로 런타임 파라미터를 동기화합니다.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {statusMessage ? <span className="text-emerald-300">{statusMessage}</span> : null}
          {errorMessage ? <span className="text-rose-300">{errorMessage}</span> : null}
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className="btn-secondary text-sm disabled:cursor-not-allowed"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            className="btn-secondary text-sm disabled:cursor-not-allowed"
          >
            Redo
          </button>
          <button
            type="button"
            onClick={handleSaveGraph}
            disabled={saving || loading}
            className="btn-primary text-sm disabled:cursor-not-allowed"
          >
            {saving ? "저장 중..." : "레이아웃 SAVE"}
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[280px_1fr] gap-6 lg:grid-cols-[280px_1fr_320px]">
        <CardShell
          as="aside"
          tone="soft"
          padding="md"
          innerClassName="flex h-full flex-col gap-4"
          interactive={false}
        >
          <header className="space-y-1">
            <h2 className="text-lg font-semibold text-accent-strong">노드 라이브러리</h2>
            <p className="text-sm text-muted">Trainer · Predictor · Utility</p>
          </header>
          <ul className="space-y-3">
            {NODE_LIBRARY.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => handleDragStart(event, item)}
                  className="w-full rounded-2xl border border-soft surface-card px-4 py-3 text-left transition hover:border-accent-soft hover:text-accent"
                >
                  <h3 className="text-sm font-semibold text-foreground">{item.label}</h3>
                  <p className="text-xs text-muted">{item.description}</p>
                </button>
              </li>
            ))}
          </ul>
        </CardShell>

        <section
          className="relative overflow-hidden rounded-3xl border border-soft surface-card-overlay shadow-elevated"
          ref={wrapperRef}
        >
          <div className="canvas-panel" aria-hidden="true" />
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            </div>
          ) : null}
          <ReactFlowProvider>
            <ReactFlow
              nodeTypes={nodeTypes}
              nodes={reactFlowNodes}
              edges={reactFlowEdges}
              onInit={handleInit}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              onNodeDragStop={handleNodeDragStop}
              onNodesDelete={handleNodesDelete}
              onEdgesDelete={handleEdgesDelete}
              onConnect={handleConnect}
              fitView
              className="rounded-3xl"
            >
              <MiniMap pannable zoomable />
              <Controls />
              <Background gap={24} color="#1e293b" />
            </ReactFlow>
          </ReactFlowProvider>
        </section>

        {selectedNode && workflowConfig ? (
          <CardShell
            as="aside"
            tone="soft"
            padding="md"
            className="hidden lg:block"
            innerClassName="flex h-full flex-col"
            interactive={false}
          >
            <header className="mb-4 space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted">Inspector</p>
              <h2 className="text-lg font-semibold text-accent-strong">{selectedNode.label}</h2>
            </header>
            <dl className="space-y-2 text-sm text-muted-strong">
              <div>
                <dt className="font-semibold text-foreground">상태</dt>
                <dd>{selectedNode.status ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">설명</dt>
                <dd className="whitespace-pre-wrap text-xs text-muted">
                  {typeof selectedNode.settings?.description === "string"
                    ? (selectedNode.settings.description as string)
                    : "-"}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setDialogOpen(true)} className="btn-secondary flex-1 text-xs">
                설정 다이얼로그
              </button>
              <button
                type="button"
                onClick={handleSaveGraph}
                disabled={saving || loading}
                className="btn-primary flex-1 text-xs disabled:cursor-not-allowed"
              >
                {saving ? "저장 중" : "SAVE"}
              </button>
            </div>
          </CardShell>
        ) : null}
      </div>

      {selectedNode && workflowConfig && isDialogOpen ? (
        <NodeSettingsDialog
          node={selectedNode}
          trainer={workflowConfig.trainer}
          predictor={workflowConfig.predictor}
          sql={workflowConfig.sql}
          form={formState}
          onChange={setFormState}
          onClose={() => setDialogOpen(false)}
          onSave={handleDialogSave}
          saving={saving}
        />
      ) : null}
    </div>
  );
}
