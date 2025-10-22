import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("echarts-for-react", () => ({
  __esModule: true,
  default: ({ option }: { option?: { series?: Array<{ type?: string }> } }) => (
    <div data-testid="echarts-mock" data-series-type={option?.series?.[0]?.type ?? "unknown"} />
  ),
}));

const fetchTrainingStatusMock = vi.hoisted(() => vi.fn());
const fetchTrainingMetricsMock = vi.hoisted(() => vi.fn());

const featureCatalog = [
  { id: "ITEM_TYPE", label: "ITEM TYPE", weight: 2.2 },
  { id: "SealTypeGrup", label: "Seal Type Grup", weight: 1.8 },
];

let serverFeatureState: Record<string, boolean>;

const fetchTrainingFeatureWeightsMock = vi.hoisted(() => vi.fn());
const patchTrainingFeaturesMock = vi.hoisted(() => vi.fn());
const fetchTrainingRunHistoryMock = vi.hoisted(() => vi.fn());
const postUiAuditMock = vi.hoisted(() => vi.fn());

vi.mock("@lib/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lib/apiClient")>();
  return {
    __esModule: true,
    ...actual,
    fetchTrainingStatus: fetchTrainingStatusMock,
    fetchTrainingMetrics: fetchTrainingMetricsMock,
    fetchTrainingFeatureWeights: fetchTrainingFeatureWeightsMock,
    fetchTrainingRunHistory: fetchTrainingRunHistoryMock,
    patchTrainingFeatures: patchTrainingFeaturesMock,
    postUiAudit: postUiAuditMock,
  };
});

import { TrainingStatusWorkspace } from "@components/workspaces/TrainingStatusWorkspace";
import { useTrainingFeatureStore } from "@routing-ml/shared/store/trainingStore";

const renderWorkspace = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <TrainingStatusWorkspace />
    </QueryClientProvider>,
  );

  return { ...view, queryClient };
};

beforeEach(() => {
  serverFeatureState = {
    ITEM_TYPE: true,
    SealTypeGrup: false,
  };
  useTrainingFeatureStore.getState().reset();
  fetchTrainingStatusMock.mockReset();
  fetchTrainingMetricsMock.mockReset();
  fetchTrainingFeatureWeightsMock.mockReset();
  fetchTrainingRunHistoryMock.mockReset();
  patchTrainingFeaturesMock.mockReset();
  postUiAuditMock.mockReset();

  fetchTrainingStatusMock.mockResolvedValue({
    job_id: "job-1",
    status: "idle",
    started_at: null,
    finished_at: null,
    progress: 25,
    message: null,
    version_path: null,
    metrics: { tensorboard_url: "https://tensorboard.example/" },
    latest_version: null,
  });

  fetchTrainingMetricsMock.mockResolvedValue({
    cards: [
      { id: "rmse", title: "RMSE", value: 0.42, subtitle: "↓ vs. baseline" },
    ],
    tensorboard_url: "https://tensorboard.example/",
    metric_trend_label: "RMSE",
    metric_trend: [
      { timestamp: "2024-01-01T00:00:00Z", value: 0.5 },
      { timestamp: "2024-01-02T00:00:00Z", value: 0.42 },
    ],
    heatmap: {
      xLabels: ["Epoch 1", "Epoch 2"],
      yLabels: ["Feature A", "Feature B"],
      values: [
        [1, 2],
        [3, 4],
      ],
      label: "Activation",
    },
  });

  fetchTrainingFeatureWeightsMock.mockImplementation(async () =>
    featureCatalog.map((feature) => ({
      ...feature,
      enabled: serverFeatureState[feature.id] ?? true,
    })),
  );

  patchTrainingFeaturesMock.mockImplementation(async (payload: { features: Record<string, boolean> }) => {
    serverFeatureState = { ...serverFeatureState, ...payload.features };
    const updated = Object.entries(payload.features)
      .filter(([, enabled]) => enabled)
      .map(([featureId]) => featureId);
    const disabled = Object.entries(payload.features)
      .filter(([, enabled]) => !enabled)
      .map(([featureId]) => featureId);
    return {
      updated,
      disabled,
      timestamp: new Date("2025-01-01T00:00:00Z").toISOString(),
    };
  });

  fetchTrainingRunHistoryMock.mockResolvedValue([]);
  postUiAuditMock.mockResolvedValue({ id: "audit-001" });
});

afterEach(() => {
  useTrainingFeatureStore.getState().reset();
});

describe("TrainingStatusWorkspace", () => {
  it("renders TensorBoard iframe and heatmap widget", async () => {
    renderWorkspace();

    const iframe = await screen.findByTitle("TensorBoard dashboard");
    expect(iframe.getAttribute("src")).toBe("https://tensorboard.example/");

    const charts = await screen.findAllByTestId("echarts-mock");
    const seriesTypes = charts.map((node) => node.getAttribute("data-series-type"));
    expect(seriesTypes).toContain("heatmap");
    expect(seriesTypes).toContain("line");
  });

  it("persists feature toggle state via the training store", async () => {
    const { rerender, queryClient } = renderWorkspace();

    const initialToggles = await screen.findAllByRole("checkbox", { name: /seal type grup/i });
    const sealToggle = initialToggles.at(-1) as HTMLInputElement;
    expect(sealToggle.checked).toBe(false);

    fireEvent.click(sealToggle);

    await waitFor(() => expect(patchTrainingFeaturesMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fetchTrainingFeatureWeightsMock).toHaveBeenCalledTimes(2));

    const togglesAfterUpdate = await screen.findAllByRole("checkbox", { name: /seal type grup/i });
    const updatedToggle = togglesAfterUpdate.at(-1) as HTMLInputElement;
    expect(updatedToggle.checked).toBe(true);

    rerender(
      <QueryClientProvider client={queryClient}>
        <TrainingStatusWorkspace />
      </QueryClientProvider>,
    );

    const togglesAfterRerender = await screen.findAllByRole("checkbox", { name: /seal type grup/i });
    const persistedToggle = togglesAfterRerender.at(-1) as HTMLInputElement;
    expect(persistedToggle.checked).toBe(true);
  });
});
