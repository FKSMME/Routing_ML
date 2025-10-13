import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { WorkflowConfigPatch, WorkflowConfigResponse } from "@app-types/workflow";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSaveConfig = vi.fn<[WorkflowConfigPatch], Promise<WorkflowConfigResponse>>();

const mockWorkflowConfig: WorkflowConfigResponse = {
  graph: {
    nodes: [
      {
        id: "trainer",
        label: "Trainer Runtime",
        type: "module",
        category: "Runtime",
        status: "active",
        position: { x: 64, y: 24 },
        settings: { description: "Primary trainer" },
        metrics: { accuracy: 0.92, loss: 0.08 },
        doc_refs: ["blueprint://trainer.md", "blueprint://training.rules"],
      },
      {
        id: "predictor",
        label: "Predictor",
        type: "module",
        category: "Runtime",
        status: "ready",
        position: { x: 320, y: 120 },
        settings: { description: "Predicts routes" },
        metrics: {},
        doc_refs: [],
      },
    ],
    edges: [
      { id: "edge-train", source: "trainer", target: "predictor", kind: "model-flow", label: "model" },
    ],
    design_refs: ["blueprint://workflow.v1"],
    last_saved: "2024-03-14T04:12:00.000Z",
  },
  trainer: {
    similarity_threshold: 0.85,
    trim_std_enabled: true,
    trim_lower_percent: 0.05,
    trim_upper_percent: 0.95,
  },
  predictor: {
    similarity_high_threshold: 0.9,
    max_routing_variants: 4,
    trim_std_enabled: true,
    trim_lower_percent: 0.05,
    trim_upper_percent: 0.95,
  },
  sql: {
    output_columns: ["ITEM_CD", "CANDIDATE_ID"],
    column_aliases: { ITEM_ALIAS: "ITEM_CD" },
    available_columns: ["ITEM_CD", "CANDIDATE_ID", "ROUTING_SIGNATURE"],
    profiles: [{ name: "default", description: "Default mapping", mapping: {} }],
    active_profile: "default",
    exclusive_column_groups: [["ITEM_CD", "ROUTING_SIGNATURE"]],
    key_columns: ["ITEM_CD"],
    training_output_mapping: { feature_a: "ITEM_CD" },
  },
  data_source: {
    offline_dataset_path: "db://primary",
    default_table: "items",
    backup_paths: [],
    table_profiles: [],
    column_overrides: {},
    allow_gui_override: true,
    shading_palette: {},
    blueprint_switches: [],
    version_hint: null,
  },
  export: {
    enable_cache_save: true,
    enable_excel: true,
    enable_csv: true,
    enable_txt: false,
    enable_parquet: false,
    enable_json: true,
    enable_database_export: true,
    database_target_table: "dbo.ROUTING_MASTER",
    erp_interface_enabled: false,
    default_encoding: "utf-8",
    export_directory: "/tmp",
    compress_on_save: false,
  },
  visualization: {
    tensorboard_projector_dir: "/tmp/tensorboard",
    projector_enabled: false,
    projector_metadata_columns: [],
    neo4j_enabled: false,
    publish_service_enabled: false,
  },
  updated_at: "2024-03-14T04:12:00.000Z",
};

vi.mock("reactflow", () => {
  const ReactFlow = ({
    nodes = [],
    nodeTypes = {},
    onNodeDoubleClick,
    children,
    className,
  }: {
    nodes?: any[];
    nodeTypes?: Record<string, React.ComponentType<any>>;
    onNodeDoubleClick?: (event: React.MouseEvent, node: any) => void;
    children?: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="mock-reactflow" className={className}>
      {nodes.map((node) => {
        const NodeComponent = nodeTypes?.[node.type] ?? (() => null);
        return (
          <div
            key={node.id}
            data-testid={`rf-node-${node.id}`}
            onDoubleClick={(event) => onNodeDoubleClick?.(event, node)}
          >
            <NodeComponent
              id={node.id}
              data={node.data}
              position={node.position}
              type={node.type}
              selected={false}
              dragging={false}
              xPos={node.position?.x ?? 0}
              yPos={node.position?.y ?? 0}
            />
          </div>
        );
      })}
      {children}
    </div>
  );

  const Provider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const Stub = () => null;

  return {
    __esModule: true,
    default: ReactFlow,
    ReactFlow,
    ReactFlowProvider: Provider,
    MiniMap: Stub,
    Controls: Stub,
    Background: Stub,
    Position: { Left: "left", Right: "right" },
    Edge: {},
    Node: {},
  };
});

vi.mock("@hooks/useWorkflowConfig", () => ({
  useWorkflowConfig: () => ({
    data: mockWorkflowConfig,
    isLoading: false,
    isFetching: false,
    saveConfig: mockSaveConfig,
    saving: false,
  }),
}));

import { WorkflowGraphPanel } from "@components/WorkflowGraphPanel";

describe("WorkflowGraphPanel blueprint styling", () => {
  beforeEach(() => {
    mockSaveConfig.mockClear();
    mockSaveConfig.mockResolvedValue(mockWorkflowConfig);
  });

  it("renders blueprint rule badges overlay", async () => {
    render(<WorkflowGraphPanel />);

    const [badgeContainer] = await screen.findAllByTestId("blueprint-node-badges-Trainer Runtime");
    const badges = within(badgeContainer);

    expect(badgeContainer).toBeTruthy();
    expect(badges.getByText(/Docs/i)).toBeTruthy();
    expect(badges.getByText(/accuracy/i)).toBeTruthy();
  });

  it("opens blueprint edit modal on node double click", async () => {
    render(<WorkflowGraphPanel />);

    const [node] = await screen.findAllByTestId("rf-node-trainer");
    expect(screen.queryByTestId("workflow-node-dialog")).toBeNull();

    fireEvent.doubleClick(node);

    expect(await screen.findByTestId("workflow-node-dialog")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: /Trainer Runtime 설정/i })).toBeTruthy();
  });
});
