import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AlgorithmWorkspace } from "@components/workspaces/AlgorithmWorkspace";
import {
  fetchWorkflowConfig,
  patchWorkflowConfig,
  postUiAudit,
  type WorkflowConfigResponse,
} from "@lib/apiClient";

vi.mock("reactflow", () => {
  const React = require("react");
  const MockReactFlow = ({
    nodes = [],
    onInit,
    onNodeClick,
    children,
  }: {
    nodes?: unknown[];
    onInit?: (instance: unknown) => void;
    onNodeClick?: (event: unknown, node: unknown) => void;
    children?: ReactNode;
  }) => {
    React.useEffect(() => {
      if (onInit) {
        onInit({} as unknown);
      }
    }, [onInit]);

    const hasSelectedRef = React.useRef(false);
    React.useEffect(() => {
      if (!hasSelectedRef.current && nodes.length > 0 && onNodeClick) {
        hasSelectedRef.current = true;
        onNodeClick({}, nodes[0]);
      }
    }, [nodes, onNodeClick]);

    return <div data-testid="reactflow-mock">{children}</div>;
  };

  return {
    __esModule: true,
    default: MockReactFlow,
    ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    MiniMap: () => null,
    Controls: () => null,
    Background: () => null,
    Position: { Right: "right", Left: "left" },
  };
});

vi.mock("@lib/apiClient", () => ({
  fetchWorkflowConfig: vi.fn(),
  patchWorkflowConfig: vi.fn(),
  postUiAudit: vi.fn(),
}));

const workflowHistoryMock = {
  pushSnapshot: vi.fn(),
  undo: vi.fn().mockReturnValue(null),
  redo: vi.fn().mockReturnValue(null),
  canUndo: false,
  canRedo: false,
  reset: vi.fn(),
};

vi.mock("@store/workflowGraphStore", () => ({
  useWorkflowGraphHistory: (selector?: (state: typeof workflowHistoryMock) => unknown) =>
    (selector ? selector(workflowHistoryMock) : workflowHistoryMock),
}));

const mockedFetchWorkflowConfig = vi.mocked(fetchWorkflowConfig);
const mockedPatchWorkflowConfig = vi.mocked(patchWorkflowConfig);
const mockedPostUiAudit = vi.mocked(postUiAudit);

const createWorkflowResponse = (): WorkflowConfigResponse & { correlation_id?: string } => ({
  graph: {
    nodes: [
      {
        id: "trainer",
        label: "Trainer",
        type: "module",
        category: "trainer",
        status: "active",
        position: { x: 0, y: 0 },
        settings: {},
        metrics: {},
        doc_refs: [],
      },
    ],
    edges: [
      {
        id: "edge-1",
        source: "trainer",
        target: "predictor",
        kind: "data-flow",
      },
    ],
    design_refs: [],
    last_saved: "2024-01-01T00:00:00Z",
  },
  trainer: {
    similarity_threshold: 0.8,
    trim_std_enabled: true,
    trim_lower_percent: 0.05,
    trim_upper_percent: 0.95,
  },
  predictor: {
    similarity_high_threshold: 0.7,
    max_routing_variants: 3,
    trim_std_enabled: false,
    trim_lower_percent: 0.1,
    trim_upper_percent: 0.9,
  },
  sql: {
    output_columns: [],
    column_aliases: {},
    available_columns: [],
    profiles: [{ name: "default", description: null, mapping: {} }],
    active_profile: "default",
    exclusive_column_groups: [],
    key_columns: [],
    training_output_mapping: {},
  },
  data_source: {
    offline_dataset_path: "",
    default_table: "",
    backup_paths: [],
    table_profiles: [],
    column_overrides: {},
    allow_gui_override: true,
    shading_palette: {},
    blueprint_switches: [],
    version_hint: null,
  },
  export: {
    enable_cache_save: false,
    enable_excel: true,
    enable_csv: true,
    enable_txt: false,
    enable_parquet: false,
    enable_json: true,
    erp_interface_enabled: false,
    erp_protocol: null,
    erp_endpoint: null,
    default_encoding: "utf-8",
    export_directory: "/tmp",
    compress_on_save: false,
  },
  visualization: {
    tensorboard_projector_dir: "",
    projector_enabled: false,
    projector_metadata_columns: [],
    neo4j_enabled: false,
    neo4j_browser_url: null,
    neo4j_workspace: null,
    publish_service_enabled: false,
    publish_notes: null,
  },
  updated_at: "2024-01-01T00:00:00Z",
  correlation_id: "test-correlation-id",
});

describe("AlgorithmWorkspace audit logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workflowHistoryMock.pushSnapshot.mockClear();
    workflowHistoryMock.undo.mockClear();
    workflowHistoryMock.redo.mockClear();
    workflowHistoryMock.reset.mockClear();
    const workflowResponse = createWorkflowResponse();
    mockedFetchWorkflowConfig.mockResolvedValue(workflowResponse);
    mockedPatchWorkflowConfig.mockImplementation(async (payload) => {
      const base = createWorkflowResponse();
      const nextGraph = {
        nodes: payload.graph?.nodes ?? base.graph.nodes,
        edges: payload.graph?.edges ?? base.graph.edges,
        design_refs: base.graph.design_refs,
        last_saved: base.graph.last_saved,
      };
      return { ...base, graph: nextGraph };
    });
    mockedPostUiAudit.mockResolvedValue(undefined);
  });

  it("emits a read audit with node statistics when the workflow loads", async () => {
    render(<AlgorithmWorkspace />);

    await waitFor(() => {
      const readCall = mockedPostUiAudit.mock.calls.find(([event]) => event.action === "ui.algorithm.read");
      expect(readCall).toBeDefined();
      expect(readCall?.[0]?.payload).toMatchObject({
        node_count: 1,
        edge_count: 1,
        correlation_id: "test-correlation-id",
      });
    });
  });

  it("logs success audits when the graph layout is saved", async () => {
    render(<AlgorithmWorkspace />);

    const [layoutSaveButton] = await screen.findAllByRole("button", { name: /레이아웃 save/i });
    fireEvent.click(layoutSaveButton);

    await waitFor(() => {
      expect(mockedPatchWorkflowConfig).toHaveBeenCalled();
    });

    await waitFor(() => {
      const graphCall = mockedPostUiAudit.mock.calls.find(([event]) => event.action === "ui.algorithm.graph.save");
      expect(graphCall).toBeDefined();
      expect(graphCall?.[0]?.payload).toMatchObject({
        node_count: 1,
        edge_count: 1,
        correlation_id: "test-correlation-id",
      });
      const persistCall = mockedPostUiAudit.mock.calls.find(([event]) => event.action === "ui.algorithm.save");
      expect(persistCall).toBeDefined();
      expect(persistCall?.[0]?.payload).toMatchObject({
        node_count: 1,
        edge_count: 1,
      });
    });
  });

  it("logs failure audits when node settings fail to persist", async () => {
    mockedPatchWorkflowConfig.mockRejectedValueOnce(new Error("persist failed"));

    render(<AlgorithmWorkspace />);

    const [dialogTrigger] = await screen.findAllByRole("button", { name: "설정 다이얼로그" });
    fireEvent.click(dialogTrigger);

    const dialogHeading = await screen.findByRole("heading", { name: /trainer 설정/i });
    const dialogContainer = dialogHeading.closest("div")?.parentElement?.parentElement;
    if (!dialogContainer) {
      throw new Error("Dialog container not found");
    }

    const saveButton = within(dialogContainer as HTMLElement).getByRole("button", { name: /^save$/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      const nodeErrorCall = mockedPostUiAudit.mock.calls.find(
        ([event]) => event.action === "ui.algorithm.node.save.error",
      );
      expect(nodeErrorCall).toBeDefined();
      expect(nodeErrorCall?.[0]?.payload).toMatchObject({
        node_id: "trainer",
        node_label: "Trainer",
      });
      const persistErrorCall = mockedPostUiAudit.mock.calls.find(
        ([event]) => event.action === "ui.algorithm.save.error",
      );
      expect(persistErrorCall).toBeDefined();
    });
  });
});
