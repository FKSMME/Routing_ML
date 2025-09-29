import type {
  PredictorRuntimeModel,
  SQLConfigModel,
  TrainerRuntimeModel,
  WorkflowConfigPatch,
  WorkflowGraphEdge,
  WorkflowGraphNode,
} from "@app-types/workflow";
import { useWorkflowConfig } from "@hooks/useWorkflowConfig";
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
  EdgeChange,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlowInstance,
  ReactFlowProvider,
} from "reactflow";

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

const NODE_TYPES = {
  module: ModuleNode,
};

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

function createReactFlowNodes(nodes: WorkflowGraphNode[]): Node<ModuleNodeData>[] {
  return nodes.map((node) => ({
    id: node.id,
    type: "module",
    position: node.position ?? { x: 0, y: 0 },
    data: {
      label: node.label,
      category: node.category,
      status: node.status,
      description:
        typeof node.settings?.description === "string" ? (node.settings.description as string) : undefined,
      metrics: node.metrics,
      docRefs: node.doc_refs ?? [],
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));
}

function createReactFlowEdges(edges: WorkflowGraphEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: edge.kind !== "data-flow",
    style: {
      stroke:
        edge.kind === "ui-flow" ? "#34d399" : edge.kind === "model-flow" ? "#38bdf8" : "#0ea5e9",
      strokeWidth: 2,
    },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 8,
    labelBgStyle: { fill: "rgba(15, 23, 42, 0.8)", stroke: "rgba(56, 189, 248, 0.4)" },
    labelStyle: { fill: "#e0f2fe", fontSize: 12, fontWeight: 600 },
  }));
}

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
            <p className="text-xs uppercase tracking-wide text-sky-300/80">{node.category ?? "module"}</p>
            <h2 className="text-2xl font-semibold text-sky-100">{node.label} 설정</h2>
            <p className="mt-1 text-sm text-slate-300">
              더블클릭한 도형의 속성을 편집하고 즉시 SAVE 할 수 있습니다.
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
                  <span>상/하위 5% Trim 표준편차 적용</span>
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
                현재 임계값: {trainer.similarity_threshold} · Trim: {trainer.trim_lower_percent}~{trainer.trim_upper_percent}
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
            변경 사항은 SAVE 시 `config/workflow_settings.json`과 런타임에 즉시 반영됩니다.
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

function createLibraryNode(item: NodeLibraryItem, position: { x: number; y: number }): WorkflowGraphNode {
  const id = `${item.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    label: item.label,
    type: "module",
    category: item.category,
    status: item.status ?? "draft",
    position,
    settings: { description: item.description ?? "" },
    metrics: {},
    doc_refs: [],
  } satisfies WorkflowGraphNode;
}

export function AlgorithmWorkspace() {
  const {
    data,
    isLoading,
    isFetching,
    saveConfig,
    saving,
  } = useWorkflowConfig();
  const [graphNodes, setGraphNodes] = useState<WorkflowGraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<WorkflowGraphEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<WorkflowGraphNode | null>(null);
  const [formState, setFormState] = useState<NodeFormState>(INITIAL_FORM);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (data?.graph?.nodes) {
      setGraphNodes(data.graph.nodes);
    }
    if (data?.graph?.edges) {
      setGraphEdges(data.graph.edges);
    }
  }, [data]);

  useEffect(() => {
    if (!statusMessage && !errorMessage) return;
    const timer = window.setTimeout(() => {
      setStatusMessage(null);
      setErrorMessage(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [statusMessage, errorMessage]);

  useEffect(() => {
    if (selectedNodeId && !graphNodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [graphNodes, selectedNodeId]);

  const selectedNode = useMemo(
    () => graphNodes.find((node) => node.id === (editingNode?.id ?? selectedNodeId)) ?? null,
    [graphNodes, editingNode, selectedNodeId],
  );

  const updateFormFromNode = useCallback(
    (node: WorkflowGraphNode) => {
      if (!data) return;
      const description =
        typeof node.settings?.description === "string" ? (node.settings.description as string) : "";
      setFormState({
        label: node.label,
        status: node.status ?? "",
        description,
        similarityThreshold: data.trainer.similarity_threshold.toString(),
        trimStdEnabled: data.trainer.trim_std_enabled,
        trimLowerPercent: data.trainer.trim_lower_percent.toString(),
        trimUpperPercent: data.trainer.trim_upper_percent.toString(),
        predictorSimilarity: data.predictor.similarity_high_threshold.toString(),
        maxRoutingVariants: data.predictor.max_routing_variants.toString(),
        sqlProfile: data.sql.active_profile ?? (data.sql.profiles[0]?.name ?? ""),
      });
    },
    [data],
  );

  useEffect(() => {
    if (selectedNode) {
      updateFormFromNode(selectedNode);
    }
  }, [selectedNode, updateFormFromNode]);

  const nodes = useMemo(() => createReactFlowNodes(graphNodes), [graphNodes]);
  const edges = useMemo(() => createReactFlowEdges(graphEdges), [graphEdges]);

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const target = graphNodes.find((item) => item.id === node.id);
      if (!target || !data) return;
      setEditingNode(target);
      setSelectedNodeId(target.id);
      updateFormFromNode(target);
    },
    [graphNodes, data, updateFormFromNode],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const target = graphNodes.find((item) => item.id === node.id);
      if (!target) return;
      setSelectedNodeId(target.id);
      setEditingNode(null);
      updateFormFromNode(target);
    },
    [graphNodes, updateFormFromNode],
  );

  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    setGraphNodes((prev) =>
      prev.map((item) =>
        item.id === node.id
          ? {
              ...item,
              position: node.position ?? { x: 0, y: 0 },
            }
          : item,
      ),
    );
  }, []);

  const handleNodesDelete = useCallback((deleted: Node[]) => {
    if (deleted.length === 0) return;
    setGraphNodes((prev) => prev.filter((item) => !deleted.some((node) => node.id === item.id)));
  }, []);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removed = changes
      .filter((change) => change.type === "remove")
      .map((change) => change.id)
      .filter((id): id is string => Boolean(id));
    if (removed.length === 0) {
      return;
    }
    setGraphEdges((prev) => prev.filter((edge) => !removed.includes(edge.id)));
  }, []);

  const handleEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    if (edgesToDelete.length === 0) return;
    setGraphEdges((prev) => prev.filter((edge) => !edgesToDelete.some((item) => item.id === edge.id)));
  }, []);

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    setGraphEdges((prev) => {
      const alreadyExists = prev.some(
        (edge) => edge.source === connection.source && edge.target === connection.target,
      );
      if (alreadyExists) {
        return prev;
      }
      const id = `${connection.source}-${connection.target}-${Date.now().toString(36)}`;
      const newEdge: WorkflowGraphEdge = {
        id,
        source: connection.source,
        target: connection.target,
        kind: "data-flow",
        label: connection.label,
      };
      return [...prev, newEdge];
    });
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setEditingNode(null);
  }, []);

  const handleSaveLayout = useCallback(async () => {
    try {
      setErrorMessage(null);
      await saveConfig({
        graph: {
          nodes: graphNodes,
          edges: graphEdges,
        },
      });
      setStatusMessage("그래프 레이아웃이 저장되었습니다.");
    } catch (error) {
      console.error(error);
      setErrorMessage("그래프 저장에 실패했습니다. 로그를 확인하세요.");
    }
  }, [graphNodes, graphEdges, saveConfig]);

  const handleSaveNode = useCallback(async () => {
    const target = selectedNode;
    if (!target || !data) return;
    try {
      setErrorMessage(null);
      const updatedNodes = graphNodes.map((node) => {
        if (node.id !== target.id) {
          return node;
        }
        return {
          ...node,
          label: formState.label,
          status: formState.status || undefined,
          settings: {
            ...node.settings,
            description: formState.description,
          },
        } satisfies WorkflowGraphNode;
      });

      const payload: WorkflowConfigPatch = {
        graph: {
          nodes: updatedNodes,
        },
      };

      if (target.id === "trainer") {
        const similarity = Number.parseFloat(formState.similarityThreshold);
        const trimLower = Number.parseFloat(formState.trimLowerPercent);
        const trimUpper = Number.parseFloat(formState.trimUpperPercent);
        payload.trainer = {
          similarity_threshold: Number.isFinite(similarity) ? similarity : data.trainer.similarity_threshold,
          trim_std_enabled: formState.trimStdEnabled,
          trim_lower_percent: Number.isFinite(trimLower) ? trimLower : data.trainer.trim_lower_percent,
          trim_upper_percent: Number.isFinite(trimUpper) ? trimUpper : data.trainer.trim_upper_percent,
        };
      }

      if (target.id === "predictor") {
        const similarity = Number.parseFloat(formState.predictorSimilarity);
        const variants = Number.parseInt(formState.maxRoutingVariants, 10);
        payload.predictor = {
          similarity_high_threshold: Number.isFinite(similarity) ? similarity : data.predictor.similarity_high_threshold,
          max_routing_variants: Number.isFinite(variants) ? variants : data.predictor.max_routing_variants,
        };
      }

      if (target.id === "sql-mapper") {
        payload.sql = {
          active_profile: formState.sqlProfile,
        };
      }

      await saveConfig(payload);
      setGraphNodes(updatedNodes);
      setStatusMessage(`${formState.label} 설정을 저장했습니다.`);
      setEditingNode(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("설정 저장에 실패했습니다. 입력값을 확인하세요.");
    }
  }, [selectedNode, data, graphNodes, formState, saveConfig]);

  const handleDialogClose = useCallback(() => {
    setEditingNode(null);
  }, []);

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
      setGraphNodes((prev) => [...prev, newNode]);
      setSelectedNodeId(newNode.id);
      setStatusMessage(`${parsed.label} 노드를 추가했습니다.`);
    },
    [reactFlowInstance],
  );

  const handleDragStart = useCallback((event: React.DragEvent<HTMLButtonElement>, item: NodeLibraryItem) => {
    event.dataTransfer.setData("application/reactflow/node", JSON.stringify(item));
    event.dataTransfer.effectAllowed = "move";
  }, []);

  return (
    <div className="flex h-full flex-col gap-6" role="region" aria-label="알고리즘 편집 워크스페이스">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-sky-100">워크플로우 알고리즘 편집기</h1>
          <p className="text-sm text-slate-300">
            ReactFlow 캔버스에서 노드를 구성하고, 런타임 파라미터를 Inspector와 설정 다이얼로그로 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {statusMessage ? <span className="text-emerald-300">{statusMessage}</span> : null}
          {errorMessage ? <span className="text-rose-300">{errorMessage}</span> : null}
          <button
            type="button"
            onClick={handleSaveLayout}
            disabled={saving || isLoading || isFetching}
            className="rounded-lg border border-sky-500/60 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-300 hover:text-sky-200 disabled:cursor-not-allowed disabled:border-slate-600 disabled:text-slate-500"
          >
            {saving ? "저장 중..." : "레이아웃 SAVE"}
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[280px_1fr_320px] gap-6">
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
                  onClick={() => setSelectedNodeId(item.id)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-left transition hover:border-sky-400 hover:text-sky-200"
                >
                  <h3 className="text-sm font-semibold text-slate-100">{item.label}</h3>
                  <p className="text-xs text-slate-400">{item.description}</p>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="relative rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-blue-950/70 to-slate-900" ref={wrapperRef}>
          {isLoading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            </div>
          ) : null}
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodeDoubleClick={handleNodeDoubleClick}
              onNodeClick={handleNodeClick}
              onNodeDragStop={handleNodeDragStop}
              onNodesDelete={handleNodesDelete}
              onEdgesDelete={handleEdgesDelete}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onPaneClick={handlePaneClick}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <MiniMap pannable zoomable className="!bg-slate-950/80" nodeColor={() => "#38bdf8"} maskColor="rgba(15,23,42,0.7)" />
              <Controls className="bg-slate-900/80 text-slate-100" showInteractive={false} />
              <Background color="rgba(56,189,248,0.25)" gap={28} />
            </ReactFlow>
          </ReactFlowProvider>
          {editingNode && data ? (
            <NodeSettingsDialog
              node={editingNode}
              trainer={data.trainer}
              predictor={data.predictor}
              sql={data.sql}
              form={formState}
              onChange={setFormState}
              onClose={handleDialogClose}
              onSave={handleSaveNode}
              saving={saving}
            />
          ) : null}
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-sky-100">Inspector</h2>
            <p className="text-xs text-slate-400">
              {selectedNode ? `${selectedNode.label} · ${selectedNode.category ?? "module"}` : "노드를 선택하세요"}
            </p>
          </header>
          {selectedNode && data ? (
            <form
              className="flex h-full flex-col gap-4 text-sm"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveNode();
              }}
            >
              <div className="space-y-3">
                <label className="space-y-2">
                  <span className="text-slate-300">레이블</span>
                  <input
                    type="text"
                    value={formState.label}
                    onChange={(event) => setFormState({ ...formState, label: event.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-slate-300">상태</span>
                  <input
                    type="text"
                    value={formState.status}
                    onChange={(event) => setFormState({ ...formState, status: event.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-slate-300">설명</span>
                  <textarea
                    value={formState.description}
                    onChange={(event) => setFormState({ ...formState, description: event.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                </label>
              </div>

              {selectedNode.id === "trainer" ? (
                <section className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4">
                  <h3 className="text-sm font-semibold text-sky-200">트레이너 런타임</h3>
                  <label className="space-y-2">
                    <span className="text-slate-300">유사도 임계값</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={formState.similarityThreshold}
                      onChange={(event) => setFormState({ ...formState, similarityThreshold: event.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border border-slate-700/80 bg-slate-950 px-3 py-2 text-slate-200">
                    <input
                      type="checkbox"
                      checked={formState.trimStdEnabled}
                      onChange={(event) => setFormState({ ...formState, trimStdEnabled: event.target.checked })}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-500"
                    />
                    <span>상/하위 5% Trim 표준편차 적용</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-slate-300">하위 Trim 비율</span>
                      <input
                        type="number"
                        min={0}
                        max={0.5}
                        step={0.01}
                        value={formState.trimLowerPercent}
                        onChange={(event) => setFormState({ ...formState, trimLowerPercent: event.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-300">상위 Trim 비율</span>
                      <input
                        type="number"
                        min={0.5}
                        max={1}
                        step={0.01}
                        value={formState.trimUpperPercent}
                        onChange={(event) => setFormState({ ...formState, trimUpperPercent: event.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                      />
                    </label>
                  </div>
                </section>
              ) : null}

              {selectedNode.id === "predictor" ? (
                <section className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4">
                  <h3 className="text-sm font-semibold text-sky-200">예측기 파라미터</h3>
                  <label className="space-y-2">
                    <span className="text-slate-300">상위 유사도 임계값</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={formState.predictorSimilarity}
                      onChange={(event) => setFormState({ ...formState, predictorSimilarity: event.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-slate-300">최대 라우팅 조합 수</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={formState.maxRoutingVariants}
                      onChange={(event) => setFormState({ ...formState, maxRoutingVariants: event.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                    />
                  </label>
                </section>
              ) : null}

              {selectedNode.id === "sql-mapper" ? (
                <section className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4">
                  <h3 className="text-sm font-semibold text-sky-200">SQL 프로파일</h3>
                  <label className="space-y-2">
                    <span className="text-slate-300">활성 프로파일</span>
                    <select
                      value={formState.sqlProfile}
                      onChange={(event) => setFormState({ ...formState, sqlProfile: event.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                    >
                      {data.sql.profiles.map((profile) => (
                        <option key={profile.name} value={profile.name}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>
              ) : null}

              <div className="mt-auto flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingNode(selectedNode);
                  }}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-sky-400 hover:text-sky-200"
                >
                  설정 다이얼로그
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-800 disabled:text-slate-400"
                >
                  {saving ? "저장 중..." : "SAVE"}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              노드를 선택하거나 드래그해서 추가하세요.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
