import type { MasterDataItemResponse } from "@app-types/masterData";

interface MasterDataMatrixProps {
  columns: MasterDataItemResponse["columns"];
  rows: MasterDataItemResponse["rows"];
  onCopy?: (rows: MasterDataItemResponse["rows"]) => void;
}

export function MasterDataMatrix({ columns, rows, onCopy }: MasterDataMatrixProps) {
  const handleCopy = () => {
    navigator.clipboard
      .writeText(JSON.stringify(rows, null, 2))
      .then(() => {
        if (onCopy) {
          onCopy(rows);
        }
      })
      .catch(() => {
        if (onCopy) {
          onCopy(rows);
        }
      });
  };

  return (
    <section className="panel-card interactive-card master-matrix">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">Access matrix</h2>
          <p className="panel-subtitle">Selected item master data from Access</p>
        </div>
        <button type="button" className="btn-secondary" onClick={handleCopy}>
          Copy rows
        </button>
      </header>
      <div className="master-matrix-scroll">
        <table className="master-matrix-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} style={column.width ? { width: column.width } : undefined}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-muted text-center py-6">
                  No matrix data available. Select an item from the hierarchy.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="hover-row">
                  {columns.map((column) => (
                    <td key={column.key}>{row.values[column.key] ?? "-"}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
