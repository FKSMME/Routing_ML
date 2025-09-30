import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, beforeEach, vi, it } from "vitest";

import { DataOutputWorkspace } from "../DataOutputWorkspace";
import { useWorkspaceStore } from "@store/workspaceStore";

const mockProfiles = [
  { id: "profile-1", name: "Primary", description: "Primary profile", format: "CSV" },
];

const mockMappings = [
  { source: "ITEM_CD", mapped: "Item", type: "string", required: true },
  { source: "PROC_CD", mapped: "Process", type: "number", required: false },
];

type MockedApi = {
  generateOutputPreview: ReturnType<typeof vi.fn>;
  saveWorkspaceSettings: ReturnType<typeof vi.fn>;
  postUiAudit: ReturnType<typeof vi.fn>;
};

vi.mock("@hooks/useOutputProfiles", () => ({
  useOutputProfiles: () => ({
    data: mockProfiles,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refresh: vi.fn(),
  }),
  useOutputProfile: () => ({
    data: {
      ...mockProfiles[0],
      mappings: mockMappings,
      sample: [
        { Item: "ITEM-001", Process: "PROC-01" },
      ],
    },
    isLoading: false,
    isFetching: false,
    isRefetching: false,
    isError: false,
    error: null,
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@hooks/useWorkflowConfig", () => ({
  useWorkflowConfig: () => ({
    data: {
      sql: {
        active_profile: "profile-1",
        output_columns: [],
        available_columns: ["ITEM_CD", "PROC_CD", "ROUTE_CD"],
      },
    },
    isLoading: false,
    isFetching: false,
    error: null,
    refresh: vi.fn(),
    saveConfig: vi.fn().mockResolvedValue({}),
    saving: false,
  }),
}));

vi.mock("@lib/apiClient", () => {
  const apiMocks: MockedApi = {
    generateOutputPreview: vi.fn().mockResolvedValue({
      columns: ["Item", "Process"],
      rows: [
        { Item: "ITEM-001", Process: "PROC-01" },
        { Item: "ITEM-002", Process: "PROC-02" },
      ],
    }),
    saveWorkspaceSettings: vi.fn().mockResolvedValue({}),
    postUiAudit: vi.fn().mockResolvedValue(undefined),
  };

  return {
    generateOutputPreview: apiMocks.generateOutputPreview,
    saveWorkspaceSettings: apiMocks.saveWorkspaceSettings,
    postUiAudit: apiMocks.postUiAudit,
  };
});

describe("DataOutputWorkspace mappings", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ outputMappings: [] });
    vi.clearAllMocks();
  });

  it("loads profile mappings into the workspace store", async () => {
    render(<DataOutputWorkspace />);

    await waitFor(() => {
      const rows = useWorkspaceStore.getState().outputMappings;
      expect(rows).toHaveLength(2);
    });

    const rows = useWorkspaceStore.getState().outputMappings;
    expect(rows[0]?.source).toBe("ITEM_CD");
    expect(rows[1]?.mapped).toBe("Process");
  });

  it("reorders mappings via drag-and-drop and serializes through saveRouting", async () => {
    render(<DataOutputWorkspace />);

    await waitFor(() => expect(screen.getAllByTestId("mapping-row")).toHaveLength(2));

    const [firstRow, secondRow] = screen.getAllByTestId("mapping-row");
    fireEvent.dragStart(firstRow);
    fireEvent.dragOver(secondRow);
    fireEvent.drop(secondRow);

    const ordered = useWorkspaceStore.getState().outputMappings;
    expect(ordered[0]?.source).toBe("PROC_CD");
    expect(ordered[1]?.source).toBe("ITEM_CD");

    const serialized = useWorkspaceStore.getState().saveRouting();
    expect(serialized.columnMappings.map((row) => row.source)).toEqual(["PROC_CD", "ITEM_CD"]);
    expect(serialized.columnMappings.every((row) => typeof row.mapped === "string")).toBe(true);
  });

  it("trims mapped aliases when serializing routing save payload", async () => {
    render(<DataOutputWorkspace />);

    await waitFor(() => expect(screen.getAllByPlaceholderText("Alias or export name")).toHaveLength(2));

    const aliasInputs = screen.getAllByPlaceholderText("Alias or export name");
    fireEvent.change(aliasInputs[0], { target: { value: "   Item Alias   " } });

    const serialized = useWorkspaceStore.getState().saveRouting();
    expect(serialized.columnMappings[0]?.mapped).toBe("Item Alias");
  });
});
