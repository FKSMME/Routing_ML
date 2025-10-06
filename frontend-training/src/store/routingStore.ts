import type {
  OperationStep,
  PredictionResponse,
  ProcessGroupColumnDefinition,
  ProcessGroupColumnType,
  ProcessGroupDefinition,
  ProcessGroupType,
  RoutingGroupDetail,
  TimelineStepMetadata,
} from "@app-types/routing";
import { create, type StateCreator, type StoreApi } from "zustand";
import { shallow } from "zustand/shallow";

import {
  enableRoutingPersistenceFlush,
  enqueueAuditEntry,
  flushRoutingPersistence,
  readLatestRoutingWorkspaceSnapshot,
  subscribeToRoutingPersistenceFlush,
  writeRoutingWorkspaceSnapshot,
} from "../lib/persistence";

const MAX_HISTORY = 50;
const NODE_GAP = 240;

export const DEFAULT_REFERENCE_MATRIX_COLUMNS = ["seq", "code", "desc", "setup", "run", "wait"] as const;

export type ReferenceMatrixColumnKey = (typeof DEFAULT_REFERENCE_MATRIX_COLUMNS)[number];

type ReferenceMatrixSubscriber = (columns: ReferenceMatrixColumnKey[]) => void;

const referenceMatrixSubscribers = new Set<ReferenceMatrixSubscriber>();

export const registerReferenceMatrixPersistence = (subscriber: ReferenceMatrixSubscriber): (() => void) => {
  referenceMatrixSubscribers.add(subscriber);
  return () => referenceMatrixSubscribers.delete(subscriber);
};

const notifyReferenceMatrixSubscribers = (columns: ReferenceMatrixColumnKey[]) => {
  referenceMatrixSubscribers.forEach((subscriber) => {
    try {
      subscriber(columns);
    } catch (error) {
      console.error("Failed to notify reference matrix subscriber", error);
    }
  });
};

type MergeStrategy = "replace" | "append";

type SnapshotReason = "insert-operation" | "reorder-step" | "remove-step" | "undo" | "redo";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export interface RuleViolation {
  ruleId: string;
  message: string;
  severity?: "info" | "warning" | "error";
}

export interface TimelineStep {
  id: string;
  seq: number;
  processCode: string;
  description?: string | null;
  setupTime?: number | null;
  runTime?: number | null;
  waitTime?: number | null;
  itemCode?: string | null;
  candidateId?: string | null;
  routingSetCode?: string | null;
  variantCode?: string | null;
  primaryRoutingCode?: string | null;
  secondaryRoutingCode?: string | null;
  branchCode?: string | null;
  branchLabel?: string | null;
  branchPath?: string | null;
  sqlValues?: Record<string, unknown> | null;
  metadata?: TimelineStepMetadata | null;
  positionX?: number;
  violations?: RuleViolation[];
  confidence?: number | null;
  similarity?: number | null;
}

export interface RoutingMatrixDefinition {
  id: string;
  routingSetCode: string | null;
  variantCode: string | null;
  primaryRoutingCode: string | null;
  secondaryRoutingCode: string | null;
}

export interface DraggableOperationPayload {
  itemCode: string;
  candidateId?: string | null;
  operation: OperationStep;
  metadata?: TimelineStepMetadata | null;
  routingSetCode?: string | null;
  variantCode?: string | null;
  primaryRoutingCode?: string | null;
  secondaryRoutingCode?: string | null;
  branchCode?: string | null;
  branchLabel?: string | null;
  branchPath?: string | null;
  sqlValues?: Record<string, unknown> | null;
}

export interface RecommendationBucket {
  itemCode: string;
  candidateId: string | null;
  operations: OperationStep[];
}

export interface CustomRecommendationEntry {
  id: string;
  itemCode: string;
  candidateId: string | null;
  operation: OperationStep;
}

export interface CustomRecommendationInput {
  itemCode: string;
  candidateId: string | null;
  operation: OperationStep;
}

type HiddenRecommendationMap = Record<string, string[]>;

export const createRecommendationBucketKey = (itemCode: string, candidateId: string | null): string =>
  `${itemCode}::${candidateId ?? "null"}`;

export const createRecommendationOperationKey = (operation: OperationStep): string =>
  `${operation.PROC_CD}::${operation.PROC_SEQ}`;

interface TimelineSnapshot {
  steps: TimelineStep[];
  reason: SnapshotReason;
  timestamp: string;
}

interface HistoryState {
  past: TimelineSnapshot[];
  future: TimelineSnapshot[];
}

export interface RoutingProductTab {
  id: string;
  productCode: string;
  productName?: string | null;
  candidateId?: string | null;
  timeline: TimelineStep[];
}

type LastSuccessMap = Record<string, TimelineStep[]>;

const SNAPSHOT_DEBOUNCE_MS = 30_000;

interface RoutingWorkspacePersistedState {
  activeProductId: string | null;
  activeItemId: string | null;
  productTabs: RoutingProductTab[];
  timeline: TimelineStep[];
  lastSuccessfulTimeline: LastSuccessMap;
  lastSavedAt?: string;
  dirty: boolean;
  customRecommendations?: CustomRecommendationEntry[];
  hiddenRecommendationKeys?: HiddenRecommendationMap;

  routingMatrixDefinitions: RoutingMatrixDefinition[];
  processGroups: ProcessGroupDefinition[];
  activeProcessGroupId: string | null;
}

export interface RoutingStoreState {
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  erpRequired: boolean;
  activeItemId: string | null;
  activeProductId: string | null;
  activeGroupId: string | null;
  activeGroupName: string | null;
  activeGroupVersion?: number;
  lastSavedAt?: string;
  productTabs: RoutingProductTab[];
  recommendations: RecommendationBucket[];
  customRecommendations: CustomRecommendationEntry[];
  hiddenRecommendationKeys: HiddenRecommendationMap;
  timeline: TimelineStep[];
  referenceMatrixColumns: ReferenceMatrixColumnKey[];
  history: HistoryState;
  lastSuccessfulTimeline: LastSuccessMap;
  routingMatrixDefinitions: RoutingMatrixDefinition[];
  processGroups: ProcessGroupDefinition[];
  activeProcessGroupId: string | null;
  validationErrors: string[];
  sourceItemCodes: string[];
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setERPRequired: (enabled: boolean) => void;
  loadRecommendations: (response: PredictionResponse) => void;
  addCustomRecommendation: (input: CustomRecommendationInput) => void;
  updateCustomRecommendation: (entryId: string, operation: OperationStep) => void;
  removeCustomRecommendation: (entryId: string) => void;
  hideRecommendation: (itemCode: string, candidateId: string | null, operationKey: string) => void;
  restoreRecommendation: (itemCode: string, candidateId: string | null, operationKey: string) => void;
  restoreAllRecommendations: (itemCode: string, candidateId: string | null) => void;
  setActiveProduct: (tabId: string) => void;
  setReferenceMatrixColumns: (columns: Array<string | ReferenceMatrixColumnKey>) => void;
  reorderReferenceMatrixColumns: (source: ReferenceMatrixColumnKey, target: ReferenceMatrixColumnKey) => void;
  hydrateReferenceMatrixColumns: (columns: Array<string | ReferenceMatrixColumnKey>) => void;
  setRoutingMatrixDefinitions: (rows: Array<Partial<RoutingMatrixDefinition>>) => void;
  addRoutingMatrixDefinition: (row?: Partial<RoutingMatrixDefinition>) => void;
  updateRoutingMatrixDefinition: (id: string, patch: Partial<RoutingMatrixDefinition>) => void;
  removeRoutingMatrixDefinition: (id: string) => void;
  hydrateRoutingMatrixDefinitions: (rows: RoutingMatrixDefinition[]) => void;
  setProcessGroups: (groups: Array<Partial<ProcessGroupDefinition>>) => void;
  hydrateProcessGroups: (groups: ProcessGroupDefinition[]) => void;
  addProcessGroup: (group?: Partial<ProcessGroupDefinition>) => void;
  updateProcessGroup: (id: string, patch: Partial<ProcessGroupDefinition>) => void;
  removeProcessGroup: (id: string) => void;
  addProcessGroupColumn: (
    groupId: string,
    column?: Partial<ProcessGroupColumnDefinition>,
  ) => void;
  updateProcessGroupColumn: (
    groupId: string,
    columnId: string,
    patch: Partial<ProcessGroupColumnDefinition>,
  ) => void;
  removeProcessGroupColumn: (groupId: string, columnId: string) => void;
  setProcessGroupFixedValue: (groupId: string, columnKey: string, value: unknown) => void;
  setActiveProcessGroup: (groupId: string | null) => void;
  insertOperation: (payload: DraggableOperationPayload, index?: number) => void;
  moveStep: (stepId: string, toIndex: number) => void;
  removeStep: (stepId: string) => void;
  clearValidation: () => void;
  setValidationErrors: (errors: string[]) => void;
  pushValidationError: (message: string) => void;
  applyGroup: (detail: RoutingGroupDetail, strategy?: MergeStrategy) => void;
  setActiveGroup: (meta: { id: string; name: string; version?: number; updatedAt?: string } | null) => void;
  setDirty: (dirty: boolean) => void;
  setLastSavedAt: (timestamp?: string) => void;
  captureLastSuccess: () => void;
  rollbackToLastSuccess: () => void;
  undo: () => void;
  redo: () => void;
}

type PersistedSelectionState = Omit<
  RoutingWorkspacePersistedState,
  "customRecommendations" | "hiddenRecommendationKeys"
> & {
  customRecommendations: CustomRecommendationEntry[];
  hiddenRecommendationKeys: HiddenRecommendationMap;
};

const cloneRecord = (
  input?: Record<string, unknown> | null,
): Record<string, unknown> | null | undefined => {
  if (input === undefined) {
    return undefined;
  }
  if (input === null) {
    return null;
  }
  return { ...input };
};

const cloneStepMetadata = (metadata?: TimelineStepMetadata | null): TimelineStepMetadata | null => {
  if (!metadata) {
    return null;
  }
  const cloned: TimelineStepMetadata = { ...metadata };
  if ("sqlValues" in cloned) {
    cloned.sqlValues = cloneRecord(metadata.sqlValues) ?? null;
  }
  if ("extra" in cloned) {
    cloned.extra = cloneRecord(metadata.extra) ?? null;
  }
  return cloned;
};

const cloneOperation = (operation: OperationStep): OperationStep => ({
  ...operation,
  metadata:
    typeof operation.metadata === "undefined"
      ? undefined
      : cloneStepMetadata(operation.metadata) ?? null,
});

const cloneCustomRecommendations = (entries: CustomRecommendationEntry[]): CustomRecommendationEntry[] =>
  entries.map((entry) => ({
    ...entry,
    operation: cloneOperation(entry.operation),
  }));

const cloneHiddenMap = (source: HiddenRecommendationMap): HiddenRecommendationMap => {
  const cloned: HiddenRecommendationMap = {};
  Object.entries(source).forEach(([bucketKey, keys]) => {
    cloned[bucketKey] = [...keys];
  });
  return cloned;
};

const createMatrixDefinitionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `matrix-${crypto.randomUUID()}`;
  }
  return `matrix-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const sanitizeMatrixValue = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = `${value}`.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const createRoutingMatrixDefinition = (
  value?: Partial<RoutingMatrixDefinition>,
): RoutingMatrixDefinition => ({
  id: value?.id ?? createMatrixDefinitionId(),
  routingSetCode: sanitizeMatrixValue(value?.routingSetCode),
  variantCode: sanitizeMatrixValue(value?.variantCode),
  primaryRoutingCode: sanitizeMatrixValue(value?.primaryRoutingCode),
  secondaryRoutingCode: sanitizeMatrixValue(value?.secondaryRoutingCode),
});

const cloneRoutingMatrixDefinitions = (
  rows: RoutingMatrixDefinition[],
): RoutingMatrixDefinition[] => rows.map((row) => ({ ...row }));

const routingMatrixDefinitionsEqual = (
  a: RoutingMatrixDefinition,
  b: RoutingMatrixDefinition,
): boolean =>
  a.routingSetCode === b.routingSetCode &&
  a.variantCode === b.variantCode &&
  a.primaryRoutingCode === b.primaryRoutingCode &&
  a.secondaryRoutingCode === b.secondaryRoutingCode;

const routingMatrixArraysEqual = (
  a: RoutingMatrixDefinition[],
  b: RoutingMatrixDefinition[],
): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    const rowA = a[index];
    const rowB = b[index];
    if (rowA.id !== rowB.id || !routingMatrixDefinitionsEqual(rowA, rowB)) {
      return false;
    }
  }
  return true;
};

const PROCESS_GROUP_COLUMN_TYPES: ProcessGroupColumnType[] = [
  "string",
  "number",
  "boolean",
  "date",
];

const createProcessGroupId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `pg-${crypto.randomUUID()}`;
  }
  return `pg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const createProcessGroupColumnId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `pgcol-${crypto.randomUUID()}`;
  }
  return `pgcol-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const sanitizeProcessGroupColumnKey = (value?: string | null): string => {
  if (value === undefined || value === null) {
    return "";
  }
  return `${value}`.trim();
};

const isProcessGroupColumnType = (value: string): value is ProcessGroupColumnType =>
  PROCESS_GROUP_COLUMN_TYPES.includes(value as ProcessGroupColumnType);

const createProcessGroupColumnDefinition = (
  value?: Partial<ProcessGroupColumnDefinition>,
): ProcessGroupColumnDefinition => {
  const keySource = sanitizeProcessGroupColumnKey(value?.key ?? value?.label ?? "");
  const normalizedKey = keySource || `COLUMN_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const labelSource = sanitizeProcessGroupColumnKey(value?.label ?? normalizedKey);
  const normalizedLabel = labelSource || normalizedKey;
  const description =
    value?.description === undefined ? null : value.description ?? null;

  return {
    id: value?.id ?? createProcessGroupColumnId(),
    key: normalizedKey,
    label: normalizedLabel,
    dataType: isProcessGroupColumnType(value?.dataType ?? "")
      ? (value?.dataType as ProcessGroupColumnType)
      : "string",
    description,
  };
};

const normalizeProcessGroupFixedValues = (
  values: Record<string, unknown> | undefined,
  columns: ProcessGroupColumnDefinition[],
): Record<string, unknown> => {
  if (!values) {
    return {};
  }
  const allowedKeys = new Set(columns.map((column) => column.key));
  const normalized: Record<string, unknown> = {};
  Object.entries(values).forEach(([rawKey, rawValue]) => {
    const key = sanitizeProcessGroupColumnKey(rawKey);
    if (!key) {
      return;
    }
    if (allowedKeys.size > 0 && !allowedKeys.has(key)) {
      return;
    }
    normalized[key] = rawValue ?? null;
  });
  return normalized;
};

const sanitizeProcessGroupName = (value?: string | null): string => {
  const trimmed = sanitizeProcessGroupColumnKey(value);
  return trimmed.length > 0 ? trimmed : "새 공정 그룹";
};

const createProcessGroupDefinition = (
  value?: Partial<ProcessGroupDefinition>,
): ProcessGroupDefinition => {
  const columns = (value?.defaultColumns ?? []).map((column) =>
    createProcessGroupColumnDefinition(column),
  );
  const now = new Date().toISOString();
  return {
    id: value?.id ?? createProcessGroupId(),
    name: sanitizeProcessGroupName(value?.name),
    description: value?.description ?? null,
    type: (value?.type ?? "machining") as ProcessGroupType,
    defaultColumns: columns,
    fixedValues: normalizeProcessGroupFixedValues(value?.fixedValues, columns),
    createdAt: value?.createdAt ?? now,
    updatedAt: value?.updatedAt ?? now,
  };
};

const cloneProcessGroupDefinitions = (
  groups: ProcessGroupDefinition[],
): ProcessGroupDefinition[] =>
  groups.map((group) => ({
    ...group,
    defaultColumns: group.defaultColumns.map((column) => ({ ...column })),
    fixedValues: { ...group.fixedValues },
  }));

const processGroupColumnsEqual = (
  a: ProcessGroupColumnDefinition[],
  b: ProcessGroupColumnDefinition[],
): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    const colA = a[index];
    const colB = b[index];
    if (
      colA.id !== colB.id ||
      colA.key !== colB.key ||
      colA.label !== colB.label ||
      colA.dataType !== colB.dataType ||
      (colA.description ?? null) !== (colB.description ?? null)
    ) {
      return false;
    }
  }
  return true;
};

const processGroupDefinitionsEqual = (
  a: ProcessGroupDefinition,
  b: ProcessGroupDefinition,
): boolean => {
  if (
    a.name !== b.name ||
    (a.description ?? null) !== (b.description ?? null) ||
    a.type !== b.type
  ) {
    return false;
  }
  if (!processGroupColumnsEqual(a.defaultColumns, b.defaultColumns)) {
    return false;
  }
  if (!recordsEqual(a.fixedValues, b.fixedValues)) {
    return false;
  }
  return true;
};

const processGroupArraysEqual = (
  a: ProcessGroupDefinition[],
  b: ProcessGroupDefinition[],
): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    const groupA = a[index];
    const groupB = b[index];
    if (groupA.id !== groupB.id || !processGroupDefinitionsEqual(groupA, groupB)) {
      return false;
    }
  }
  return true;
};

const recordsEqual = (
  a?: Record<string, unknown> | null,
  b?: Record<string, unknown> | null,
): boolean => {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return !a && !b;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
};

const metadataEqual = (a?: TimelineStepMetadata | null, b?: TimelineStepMetadata | null): boolean => {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return !a && !b;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (key === "sqlValues" || key === "extra") {
      if (!recordsEqual(
        (a[key] as Record<string, unknown> | null | undefined) ?? null,
        (b[key] as Record<string, unknown> | null | undefined) ?? null,
      )) {
        return false;
      }
      continue;
    }
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
};

const cloneTimeline = (steps: TimelineStep[]): TimelineStep[] =>
  steps.map((step) => ({
    ...step,
    sqlValues: cloneRecord(step.sqlValues) ?? null,
    metadata: cloneStepMetadata(step.metadata),
    violations: step.violations?.map((violation) => ({ ...violation })),
  }));

const cloneSuccessMap = (source: LastSuccessMap): LastSuccessMap =>
  Object.fromEntries(Object.entries(source).map(([key, steps]) => [key, cloneTimeline(steps)]));

const normalizeSequence = (steps: TimelineStep[]): TimelineStep[] =>
  steps.map((step, index) => ({ ...step, seq: index + 1, positionX: index * NODE_GAP }));

const isReferenceMatrixColumnKey = (value: string): value is ReferenceMatrixColumnKey =>
  (DEFAULT_REFERENCE_MATRIX_COLUMNS as ReadonlyArray<string>).includes(value);

const coerceReferenceMatrixColumns = (
  columns: Array<string | ReferenceMatrixColumnKey>,
): ReferenceMatrixColumnKey[] => {
  const normalized: ReferenceMatrixColumnKey[] = [];
  columns.forEach((column) => {
    if (typeof column === "string" && isReferenceMatrixColumnKey(column) && !normalized.includes(column)) {
      normalized.push(column);
    } else if (isReferenceMatrixColumnKey(column) && !normalized.includes(column)) {
      normalized.push(column);
    }
  });
  if (normalized.length === 0) {
    return [...DEFAULT_REFERENCE_MATRIX_COLUMNS];
  }
  return normalized;
};

const mergeReferenceMatrixColumns = (
  selected: Array<string | ReferenceMatrixColumnKey>,
  previous: ReferenceMatrixColumnKey[],
): ReferenceMatrixColumnKey[] => {
  const sanitized = coerceReferenceMatrixColumns(selected);
  const retained = previous.filter((column) => sanitized.includes(column));
  const missing = sanitized.filter((column) => !retained.includes(column));
  return [...retained, ...missing];
};

const computeReorderedReferenceMatrixColumns = (
  columns: ReferenceMatrixColumnKey[],
  source: ReferenceMatrixColumnKey,
  target: ReferenceMatrixColumnKey,
): ReferenceMatrixColumnKey[] => {
  const fromIndex = columns.indexOf(source);
  const toIndex = columns.indexOf(target);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return columns;
  }
  const next = [...columns];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, source);
  return next;
};

const referenceMatrixColumnsEqual = (
  a: ReferenceMatrixColumnKey[],
  b: ReferenceMatrixColumnKey[],
): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
};

const timelinesEqual = (a: TimelineStep[], b: TimelineStep[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    const stepA = a[i];
    const stepB = b[i];
    if (
      stepA.processCode !== stepB.processCode ||
      stepA.description !== stepB.description ||
      stepA.setupTime !== stepB.setupTime ||
      stepA.runTime !== stepB.runTime ||
      stepA.waitTime !== stepB.waitTime ||
      stepA.itemCode !== stepB.itemCode ||
      stepA.candidateId !== stepB.candidateId ||
      stepA.routingSetCode !== stepB.routingSetCode ||
      stepA.variantCode !== stepB.variantCode ||
      stepA.primaryRoutingCode !== stepB.primaryRoutingCode ||
      stepA.secondaryRoutingCode !== stepB.secondaryRoutingCode ||
      stepA.branchCode !== stepB.branchCode ||
      stepA.branchLabel !== stepB.branchLabel ||
      stepA.branchPath !== stepB.branchPath ||
      !recordsEqual(stepA.sqlValues ?? null, stepB.sqlValues ?? null) ||
      !metadataEqual(stepA.metadata ?? null, stepB.metadata ?? null)
    ) {
      return false;
    }
  }
  return true;
};

const computeDirty = (
  timeline: TimelineStep[],
  lastSuccess: LastSuccessMap,
  activeProductId: string | null,
): boolean => {
  if (!activeProductId) {
    return timeline.length > 0;
  }
  const baseline = lastSuccess[activeProductId];
  if (!baseline) {
    return timeline.length > 0;
  }
  return !timelinesEqual(timeline, baseline);
};

const pushHistory = (
  history: HistoryState,
  timeline: TimelineStep[],
  reason: SnapshotReason,
): HistoryState => {
  const snapshot: TimelineSnapshot = {
    steps: cloneTimeline(timeline),
    reason,
    timestamp: new Date().toISOString(),
  };
  const past = [...history.past, snapshot];
  if (past.length > MAX_HISTORY) {
    past.shift();
  }
  return { past, future: [] };
};

interface TimelineStepCreationContext {
  itemCode?: string | null;
  candidateId?: string | null;
  metadata?: TimelineStepMetadata | null;
  routingSetCode?: string | null;
  variantCode?: string | null;
  primaryRoutingCode?: string | null;
  secondaryRoutingCode?: string | null;
  branchCode?: string | null;
  branchLabel?: string | null;
  branchPath?: string | null;
  sqlValues?: Record<string, unknown> | null;
}

const toTimelineStep = (
  operation: OperationStep,
  context: TimelineStepCreationContext,
): TimelineStep => {
  const baseMetadata =
    cloneStepMetadata(context.metadata ?? operation.metadata ?? undefined) ?? null;
  const routingSetCode = context.routingSetCode ?? baseMetadata?.routingSetCode ?? null;
  const variantCode = context.variantCode ?? baseMetadata?.variantCode ?? null;
  const primaryRoutingCode =
    context.primaryRoutingCode ?? baseMetadata?.primaryRoutingCode ?? null;
  const secondaryRoutingCode =
    context.secondaryRoutingCode ?? baseMetadata?.secondaryRoutingCode ?? null;
  const branchCode = context.branchCode ?? baseMetadata?.branchCode ?? null;
  const branchLabel = context.branchLabel ?? baseMetadata?.branchLabel ?? null;
  const branchPath = context.branchPath ?? baseMetadata?.branchPath ?? null;
  const sqlValuesSource = context.sqlValues ?? baseMetadata?.sqlValues ?? null;
  const sqlValues = cloneRecord(sqlValuesSource) ?? null;

  let metadata = baseMetadata;
  if (metadata) {
    metadata.routingSetCode = routingSetCode ?? null;
    metadata.variantCode = variantCode ?? null;
    metadata.primaryRoutingCode = primaryRoutingCode ?? null;
    metadata.secondaryRoutingCode = secondaryRoutingCode ?? null;
    metadata.branchCode = branchCode ?? null;
    metadata.branchLabel = branchLabel ?? null;
    metadata.branchPath = branchPath ?? null;
    metadata.sqlValues = sqlValues ? { ...sqlValues } : null;
  } else if (
    routingSetCode ||
    variantCode ||
    primaryRoutingCode ||
    secondaryRoutingCode ||
    branchCode ||
    branchLabel ||
    branchPath ||
    sqlValues
  ) {
    metadata = {
      routingSetCode: routingSetCode ?? null,
      variantCode: variantCode ?? null,
      primaryRoutingCode: primaryRoutingCode ?? null,
      secondaryRoutingCode: secondaryRoutingCode ?? null,
      branchCode: branchCode ?? null,
      branchLabel: branchLabel ?? null,
      branchPath: branchPath ?? null,
      sqlValues: sqlValues ? { ...sqlValues } : null,
    };
  }

  return {
    id: createId(),
    seq: operation.PROC_SEQ ?? 0,
    processCode: operation.PROC_CD,
    description: operation.PROC_DESC ?? null,
    setupTime: operation.SETUP_TIME ?? null,
    runTime: operation.RUN_TIME ?? null,
    waitTime: operation.WAIT_TIME ?? null,
    itemCode: context.itemCode ?? null,
    candidateId: context.candidateId ?? null,
    routingSetCode,
    variantCode,
    primaryRoutingCode,
    secondaryRoutingCode,
    branchCode,
    branchLabel,
    branchPath,
    sqlValues,
    metadata,
    violations: [],
  };
};

const updateTabTimeline = (
  tabs: RoutingProductTab[],
  tabId: string,
  updater: (timeline: TimelineStep[]) => TimelineStep[],
): RoutingProductTab[] =>
  tabs.map((tab) => (tab.id === tabId ? { ...tab, timeline: updater(tab.timeline) } : tab));

const updateLastSuccess = (
  lastSuccess: LastSuccessMap,
  tabId: string,
  timeline: TimelineStep[],
): LastSuccessMap => ({ ...lastSuccess, [tabId]: cloneTimeline(timeline) });

const toPersistedState = (selection: PersistedSelectionState): RoutingWorkspacePersistedState => ({
  activeProductId: selection.activeProductId,
  activeItemId: selection.activeItemId,
  productTabs: selection.productTabs.map((tab) => ({ ...tab, timeline: cloneTimeline(tab.timeline) })),
  timeline: cloneTimeline(selection.timeline),
  lastSuccessfulTimeline: cloneSuccessMap(selection.lastSuccessfulTimeline),
  lastSavedAt: selection.lastSavedAt,
  dirty: selection.dirty,
  customRecommendations: cloneCustomRecommendations(selection.customRecommendations),
  hiddenRecommendationKeys: cloneHiddenMap(selection.hiddenRecommendationKeys),
  routingMatrixDefinitions: cloneRoutingMatrixDefinitions(selection.routingMatrixDefinitions ?? []),
  processGroups: cloneProcessGroupDefinitions(selection.processGroups ?? []),
  activeProcessGroupId: selection.activeProcessGroupId ?? null,
});

const persistedSelector = (state: RoutingStoreState): PersistedSelectionState => ({
  activeProductId: state.activeProductId,
  activeItemId: state.activeItemId,
  productTabs: state.productTabs,
  timeline: state.timeline,
  lastSuccessfulTimeline: state.lastSuccessfulTimeline,
  lastSavedAt: state.lastSavedAt,
  dirty: state.dirty,
  customRecommendations: state.customRecommendations,
  hiddenRecommendationKeys: state.hiddenRecommendationKeys,
  routingMatrixDefinitions: state.routingMatrixDefinitions,
  processGroups: state.processGroups,
  activeProcessGroupId: state.activeProcessGroupId,
});

const routingStateCreator: StateCreator<RoutingStoreState> = (set) => ({
  loading: false,
  saving: false,
  dirty: false,
  erpRequired: false,
  activeItemId: null,
  activeProductId: null,
  activeGroupId: null,
  activeGroupName: null,
  activeGroupVersion: undefined,
  lastSavedAt: undefined,
  productTabs: [],
  recommendations: [],
  customRecommendations: [],
  hiddenRecommendationKeys: {},
  timeline: [],
  referenceMatrixColumns: [...DEFAULT_REFERENCE_MATRIX_COLUMNS],
  history: { past: [], future: [] },
  lastSuccessfulTimeline: {},
  routingMatrixDefinitions: [],
  processGroups: [],
  activeProcessGroupId: null,
  validationErrors: [],
  sourceItemCodes: [],
  setLoading: (loading) => set({ loading }),
  setSaving: (saving) => set({ saving }),
  setERPRequired: (enabled) => set({ erpRequired: enabled, dirty: true }),
  setReferenceMatrixColumns: (columns) =>
    set((state) => {
      const normalized = mergeReferenceMatrixColumns(columns, state.referenceMatrixColumns);
      if (referenceMatrixColumnsEqual(normalized, state.referenceMatrixColumns)) {
        return state;
      }
      notifyReferenceMatrixSubscribers(normalized);
      return { referenceMatrixColumns: normalized };
    }),
  reorderReferenceMatrixColumns: (source, target) =>
    set((state) => {
      const reordered = computeReorderedReferenceMatrixColumns(state.referenceMatrixColumns, source, target);
      if (referenceMatrixColumnsEqual(reordered, state.referenceMatrixColumns)) {
        return state;
      }
      notifyReferenceMatrixSubscribers(reordered);
      return { referenceMatrixColumns: reordered };
    }),
  hydrateReferenceMatrixColumns: (columns) =>
    set((state) => {
      const normalized = coerceReferenceMatrixColumns(columns);
      if (referenceMatrixColumnsEqual(normalized, state.referenceMatrixColumns)) {
        return state;
      }
      return { referenceMatrixColumns: normalized };
    }),
  setRoutingMatrixDefinitions: (rows) =>
    set((state) => {
      const normalized = rows.map((row) => createRoutingMatrixDefinition(row));
      if (routingMatrixArraysEqual(normalized, state.routingMatrixDefinitions)) {
        return state;
      }
      return { routingMatrixDefinitions: normalized, dirty: true };
    }),
  addRoutingMatrixDefinition: (row) =>
    set((state) => ({
      routingMatrixDefinitions: [
        ...state.routingMatrixDefinitions,
        createRoutingMatrixDefinition(row),
      ],
      dirty: true,
    })),
  updateRoutingMatrixDefinition: (id, patch) =>
    set((state) => {
      const index = state.routingMatrixDefinitions.findIndex((entry) => entry.id === id);
      if (index === -1) {
        return state;
      }
      const previous = state.routingMatrixDefinitions[index];
      const updated = createRoutingMatrixDefinition({ ...previous, ...patch, id });
      if (routingMatrixDefinitionsEqual(previous, updated)) {
        return state;
      }
      const next = [...state.routingMatrixDefinitions];
      next[index] = updated;
      return { routingMatrixDefinitions: next, dirty: true };
    }),
  removeRoutingMatrixDefinition: (id) =>
    set((state) => {
      const next = state.routingMatrixDefinitions.filter((entry) => entry.id !== id);
      if (next.length === state.routingMatrixDefinitions.length) {
        return state;
      }
      return { routingMatrixDefinitions: next, dirty: true };
    }),
  hydrateRoutingMatrixDefinitions: (rows) =>
    set((state) => {
      const normalized = rows.map((row) => createRoutingMatrixDefinition(row));
      if (routingMatrixArraysEqual(normalized, state.routingMatrixDefinitions)) {
        return state;
      }
      return { routingMatrixDefinitions: normalized };
    }),
  setProcessGroups: (groups) =>
    set((state) => {
      const normalized = groups.map((group) => createProcessGroupDefinition(group));
      const activeExists = state.activeProcessGroupId
        ? normalized.some((group) => group.id === state.activeProcessGroupId)
        : false;
      const nextActive = activeExists
        ? state.activeProcessGroupId
        : normalized[0]?.id ?? null;
      if (
        processGroupArraysEqual(normalized, state.processGroups) &&
        state.activeProcessGroupId === nextActive
      ) {
        return state;
      }
      return { processGroups: normalized, activeProcessGroupId: nextActive };
    }),
  hydrateProcessGroups: (groups) =>
    set((state) => {
      const normalized = groups.map((group) => createProcessGroupDefinition(group));
      if (processGroupArraysEqual(normalized, state.processGroups)) {
        return state;
      }
      const activeExists = state.activeProcessGroupId
        ? normalized.some((group) => group.id === state.activeProcessGroupId)
        : false;
      return {
        processGroups: normalized,
        activeProcessGroupId: activeExists
          ? state.activeProcessGroupId
          : normalized[0]?.id ?? null,
      };
    }),
  addProcessGroup: (group) =>
    set((state) => {
      const definition = createProcessGroupDefinition(group);
      return {
        processGroups: [...state.processGroups, definition],
        activeProcessGroupId: definition.id,
      };
    }),
  updateProcessGroup: (id, patch) =>
    set((state) => {
      const index = state.processGroups.findIndex((group) => group.id === id);
      if (index === -1) {
        return state;
      }
      const previous = state.processGroups[index];
      const updated = createProcessGroupDefinition({
        ...previous,
        ...patch,
        id,
        createdAt: previous.createdAt,
        updatedAt: new Date().toISOString(),
      });
      if (processGroupDefinitionsEqual(previous, updated)) {
        return state;
      }
      const next = [...state.processGroups];
      next[index] = updated;
      return { processGroups: next };
    }),
  removeProcessGroup: (id) =>
    set((state) => {
      const next = state.processGroups.filter((group) => group.id !== id);
      if (next.length === state.processGroups.length) {
        return state;
      }
      const nextActive = state.activeProcessGroupId === id ? next[0]?.id ?? null : state.activeProcessGroupId;
      return {
        processGroups: next,
        activeProcessGroupId: nextActive ?? null,
      };
    }),
  addProcessGroupColumn: (groupId, column) =>
    set((state) => {
      const index = state.processGroups.findIndex((group) => group.id === groupId);
      if (index === -1) {
        return state;
      }
      const previous = state.processGroups[index];
      const updatedColumns = [
        ...previous.defaultColumns,
        createProcessGroupColumnDefinition(column),
      ];
      const updated = createProcessGroupDefinition({
        ...previous,
        defaultColumns: updatedColumns,
        fixedValues: previous.fixedValues,
        id: previous.id,
        createdAt: previous.createdAt,
        updatedAt: new Date().toISOString(),
      });
      if (processGroupDefinitionsEqual(previous, updated)) {
        return state;
      }
      const next = [...state.processGroups];
      next[index] = updated;
      return { processGroups: next };
    }),
  updateProcessGroupColumn: (groupId, columnId, patch) =>
    set((state) => {
      const index = state.processGroups.findIndex((group) => group.id === groupId);
      if (index === -1) {
        return state;
      }
      const previous = state.processGroups[index];
      const columnIndex = previous.defaultColumns.findIndex((column) => column.id === columnId);
      if (columnIndex === -1) {
        return state;
      }
      const currentColumn = previous.defaultColumns[columnIndex];
      const patchedColumn = createProcessGroupColumnDefinition({
        ...currentColumn,
        ...patch,
        id: columnId,
      });
      if (
        currentColumn.key === patchedColumn.key &&
        currentColumn.label === patchedColumn.label &&
        currentColumn.dataType === patchedColumn.dataType &&
        (currentColumn.description ?? null) === (patchedColumn.description ?? null)
      ) {
        return state;
      }
      const updatedColumns = [...previous.defaultColumns];
      updatedColumns[columnIndex] = patchedColumn;
      const fixedValues = { ...previous.fixedValues };
      if (currentColumn.key !== patchedColumn.key) {
        const preserved = fixedValues[currentColumn.key];
        delete fixedValues[currentColumn.key];
        if (preserved !== undefined) {
          fixedValues[patchedColumn.key] = preserved;
        }
      }
      const updated = createProcessGroupDefinition({
        ...previous,
        defaultColumns: updatedColumns,
        fixedValues,
        id: previous.id,
        createdAt: previous.createdAt,
        updatedAt: new Date().toISOString(),
      });
      if (processGroupDefinitionsEqual(previous, updated)) {
        return state;
      }
      const next = [...state.processGroups];
      next[index] = updated;
      return { processGroups: next };
    }),
  removeProcessGroupColumn: (groupId, columnId) =>
    set((state) => {
      const index = state.processGroups.findIndex((group) => group.id === groupId);
      if (index === -1) {
        return state;
      }
      const previous = state.processGroups[index];
      const removedColumn = previous.defaultColumns.find((column) => column.id === columnId);
      if (!removedColumn) {
        return state;
      }
      const updatedColumns = previous.defaultColumns.filter((column) => column.id !== columnId);
      const fixedValues = { ...previous.fixedValues };
      delete fixedValues[removedColumn.key];
      const updated = createProcessGroupDefinition({
        ...previous,
        defaultColumns: updatedColumns,
        fixedValues,
        id: previous.id,
        createdAt: previous.createdAt,
        updatedAt: new Date().toISOString(),
      });
      if (processGroupDefinitionsEqual(previous, updated)) {
        return state;
      }
      const next = [...state.processGroups];
      next[index] = updated;
      return { processGroups: next };
    }),
  setProcessGroupFixedValue: (groupId, columnKey, value) =>
    set((state) => {
      const index = state.processGroups.findIndex((group) => group.id === groupId);
      if (index === -1) {
        return state;
      }
      const previous = state.processGroups[index];
      const key = sanitizeProcessGroupColumnKey(columnKey);
      if (!key) {
        return state;
      }
      if (!previous.defaultColumns.some((column) => column.key === key)) {
        return state;
      }
      const fixedValues = { ...previous.fixedValues };
      if (value === undefined) {
        if (!(key in fixedValues)) {
          return state;
        }
        delete fixedValues[key];
      } else if (Object.is(fixedValues[key], value)) {
        return state;
      } else {
        fixedValues[key] = value;
      }
      const updated = createProcessGroupDefinition({
        ...previous,
        fixedValues,
        id: previous.id,
        createdAt: previous.createdAt,
        updatedAt: new Date().toISOString(),
      });
      if (processGroupDefinitionsEqual(previous, updated)) {
        return state;
      }
      const next = [...state.processGroups];
      next[index] = updated;
      return { processGroups: next };
    }),
  setActiveProcessGroup: (groupId) =>
    set((state) => {
      if (groupId && !state.processGroups.some((group) => group.id === groupId)) {
        const fallback = state.processGroups[0]?.id ?? null;
        if (state.activeProcessGroupId === fallback) {
          return state;
        }
        return { activeProcessGroupId: fallback };
      }
      if (state.activeProcessGroupId === groupId) {
        return state;
      }
      return { activeProcessGroupId: groupId };
    }),
  loadRecommendations: (response) => {
    const buckets: RecommendationBucket[] = response.items.map((item) => ({
      itemCode: item.ITEM_CD,
      candidateId: item.CANDIDATE_ID ?? null,
      operations: item.operations,
    }));

    const tabs: RoutingProductTab[] = response.items.map((item) => {
      const operations = item.operations ?? [];
      const timeline = normalizeSequence(
        operations.map((operation) =>
          toTimelineStep(operation, {
            itemCode: item.ITEM_CD,
            candidateId: item.CANDIDATE_ID ?? null,
            metadata: operation.metadata ?? null,
          }),
        ),
      );
      return {
        id: item.ITEM_CD,
        productCode: item.ITEM_CD,
        productName: item.ITEM_CD,
        candidateId: item.CANDIDATE_ID ?? null,
        timeline,
      };
    });

    const activeTabId = tabs[0]?.id ?? null;
    const activeTimeline = activeTabId ? cloneTimeline(tabs[0].timeline) : [];
    const successMap: LastSuccessMap = {};
    tabs.forEach((tab) => {
      successMap[tab.id] = cloneTimeline(tab.timeline);
    });

    set((state) => {
      const validBucketKeys = new Set<string>();
      const operationKeyMap = new Map<string, Set<string>>();
      buckets.forEach((bucket) => {
        const bucketKey = createRecommendationBucketKey(bucket.itemCode, bucket.candidateId);
        validBucketKeys.add(bucketKey);
        operationKeyMap.set(
          bucketKey,
          new Set(bucket.operations.map((operation) => createRecommendationOperationKey(operation))),
        );
      });

      const filteredCustom = state.customRecommendations.filter((entry) =>
        validBucketKeys.has(createRecommendationBucketKey(entry.itemCode, entry.candidateId)),
      );

      const filteredHidden: HiddenRecommendationMap = {};
      Object.entries(state.hiddenRecommendationKeys).forEach(([bucketKey, keys]) => {
        if (!validBucketKeys.has(bucketKey)) {
          return;
        }
        const available = operationKeyMap.get(bucketKey);
        if (!available) {
          return;
        }
        const remaining = keys.filter((key) => available.has(key));
        if (remaining.length > 0) {
          filteredHidden[bucketKey] = remaining;
        }
      });

      return {
        recommendations: buckets,
        productTabs: tabs,
        activeProductId: activeTabId,
        activeItemId: activeTabId,
        timeline: activeTimeline,
        history: { past: [], future: [] },
        dirty: false,
        validationErrors: [],
        sourceItemCodes: response.items.map((item) => item.ITEM_CD),
        lastSuccessfulTimeline: successMap,
        activeGroupId: null,
        activeGroupName: null,
        activeGroupVersion: undefined,
        lastSavedAt: undefined,
        customRecommendations: filteredCustom,
        hiddenRecommendationKeys: filteredHidden,
      };
    });
  },
  addCustomRecommendation: (input) =>
    set((state) => {
      if (!input.itemCode) {
        return state;
      }
      const entry: CustomRecommendationEntry = {
        id: createId(),
        itemCode: input.itemCode,
        candidateId: input.candidateId ?? null,
        operation: cloneOperation(input.operation),
      };
      return {
        customRecommendations: [...state.customRecommendations, entry],
      };
    }),
  updateCustomRecommendation: (entryId, operation) =>
    set((state) => {
      const index = state.customRecommendations.findIndex((entry) => entry.id === entryId);
      if (index === -1) {
        return state;
      }
      const next = [...state.customRecommendations];
      next[index] = { ...next[index], operation: cloneOperation(operation) };
      return { customRecommendations: next };
    }),
  removeCustomRecommendation: (entryId) =>
    set((state) => {
      const next = state.customRecommendations.filter((entry) => entry.id !== entryId);
      if (next.length === state.customRecommendations.length) {
        return state;
      }
      return { customRecommendations: next };
    }),
  hideRecommendation: (itemCode, candidateId, operationKey) =>
    set((state) => {
      const bucketKey = createRecommendationBucketKey(itemCode, candidateId);
      const existing = state.hiddenRecommendationKeys[bucketKey] ?? [];
      if (existing.includes(operationKey)) {
        return state;
      }
      return {
        hiddenRecommendationKeys: {
          ...state.hiddenRecommendationKeys,
          [bucketKey]: [...existing, operationKey],
        },
      };
    }),
  restoreRecommendation: (itemCode, candidateId, operationKey) =>
    set((state) => {
      const bucketKey = createRecommendationBucketKey(itemCode, candidateId);
      const existing = state.hiddenRecommendationKeys[bucketKey];
      if (!existing) {
        return state;
      }
      const remaining = existing.filter((key) => key !== operationKey);
      if (remaining.length === existing.length) {
        return state;
      }
      const nextMap = { ...state.hiddenRecommendationKeys };
      if (remaining.length === 0) {
        delete nextMap[bucketKey];
      } else {
        nextMap[bucketKey] = remaining;
      }
      return { hiddenRecommendationKeys: nextMap };
    }),
  restoreAllRecommendations: (itemCode, candidateId) =>
    set((state) => {
      const bucketKey = createRecommendationBucketKey(itemCode, candidateId);
      if (!state.hiddenRecommendationKeys[bucketKey]) {
        return state;
      }
      const nextMap = { ...state.hiddenRecommendationKeys };
      delete nextMap[bucketKey];
      return { hiddenRecommendationKeys: nextMap };
    }),
  setActiveProduct: (tabId) =>
    set((state) => {
      const tab = state.productTabs.find((item) => item.id === tabId);
      if (!tab) {
        return state;
      }
      const timeline = cloneTimeline(tab.timeline);
      return {
        activeProductId: tabId,
        activeItemId: tab.productCode,
        timeline,
        history: { past: [], future: [] },
        dirty: computeDirty(timeline, state.lastSuccessfulTimeline, tabId),
      };
    }),
  insertOperation: (payload, index) =>
    set((state) => {
      const { activeProductId } = state;
      if (!activeProductId) {
        return state;
      }
      const history = pushHistory(state.history, state.timeline, "insert-operation");
      const timeline = [...state.timeline];
      const insertIndex = typeof index === "number" && index >= 0 && index <= timeline.length ? index : timeline.length;
      const contextMetadata = payload.metadata ?? payload.operation.metadata ?? null;
      const newStep = toTimelineStep(payload.operation, {
        itemCode: payload.itemCode,
        candidateId: payload.candidateId ?? null,
        metadata: contextMetadata,
        routingSetCode: payload.routingSetCode ?? contextMetadata?.routingSetCode ?? null,
        variantCode: payload.variantCode ?? contextMetadata?.variantCode ?? null,
        primaryRoutingCode:
          payload.primaryRoutingCode ?? contextMetadata?.primaryRoutingCode ?? null,
        secondaryRoutingCode:
          payload.secondaryRoutingCode ?? contextMetadata?.secondaryRoutingCode ?? null,
        branchCode: payload.branchCode ?? contextMetadata?.branchCode ?? null,
        branchLabel: payload.branchLabel ?? contextMetadata?.branchLabel ?? null,
        branchPath: payload.branchPath ?? contextMetadata?.branchPath ?? null,
        sqlValues: payload.sqlValues ?? contextMetadata?.sqlValues ?? null,
      });
      timeline.splice(insertIndex, 0, newStep);
      const normalized = normalizeSequence(timeline);
      const updatedTabs = updateTabTimeline(state.productTabs, activeProductId, () => cloneTimeline(normalized));
      return {
        timeline: normalized,
        productTabs: updatedTabs,
        history,
        dirty: computeDirty(normalized, state.lastSuccessfulTimeline, activeProductId),
      };
    }),
  moveStep: (stepId, toIndex) =>
    set((state) => {
      const { activeProductId } = state;
      if (!activeProductId) {
        return state;
      }
      const fromIndex = state.timeline.findIndex((step) => step.id === stepId);
      if (fromIndex === -1 || fromIndex === toIndex) {
        return state;
      }
      const boundedIndex = Math.max(0, Math.min(toIndex, state.timeline.length - 1));
      const history = pushHistory(state.history, state.timeline, "reorder-step");
      const timeline = [...state.timeline];
      const [step] = timeline.splice(fromIndex, 1);
      timeline.splice(boundedIndex, 0, step);
      const normalized = normalizeSequence(timeline);
      const updatedTabs = updateTabTimeline(state.productTabs, activeProductId, () => cloneTimeline(normalized));
      return {
        timeline: normalized,
        productTabs: updatedTabs,
        history,
        dirty: computeDirty(normalized, state.lastSuccessfulTimeline, activeProductId),
      };
    }),
  removeStep: (stepId) =>
    set((state) => {
      const { activeProductId } = state;
      if (!activeProductId) {
        return state;
      }
      const index = state.timeline.findIndex((step) => step.id === stepId);
      if (index === -1) {
        return state;
      }
      const history = pushHistory(state.history, state.timeline, "remove-step");
      const timeline = [...state.timeline];
      timeline.splice(index, 1);
      const normalized = normalizeSequence(timeline);
      const updatedTabs = updateTabTimeline(state.productTabs, activeProductId, () => cloneTimeline(normalized));
      return {
        timeline: normalized,
        productTabs: updatedTabs,
        history,
        dirty: computeDirty(normalized, state.lastSuccessfulTimeline, activeProductId),
      };
    }),
  clearValidation: () => set({ validationErrors: [] }),
  setValidationErrors: (errors) => set({ validationErrors: [...errors] }),
  pushValidationError: (message) => set((state) => ({ validationErrors: [...state.validationErrors, message] })),
  applyGroup: (detail, strategy = "replace") =>
    set((state) => {
      const baseTimeline = strategy === "append" ? [...state.timeline] : [];
      const converted = detail.steps.map((step) =>
        toTimelineStep(
          {
            PROC_SEQ: step.seq,
            PROC_CD: step.process_code,
            PROC_DESC: step.description ?? undefined,
            SETUP_TIME: step.setup_time ?? undefined,
            RUN_TIME: step.duration_min ?? undefined,
            WAIT_TIME: step.wait_time ?? undefined,
            metadata: (step.metadata as TimelineStepMetadata | null) ?? null,
          },
          {
            itemCode: detail.item_codes[0] ?? state.activeItemId,
            candidateId: detail.group_id,
            metadata: (step.metadata as TimelineStepMetadata | null) ?? null,
            routingSetCode: step.routing_set_code ?? null,
            variantCode: step.variant_code ?? null,
            primaryRoutingCode: step.primary_routing_code ?? null,
            secondaryRoutingCode: step.secondary_routing_code ?? null,
            branchCode: step.branch_code ?? null,
            branchLabel: step.branch_label ?? null,
            branchPath: step.branch_path ?? null,
            sqlValues: step.sql_values ?? null,
          },
        ),
      );
      const timeline = normalizeSequence([...baseTimeline, ...converted]);

      const tabId = detail.item_codes[0] ?? detail.group_id;
      const existing = state.productTabs.find((tab) => tab.id === tabId);
      const updatedTabs = existing
        ? updateTabTimeline(state.productTabs, tabId, () => cloneTimeline(timeline))
        : [
            ...state.productTabs,
            {
              id: tabId,
              productCode: detail.item_codes[0] ?? tabId,
              productName: detail.group_name,
              candidateId: detail.group_id,
              timeline: cloneTimeline(timeline),
            },
          ];

      const successMap = updateLastSuccess(state.lastSuccessfulTimeline, tabId, timeline);

      return {
        productTabs: updatedTabs,
        activeProductId: tabId,
        activeItemId: detail.item_codes[0] ?? tabId,
        timeline,
        history: { past: [], future: [] },
        dirty: false,
        lastSuccessfulTimeline: successMap,
        erpRequired: detail.erp_required,
        activeGroupId: detail.group_id,
        activeGroupName: detail.group_name,
        activeGroupVersion: detail.version,
        lastSavedAt: detail.updated_at,
        validationErrors: [],
        sourceItemCodes: detail.item_codes,
      };
    }),
  setActiveGroup: (meta) =>
    set(() => ({
      activeGroupId: meta?.id ?? null,
      activeGroupName: meta?.name ?? null,
      activeGroupVersion: meta?.version,
      lastSavedAt: meta?.updatedAt,
    })),
  setDirty: (dirty) => set({ dirty }),
  setLastSavedAt: (timestamp) => set({ lastSavedAt: timestamp }),
  captureLastSuccess: () =>
    set((state) => {
      const { activeProductId, timeline } = state;
      if (!activeProductId) {
        return state;
      }
      const successMap = updateLastSuccess(state.lastSuccessfulTimeline, activeProductId, timeline);
      return {
        lastSuccessfulTimeline: successMap,
        dirty: false,
      };
    }),
  rollbackToLastSuccess: () =>
    set((state) => {
      const { activeProductId } = state;
      if (!activeProductId) {
        return state;
      }
      const lastSuccess = state.lastSuccessfulTimeline[activeProductId];
      if (!lastSuccess) {
        return state;
      }
      const restored = cloneTimeline(lastSuccess);
      const updatedTabs = updateTabTimeline(state.productTabs, activeProductId, () => cloneTimeline(restored));
      return {
        timeline: normalizeSequence(restored),
        productTabs: updatedTabs,
        history: { past: [], future: [] },
        dirty: false,
      };
    }),
  undo: () =>
    set((state) => {
      const { activeProductId } = state;
      if (!activeProductId || state.history.past.length === 0) {
        return state;
      }
      const past = [...state.history.past];
      const snapshot = past.pop()!;
      const futureSnapshot: TimelineSnapshot = {
        steps: cloneTimeline(state.timeline),
        reason: "undo",
        timestamp: new Date().toISOString(),
      };
      const future = [futureSnapshot, ...state.history.future];
      if (future.length > MAX_HISTORY) {
        future.pop();
      }
      const timeline = normalizeSequence(cloneTimeline(snapshot.steps));
      const updatedTabs = updateTabTimeline(state.productTabs, activeProductId, () => cloneTimeline(timeline));
      return {
        timeline,
        productTabs: updatedTabs,
        history: { past, future },
        dirty: computeDirty(timeline, state.lastSuccessfulTimeline, activeProductId),
      };
    }),
  redo: () =>
    set((state) => {
      const { activeProductId } = state;
      if (!activeProductId || state.history.future.length === 0) {
        return state;
      }
      const future = [...state.history.future];
      const snapshot = future.shift()!;
      const pastSnapshot: TimelineSnapshot = {
        steps: cloneTimeline(state.timeline),
        reason: "redo",
        timestamp: new Date().toISOString(),
      };
      const past = [...state.history.past, pastSnapshot];
      if (past.length > MAX_HISTORY) {
        past.shift();
      }
      const timeline = normalizeSequence(cloneTimeline(snapshot.steps));
      const updatedTabs = updateTabTimeline(state.productTabs, activeProductId, () => cloneTimeline(timeline));
      return {
        timeline,
        productTabs: updatedTabs,
        history: { past, future },
        dirty: computeDirty(timeline, state.lastSuccessfulTimeline, activeProductId),
      };
    }),
});

let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
let lastPersistedSnapshotSignature: string | null = null;

const computeSnapshotSignature = (state: RoutingWorkspacePersistedState): string =>
  JSON.stringify(state);

const persistRoutingSnapshot = (state: RoutingWorkspacePersistedState, signature: string) => {
  void (async () => {
    try {
      const snapshot = await writeRoutingWorkspaceSnapshot(state);
      lastPersistedSnapshotSignature = signature;
      await enqueueAuditEntry({
        action: "routing.snapshot.save",
        message: "Saved routing workspace snapshot to IndexedDB.",
        context: {
          snapshotId: snapshot.id,
          activeProductId: state.activeProductId,
          dirty: state.dirty,
        },
      });
    } catch (error) {
      console.error("Failed to save routing workspace snapshot", error);
      await enqueueAuditEntry({
        action: "routing.snapshot.save.error",
        level: "error",
        message: error instanceof Error ? error.message : String(error),
        context: {
          activeProductId: state.activeProductId,
        },
      });
    }
  })();
};

const scheduleSnapshotSave = (selection: PersistedSelectionState) => {
  const stateForSave = toPersistedState(selection);
  const signature = computeSnapshotSignature(stateForSave);
  if (lastPersistedSnapshotSignature !== null && Object.is(lastPersistedSnapshotSignature, signature)) {
    return;
  }
  if (snapshotTimer) {
    clearTimeout(snapshotTimer);
  }
  snapshotTimer = setTimeout(() => {
    snapshotTimer = undefined;
    persistRoutingSnapshot(stateForSave, signature);
  }, SNAPSHOT_DEBOUNCE_MS);
};

let lastPersistedSelection: PersistedSelectionState | null = null;

const initializeRoutingPersistence = (store: StoreApi<RoutingStoreState>) => {
  store.subscribe((state) => {
    const nextSelection: PersistedSelectionState = persistedSelector(state);
    if (lastPersistedSelection && shallow(lastPersistedSelection, nextSelection)) {
      return;
    }
    lastPersistedSelection = nextSelection;
    scheduleSnapshotSave(nextSelection);
  });
  enableRoutingPersistenceFlush();
  subscribeToRoutingPersistenceFlush((result) => {
    if (!result || result.updatedGroups.length === 0) {
      return;
    }
    store.setState((state) => {
      if (!state.activeGroupId) {
        return state;
      }
      const update = result.updatedGroups.find((item) => item.groupId === state.activeGroupId);
      if (!update) {
        return state;
      }
      const nextLastSavedAt = update.updatedAt ?? state.lastSavedAt;
      if (
        state.dirty === update.dirty &&
        state.activeGroupVersion === update.version &&
        Object.is(state.lastSavedAt, nextLastSavedAt)
      ) {
        return state;
      }
      return {
        ...state,
        dirty: update.dirty,
        activeGroupVersion: update.version,
        lastSavedAt: nextLastSavedAt,
      };
    });
  });
  void flushRoutingPersistence("init");
};

const restoreLatestSnapshot = async (store: StoreApi<RoutingStoreState>) => {
  try {
    const snapshot = await readLatestRoutingWorkspaceSnapshot<RoutingWorkspacePersistedState>();
    if (!snapshot || !snapshot.state) {
      return;
    }
    const persisted = snapshot.state;
    const restoredTabs = (persisted.productTabs ?? []).map((tab) => ({
      ...tab,
      timeline: normalizeSequence(cloneTimeline(tab.timeline ?? [])),
    }));
    let activeProductId = persisted.activeProductId;
    if (!activeProductId || !restoredTabs.some((tab) => tab.id === activeProductId)) {
      activeProductId = restoredTabs[0]?.id ?? null;
    }
    const fallbackTimeline = normalizeSequence(cloneTimeline(persisted.timeline ?? []));
    const activeTimelineSource = activeProductId
      ? restoredTabs.find((tab) => tab.id === activeProductId)?.timeline ?? fallbackTimeline
      : fallbackTimeline;
    const normalizedTimeline = normalizeSequence(cloneTimeline(activeTimelineSource));
    const successMap = persisted.lastSuccessfulTimeline
      ? cloneSuccessMap(persisted.lastSuccessfulTimeline)
      : {};
    const restoredDirty = computeDirty(normalizedTimeline, successMap, activeProductId);
    const restoredMatrix = persisted.routingMatrixDefinitions
      ? cloneRoutingMatrixDefinitions(persisted.routingMatrixDefinitions)
      : [];
    const restoredGroups = persisted.processGroups
      ? cloneProcessGroupDefinitions(persisted.processGroups)
      : [];
    const restoredActiveProcessGroupId = persisted.activeProcessGroupId ?? null;
    const restoredSelection: PersistedSelectionState = {
      activeProductId,
      activeItemId: persisted.activeItemId ?? activeProductId,
      productTabs: restoredTabs,
      timeline: normalizedTimeline,
      lastSuccessfulTimeline: successMap,
      lastSavedAt: persisted.lastSavedAt,
      dirty: restoredDirty,
      customRecommendations: cloneCustomRecommendations(persisted.customRecommendations ?? []),
      hiddenRecommendationKeys: cloneHiddenMap(persisted.hiddenRecommendationKeys ?? {}),
      routingMatrixDefinitions: restoredMatrix,
      processGroups: restoredGroups,
      activeProcessGroupId: restoredActiveProcessGroupId,
    };

    store.setState((current) => ({
      ...current,
      ...restoredSelection,
      history: { past: [], future: [] },
      routingMatrixDefinitions: restoredMatrix,
      processGroups: restoredGroups,
      activeProcessGroupId: restoredGroups.some((group) => group.id === restoredActiveProcessGroupId)
        ? restoredActiveProcessGroupId
        : restoredGroups[0]?.id ?? null,
    }));
    lastPersistedSnapshotSignature = computeSnapshotSignature(toPersistedState(restoredSelection));

    await enqueueAuditEntry({
      action: "routing.snapshot.restore",
      message: "Restored routing workspace snapshot from IndexedDB.",
      context: {
        snapshotId: snapshot.id,
        tabCount: restoredTabs.length,
      },
    });
  } catch (error) {
    console.error("Failed to restore routing workspace snapshot", error);
    await enqueueAuditEntry({
      action: "routing.snapshot.restore.error",
      level: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

export const createRoutingStore = () => {
  const store = create<RoutingStoreState>()(routingStateCreator);
  initializeRoutingPersistence(store);
  void restoreLatestSnapshot(store);
  return store;
};

export const useRoutingStore = createRoutingStore();















