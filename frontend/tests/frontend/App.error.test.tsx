import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";

const refetchMock = vi.fn();
const updateItemCodesMock = vi.fn();
const updateTopKMock = vi.fn();
const updateThresholdMock = vi.fn();
const setFeatureWeightProfileMock = vi.fn();
const setManualWeightMock = vi.fn();
const resetManualWeightsMock = vi.fn();
const applyPredictionResponseMock = vi.fn();
const setLayoutMock = vi.fn();
const setActiveMenuMock = vi.fn();
const setRoutingLoadingMock = vi.fn();

const usePredictRoutingsMock = vi.fn();

vi.mock("@hooks/usePredictRoutings", () => ({
  usePredictRoutings: (...args: unknown[]) => usePredictRoutingsMock(...args),
}));

vi.mock("@hooks/useResponsiveNav", () => ({
  useResponsiveNav: () => ({
    layout: "desktop",
    isDrawerMode: false,
    isOpen: false,
    isPersistent: true,
    toggle: vi.fn(),
    close: vi.fn(),
  }),
}));

vi.mock("@store/routingStore", () => ({
  useRoutingStore: (selector?: (state: { setLoading: typeof setRoutingLoadingMock }) => unknown) =>
    selector ? selector({ setLoading: setRoutingLoadingMock }) : { setLoading: setRoutingLoadingMock },
}));

const workspaceState = {
  layout: "desktop",
  activeMenu: "routing",
  setActiveMenu: setActiveMenuMock,
  itemSearch: { itemCodes: ["ITEM-001"], topK: 5, threshold: 0.4 },
  updateItemCodes: updateItemCodesMock,
  updateTopK: updateTopKMock,
  updateThreshold: updateThresholdMock,
  featureWeights: { manualWeights: {}, profile: null, availableProfiles: [] },
  setFeatureWeightProfile: setFeatureWeightProfileMock,
  setManualWeight: setManualWeightMock,
  resetManualWeights: resetManualWeightsMock,
  exportProfile: { formats: [], destination: "local", withVisualization: false },
  applyPredictionResponse: applyPredictionResponseMock,
  setLayout: setLayoutMock,
};

vi.mock("@store/workspaceStore", () => ({
  useWorkspaceStore: (selector?: (state: typeof workspaceState) => unknown) =>
    selector ? selector(workspaceState) : workspaceState,
}));

function createStubComponent(testId: string) {
  return ({ children }: { children?: ReactNode } & Record<string, unknown>) => (
    <div data-testid={testId}>{children ?? null}</div>
  );
}

vi.mock("@components/CandidatePanel", () => ({ CandidatePanel: createStubComponent("candidate-panel") }));
vi.mock("@components/FeatureWeightPanel", () => ({ FeatureWeightPanel: createStubComponent("feature-weight-panel") }));
vi.mock("@components/Header", () => ({ Header: ({ title }: { title: string } & Record<string, unknown>) => <header>{title}</header> }));
vi.mock("@components/HeroBanner", () => ({ HeroBanner: createStubComponent("hero-banner") }));
vi.mock("@components/MainNavigation", () => ({ MainNavigation: createStubComponent("main-navigation") }));
vi.mock("@components/ResponsiveNavigationDrawer", () => ({ ResponsiveNavigationDrawer: createStubComponent("nav-drawer") }));
vi.mock("@components/master-data/MasterDataWorkspace", () => ({ MasterDataWorkspace: createStubComponent("master-data-workspace") }));
vi.mock("@components/MetricsPanel", () => ({ MetricsPanel: createStubComponent("metrics-panel") }));
vi.mock("@components/routing/ReferenceMatrixPanel", () => ({ ReferenceMatrixPanel: createStubComponent("reference-matrix") }));
vi.mock("@components/routing/RoutingProductTabs", () => ({
  RoutingProductTabs: ({ emptyState }: { emptyState?: ReactNode; renderWorkspace?: (tab: unknown) => ReactNode }) => (
    <div data-testid="routing-product-tabs">{emptyState ?? null}</div>
  ),
}));
vi.mock("@components/routing/RoutingWorkspaceLayout", () => ({
  RoutingWorkspaceLayout: ({ left, center, right }: { left: ReactNode; center: ReactNode; right: ReactNode }) => (
    <div data-testid="routing-workspace-layout">
      <div data-testid="layout-left">{left}</div>
      <div data-testid="layout-center">{center}</div>
      <div data-testid="layout-right">{right}</div>
    </div>
  ),
}));
vi.mock("@components/RoutingGroupControls", () => ({ RoutingGroupControls: createStubComponent("routing-group-controls") }));
vi.mock("@components/SaveInterfacePanel", () => ({ SaveInterfacePanel: createStubComponent("save-interface-panel") }));
vi.mock("@components/TimelinePanel", () => ({ TimelinePanel: createStubComponent("timeline-panel") }));
vi.mock("@components/VisualizationSummary", () => ({ VisualizationSummary: createStubComponent("visualization-summary") }));
vi.mock("@components/WorkflowGraphPanel", () => ({ WorkflowGraphPanel: createStubComponent("workflow-graph") }));
vi.mock("@components/workspaces/AlgorithmWorkspace", () => ({ AlgorithmWorkspace: createStubComponent("algorithm-workspace") }));
vi.mock("@components/workspaces/DataOutputWorkspace", () => ({ DataOutputWorkspace: createStubComponent("data-output-workspace") }));
vi.mock("@components/workspaces/OptionsWorkspace", () => ({ OptionsWorkspace: createStubComponent("options-workspace") }));
vi.mock("@components/workspaces/ProcessGroupsWorkspace", () => ({ ProcessGroupsWorkspace: createStubComponent("process-groups-workspace") }));
vi.mock("@components/workspaces/RoutingMatrixWorkspace", () => ({ RoutingMatrixWorkspace: createStubComponent("routing-matrix-workspace") }));
vi.mock("@components/workspaces/TrainingStatusWorkspace", () => ({ TrainingStatusWorkspace: createStubComponent("training-status-workspace") }));

const renderWithClient = () => {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
};

describe("App prediction error handling", () => {
  beforeEach(() => {
    refetchMock.mockReset();
    updateItemCodesMock.mockReset();
    updateTopKMock.mockReset();
    updateThresholdMock.mockReset();
    setFeatureWeightProfileMock.mockReset();
    setManualWeightMock.mockReset();
    resetManualWeightsMock.mockReset();
    applyPredictionResponseMock.mockReset();
    setLayoutMock.mockReset();
    setActiveMenuMock.mockReset();
    setRoutingLoadingMock.mockReset();
    usePredictRoutingsMock.mockReset();
    usePredictRoutingsMock.mockReturnValue({
      data: undefined,
      error: new Error("Request timed out"),
      isLoading: false,
      isFetching: false,
      refetch: refetchMock,
    });
  });

  it("displays prediction errors and allows retrying the request", async () => {
    renderWithClient();

    const banners = await screen.findAllByText(/Server response delayed/i);
    expect(banners.length).toBeGreaterThan(0);

    const errorMessages = screen.getAllByText(/Request timed out/i);
    const panelError = errorMessages.find((element) => element.classList.contains("prediction-panel__error"));
    expect(panelError).toBeDefined();

    const submitButtons = screen.getAllByRole("button", { name: "추천 실행" });
    submitButtons.forEach((button) => expect(button).toBeEnabled());
    const submitButton = submitButtons[0];

    const user = userEvent.setup();
    await user.click(submitButton);

    expect(updateItemCodesMock).toHaveBeenCalledWith(["ITEM-001"]);
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});
