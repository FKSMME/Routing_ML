import type { TrainingFeatureWeight } from "@lib/apiClient";
import { create } from "zustand";

interface TrainingFeatureToggleState {
  toggles: Record<string, boolean>;
  lastSyncedAt?: string;
  syncFromFeatures: (features: TrainingFeatureWeight[]) => void;
  setMany: (values: Record<string, boolean>) => void;
  setToggle: (featureId: string, enabled: boolean) => void;
  markSynced: (timestamp: string) => void;
  reset: () => void;
}

const areMapsEqual = (a: Record<string, boolean>, b: Record<string, boolean>): boolean => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
};

export const useTrainingFeatureStore = create<TrainingFeatureToggleState>()((set) => ({
  toggles: {},
  lastSyncedAt: undefined,
  syncFromFeatures: (features) => {
    const next: Record<string, boolean> = {};
    for (const feature of features) {
      next[feature.id] = Boolean(feature.enabled);
    }
    set((state) => {
      if (areMapsEqual(state.toggles, next)) {
        return state;
      }
      return {
        ...state,
        toggles: next,
      };
    });
  },
  setMany: (values) => {
    const normalized: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(values)) {
      normalized[key] = Boolean(value);
    }
    set((state) => {
      if (areMapsEqual(state.toggles, normalized)) {
        return state;
      }
      return {
        ...state,
        toggles: normalized,
      };
    });
  },
  setToggle: (featureId, enabled) =>
    set((state) => {
      if (state.toggles[featureId] === enabled) {
        return state;
      }
      return {
        ...state,
        toggles: {
          ...state.toggles,
          [featureId]: enabled,
        },
      };
    }),
  markSynced: (timestamp) =>
    set((state) => {
      if (state.lastSyncedAt === timestamp) {
        return state;
      }
      return {
        ...state,
        lastSyncedAt: timestamp,
      };
    }),
  reset: () => ({ toggles: {}, lastSyncedAt: undefined }),
}));

export type { TrainingFeatureToggleState };
