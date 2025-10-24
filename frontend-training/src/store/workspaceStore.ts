import type { FeatureWeightsProfile, PredictionResponse } from "@app-types/routing";
import { create } from "zustand";

// import { saveWorkspaceSettings, type WorkspaceSettingsPayload, type WorkspaceSettingsResponse } from "@lib/apiClient";
type WorkspaceSettingsPayload = any;
type WorkspaceSettingsResponse = any;

import {
  DEFAULT_REFERENCE_MATRIX_COLUMNS,
  type ReferenceMatrixColumnKey,
  registerReferenceMatrixPersistence,
  useRoutingStore,
} from "./routingStore";

export type LayoutMode = "desktop";
export type NavigationKey =
  | "master-data"
  | "routing"
  | "routing-matrix"
  | "process-groups"
  | "data-output"
  | "algorithm"
  | "algorithm-viz"
  | "model-training"
  | "tensorboard"
  | "quality-monitor"
  | "training-monitor"
  | "training-settings"
  | "log-viewer"
  | "options";

type ExportDestination = "local" | "clipboard" | "server";

interface ItemSearchState {
  itemCodes: string[];
  topK: number;
  threshold: number;
  lastRequestedAt?: string;
}

interface FeatureProfileSummary {
  name: string;
  description?: string | null;
  weights?: Record<string, number>;
}

interface FeatureWeightState {
  profile: string | null;
  manualWeights: Record<string, number>;
  availableProfiles: FeatureProfileSummary[];
}

interface ExportProfileState {
  formats: string[];
  destination: ExportDestination;
  withVisualization: boolean;
  lastSyncAt?: string;
}

export interface WorkspaceColumnMappingRow {
  id: string;
  scope: string;
  source: string;
  target: string;
}

export interface WorkspaceOptionsSnapshot {
  standard: string[];
  similarity: string[];
  offlineDatasetPath: string;
  databaseTargetTable: string;
  columnMappings: WorkspaceColumnMappingRow[];
  erpInterface: boolean;
}

interface WorkspaceOptionsState {
  data: WorkspaceOptionsSnapshot;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  lastSyncedAt?: string;
}

interface SaveWorkspaceOptionsArgs {
  version?: number;
  metadata?: WorkspaceSettingsPayload["metadata"];
  columnMappings?: WorkspaceColumnMappingRow[];
}

export interface OutputMappingRow {
  id: string;
  source: string;
  mapped: string;
  type: string;
  required: boolean;
  defaultValue?: string;
}

export interface SerializedOutputMappingRow {
  source: string;
  mapped: string;
  type: string;
  required: boolean;
  defaultValue?: string;
}

interface RoutingSaveState {
  exportProfile: ExportProfileState;
  erpInterfaceEnabled: boolean;
  columnMappings: SerializedOutputMappingRow[];
}

interface WorkspaceStoreState {
  layout: LayoutMode;
  activeMenu: NavigationKey;
  itemSearch: ItemSearchState;
  featureWeights: FeatureWeightState;
  exportProfile: ExportProfileState;
  erpInterfaceEnabled: boolean;
  workspaceOptions: WorkspaceOptionsState;
  outputMappings: OutputMappingRow[];
  setLayout: (layout: LayoutMode) => void;
  referenceMatrixColumns: ReferenceMatrixColumnKey[];
  setActiveMenu: (menu: NavigationKey) => void;
  updateItemCodes: (codes: string[]) => void;
  updateTopK: (value: number) => void;
  updateThreshold: (value: number) => void;
  setFeatureWeightProfile: (profile: string | null) => void;
  setManualWeight: (feature: string, value: number) => void;
  resetManualWeights: () => void;
  setAvailableProfiles: (profiles: FeatureProfileSummary[]) => void;
  setExportFormats: (formats: string[]) => void;
  toggleExportFormat: (format: string) => void;
  setExportDestination: (destination: ExportDestination) => void;
  toggleVisualization: (enabled: boolean) => void;
  setErpInterfaceEnabled: (enabled: boolean) => void;
  markExportSynced: () => void;
  applyPredictionResponse: (response: PredictionResponse) => void;
  setWorkspaceOptionsLoading: (loading: boolean) => void;
  setWorkspaceOptionsSnapshot: (snapshot: WorkspaceOptionsSnapshot, options?: { dirty?: boolean; lastSyncedAt?: string }) => void;
  updateWorkspaceOptions: (
    patch: Partial<WorkspaceOptionsSnapshot> | ((prev: WorkspaceOptionsSnapshot) => WorkspaceOptionsSnapshot),
  ) => void;
  updateWorkspaceColumnMappings: (
    updater: (rows: WorkspaceColumnMappingRow[]) => WorkspaceColumnMappingRow[],
  ) => void;
  setWorkspaceOptionsDirty: (dirty: boolean) => void;
  saveWorkspaceOptions: (args?: SaveWorkspaceOptionsArgs) => Promise<WorkspaceSettingsResponse>;
  setReferenceMatrixColumns: (columns: Array<string | ReferenceMatrixColumnKey>) => void;
  setOutputMappings: (rows: OutputMappingRow[]) => void;
  updateOutputMappings: (updater: (rows: OutputMappingRow[]) => OutputMappingRow[]) => void;
  reorderOutputMappings: (fromIndex: number, toIndex: number) => void;
  clearOutputMappings: () => void;
  saveRouting: () => RoutingSaveState;
}

const DEFAULT_PROFILES: FeatureProfileSummary[] = [
  { name: "default", description: "Default" },
  { name: "geometry-focus", description: "Geometry emphasis" },
  { name: "operation-history", description: "Runtime emphasis" },
];

const normalizeFormats = (formats: string[]): string[] => {
  const unique = new Set<string>();
  formats.forEach((format) => {
    if (format) {
      unique.add(format.toLowerCase());
    }
  });
  return Array.from(unique);
};

const toProfileSummary = (profiles: FeatureWeightsProfile[] | undefined): FeatureProfileSummary[] => {
  if (!profiles || profiles.length === 0) {
    return DEFAULT_PROFILES;
  }
  return profiles.map((profile) => ({
    name: profile.name,
    description: profile.description ?? null,
    weights: profile.weights,
  }));
};

const normalizeReferenceMatrixColumns = (
  columns: Array<string | ReferenceMatrixColumnKey>,
): ReferenceMatrixColumnKey[] => {
  const normalized: ReferenceMatrixColumnKey[] = [];
  const validColumns = DEFAULT_REFERENCE_MATRIX_COLUMNS as ReadonlyArray<ReferenceMatrixColumnKey>;
  columns.forEach((column) => {
    if (typeof column === "string") {
      const match = validColumns.find((candidate) => candidate === column);
      if (match && !normalized.includes(match)) {
        normalized.push(match);
      }
    } else if (validColumns.includes(column) && !normalized.includes(column)) {
      normalized.push(column);
    }
  });
  if (normalized.length === 0) {
    return [...DEFAULT_REFERENCE_MATRIX_COLUMNS];
  }
  return normalized;
};

const nowIsoString = () => new Date().toISOString();
const createDefaultWorkspaceOptions = (): WorkspaceOptionsSnapshot => ({
  standard: ["zscore"],
  similarity: ["cosine", "profile"],
  offlineDatasetPath: "",
  databaseTargetTable: "",
  columnMappings: [],
  erpInterface: useRoutingStore.getState().erpRequired,
});

const createWorkspaceOptionsState = (): WorkspaceOptionsState => ({
  data: createDefaultWorkspaceOptions(),
  loading: false,
  saving: false,
  dirty: false,
  lastSyncedAt: undefined,
});
const createMappingRowId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `mapping-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const useWorkspaceStore = create<WorkspaceStoreState>()((set, get) => ({
  layout: "desktop",
  activeMenu: "master-data",
  itemSearch: {
    itemCodes: ["ITEM-001"],
    topK: 10,
    threshold: 0.3,
    lastRequestedAt: undefined,
  },
  featureWeights: {
    profile: "geometry-focus",
    manualWeights: {},
    availableProfiles: DEFAULT_PROFILES,
  },
  exportProfile: {
    formats: ["csv", "excel"],
    destination: "local",
    withVisualization: false,
    lastSyncAt: undefined,
  },
  erpInterfaceEnabled: useRoutingStore.getState().erpRequired,
  workspaceOptions: createWorkspaceOptionsState(),
  referenceMatrixColumns: [...DEFAULT_REFERENCE_MATRIX_COLUMNS],
  outputMappings: [],
  setLayout: (layout) => set({ layout }),
  setActiveMenu: (menu) => set({ activeMenu: menu }),
  updateItemCodes: (codes) =>
    set((state) => ({
      itemSearch: {
        ...state.itemSearch,
        itemCodes: codes,
      },
    })),
  updateTopK: (value) =>
    set((state) => ({
      itemSearch: {
        ...state.itemSearch,
        topK: value,
      },
    })),
  updateThreshold: (value) =>
    set((state) => ({
      itemSearch: {
        ...state.itemSearch,
        threshold: value,
      },
    })),
  setFeatureWeightProfile: (profile) =>
    set((state) => ({
      featureWeights: {
        ...state.featureWeights,
        profile,
        manualWeights: profile === "custom" ? state.featureWeights.manualWeights : {},
      },
    })),
  setManualWeight: (feature, value) =>
    set((state) => ({
      featureWeights: {
        profile: "custom",
        availableProfiles: state.featureWeights.availableProfiles,
        manualWeights: {
          ...state.featureWeights.manualWeights,
          [feature]: value,
        },
      },
    })),
  resetManualWeights: () =>
    set((state) => ({
      featureWeights: {
        ...state.featureWeights,
        profile: "default",
        manualWeights: {},
      },
    })),
  setAvailableProfiles: (profiles) =>
    set((state) => {
      const currentProfile = state.featureWeights.profile;
      const catalog = profiles.length > 0 ? profiles : DEFAULT_PROFILES;
      const profileNames = catalog.map((profile) => profile.name);
      const keepCurrent = !currentProfile || currentProfile === "custom" || profileNames.includes(currentProfile);
      const nextProfile = keepCurrent ? currentProfile : catalog[0]?.name ?? null;
      return {
        featureWeights: {
          ...state.featureWeights,
          profile: nextProfile,
          availableProfiles: catalog,
        },
      };
    }),
  setExportFormats: (formats) =>
    set((state) => ({
      exportProfile: {
        ...state.exportProfile,
        formats: normalizeFormats(formats),
      },
    })),
  toggleExportFormat: (format) =>
    set((state) => {
      const normalized = format.toLowerCase();
      const formats = new Set(state.exportProfile.formats.map((item) => item.toLowerCase()));
      if (formats.has(normalized)) {
        formats.delete(normalized);
      } else {
        formats.add(normalized);
      }
      return {
        exportProfile: {
          ...state.exportProfile,
          formats: Array.from(formats),
        },
      };
    }),
  setExportDestination: (destination) =>
    set((state) => ({
      exportProfile: {
        ...state.exportProfile,
        destination,
      },
    })),
  toggleVisualization: (enabled) =>
    set((state) => ({
      exportProfile: {
        ...state.exportProfile,
        withVisualization: enabled,
      },
    })),
  setErpInterfaceEnabled: (enabled) => {
    useRoutingStore.getState().setERPRequired(enabled);
    set((state) => ({
      erpInterfaceEnabled: enabled,
      workspaceOptions: {
        ...state.workspaceOptions,
        data:
          state.workspaceOptions.data.erpInterface === enabled
            ? state.workspaceOptions.data
            : { ...state.workspaceOptions.data, erpInterface: enabled },
        dirty:
          state.workspaceOptions.dirty || state.workspaceOptions.data.erpInterface !== enabled,
      },
    }));
  },
  markExportSynced: () =>
    set((state) => ({
      exportProfile: {
        ...state.exportProfile,
        lastSyncAt: nowIsoString(),
      },
    })),
  setReferenceMatrixColumns: (columns) =>
    set((state) => {
      const nextColumns = normalizeReferenceMatrixColumns(columns);
      const current = state.referenceMatrixColumns;
      if (
        nextColumns.length === current.length &&
        nextColumns.every((column, index) => column === current[index])
      ) {
        return state;
      }
      useRoutingStore.getState().hydrateReferenceMatrixColumns(nextColumns);
      return { referenceMatrixColumns: nextColumns };
    }),
  setOutputMappings: (rows) =>
    set({
      outputMappings: rows.map((row) => ({
        id: row.id || createMappingRowId(),
        source: row.source,
        mapped: row.mapped,
        type: row.type,
        required: row.required,
        defaultValue: row.defaultValue ?? "",
      })),
    }),
  updateOutputMappings: (updater) =>
    set((state) => ({
      outputMappings: updater(state.outputMappings).map((row) => ({
        id: row.id || createMappingRowId(),
        source: row.source,
        mapped: row.mapped,
        type: row.type,
        required: row.required,
        defaultValue: row.defaultValue ?? "",
      })),
    })),
  reorderOutputMappings: (fromIndex, toIndex) =>
    set((state) => {
      if (fromIndex === toIndex) {
        return state;
      }
      const next = [...state.outputMappings];
      if (fromIndex < 0 || fromIndex >= next.length) {
        return state;
      }
      const clampedIndex = Math.max(0, Math.min(toIndex, next.length - 1));
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) {
        return state;
      }
      next.splice(clampedIndex, 0, moved);
      return { outputMappings: next };
    }),
  clearOutputMappings: () => set({ outputMappings: [] }),
  saveRouting: () => {
    const state = get();
    const columnMappings: SerializedOutputMappingRow[] = state.outputMappings
      .map((row) => ({
        source: row.source.trim(),
        mapped: (row.mapped ?? "").trim() || row.source.trim(),
        type: row.type.trim() || "string",
        required: Boolean(row.required),
        defaultValue: row.defaultValue?.trim() || undefined,
      }))
      .filter((row) => row.mapped !== "" && (row.source !== "" || (row.defaultValue ?? "") !== ""));
    return {
      exportProfile: state.exportProfile,
      erpInterfaceEnabled: state.erpInterfaceEnabled,
      columnMappings,
    };
  },
  applyPredictionResponse: (response) => {
    useRoutingStore.getState().loadRecommendations(response);
    const generatedAt = response.metrics.generated_at ?? nowIsoString();
    const availableProfiles = toProfileSummary(response.metrics.feature_weights?.profiles);
    set((state) => ({
      itemSearch: {
        ...state.itemSearch,
        lastRequestedAt: generatedAt,
      },
      featureWeights: {
        ...state.featureWeights,
        availableProfiles,
        profile:
          state.featureWeights.profile === "custom" || !state.featureWeights.profile
            ? state.featureWeights.profile
            : availableProfiles.some((profile) => profile.name === state.featureWeights.profile)
              ? state.featureWeights.profile
              : availableProfiles[0]?.name ?? state.featureWeights.profile,
      },
      exportProfile: {
        ...state.exportProfile,
        withVisualization: Boolean(response.metrics.visualization),
        lastSyncAt: generatedAt,
      },
    }));
  },
  setWorkspaceOptionsLoading: (loading) =>
    set((state) => ({
      workspaceOptions: {
        ...state.workspaceOptions,
        loading,
      },
    })),
  setWorkspaceOptionsSnapshot: (snapshot, options) => {
    useRoutingStore.getState().setERPRequired(snapshot.erpInterface);
    set((state) => ({
      erpInterfaceEnabled: snapshot.erpInterface,
      workspaceOptions: {
        ...state.workspaceOptions,
        data: snapshot,
        loading: false,
        saving: false,
        dirty: options?.dirty ?? state.workspaceOptions.dirty,
        lastSyncedAt: options?.lastSyncedAt ?? state.workspaceOptions.lastSyncedAt,
      },
    }));
  },
  updateWorkspaceOptions: (patch) =>
    set((state) => {
      const current = state.workspaceOptions.data;
      const next = typeof patch === "function" ? patch(current) : { ...current, ...patch };
      return {
        workspaceOptions: {
          ...state.workspaceOptions,
          data: next,
          dirty: true,
        },
      };
    }),
  updateWorkspaceColumnMappings: (updater) =>
    set((state) => ({
      workspaceOptions: {
        ...state.workspaceOptions,
        data: {
          ...state.workspaceOptions.data,
          columnMappings: updater(state.workspaceOptions.data.columnMappings),
        },
        dirty: true,
      },
    })),
  setWorkspaceOptionsDirty: (dirty) =>
    set((state) => ({
      workspaceOptions: {
        ...state.workspaceOptions,
        dirty,
      },
    })),
  saveWorkspaceOptions: async (args) => {
    const current = get().workspaceOptions.data;
    const standard = Array.from(new Set(current.standard.map((value) => value.trim()).filter(Boolean)));
    const similarity = Array.from(new Set(current.similarity.map((value) => value.trim()).filter(Boolean)));
    const offlineDatasetPath = current.offlineDatasetPath.trim();
    const databaseTargetTable = current.databaseTargetTable.trim();
    const mappingsSource = args?.columnMappings ?? current.columnMappings;
    const normalizedMappings = mappingsSource.map((row) => ({
      id: row.id,
      scope: row.scope.trim(),
      source: row.source.trim(),
      target: row.target.trim(),
    }));
    const payloadMappings = normalizedMappings
      .map((row) => ({
        scope: row.scope,
        source: row.source,
        target: row.target,
      }))
      .filter((row) => row.scope || row.source || row.target);
    const _payload: WorkspaceSettingsPayload = {
      version: args?.version ?? Date.now(),
      options: {
        standard,
        similarity,
        offline_dataset_path: offlineDatasetPath,
        database_target_table: databaseTargetTable || null,
        erp_interface: current.erpInterface,
        column_mappings: payloadMappings,
      },
      access: {
        path: offlineDatasetPath || null,
        table: databaseTargetTable || null,
      },
      metadata: args?.metadata,
    };
    set((state) => ({
      workspaceOptions: {
        ...state.workspaceOptions,
        saving: true,
      },
    }));
    try {
      // API function removed - workspace settings feature not used
      const response = {} as WorkspaceSettingsResponse;
      // const response = await saveWorkspaceSettings(payload);
      useRoutingStore.getState().setERPRequired(current.erpInterface);
      set((state) => ({
        erpInterfaceEnabled: current.erpInterface,
        workspaceOptions: {
          ...state.workspaceOptions,
          data: {
            ...state.workspaceOptions.data,
            standard,
            similarity,
            offlineDatasetPath,
            databaseTargetTable,
            columnMappings: normalizedMappings,
            erpInterface: current.erpInterface,
          },
          saving: false,
          dirty: false,
          lastSyncedAt: response.updated_at ?? nowIsoString(),
        },
      }));
      return response;
    } catch (error) {
      set((state) => ({
        workspaceOptions: {
          ...state.workspaceOptions,
          saving: false,
        },
      }));
      throw error;
    }
  },
}));

registerReferenceMatrixPersistence((columns) => {
  useWorkspaceStore.setState((current) => {
    if (
      current.referenceMatrixColumns.length === columns.length &&
      current.referenceMatrixColumns.every((column, index) => column === columns[index])
    ) {
      return current;
    }
    return { referenceMatrixColumns: columns };
  });
});

useRoutingStore.getState().hydrateReferenceMatrixColumns(useWorkspaceStore.getState().referenceMatrixColumns);

useRoutingStore.subscribe(
  (state) => {
    const erpRequired = state.erpRequired;
    useWorkspaceStore.setState((current) => ({
      erpInterfaceEnabled: erpRequired,
      workspaceOptions: {
        ...current.workspaceOptions,
        data:
          current.workspaceOptions.data.erpInterface === erpRequired
            ? current.workspaceOptions.data
            : { ...current.workspaceOptions.data, erpInterface: erpRequired },
      },
    }));
  }
);

useRoutingStore.subscribe(
  (state) => {
    const codes = state.sourceItemCodes;
    if (codes && codes.length > 0) {
      useWorkspaceStore.setState((current) => ({
        itemSearch: {
          ...current.itemSearch,
          itemCodes: codes,
        },
      }));
    }
  }
);
