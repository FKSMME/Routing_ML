import type { MasterDataItemResponse, MasterDataMatrixRow } from "@app-types/masterData";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useMemo } from "react";

type MasterDataMatrixColumnConfig = MasterDataItemResponse["columns"][number] & {
  align?: "left" | "center" | "right";
  format?: (params: {
    value: string | undefined;
    row: MasterDataMatrixRow;
    column: MasterDataMatrixColumnConfig;
  }) => ReactNode;
};

interface MasterDataMatrixProps {
  columns: MasterDataMatrixColumnConfig[];
  rows: MasterDataMatrixRow[];
  emptyState?: ReactNode;
}

interface MasterDataMatrixPanelProps extends MasterDataMatrixProps {
  onCopy?: (rows: MasterDataMatrixRow[]) => void;
  filterText?: string;
  rowFilter?: (row: MasterDataMatrixRow) => boolean;
  title?: string;
  subtitle?: string;
  className?: string;
}

function normalizeFilter(filterText?: string) {
  const trimmed = filterText?.trim();
  return trimmed ? trimmed.toLowerCase() : "";
}

function getFilteredRows(
  rows: MasterDataMatrixRow[],
  columns: MasterDataMatrixColumnConfig[],
  filterText?: string,
  rowFilter?: (row: MasterDataMatrixRow) => boolean,
): MasterDataMatrixRow[] {
  const normalizedFilter = normalizeFilter(filterText);
  return rows.filter((row) => {
    if (rowFilter && !rowFilter(row)) {
      return false;
    }
    if (!normalizedFilter) {
      return true;
    }
    return columns.some((column) => {
      const value = row.values[column.key];
      return typeof value === "string" && value.toLowerCase().includes(normalizedFilter);
    });
  });
}

function renderCellContent(
  column: MasterDataMatrixColumnConfig,
  row: MasterDataMatrixRow,
): ReactNode {
  const rawValue = row.values[column.key];
  if (column.format) {
    return column.format({
      value: rawValue,
      row,
      column,
    });
  }
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return "-";
  }
  return rawValue;
}

export function MasterDataMatrix({ columns, rows, emptyState }: MasterDataMatrixProps) {
  const hasRows = rows.length > 0;

  return (
    <table className="master-matrix-table">
      <colgroup>
        {columns.map((column) => (
          <col key={column.key} style={column.width ? { width: column.width } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column) => {
            const headerStyle: CSSProperties = { position: "sticky", top: 0 };
            if (column.width) {
              headerStyle.width = column.width;
            }
            return (
              <th
                key={column.key}
                className="master-matrix-header-cell"
                data-column={column.key}
                data-align={column.align ?? "left"}
                data-sticky="true"
                scope="col"
                style={headerStyle}
              >
                <span>{column.label}</span>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {hasRows ? (
          rows.map((row) => (
            <tr key={row.key} className="hover-row" data-row={row.key}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-column={column.key}
                  data-align={column.align ?? "left"}
                  style={column.align ? { textAlign: column.align } : undefined}
                >
                  {renderCellContent(column, row)}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={columns.length} className="text-muted text-center py-6">
              {emptyState ?? "No matrix data available. Select an item from the hierarchy."}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function MasterDataMatrixPanel({
  columns,
  rows,
  onCopy,
  filterText,
  rowFilter,
  title = "MSSQL matrix",
  subtitle = "Selected item master data from MSSQL",
  emptyState,
  className,
}: MasterDataMatrixPanelProps) {
  const filteredRows = useMemo(
    () => getFilteredRows(rows, columns, filterText, rowFilter),
    [rows, columns, filterText, rowFilter],
  );

  const totalCount = rows.length;
  const filteredCount = filteredRows.length;
  const isFiltered = normalizeFilter(filterText) !== "" || Boolean(rowFilter);

  const handleCopy = useCallback(() => {
    const rowsToCopy = filteredRows;
    if (rowsToCopy.length === 0) {
      onCopy?.([]);
      return;
    }
    const serialized = JSON.stringify(rowsToCopy, null, 2);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(serialized)
        .then(() => {
          onCopy?.(rowsToCopy);
        })
        .catch(() => {
          onCopy?.(rowsToCopy);
        });
    } else {
      onCopy?.(rowsToCopy);
    }
  }, [filteredRows, onCopy]);

  return (
    <section className={["panel-card", "interactive-card", "master-matrix", className].filter(Boolean).join(" ")}>
      <header className="panel-header">
        <div>
          <h2 className="panel-title">{title}</h2>
          <p className="panel-subtitle">{subtitle}</p>
          {isFiltered ? (
            <p className="panel-meta" aria-live="polite">
              Showing {filteredCount.toLocaleString()} of {totalCount.toLocaleString()} rows
            </p>
          ) : null}
        </div>
        <button type="button" className="btn-secondary" onClick={handleCopy} aria-label="Copy matrix rows">
          Copy rows
        </button>
      </header>
      <div className="master-matrix-scroll">
        <MasterDataMatrix columns={columns} rows={filteredRows} emptyState={emptyState} />
      </div>
    </section>
  );
}

export type { MasterDataMatrixColumnConfig };
