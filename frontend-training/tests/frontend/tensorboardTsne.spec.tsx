import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-three/fiber", () => ({
  Canvas: () => <div data-testid="mock-canvas" />,
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  Grid: () => null,
}));

vi.mock("echarts-for-react", () => {
  return {
    default: ({ option }: { option: unknown }) => (
      <div data-testid="mock-echarts">{JSON.stringify(option)}</div>
    ),
  };
});

const apiClientMocks = vi.hoisted(() => ({
  fetchTrainingStatusMock: vi.fn().mockResolvedValue({}),
  exportTensorboardProjectorMock: vi.fn().mockResolvedValue({}),
  fetchTensorboardConfigMock: vi.fn().mockResolvedValue({
    projectorPath: "/tmp/projector",
    projectorPathExists: true,
    modelDir: "/tmp/model",
    mlArtifactsDir: "/tmp/model",
  }),
}));

vi.mock("@lib/apiClient", () => ({
  fetchTrainingStatus: apiClientMocks.fetchTrainingStatusMock,
  exportTensorboardProjector: apiClientMocks.exportTensorboardProjectorMock,
  fetchTensorboardConfig: apiClientMocks.fetchTensorboardConfigMock,
}));

const initializeMock = vi.fn(async () => {});
const reloadProjectorsMock = vi.fn(async () => {});
const refreshPointsMock = vi.fn(async () => {});
const loadFiltersMock = vi.fn(async () => {});
const fetchMetricsMock = vi.fn(async () => {});
const fetchTsneMock = vi.fn(async () => {});

type TsneSettings = {
  limit: number;
  perplexity: number;
  iterations: number;
  steps: number;
  stride: number | null;
};

type StoreState = ReturnType<typeof createStoreState>;

const createStoreState = () => ({
  projectors: [
    { id: "default", tensorName: "embedding", sampleCount: 5, updatedAt: "2025-10-22T00:00:00Z" },
  ],
  selectedId: "default",
  points: [],
  totalPoints: 0,
  filters: [],
  activeFilters: {} as Record<string, string[]>,
  colorField: null as string | null,
  metrics: [],
  activeMetric: null as string | null,
  loadingProjectors: false,
  loadingPoints: false,
  loadingMetrics: false,
  loadingTsne: false,
  error: null as string | null,
  tsnePoints: [
    {
      id: "item-0",
      x: 0.0,
      y: 0.1,
      progress: 0.0,
      step: 1,
      metadata: { ITEM_CD: "item-0", PART_TYPE: "alpha" },
    },
    {
      id: "item-1",
      x: 0.2,
      y: 0.3,
      progress: 0.75,
      step: 2,
      metadata: { ITEM_CD: "item-1", PART_TYPE: "beta" },
    },
  ],
  tsneMeta: {
    projectorId: "default",
    total: 5,
    sampled: 2,
    requestedPerplexity: 30,
    effectivePerplexity: 25,
    iterations: 750,
    usedPcaFallback: false,
  },
  tsneError: null as string | null,
  tsneSettings: {
    limit: 500,
    perplexity: 30,
    iterations: 750,
    steps: 4,
    stride: null,
  } as TsneSettings,
  initialize: initializeMock,
  selectProjector: vi.fn(async () => {}),
  reloadProjectors: reloadProjectorsMock,
  refreshPoints: refreshPointsMock,
  loadFilters: loadFiltersMock,
  setColorField: vi.fn(),
  toggleFilterValue: vi.fn(),
  clearFilters: vi.fn(),
  fetchMetrics: fetchMetricsMock,
  setActiveMetric: vi.fn(),
  fetchTsne: fetchTsneMock,
  setTsneSettings: setTsneSettingsMock,
  pointLimit: 10000,
  pointStride: 1,
  setPointLimit: vi.fn(),
  setPointStride: vi.fn(),
});

let storeState: StoreState = createStoreState();

function setTsneSettingsMock(partial: Partial<TsneSettings>) {
  storeState.tsneSettings = { ...storeState.tsneSettings, ...partial };
}

vi.mock("@store/tensorboardStore", () => ({
  useTensorboardStore: (selector?: (state: StoreState) => unknown) =>
    selector ? selector(storeState) : storeState,
}));

import { TensorboardEmbeddingPanel } from "../../src/components/tensorboard/TensorboardEmbeddingPanel";

describe("TensorboardEmbeddingPanel - T-SNE visualization", () => {
  beforeEach(() => {
    apiClientMocks.fetchTrainingStatusMock.mockClear();
    apiClientMocks.exportTensorboardProjectorMock.mockClear();
    apiClientMocks.fetchTensorboardConfigMock.mockClear();
    initializeMock.mockClear();
    reloadProjectorsMock.mockClear();
    refreshPointsMock.mockClear();
    loadFiltersMock.mockClear();
    fetchMetricsMock.mockClear();
    fetchTsneMock.mockClear();
    storeState = createStoreState();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const openTsneView = async () => {
    render(<TensorboardEmbeddingPanel />);
    const [tsneToggle] = screen.getAllByRole("button", { name: "T-SNE Progress" });
    fireEvent.click(tsneToggle);
    await waitFor(() => expect(screen.getByText(/T-SNE 재계산/)).toBeInTheDocument());
  };

  it("renders T-SNE summary when the visualization mode is toggled", async () => {
    await openTsneView();

    expect(screen.getByText(/샘플링:/)).toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
    expect(screen.getByText("T-SNE 재계산")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("invokes fetchTsne when recalculation is requested", async () => {
    await openTsneView();

    const recalcButton = screen.getByRole("button", { name: "T-SNE 재계산" });
    fireEvent.click(recalcButton);

    expect(fetchTsneMock).toHaveBeenCalledTimes(1);
  });
});
