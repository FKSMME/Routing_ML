import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlowProvider,
} from "reactflow";

import { useWorkflowConfig } from "@hooks/useWorkflowConfig";
import type {
  PredictorRuntimeModel,
  SQLConfigModel,
  TrainerRuntimeModel,
  WorkflowGraphEdge,
  WorkflowGraphNode,
} from "@types/workflow";

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
      description: typeof node.settings?.description === "string" ? (node.settings.description as string) : undefined,
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
      stroke: edge.kind === "ui-flow" ? "#34d399" : edge.kind === "model-flow" ? "#38bdf8" : "#0ea5e9",
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

export function WorkflowGraphPanel() {
  const { data, isLoading, isFetching, saveConfig, saving } = useWorkflowConfig();
  const [graphNodes, setGraphNodes] = useState<WorkflowGraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<WorkflowGraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<WorkflowGraphNode | null>(null);
  const [formState, setFormState] = useState<NodeFormState>(INITIAL_FORM);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data?.graph?.nodes) {
      setGraphNodes(data.graph.nodes);
    }
    if (data?.graph?.edges) {
      setGraphEdges(data.graph.edges);
    }
  }, [data]);

  useEffect(() => {
    if (!selectedNode || !data) {
      return;
    }
    const description = typeof selectedNode.settings?.description === "string" ? (selectedNode.settings.description as string) : "";
    setFormState({
      label: selectedNode.label,
      status: selectedNode.status ?? "",
      description,
      similarityThreshold: data.trainer.similarity_threshold.toString(),
      trimStdEnabled: data.trainer.trim_std_enabled,
      trimLowerPercent: data.trainer.trim_lower_percent.toString(),
      trimUpperPercent: data.trainer.trim_upper_percent.toString(),
      predictorSimilarity: data.predictor.similarity_high_threshold.toString(),
      maxRoutingVariants: data.predictor.max_routing_variants.toString(),
      sqlProfile: data.sql.active_profile ?? (data.sql.profiles[0]?.name ?? ""),
    });
  }, [selectedNode, data]);

  useEffect(() => {
    if (!statusMessage && !errorMessage) return;
    const timer = window.setTimeout(() => {
      setStatusMessage(null);
      setErrorMessage(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [statusMessage, errorMessage]);

  const nodes = useMemo(() => createReactFlowNodes(graphNodes), [graphNodes]);
  const edges = useMemo(() => createReactFlowEdges(graphEdges), [graphEdges]);

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const target = graphNodes.find((item) => item.id === node.id);
      if (target && data) {
        setSelectedNode(target);
      }
    },
    [graphNodes, data],
  );

  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    setGraphNodes((prev) =>
      prev.map((item) => (item.id === node.id ? { ...item, position: node.position ?? { x: 0, y: 0 } } : item)),
    );
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
    if (!selectedNode || !data) return;
    try {
      setErrorMessage(null);
      const updatedNodes = graphNodes.map((node) => {
        if (node.id !== selectedNode.id) {
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

      if (selectedNode.id === "trainer") {
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

      if (selectedNode.id === "predictor") {
        const similarity = Number.parseFloat(formState.predictorSimilarity);
        const variants = Number.parseInt(formState.maxRoutingVariants, 10);
        payload.predictor = {
          similarity_high_threshold: Number.isFinite(similarity) ? similarity : data.predictor.similarity_high_threshold,
          max_routing_variants: Number.isFinite(variants) ? variants : data.predictor.max_routing_variants,
        };
      }

      if (selectedNode.id === "sql-mapper") {
        payload.sql = {
          active_profile: formState.sqlProfile,
        };
      }

      await saveConfig(payload);
      setStatusMessage(`${formState.label} 설정을 저장했습니다.`);
      setSelectedNode(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("설정 저장에 실패했습니다. 입력값을 확인하세요.");
    }
  }, [selectedNode, data, graphNodes, formState, saveConfig]);

  return (
    <section className="mx-auto mt-10 max-w-7xl rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-slate-100 shadow-2xl">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-sky-400/80">Workflow Graph</p>
          <h2 className="text-2xl font-semibold text-sky-100">블루스크린 워크플로우 디자이너</h2>
          <p className="mt-1 text-sm text-slate-300">
            노드 더블클릭으로 설정을 수정하고 SAVE 버튼으로 트레이너/예측기/SQL 매핑을 즉시 반영합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {statusMessage ? <span className="text-xs text-emerald-300">{statusMessage}</span> : null}
          {errorMessage ? <span className="text-xs text-rose-300">{errorMessage}</span> : null}
          <button
            type="button"
            onClick={handleSaveLayout}
            disabled={saving || isLoading || isFetching}
            className="rounded-lg border border-sky-500/60 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-300 hover:text-sky-200 disabled:cursor-not-allowed disabled:border-slate-600 disabled:text-slate-500"
          >
            {saving ? "저장 중..." : "레이아웃 SAVE"}
          </button>
        </div>
      </header>
      <div className="relative h-[520px] overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-blue-950/70 to-slate-900">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
          </div>
        ) : null}
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodeDragStop={handleNodeDragStop}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <MiniMap pannable zoomable className="!bg-slate-950/80" nodeColor={() => "#38bdf8"} maskColor="rgba(15,23,42,0.7)" />
            <Controls className="bg-slate-900/80 text-slate-100" showInteractive={false} />
            <Background color="rgba(56,189,248,0.25)" gap={28} />
          </ReactFlow>
        </ReactFlowProvider>
        {selectedNode && data ? (
          <NodeSettingsDialog
            node={selectedNode}
            trainer={data.trainer}
            predictor={data.predictor}
            sql={data.sql}
            form={formState}
            onChange={setFormState}
            onClose={() => setSelectedNode(null)}
            onSave={handleSaveNode}
            saving={saving}
          />
        ) : null}
      </div>
    </section>
  );
}
