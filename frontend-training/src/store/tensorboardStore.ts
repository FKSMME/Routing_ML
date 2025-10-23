import { create } from "zustand";

import {
  fetchTensorboardProjectorFilters,
  fetchTensorboardProjectorPoints,
  fetchTensorboardProjectors,
  fetchTensorboardMetrics,
  fetchTensorboardTsne,
} from "@lib/apiClient";
import type {
  TensorboardFilterField,
  TensorboardMetricSeries,
  TensorboardPoint,
  TensorboardProjectorSummary,
  TensorboardTsnePoint,
  TensorboardTsneSummary,
} from "@app-types/tensorboard";

type TsneSettings = {
  limit: number;
  perplexity: number;
  iterations: number;
  steps: number;
  stride: number | null;
};

interface TensorboardState {
  projectors: TensorboardProjectorSummary[];
  selectedId: string | null;
  points: TensorboardPoint[];
  totalPoints: number;
  filters: TensorboardFilterField[];
  activeFilters: Record<string, string[]>;
  colorField: string | null;
  metrics: TensorboardMetricSeries[];
  activeMetric: string | null;
  loadingProjectors: boolean;
  loadingPoints: boolean;
  loadingMetrics: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  selectProjector: (id: string) => Promise<void>;
  reloadProjectors: () => Promise<void>;
  refreshPoints: () => Promise<void>;
  fetchTsne: () => Promise<void>;
  loadFilters: () => Promise<void>;
  setColorField: (field: string | null) => void;
  toggleFilterValue: (field: string, value: string) => void;
  clearFilters: () => void;
  fetchMetrics: () => Promise<void>;
  setActiveMetric: (metric: string | null) => void;
  pointLimit: number;
  pointStride: number;
  setPointLimit: (limit: number) => void;
  setPointStride: (stride: number) => void;
  tsnePoints: TensorboardTsnePoint[];
  tsneMeta: TensorboardTsneSummary | null;
  tsneError: string | null;
  loadingTsne: boolean;
  tsneSettings: TsneSettings;
  setTsneSettings: (settings: Partial<TsneSettings>) => void;
}

export const useTensorboardStore = create<TensorboardState>()((set, get) => ({
  projectors: [],
  selectedId: null,
  points: [],
  totalPoints: 0,
  filters: [],
  activeFilters: {},
  colorField: null,
  metrics: [],
  activeMetric: null,
  loadingProjectors: false,
  loadingPoints: false,
  loadingMetrics: false,
  loadingTsne: false,
  error: null,
  pointLimit: 10000,
  pointStride: 1,
  tsnePoints: [],
  tsneMeta: null,
  tsneError: null,
  tsneSettings: {
    limit: 1500,
    perplexity: 30,
    iterations: 750,
    steps: 12,
    stride: null,
  },

  initialize: async () => {
    await get().reloadProjectors();
  },

  selectProjector: async (id: string) => {
    const state = get();
    if (state.selectedId === id) {
      return;
    }
    set({
      selectedId: id,
      activeFilters: {},
      colorField: null,
      points: [],
      totalPoints: 0,
      metrics: [],
      activeMetric: null,
      tsnePoints: [],
      tsneMeta: null,
      tsneError: null,
    });
    await get().loadFilters();
    await get().refreshPoints();
    await get().fetchMetrics();
  },

  reloadProjectors: async () => {
    const state = get();
    if (state.loadingProjectors) {
      return;
    }
    set({ loadingProjectors: true, error: null });
    try {
      const projectors = await fetchTensorboardProjectors();
      const preferredProjector = projectors.find(
        (projector: TensorboardProjectorSummary) => projector.id === "root"
      );
      const freshestProjector = projectors.reduce<TensorboardProjectorSummary | null>((best, current) => {
        if (!best) {
          return current;
        }
        const bestUpdated = best.updatedAt ?? "";
        const currentUpdated = current.updatedAt ?? "";
        if (currentUpdated > bestUpdated) {
          return current;
        }
        if (currentUpdated === bestUpdated) {
          const bestCount = typeof best.sampleCount === "number" ? best.sampleCount : 0;
          const currentCount = typeof current.sampleCount === "number" ? current.sampleCount : 0;
          if (currentCount > bestCount) {
            return current;
          }
        }
        return best;
      }, null);
      let selectedId = state.selectedId;
      if (!selectedId || !projectors.some((projector: TensorboardProjectorSummary) => projector.id === selectedId)) {
        if (freshestProjector) {
          selectedId = freshestProjector.id;
        } else if (preferredProjector) {
          selectedId = preferredProjector.id;
        } else {
          selectedId = projectors.length > 0 ? projectors[0].id : null;
        }
      }
      set({
        projectors,
        selectedId,
        activeFilters: {},
        colorField: null,
        filters: [],
        points: [],
        totalPoints: 0,
        metrics: [],
        activeMetric: null,
        tsnePoints: [],
        tsneMeta: null,
        tsneError: null,
      });
      if (selectedId) {
        await get().loadFilters();
        await get().refreshPoints();
        await get().fetchMetrics();
      }
    } catch (error) {
      console.error("Failed to reload tensorboard projectors", error);
      set({
        error: "TensorBoard 프로젝트를 불러오지 못했습니다.",
        projectors: [],
        selectedId: null,
        points: [],
        totalPoints: 0,
        filters: [],
        metrics: [],
        activeMetric: null,
        tsnePoints: [],
        tsneMeta: null,
        tsneError: "T-SNE 좌표를 불러오지 못했습니다.",
      });
    } finally {
      set({ loadingProjectors: false });
    }
  },

  refreshPoints: async () => {
    const state = get();
    if (!state.selectedId || state.loadingPoints) {
      return;
    }
    set({ loadingPoints: true, error: null });
    try {
      const response = await fetchTensorboardProjectorPoints(state.selectedId, {
        filters: state.activeFilters,
        limit: state.pointLimit,
        stride: state.pointStride > 1 ? state.pointStride : undefined,
      });
      set({
        points: response.points,
        totalPoints: response.total,
      });
    } catch (error) {
      console.error("Failed to load tensorboard points", error);
      set({
        error: "임베딩 좌표를 불러오지 못했습니다.",
        points: [],
        totalPoints: 0,
      });
    } finally {
      set({ loadingPoints: false });
      if (get().selectedId) {
        void get().fetchTsne();
      }
    }
  },

  fetchTsne: async () => {
    const state = get();
    if (!state.selectedId || state.loadingTsne) {
      return;
    }
    set({ loadingTsne: true, tsneError: null });
    try {
      const { limit, perplexity, iterations, steps, stride } = state.tsneSettings;
      const response = await fetchTensorboardTsne(state.selectedId, {
        limit,
        perplexity,
        iterations,
        steps,
        stride: typeof stride === "number" && stride > 0 ? stride : undefined,
        filters: state.activeFilters,
      });
      set({
        tsnePoints: response.points,
        tsneMeta: {
          projectorId: response.projectorId,
          total: response.total,
          sampled: response.sampled,
          requestedPerplexity: response.requestedPerplexity,
          effectivePerplexity: response.effectivePerplexity,
          iterations: response.iterations,
          usedPcaFallback: response.usedPcaFallback,
        },
        tsneError: null,
      });
    } catch (error) {
      console.error("Failed to load tensorboard tsne", error);
      set({
        tsnePoints: [],
        tsneMeta: null,
        tsneError: "T-SNE 좌표를 불러오지 못했습니다.",
      });
    } finally {
      set({ loadingTsne: false });
    }
  },

  loadFilters: async () => {
    const state = get();
    if (!state.selectedId) {
      return;
    }
    try {
      const response = await fetchTensorboardProjectorFilters(state.selectedId);
      set({
        filters: response.fields,
        colorField: response.fields.length > 0 ? response.fields[0].name : null,
      });
    } catch (error) {
      console.error("Failed to load tensorboard filters", error);
      set({
        filters: [],
        colorField: null,
      });
    }
  },

  setColorField: (field) =>
    set({
      colorField: field,
    }),

  toggleFilterValue: (field, value) =>
    set((state) => {
      const currentValues = state.activeFilters[field] ?? [];
      const exists = currentValues.includes(value);
      const nextValues = exists
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];
      const nextFilters = {
        ...state.activeFilters,
        [field]: nextValues,
      };
      if (nextValues.length === 0) {
        delete nextFilters[field];
      }
      return {
        activeFilters: nextFilters,
      };
    }),

  clearFilters: () =>
    set({
      activeFilters: {},
    }),

  fetchMetrics: async () => {
    const state = get();
    if (!state.selectedId || state.loadingMetrics) {
      return;
    }
    set({ loadingMetrics: true });
    try {
      const series = await fetchTensorboardMetrics(state.selectedId);
      set({
        metrics: series,
        activeMetric: series.length > 0 ? series[0].metric : null,
      });
    } catch (error) {
      console.error("Failed to load tensorboard metrics", error);
      set({
        metrics: [],
        activeMetric: null,
      });
    } finally {
      set({ loadingMetrics: false });
    }
  },

  setActiveMetric: (metric) =>
    set({
      activeMetric: metric,
    }),

  setPointLimit: (limit) =>
    set(() => ({
      pointLimit: Math.max(500, limit),
    })),

  setPointStride: (stride) =>
    set(() => ({
      pointStride: Math.max(1, stride),
    })),

  setTsneSettings: (settings) =>
    set((state) => {
      const next: TsneSettings = { ...state.tsneSettings };
      if (settings.limit !== undefined) {
        next.limit = Math.max(200, Math.min(5000, Math.floor(settings.limit)));
      }
      if (settings.perplexity !== undefined) {
        next.perplexity = Math.max(5, Math.min(100, settings.perplexity));
      }
      if (settings.iterations !== undefined) {
        next.iterations = Math.max(250, Math.min(2000, Math.floor(settings.iterations)));
      }
      if (settings.steps !== undefined) {
        next.steps = Math.max(3, Math.min(50, Math.floor(settings.steps)));
      }
      if (settings.stride !== undefined) {
        const stride = settings.stride;
        next.stride = typeof stride === "number" && stride > 0 ? Math.floor(stride) : null;
      }
      return { tsneSettings: next };
    }),
}));

export type { TensorboardState };
