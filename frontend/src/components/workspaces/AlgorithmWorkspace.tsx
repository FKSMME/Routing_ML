import type {
  PredictorRuntimeModel,
  SQLConfigModel,
  TrainerRuntimeModel,
  WorkflowConfigPatch,
  WorkflowConfigResponse,
  WorkflowGraphEdge,
  WorkflowGraphNode,
} from "@app-types/workflow";
import { fetchWorkflowConfig, patchWorkflowConfig } from "@lib/apiClient";
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
  Position,
  ReactFlowInstance,
  ReactFlowProvider,
  type NodeTypes,
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
    <div className="w-60 rounded-2xl border border-sky-400/70 bg-slate-950/80 px-4 py-3 text-slate-100 shadow-lg shadow-sky-900/40">
      <span className="text-xs uppercase tracking-wide text-sky-300/80">
        {data.category ?? "module"}
      </span>
      <h3 className="mt-1 text-lg font-semibold text-sky-100">{data.label}</h3>
      {data.status ? (
        <p className="mt-1 text-xs font-medium text-sky-400">상태: {data.status}</p>
      ) : null}
      {data.description ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-300">{data.description}</p>
      ) : null}
      {metricEntries.length > 0 ? (
        <dl className="mt-3 space-y-1 text-[11px] text-slate-400">
          {metricEntries.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-2">
              <dt className="font-semibold text-slate-300">{key}</dt>
              <dd className="truncate text-right text-slate-200">
                {typeof value === "number" ? value.toString() : String(value ?? "-")}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {data.docRefs.length > 0 ? (
        <div className="mt-3 space-y-1 text-[11px] text-slate-400">
          <p className="font-semibold text-slate-200">문서</p>
          <ul className="list-disc space-y-1 pl-4">
            {data.docRefs.slice(0, 2).map((ref) => (
              <li key={ref} className="truncate" title={ref}>
                {ref}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-sky-300/80">
              {node.category ?? "module"}
            </p>
            <h2 className="text-2xl font-semibold text-sky-100">{node.label} 설정</h2>
            <p className="mt-1 text-sm text-slate-300">
              더블클릭한 도형의 속성을 편집하고 SAVE 하면 즉시 반영됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-600 px-3 py-1 text-sm text-slate-300 transition hover:border-slate-400 hover:text-slate-100"
          >
            닫기
          </button>
        </header>
        <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-2">
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-sky-200">기본 정보</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="text-slate-300">레이블</span>
                <input
                  type="text"
                  value={form.label}
                  onChange={(event) => onChange({ ...form, label: event.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-slate-300">상태</span>
                <input
                  type="text"
                  value={form.status}
                  onChange={(event) => onChange({ ...form, status: event.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                />
              </label>
            </div>
            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">설명</span>
              <textarea
                value={form.description}
                onChange={(event) => onChange({ ...form, description: event.target.value })}
                rows={3}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
              />
            </label>
          </section>

          {node.id === "trainer" ? (
            <section className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4">
              <h3 className="text-lg font-semibold text-sky-200">트레이너 런타임</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">유사도 임계값</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={form.similarityThreshold}
                    onChange={(event) => onChange({ ...form, similarityThreshold: event.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-slate-700/80 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.trimStdEnabled}
                    onChange={(event) => onChange({ ...form, trimStdEnabled: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-500"
                  />
                  <span>상/하위 Trim 표준편차 적용</span>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">하위 Trim 비율 (0~1)</span>
                  <input
                    type="number"
                    min={0}
                    max={0.5}
                    step={0.01}
                    value={form.trimLowerPercent}
                    onChange={(event) => onChange({ ...form, trimLowerPercent: event.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">상위 Trim 비율 (0~1)</span>
                  <input
                    type="number"
                    min={0.5}
                    max={1}
                    step={0.01}
                    value={form.trimUpperPercent}
                    onChange={(event) => onChange({ ...form, trimUpperPercent: event.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-400">
                현재 임계값: {trainer.similarity_threshold} · Trim: {trainer.trim_lower_percent}~
                {trainer.trim_upper_percent}
              </p>
            </section>
          ) : null}

          {node.id === "predictor" ? (
            <section className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4">
              <h3 className="text-lg font-semibold text-sky-200">예측기 파라미터</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">상위 유사도 임계값</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={form.predictorSimilarity}
                    onChange={(event) => onChange({ ...form, predictorSimilarity: event.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">최대 라우팅 조합 수</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.maxRoutingVariants}
                    onChange={(event) => onChange({ ...form, maxRoutingVariants: event.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-400">
                현재 설정: Top {predictor.max_routing_variants}, 임계 {predictor.similarity_high_threshold}
              </p>
            </section>
          ) : null}

          {node.id === "sql-mapper" ? (
            <section className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4">
              <h3 className="text-lg font-semibold text-sky-200">SQL 프로파일</h3>
              <label className="space-y-2 text-sm">
                <span className="text-slate-300">활성 프로파일</span>
                <select
                  value={form.sqlProfile}
                  onChange={(event) => onChange({ ...form, sqlProfile: event.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                >
                  {sql.profiles.map((profile) => (
                    <option key={profile.name} value={profile.name}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-slate-400">
                7.1 구조와 매핑된 컬럼 수: {sql.output_columns.length}
              </p>
            </section>
          ) : null}
        </div>
        <footer className="mt-6 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            변경 사항은 SAVE 시 백엔드 Workflow JSON과 동기화됩니다.
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-400 hover:text-slate-100"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-800 disabled:text-slate-400"
            >
              {saving ? "저장 중..." : "SAVE"}
            </button>
          </div>
        </footer>
      </div>
    </div>
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
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setErrorMessage("워크플로우 설정을 불러오지 못했습니다.");
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
    async (payload: WorkflowConfigPatch, successMessage?: string) => {
      setSaving(true);
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
      } catch (error) {
        console.error(error);
        setErrorMessage("워크플로우 저장에 실패했습니다. 입력값을 확인하세요.");
      } finally {
        setSaving(false);
      }
    },
    [reset],
  );

  const handleSaveGraph = useCallback(async () => {
    await persistWorkflow(
      {
        graph: {
          nodes: nodesRef.current,
          edges: edgesRef.current,
        },
      },
      "그래프 레이아웃을 저장했습니다.",
    );
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

    await persistWorkflow(payload, `${formState.label} 설정을 저장했습니다.`);
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
          <h1 className="text-2xl font-semibold text-sky-100">워크플로우 알고리즘 편집기</h1>
          <p className="text-sm text-slate-300">
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
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-sky-400 hover:text-sky-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-sky-400 hover:text-sky-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
          >
            Redo
          </button>
          <button
            type="button"
            onClick={handleSaveGraph}
            disabled={saving || loading}
            className="rounded-lg border border-sky-500/60 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-300 hover:text-sky-200 disabled:cursor-not-allowed disabled:border-slate-600 disabled:text-slate-500"
          >
            {saving ? "저장 중..." : "레이아웃 SAVE"}
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[280px_1fr] gap-6 lg:grid-cols-[280px_1fr_320px]">
        <aside className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
          <header className="mb-4 space-y-1">
            <h2 className="text-lg font-semibold text-sky-100">노드 라이브러리</h2>
            <p className="text-sm text-slate-400">Trainer · Predictor · Utility</p>
          </header>
          <ul className="space-y-3">
            {NODE_LIBRARY.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => handleDragStart(event, item)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-left transition hover:border-sky-400 hover:text-sky-200"
                >
                  <h3 className="text-sm font-semibold text-slate-100">{item.label}</h3>
                  <p className="text-xs text-slate-400">{item.description}</p>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section
          className="relative rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-blue-950/70 to-slate-900"
          ref={wrapperRef}
        >
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
          <aside className="hidden rounded-3xl border border-slate-800 bg-slate-900/70 p-4 lg:block">
            <header className="mb-4 space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-400">Inspector</p>
              <h2 className="text-lg font-semibold text-sky-100">{selectedNode.label}</h2>
            </header>
            <dl className="space-y-2 text-sm text-slate-300">
              <div>
                <dt className="font-semibold text-slate-200">상태</dt>
                <dd>{selectedNode.status ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-200">설명</dt>
                <dd className="whitespace-pre-wrap text-xs text-slate-400">
                  {typeof selectedNode.settings?.description === "string"
                    ? (selectedNode.settings.description as string)
                    : "-"}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-sky-400 hover:text-sky-200"
              >
                설정 다이얼로그
              </button>
              <button
                type="button"
                onClick={handleSaveGraph}
                disabled={saving || loading}
                className="flex-1 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-800 disabled:text-slate-400"
              >
                {saving ? "저장 중" : "SAVE"}
              </button>
            </div>
          </aside>
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
