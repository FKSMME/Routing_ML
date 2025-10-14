import type {
  TensorboardFilterField,
  TensorboardMetricSeries,
  TensorboardPoint,
  TensorboardProjectorSummary,
} from "@app-types/tensorboard";
import {
  fetchTensorboardMetrics,
  fetchTensorboardProjectorFilters,
  fetchTensorboardProjectorPoints,
  fetchTensorboardProjectors,
} from "@lib/apiClient";
import { create } from "zustand";

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
  error: null,
  pointLimit: 10000,
  pointStride: 1,

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
      let selectedId = state.selectedId;
      if (!selectedId || !projectors.some((projector) => projector.id === selectedId)) {
        selectedId = projectors.length > 0 ? projectors[0].id : null;
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
}));

export type { TensorboardState };
