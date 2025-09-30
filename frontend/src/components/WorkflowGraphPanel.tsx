import type {
  PredictorRuntimeModel,
  SQLConfigModel,
  TrainerRuntimeModel,
  WorkflowCodeSyncResponse,
  WorkflowConfigPatch,
  WorkflowGraphEdge,
  WorkflowGraphNode,
} from "@app-types/workflow";
import { useWorkflowConfig } from "@hooks/useWorkflowConfig";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
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
import { regenerateWorkflowCode } from "@lib/apiClient";

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

interface ColumnAliasRow {
  alias: string;
  column: string;
}

interface TrainingMappingRow {
  feature: string;
  column: string;
}

interface TensorBoardLink {
  label: string;
  href: string;
  description?: string;
}

type ToastKind = "success" | "error";

interface ToastMessage {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

function orderByReference(values: string[], reference: string[]): string[] {
  const orderMap = new Map(reference.map((item, index) => [item, index] as const));
  return Array.from(new Set(values)).sort((a, b) => {
    const aIndex = orderMap.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = orderMap.get(b) ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex;
  });
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
  sqlOutputColumns: string[];
  sqlKeyColumns: string[];
  sqlColumnAliases: ColumnAliasRow[];
  sqlTrainingMappings: TrainingMappingRow[];
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
  sqlOutputColumns: [],
  sqlKeyColumns: [],
  sqlColumnAliases: [],
  sqlTrainingMappings: [],
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
  tensorboardLinks: TensorBoardLink[];
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
  tensorboardLinks,
}: NodeSettingsDialogProps) {
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    setValidationMessage(null);
  }, [node.id]);

  const availableSet = useMemo(() => new Set(sql.available_columns), [sql.available_columns]);
  const selectedOutputSet = useMemo(() => new Set(form.sqlOutputColumns), [form.sqlOutputColumns]);
  const conflictViolations = useMemo(
    () =>
      sql.exclusive_column_groups
        .map((group) => {
          const selected = group.filter((column) => selectedOutputSet.has(column));
          return { group, selected };
        })
        .filter((item) => item.selected.length > 1),
    [sql.exclusive_column_groups, selectedOutputSet],
  );
  const conflictColumns = useMemo(
    () => new Set(conflictViolations.flatMap((item) => item.selected)),
    [conflictViolations],
  );
  const missingKeyColumns = useMemo(
    () => form.sqlKeyColumns.filter((column) => !selectedOutputSet.has(column)),
    [form.sqlKeyColumns, selectedOutputSet],
  );
  const keyColumnInvalid = useMemo(
    () => form.sqlKeyColumns.filter((column) => !availableSet.has(column)),
    [form.sqlKeyColumns, availableSet],
  );
  const aliasDuplicateSet = useMemo(() => {
    const counts = new Map<string, number>();
    form.sqlColumnAliases.forEach((row) => {
      const alias = row.alias.trim();
      if (!alias) return;
      counts.set(alias, (counts.get(alias) ?? 0) + 1);
    });
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([alias]) => alias),
    );
  }, [form.sqlColumnAliases]);
  const aliasInvalidColumns = useMemo(
    () =>
      new Set(
        form.sqlColumnAliases
          .filter((row) => row.column && !availableSet.has(row.column))
          .map((row) => row.column),
      ),
    [form.sqlColumnAliases, availableSet],
  );
  const trainingFeatureDuplicateSet = useMemo(() => {
    const counts = new Map<string, number>();
    form.sqlTrainingMappings.forEach((row) => {
      const feature = row.feature.trim();
      if (!feature) return;
      counts.set(feature, (counts.get(feature) ?? 0) + 1);
    });
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([feature]) => feature),
    );
  }, [form.sqlTrainingMappings]);
  const trainingRowIssues = useMemo(
    () =>
      form.sqlTrainingMappings
        .map((row, index) => {
          const feature = row.feature.trim();
          const column = row.column;
          if (!feature && !column) {
            return null;
          }
          if (!feature || !column) {
            return { index, reason: "불완전한 행" };
          }
          if (!availableSet.has(column)) {
            return { index, reason: "허용되지 않은 컬럼" };
          }
          if (!selectedOutputSet.has(column)) {
            return { index, reason: "출력 컬럼 아님" };
          }
          return null;
        })
        .filter((item): item is { index: number; reason: string } => Boolean(item)),
    [form.sqlTrainingMappings, availableSet, selectedOutputSet],
  );

  const updateForm = (changes: Partial<NodeFormState>) => {
    onChange({ ...form, ...changes });
  };

  const toggleOutputColumn = (column: string) => {
    if (!availableSet.has(column)) {
      setValidationMessage(`허용되지 않은 컬럼입니다: ${column}`);
      return;
    }
    if (selectedOutputSet.has(column)) {
      if (form.sqlKeyColumns.includes(column)) {
        setValidationMessage("키 컬럼은 출력 컬럼에서 제거할 수 없습니다.");
        return;
      }
      updateForm({ sqlOutputColumns: form.sqlOutputColumns.filter((item) => item !== column) });
      setValidationMessage(null);
      return;
    }
    const conflict = sql.exclusive_column_groups.find(
      (group) => group.includes(column) && group.some((member) => selectedOutputSet.has(member)),
    );
    if (conflict) {
      setValidationMessage(`상호 배타 그룹(${conflict.join(", ")})과 충돌합니다.`);
      return;
    }
    const next = orderByReference([...form.sqlOutputColumns, column], sql.available_columns);
    updateForm({ sqlOutputColumns: next });
    setValidationMessage(null);
  };

  const toggleKeyColumn = (column: string) => {
    if (!selectedOutputSet.has(column)) {
      setValidationMessage("출력 컬럼에 포함된 후 키로 지정할 수 있습니다.");
      return;
    }
    if (form.sqlKeyColumns.includes(column)) {
      if (form.sqlKeyColumns.length <= 1) {
        setValidationMessage("최소 1개의 키 컬럼이 필요합니다.");
        return;
      }
      updateForm({ sqlKeyColumns: form.sqlKeyColumns.filter((item) => item !== column) });
      setValidationMessage(null);
      return;
    }
    const next = orderByReference([...form.sqlKeyColumns, column], sql.available_columns);
    updateForm({ sqlKeyColumns: next });
    setValidationMessage(null);
  };

  const handleAliasChange = (index: number, field: "alias" | "column", value: string) => {
    const next = form.sqlColumnAliases.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [field]: value } : row,
    );
    updateForm({ sqlColumnAliases: next });
  };

  const handleRemoveAlias = (index: number) => {
    updateForm({ sqlColumnAliases: form.sqlColumnAliases.filter((_, rowIndex) => rowIndex !== index) });
  };

  const handleAddAlias = () => {
    const defaultColumn = sql.available_columns[0] ?? "";
    updateForm({ sqlColumnAliases: [...form.sqlColumnAliases, { alias: "", column: defaultColumn }] });
  };

  const handleTrainingMappingChange = (index: number, field: "feature" | "column", value: string) => {
    const next = form.sqlTrainingMappings.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [field]: value } : row,
    );
    updateForm({ sqlTrainingMappings: next });
  };

  const handleRemoveTrainingMapping = (index: number) => {
    updateForm({ sqlTrainingMappings: form.sqlTrainingMappings.filter((_, rowIndex) => rowIndex !== index) });
  };

  const handleAddTrainingMapping = () => {
    const defaultColumn = form.sqlOutputColumns[0] ?? sql.available_columns[0] ?? "";
    updateForm({
      sqlTrainingMappings: [...form.sqlTrainingMappings, { feature: "", column: defaultColumn }],
    });
  };

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
        <div className="max-h-[60vh] overflow-y-auto pr-2">
          <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_260px] md:items-start md:gap-6">
            <div className="space-y-6">
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
            <section className="space-y-4 rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-sky-200">SQL 프로파일 및 컬럼 구성</h3>
                  <p className="text-xs text-slate-400">
                    허용된 컬럼 집합({sql.available_columns.length})과 상호 배타 규칙을 기준으로 매핑을 관리합니다.
                  </p>
                </div>
                <label className="space-y-1 text-sm md:w-64">
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
              </div>
              {validationMessage ? <p className="text-xs text-amber-300">{validationMessage}</p> : null}
              {conflictViolations.map((item, index) => (
                <p key={`conflict-${index}`} className="text-xs text-rose-300">
                  상호 배타 그룹({item.group.join(" · ")})에서 {item.selected.join(", ")}가 동시에 선택되었습니다.
                </p>
              ))}
              {missingKeyColumns.length > 0 ? (
                <p className="text-xs text-rose-300">
                  키 컬럼이 출력 컬럼에 포함되지 않았습니다: {missingKeyColumns.join(", ")}
                </p>
              ) : null}
              {keyColumnInvalid.length > 0 ? (
                <p className="text-xs text-rose-300">허용되지 않은 키 컬럼: {keyColumnInvalid.join(", ")}</p>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-200">
                    출력 컬럼 선택 ({form.sqlOutputColumns.length})
                  </h4>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 pr-4 text-xs sm:text-sm">
                    {sql.available_columns.map((column) => {
                      const selected = selectedOutputSet.has(column);
                      const hasConflict = conflictColumns.has(column);
                      return (
                        <label
                          key={column}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${
                            selected
                              ? "border-sky-500 bg-sky-500/10 text-sky-100"
                              : "border-slate-700/80 text-slate-200 hover:border-sky-400/80 hover:text-sky-100"
                          } ${hasConflict ? "border-rose-500/80 text-rose-200" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleOutputColumn(column)}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-500"
                          />
                          <span className="font-mono">{column}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-400">
                    선택된 컬럼 수: {form.sqlOutputColumns.length} / 허용 {sql.available_columns.length}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-200">
                    키 컬럼 지정 ({form.sqlKeyColumns.length})
                  </h4>
                  {form.sqlOutputColumns.length === 0 ? (
                    <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                      먼저 출력 컬럼을 선택한 후 키 컬럼을 지정하세요.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
                      {form.sqlOutputColumns.map((column) => {
                        const isKey = form.sqlKeyColumns.includes(column);
                        return (
                          <button
                            key={column}
                            type="button"
                            onClick={() => toggleKeyColumn(column)}
                            className={`rounded-full px-3 py-1 text-xs sm:text-sm transition ${
                              isKey
                                ? "border border-sky-400 bg-sky-500/20 text-sky-100"
                                : "border border-slate-600 text-slate-300 hover:border-sky-400 hover:text-sky-100"
                            }`}
                          >
                            {column}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {sql.exclusive_column_groups.length > 0 ? (
                    <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-slate-300">
                      <p className="mb-2 font-semibold text-slate-200">상호 배타 그룹</p>
                      <ul className="list-disc space-y-1 pl-4">
                        {sql.exclusive_column_groups.map((group, index) => (
                          <li key={group.join("-") || index} className="font-mono text-[11px] text-slate-300">
                            {group.join(" · ")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-200">컬럼 별칭 매핑</h4>
                  <button
                    type="button"
                    onClick={handleAddAlias}
                    className="rounded-lg border border-sky-500/70 px-3 py-1 text-xs font-semibold text-sky-100 transition hover:border-sky-300 hover:text-sky-50"
                  >
                    행 추가
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                  <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
                    <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-2">별칭</th>
                        <th className="px-4 py-2">대상 컬럼</th>
                        <th className="px-4 py-2 text-right">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {form.sqlColumnAliases.map((row, index) => {
                        const aliasValue = row.alias;
                        const aliasTrimmed = aliasValue.trim();
                        const aliasDuplicate = aliasTrimmed !== "" && aliasDuplicateSet.has(aliasTrimmed);
                        const columnInvalid = row.column !== "" && !availableSet.has(row.column);
                        const showAliasError = aliasDuplicate || (!aliasTrimmed && row.column);
                        return (
                          <tr key={`alias-${index}`} className="bg-slate-950/40">
                            <td className="px-4 py-2 align-middle">
                              <input
                                type="text"
                                value={row.alias}
                                onChange={(event) => handleAliasChange(index, "alias", event.target.value)}
                                className={`w-full rounded-lg border bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none ${
                                  showAliasError ? "border-rose-500/70" : "border-slate-700"
                                }`}
                                placeholder="JOB_CD"
                              />
                            </td>
                            <td className="px-4 py-2 align-middle">
                              <select
                                value={row.column}
                                onChange={(event) => handleAliasChange(index, "column", event.target.value)}
                                className={`w-full rounded-lg border bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none ${
                                  columnInvalid ? "border-rose-500/70" : "border-slate-700"
                                }`}
                              >
                                <option value="">컬럼 선택</option>
                                {sql.available_columns.map((column) => (
                                  <option key={column} value={column}>
                                    {column}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveAlias(index)}
                                className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-rose-400 hover:text-rose-200"
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {form.sqlColumnAliases.length === 0 ? (
                        <tr>
                          <td className="px-4 py-3 text-center text-xs text-slate-500" colSpan={3}>
                            등록된 별칭이 없습니다. 행 추가 버튼을 눌러주세요.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400">
                  Access VIEW 별칭과 내부 컬럼명을 매핑합니다. 공백 또는 중복된 별칭은 저장 전에 수정해야 합니다.
                </p>
                {aliasDuplicateSet.size > 0 ? (
                  <p className="text-xs text-rose-300">중복 별칭: {Array.from(aliasDuplicateSet).join(", ")}</p>
                ) : null}
                {aliasInvalidColumns.size > 0 ? (
                  <p className="text-xs text-rose-300">
                    허용되지 않은 컬럼이 선택되었습니다: {Array.from(aliasInvalidColumns).join(", ")}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-200">학습-출력 매핑</h4>
                  <button
                    type="button"
                    onClick={handleAddTrainingMapping}
                    className="rounded-lg border border-sky-500/70 px-3 py-1 text-xs font-semibold text-sky-100 transition hover:border-sky-300 hover:text-sky-50"
                  >
                    행 추가
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                  <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
                    <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-2">피처 키</th>
                        <th className="px-4 py-2">출력 컬럼</th>
                        <th className="px-4 py-2 text-right">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {form.sqlTrainingMappings.map((row, index) => {
                        const featureTrimmed = row.feature.trim();
                        const featureDuplicate = featureTrimmed !== "" && trainingFeatureDuplicateSet.has(featureTrimmed);
                        const columnInvalid =
                          row.column !== "" && (!availableSet.has(row.column) || !selectedOutputSet.has(row.column));
                        const incomplete = (featureTrimmed === "" && row.column) || (featureTrimmed && !row.column);
                        return (
                          <tr key={`mapping-${index}`} className="bg-slate-950/40">
                            <td className="px-4 py-2 align-middle">
                              <input
                                type="text"
                                value={row.feature}
                                onChange={(event) => handleTrainingMappingChange(index, "feature", event.target.value)}
                                className={`w-full rounded-lg border bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none ${
                                  featureDuplicate || incomplete ? "border-rose-500/70" : "border-slate-700"
                                }`}
                                placeholder="item_code"
                              />
                            </td>
                            <td className="px-4 py-2 align-middle">
                              <select
                                value={row.column}
                                onChange={(event) => handleTrainingMappingChange(index, "column", event.target.value)}
                                className={`w-full rounded-lg border bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none ${
                                  columnInvalid || incomplete ? "border-rose-500/70" : "border-slate-700"
                                }`}
                                disabled={form.sqlOutputColumns.length === 0}
                              >
                                <option value="">컬럼 선택</option>
                                {form.sqlOutputColumns.map((column) => (
                                  <option key={column} value={column}>
                                    {column}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveTrainingMapping(index)}
                                className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-rose-400 hover:text-rose-200"
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {form.sqlTrainingMappings.length === 0 ? (
                        <tr>
                          <td className="px-4 py-3 text-center text-xs text-slate-500" colSpan={3}>
                            매핑이 비어 있습니다. 학습 피처와 출력 컬럼을 연결하세요.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400">
                  학습 파이프라인 피처와 최종 출력 컬럼 간의 관계를 정의합니다. 중복된 키 또는 허용되지 않은 컬럼은 저장할 수 없습니다.
                </p>
                {trainingFeatureDuplicateSet.size > 0 ? (
                  <p className="text-xs text-rose-300">
                    중복된 피처 키: {Array.from(trainingFeatureDuplicateSet).join(", ")}
                  </p>
                ) : null}
                {trainingRowIssues.length > 0 ? (
                  <p className="text-xs text-rose-300">
                    매핑에 검증 오류가 있습니다 (행: {trainingRowIssues.map((item) => item.index + 1).join(", ")})
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}
            </div>
            {tensorboardLinks.length > 0 ? (
              <aside className="md:sticky md:top-6 md:self-start">
                <div className="space-y-3 rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4 text-xs text-slate-300">
                  <h3 className="text-sm font-semibold text-sky-200">TensorBoard 링크</h3>
                  <p className="text-[11px] text-slate-400">
                    워크플로우 코드 재생성 시 확인되는 Projector 자산 경로입니다.
                  </p>
                  <ul className="space-y-2">
                    {tensorboardLinks.map((link) => (
                      <li key={link.href} className="break-words">
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sky-300 transition hover:text-sky-100"
                        >
                          <ExternalLink size={14} />
                          <span className="truncate text-left">{link.label}</span>
                        </a>
                        {link.description ? (
                          <p className="mt-1 text-[11px] text-slate-500">{link.description}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            ) : null}
          </div>
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
  const [toast, setToast] = useState<ToastMessage | null>(null);

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
    const sortedOutputColumns = orderByReference(data.sql.output_columns ?? [], data.sql.available_columns ?? []);
    const aliasRows = Object.entries(data.sql.column_aliases ?? {})
      .map(([alias, column]) => ({ alias, column }))
      .sort((a, b) => a.alias.localeCompare(b.alias));
    const trainingMappings = Object.entries(data.sql.training_output_mapping ?? {})
      .map(([feature, column]) => ({ feature, column }))
      .sort((a, b) => a.feature.localeCompare(b.feature));
    const defaultKeyColumns = ["ITEM_CD", "CANDIDATE_ID", "ROUTING_SIGNATURE"];
    const keySource =
      data.sql.key_columns && data.sql.key_columns.length > 0
        ? data.sql.key_columns
        : defaultKeyColumns.filter((column) => sortedOutputColumns.includes(column));
    const keyColumns = orderByReference(keySource, data.sql.available_columns ?? []);
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
      sqlOutputColumns: sortedOutputColumns,
      sqlKeyColumns: keyColumns,
      sqlColumnAliases: aliasRows,
      sqlTrainingMappings: trainingMappings,
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

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const nodes = useMemo(() => createReactFlowNodes(graphNodes), [graphNodes]);
  const edges = useMemo(() => createReactFlowEdges(graphEdges), [graphEdges]);

  const showToast = useCallback((message: Omit<ToastMessage, "id">) => {
    setToast({ ...message, id: Date.now() });
  }, []);

  const tensorboardLinks = useMemo(() => {
    const projectorDir = data?.visualization?.tensorboard_projector_dir;
    if (typeof projectorDir !== "string") {
      return [];
    }
    const trimmed = projectorDir.trim();
    if (trimmed.length === 0) {
      return [];
    }
    const normalized = trimmed.replace(/\\/g, "/");
    const sanitized = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
    const links: TensorBoardLink[] = [];

    if (sanitized.startsWith("http://") || sanitized.startsWith("https://")) {
      links.push({
        label: "TensorBoard Projector",
        href: sanitized,
        description: "TensorBoard 웹 뷰어",
      });
      links.push({
        label: "Projector Config (JSON)",
        href: `${sanitized}/data/plugin/projector/projector_config.json`,
        description: "projector_config.json",
      });
      links.push({
        label: "vectors.tsv",
        href: `${sanitized}/data/plugin/projector/vectors.tsv`,
        description: "vectors.tsv",
      });
      links.push({
        label: "metadata.tsv",
        href: `${sanitized}/data/plugin/projector/metadata.tsv`,
        description: "metadata.tsv",
      });
    } else {
      links.push({
        label: "Projector 디렉터리",
        href: sanitized,
        description: "tensorboard_projector_dir",
      });
      const base = sanitized;
      links.push({
        label: "projector_config.json",
        href: `${base}/projector_config.json`,
        description: "TensorBoard Projector 구성 파일",
      });
      links.push({
        label: "vectors.tsv",
        href: `${base}/vectors.tsv`,
        description: "임베딩 벡터",
      });
      links.push({
        label: "metadata.tsv",
        href: `${base}/metadata.tsv`,
        description: "메타데이터 파일",
      });
    }

    return links;
  }, [data?.visualization?.tensorboard_projector_dir]);

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
        const availableColumns = data.sql.available_columns ?? [];
        const allowedSet = new Set(availableColumns);
        const sortedOutputColumns = orderByReference(formState.sqlOutputColumns, availableColumns);
        if (sortedOutputColumns.length === 0) {
          setErrorMessage("출력 컬럼을 최소 1개 이상 선택해야 합니다.");
          return;
        }
        const invalidOutputs = sortedOutputColumns.filter((column) => !allowedSet.has(column));
        if (invalidOutputs.length > 0) {
          setErrorMessage(`허용되지 않은 출력 컬럼이 포함되어 있습니다: ${invalidOutputs.join(", ")}`);
          return;
        }
        const conflictViolation = (data.sql.exclusive_column_groups ?? []).some((group) => {
          const selected = group.filter((column) => sortedOutputColumns.includes(column));
          return selected.length > 1;
        });
        if (conflictViolation) {
          setErrorMessage("상호 배타 그룹 규칙을 위반했습니다. 선택한 컬럼을 다시 확인하세요.");
          return;
        }

        const keyColumns = orderByReference(formState.sqlKeyColumns, availableColumns);
        if (keyColumns.length === 0) {
          setErrorMessage("키 컬럼을 최소 1개 이상 지정하세요.");
          return;
        }
        const invalidKeys = keyColumns.filter((column) => !allowedSet.has(column));
        if (invalidKeys.length > 0) {
          setErrorMessage(`허용되지 않은 키 컬럼이 포함되어 있습니다: ${invalidKeys.join(", ")}`);
          return;
        }
        const missingKeyOutputs = keyColumns.filter((column) => !sortedOutputColumns.includes(column));
        if (missingKeyOutputs.length > 0) {
          setErrorMessage(`키 컬럼은 출력 컬럼에 포함되어야 합니다: ${missingKeyOutputs.join(", ")}`);
          return;
        }

        const aliasEntries = formState.sqlColumnAliases.map((row) => ({
          alias: row.alias.trim(),
          column: row.column.trim(),
        }));
        const aliasFiltered = aliasEntries.filter((row) => row.alias !== "" || row.column !== "");
        const aliasIncomplete = aliasFiltered.filter((row) => row.alias === "" || row.column === "");
        if (aliasIncomplete.length > 0) {
          setErrorMessage("컬럼 별칭 매핑에 빈 값이 있습니다. 모든 행을 채워주세요.");
          return;
        }
        const aliasDuplicateCheck = new Map<string, string>();
        const duplicateAliases: string[] = [];
        for (const row of aliasFiltered) {
          if (aliasDuplicateCheck.has(row.alias)) {
            duplicateAliases.push(row.alias);
          } else {
            aliasDuplicateCheck.set(row.alias, row.column);
          }
        }
        if (duplicateAliases.length > 0) {
          setErrorMessage(`중복된 별칭이 있습니다: ${Array.from(new Set(duplicateAliases)).join(", ")}`);
          return;
        }
        const aliasInvalidColumns = aliasFiltered
          .map((row) => row.column)
          .filter((column) => column !== "" && !allowedSet.has(column));
        if (aliasInvalidColumns.length > 0) {
          setErrorMessage(`허용되지 않은 컬럼을 별칭에 지정했습니다: ${Array.from(new Set(aliasInvalidColumns)).join(", ")}`);
          return;
        }
        const columnAliases = Object.fromEntries(aliasFiltered.map((row) => [row.alias, row.column]));

        const trainingEntries = formState.sqlTrainingMappings.map((row) => ({
          feature: row.feature.trim(),
          column: row.column.trim(),
        }));
        const trainingFiltered = trainingEntries.filter((row) => row.feature !== "" || row.column !== "");
        if (trainingFiltered.length === 0) {
          setErrorMessage("학습-출력 매핑을 최소 1개 이상 등록하세요.");
          return;
        }
        const trainingIncomplete = trainingFiltered.filter((row) => row.feature === "" || row.column === "");
        if (trainingIncomplete.length > 0) {
          setErrorMessage("학습-출력 매핑에 빈 값이 있습니다. 모든 행을 채워주세요.");
          return;
        }
        const trainingDuplicateCheck = new Set<string>();
        const trainingDuplicates: string[] = [];
        for (const row of trainingFiltered) {
          if (trainingDuplicateCheck.has(row.feature)) {
            trainingDuplicates.push(row.feature);
          }
          trainingDuplicateCheck.add(row.feature);
        }
        if (trainingDuplicates.length > 0) {
          setErrorMessage(`중복된 학습 피처 키가 있습니다: ${Array.from(new Set(trainingDuplicates)).join(", ")}`);
          return;
        }
        const trainingInvalidColumns = trainingFiltered
          .map((row) => row.column)
          .filter((column) => !sortedOutputColumns.includes(column));
        if (trainingInvalidColumns.length > 0) {
          setErrorMessage(
            `학습 매핑이 출력 컬럼에 포함되지 않은 값을 참조합니다: ${Array.from(
              new Set(trainingInvalidColumns),
            ).join(", ")}`,
          );
          return;
        }
        const trainingOutputMapping = Object.fromEntries(
          trainingFiltered.map((row) => [row.feature, row.column]),
        );

        payload.sql = {
          active_profile: formState.sqlProfile,
          output_columns: sortedOutputColumns,
          column_aliases: columnAliases,
          key_columns: keyColumns,
          training_output_mapping: trainingOutputMapping,
        };
      }

      await saveConfig(payload);
      let codeResponse: WorkflowCodeSyncResponse | null = null;
      try {
        codeResponse = await regenerateWorkflowCode();
      } catch (codeError) {
        console.error(codeError);
        setErrorMessage("워크플로우 코드를 재생성하지 못했습니다. 로그를 확인하세요.");
        showToast({
          kind: "error",
          title: "코드 재생성 실패",
          description: "워크플로우 코드를 재생성하지 못했습니다. 로그를 확인하세요.",
        });
        return;
      }

      const projectorHint =
        codeResponse.tensorboard_paths?.projector_config ?? codeResponse.tensorboard_paths?.projector_dir;

      showToast({
        kind: "success",
        title: `${formState.label} 설정과 코드가 갱신되었습니다.`,
        description: projectorHint ? `TensorBoard 자산: ${projectorHint}` : undefined,
      });

      setStatusMessage(null);
      setSelectedNode(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("설정 저장에 실패했습니다. 입력값을 확인하세요.");
    }
  }, [selectedNode, data, graphNodes, formState, saveConfig, showToast]);

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
            tensorboardLinks={tensorboardLinks}
          />
        ) : null}
      </div>
      {toast ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50">
          <div
            className={`pointer-events-auto w-80 rounded-2xl border px-4 py-3 shadow-xl transition ${
              toast.kind === "error"
                ? "border-rose-500/70 bg-rose-500/10 text-rose-100"
                : "border-emerald-500/70 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description ? (
              <p
                className={`mt-1 text-xs ${
                  toast.kind === "error" ? "text-rose-100/90" : "text-emerald-100/90"
                }`}
              >
                {toast.description}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
