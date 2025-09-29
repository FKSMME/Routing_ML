import type { FeatureWeightsProfile, PredictionResponse } from "@app-types/routing";
import { create } from "zustand";

import { useRoutingStore } from "./routingStore";

export type LayoutMode = "desktop" | "tablet" | "mobile";
export type NavigationKey =
  | "master-data"
  | "routing"
  | "algorithm"
  | "data-output"
  | "training-status"
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
  description?: string;
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

interface WorkspaceStoreState {
  layout: LayoutMode;
  activeMenu: NavigationKey;
  itemSearch: ItemSearchState;
  featureWeights: FeatureWeightState;
  exportProfile: ExportProfileState;
  erpInterfaceEnabled: boolean;
  setLayout: (layout: LayoutMode) => void;
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
    description: profile.description ?? undefined,
  }));
};

const nowIsoString = () => new Date().toISOString();

export const useWorkspaceStore = create<WorkspaceStoreState>()((set) => ({
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
    set({ erpInterfaceEnabled: enabled });
  },
  markExportSynced: () =>
    set((state) => ({
      exportProfile: {
        ...state.exportProfile,
        lastSyncAt: nowIsoString(),
      },
    })),
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
}));

useRoutingStore.subscribe(
  (state) => state.erpRequired,
  (erpRequired) => {
    useWorkspaceStore.setState({ erpInterfaceEnabled: erpRequired });
  },
);

useRoutingStore.subscribe(
  (state) => state.sourceItemCodes,
  (codes) => {
    if (codes && codes.length > 0) {
      useWorkspaceStore.setState((current) => ({
        itemSearch: {
          ...current.itemSearch,
          itemCodes: codes,
        },
      }));
    }
  },
);
