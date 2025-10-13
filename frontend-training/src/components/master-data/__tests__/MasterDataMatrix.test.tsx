import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MasterDataMatrixRow } from "@app-types/masterData";

import {
  MasterDataMatrix,
  MasterDataMatrixPanel,
  type MasterDataMatrixColumnConfig,
} from "../MasterDataMatrix";

afterEach(() => {
  cleanup();
});

describe("MasterDataMatrixPanel", () => {
  const baseColumns: MasterDataMatrixColumnConfig[] = [
    { key: "item", label: "Item" },
    { key: "material", label: "Material" },
    { key: "updated", label: "Updated" },
  ];

  const baseRows: MasterDataMatrixRow[] = [
    {
      key: "row-1",
      values: {
        item: "ITEM-001",
        material: "A105",
        updated: "2024-01-01",
      },
    },
    {
      key: "row-2",
      values: {
        item: "ITEM-002",
        material: "SS400",
        updated: "2024-02-01",
      },
    },
  ];

  it("applies column formatter output for each cell", () => {
    const formatter = vi.fn(({ value }: { value: string | undefined }) =>
      value ? value.toUpperCase() : "-",
    );

    const columns: MasterDataMatrixColumnConfig[] = [
      baseColumns[0],
      {
        ...baseColumns[1],
        format: formatter,
      },
      baseColumns[2],
    ];

    render(<MasterDataMatrix columns={columns} rows={baseRows} />);

    expect(formatter).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "A105",
      }),
    );

    expect(screen.queryByText("A105")).not.toBeNull();
    expect(screen.queryByText("SS400")).not.toBeNull();
  });

  it("filters rows using the provided text across all columns", () => {
    render(
      <MasterDataMatrixPanel columns={baseColumns} rows={baseRows} filterText="SS400" />, // only second row matches
    );

    expect(screen.queryByText("ITEM-002")).not.toBeNull();
    expect(screen.queryByText("ITEM-001")).toBeNull();
    expect(screen.queryByText(/showing 1 of 2 rows/i)).not.toBeNull();
  });

  it("marks MSSQL headers as sticky", () => {
    render(<MasterDataMatrix columns={baseColumns} rows={baseRows} />);

    const headerCell = screen.getByRole("columnheader", { name: "Item" });
    expect(headerCell.getAttribute("data-sticky")).toBe("true");
    expect((headerCell as HTMLElement).style.position).toBe("sticky");
  });
});
