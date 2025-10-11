import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OptionsWorkspace } from "../OptionsWorkspace";
import { useWorkspaceStore } from "@store/workspaceStore";
import { useRoutingStore } from "@store/routingStore";
import {
  fetchWorkspaceSettings,
  saveWorkspaceSettings,
  type WorkspaceSettingsResponse,
} from "@lib/apiClient";

vi.mock("@lib/apiClient", () => {
  const defaultResponse: WorkspaceSettingsResponse = {
    version: 1,
    options: {
      standard: ["zscore"],
      similarity: ["cosine", "profile"],
      access_path: "\\\\Server\\Routing\\ROUTING.accdb",
      access_table: "dbo_ROUTING",
      erp_interface: false,
      column_mappings: [
        {
          scope: "Routing Generation",
          source: "ITEM_CD",
          target: "items.item_code",
        },
      ],
    },
    access: { path: "\\\\Server\\Routing\\ROUTING.accdb", table: "dbo_ROUTING" },
    metadata: null,
  };

  return {
    fetchWorkspaceSettings: vi.fn().mockResolvedValue(defaultResponse),
    fetchWorkflowConfig: vi.fn().mockResolvedValue({ graph: { nodes: [] } }),
    fetchAccessMetadata: vi.fn(),
    postUiAudit: vi.fn().mockResolvedValue(undefined),
    saveWorkspaceSettings: vi.fn().mockResolvedValue(defaultResponse),
    testAccessConnection: vi.fn(),
  };
});

const mockedFetchWorkspaceSettings = vi.mocked(fetchWorkspaceSettings);
const mockedSaveWorkspaceSettings = vi.mocked(saveWorkspaceSettings);

const resetStores = () => {
  useWorkspaceStore.setState((state) => ({
    ...state,
    workspaceOptions: {
      data: {
        standard: ["zscore"],
        similarity: ["cosine", "profile"],
        accessPath: "",
        accessTable: "",
        columnMappings: [
          {
            id: "test-row",
            scope: "Routing Generation",
            source: "ITEM_CD",
            target: "items.item_code",
          },
        ],
        erpInterface: false,
      },
      loading: false,
      saving: false,
      dirty: false,
      lastSyncedAt: undefined,
    },
  }));
  useRoutingStore.setState({ erpRequired: false });
};

describe("OptionsWorkspace validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("shows a warning when no normalization option is selected", async () => {
    render(<OptionsWorkspace />);

    const zscore = await screen.findByLabelText(/Z-Score/i);
    fireEvent.click(zscore);

    await screen.findByText(/Select at least one normalization option/i);
  });

  it("shows a warning when all similarity algorithms are disabled", async () => {
    render(<OptionsWorkspace />);

    const [cosine] = await screen.findAllByLabelText(/Cosine/i);
    const [profile] = await screen.findAllByLabelText(/Weighted Profile/i);

    fireEvent.click(cosine);
    fireEvent.click(profile);

    const warnings = await screen.findAllByText(/Choose at least one similarity algorithm/i);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("summarizes column mapping validation errors", async () => {
    render(<OptionsWorkspace />);

    await waitFor(() => {
      expect(document.body.textContent).toContain("Column Mapping");
    });
    const mappingTable = await waitFor(() => {
      const table = document.querySelector(".mapping-table") as HTMLTableElement | null;
      if (!table) {
        throw new Error("Mapping table not ready");
      }
      return table;
    });
    const scopeInput = within(mappingTable).getAllByRole("textbox")[0] as HTMLInputElement;
    fireEvent.change(scopeInput, { target: { value: "" } });

    await waitFor(() => {
      expect(document.body.textContent).toContain("Complete all column mapping fields before saving.");
    });

    const [saveButton] = screen.getAllByRole("button", { name: /save/i });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);

    expect(mockedSaveWorkspaceSettings).not.toHaveBeenCalled();
  });

  it("does not fetch settings more than once per render", async () => {
    render(<OptionsWorkspace />);

    await waitFor(() => {
      expect(mockedFetchWorkspaceSettings).toHaveBeenCalledTimes(1);
    });
  });
});
