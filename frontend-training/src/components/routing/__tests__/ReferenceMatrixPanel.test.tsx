import type { OperationStep } from "@app-types/routing";
import { ReferenceMatrixPanel } from "@components/routing/ReferenceMatrixPanel";
import {
  DEFAULT_REFERENCE_MATRIX_COLUMNS,
  type ReferenceMatrixColumnKey,
  useRoutingStore,
} from "@store/routingStore";
import { useWorkspaceStore } from "@store/workspaceStore";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

const SAMPLE_OPERATIONS: OperationStep[] = [
  {
    PROC_SEQ: 1,
    PROC_CD: "OP-100",
    PROC_DESC: "Cutting",
    SETUP_TIME: 10,
    RUN_TIME: 40,
    WAIT_TIME: 5,
  },
  {
    PROC_SEQ: 2,
    PROC_CD: "OP-200",
    PROC_DESC: "Grinding",
    SETUP_TIME: 8,
    RUN_TIME: 55,
    WAIT_TIME: 4,
  },
];

const resetStores = () => {
  useRoutingStore.setState({
    activeProductId: "ITEM-001",
    recommendations: [
      {
        itemCode: "ITEM-001",
        candidateId: null,
        operations: SAMPLE_OPERATIONS,
      },
    ],
    referenceMatrixColumns: [...DEFAULT_REFERENCE_MATRIX_COLUMNS],
  });

  useWorkspaceStore.setState({
    referenceMatrixColumns: [...DEFAULT_REFERENCE_MATRIX_COLUMNS],
  });

  useRoutingStore
    .getState()
    .hydrateReferenceMatrixColumns(useWorkspaceStore.getState().referenceMatrixColumns);
};

const getWorkspaceColumns = () => useWorkspaceStore.getState().referenceMatrixColumns;

const updateMultiSelect = (
  element: HTMLSelectElement,
  values: ReferenceMatrixColumnKey[],
) => {
  Array.from(element.options).forEach((option) => {
    option.selected = values.includes(option.value as ReferenceMatrixColumnKey);
  });
  fireEvent.change(element);
};

beforeEach(() => {
  resetStores();
});

describe("ReferenceMatrixPanel", () => {
  it("allows selecting columns via multi-select and syncs with workspace store", async () => {
    render(<ReferenceMatrixPanel />);

    const select = screen.getByTestId("reference-matrix-column-select") as HTMLSelectElement;
    const withoutDescription = DEFAULT_REFERENCE_MATRIX_COLUMNS.filter((column) => column !== "desc");

    updateMultiSelect(select, withoutDescription);

    expect(screen.queryByRole("columnheader", { name: "설명" })).toBeNull();
    expect(getWorkspaceColumns()).not.toContain("desc");
    expect(useRoutingStore.getState().referenceMatrixColumns).toEqual(withoutDescription);

    updateMultiSelect(select, [...DEFAULT_REFERENCE_MATRIX_COLUMNS]);

    await waitFor(() => {
      expect(screen.queryByRole("columnheader", { name: "설명" })).not.toBeNull();
    });
    expect(getWorkspaceColumns()).toContain("desc");
    expect(useRoutingStore.getState().referenceMatrixColumns).toEqual([
      ...withoutDescription,
      "desc",
    ]);
  });

  it("supports reordering columns via drag and persists order", () => {
    render(<ReferenceMatrixPanel />);

    const [seqHeader] = screen.getAllByTestId("reference-matrix-column-seq");
    const [codeHeader] = screen.getAllByTestId("reference-matrix-column-code");

    const dataTransferData = new Map<string, string>();
    const dataTransfer = {
      data: dataTransferData,
      setData(key: string, value: string) {
        dataTransferData.set(key, value);
      },
      getData(key: string) {
        return dataTransferData.get(key) ?? "";
      },
      clearData() {
        dataTransferData.clear();
      },
      dropEffect: "move",
      effectAllowed: "move",
      files: [],
      items: [],
      types: [],
    } as unknown as DataTransfer;

    fireEvent.dragStart(seqHeader, { dataTransfer });
    fireEvent.dragEnter(codeHeader, { dataTransfer });
    fireEvent.dragOver(codeHeader, { dataTransfer });
    fireEvent.drop(codeHeader, { dataTransfer });
    fireEvent.dragEnd(seqHeader, { dataTransfer });

    const headers = screen.getAllByRole("columnheader");
    expect(headers[0].textContent).toContain("공정 코드");
    expect(headers[1].textContent).toContain("No");

    const workspaceColumns = getWorkspaceColumns();
    expect(workspaceColumns[0]).toBe<ReferenceMatrixColumnKey>("code");
    expect(workspaceColumns[1]).toBe<ReferenceMatrixColumnKey>("seq");
  });
});
