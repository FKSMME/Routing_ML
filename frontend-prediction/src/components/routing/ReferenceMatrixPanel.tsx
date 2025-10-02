import {
  DEFAULT_REFERENCE_MATRIX_COLUMNS,
  type ReferenceMatrixColumnKey,
  useRoutingStore,
} from "@store/routingStore";
import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

interface ReferenceMatrixRow {
  seq: number | string | null | undefined;
  code: string;
  desc: string;
  setup: number | string | null | undefined;
  run: number | string | null | undefined;
  wait: number | string | null | undefined;
}

interface ColumnDefinition {
  key: ReferenceMatrixColumnKey;
  label: string;
  align?: "right" | "left";
  render: (row: ReferenceMatrixRow) => React.ReactNode;
}

const COLUMN_DEFINITIONS: Record<ReferenceMatrixColumnKey, ColumnDefinition> = {
  seq: {
    key: "seq",
    label: "No",
    render: (row) => row.seq ?? "-",
  },
  code: {
    key: "code",
    label: "공정 코드",
    render: (row) => row.code,
  },
  desc: {
    key: "desc",
    label: "설명",
    render: (row) => row.desc ?? "-",
  },
  setup: {
    key: "setup",
    label: "세팅",
    align: "right",
    render: (row) => row.setup ?? "-",
  },
  run: {
    key: "run",
    label: "가공",
    align: "right",
    render: (row) => row.run ?? "-",
  },
  wait: {
    key: "wait",
    label: "대기",
    align: "right",
    render: (row) => row.wait ?? "-",
  },
};

const COLUMN_OPTIONS = DEFAULT_REFERENCE_MATRIX_COLUMNS.map((key) => ({
  key,
  label: COLUMN_DEFINITIONS[key].label,
}));

export function ReferenceMatrixPanel() {
  const activeProductId = useRoutingStore((state) => state.activeProductId);
  const recommendations = useRoutingStore((state) => state.recommendations);
  const selectedColumns = useRoutingStore((state) => state.referenceMatrixColumns);
  const setSelectedColumns = useRoutingStore((state) => state.setReferenceMatrixColumns);
  const reorderColumns = useRoutingStore((state) => state.reorderReferenceMatrixColumns);

  const rows = useMemo<ReferenceMatrixRow[]>(() => {
    if (!activeProductId) {
      return [];
    }
    const bucket = recommendations.find((item) => item.itemCode === activeProductId);
    if (!bucket) {
      return [];
    }
    return bucket.operations.map((operation) => ({
      seq: operation.PROC_SEQ ?? "-",
      code: operation.PROC_CD,
      desc: operation.PROC_DESC ?? "-",
      setup: operation.SETUP_TIME ?? "-",
      run: operation.RUN_TIME ?? "-",
      wait: operation.WAIT_TIME ?? "-",
    }));
  }, [activeProductId, recommendations]);

  const visibleColumns = useMemo(() => {
    return selectedColumns.map((key) => COLUMN_DEFINITIONS[key]);
  }, [selectedColumns]);

  const [dragSource, setDragSource] = useState<ReferenceMatrixColumnKey | null>(null);

  const handleColumnSelectionChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const selected = Array.from(event.target.selectedOptions).map(
        (option) => option.value as ReferenceMatrixColumnKey,
      );
      setSelectedColumns(selected);
    },
    [setSelectedColumns],
  );

  const handleDragStart = useCallback(
    (key: ReferenceMatrixColumnKey) => (event: DragEvent<HTMLTableHeaderCellElement>) => {
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setData("text/plain", key);
      } catch (error) {
        // Ignore browsers that do not support programmatic data transfer in tests.
      }
      setDragSource(key);
    },
    [],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLTableHeaderCellElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (target: ReferenceMatrixColumnKey) => (event: DragEvent<HTMLTableHeaderCellElement>) => {
      event.preventDefault();
      const source = dragSource ?? ((event.dataTransfer.getData("text/plain") as ReferenceMatrixColumnKey) || null);
      if (source && source !== target) {
        reorderColumns(source, target);
      }
      setDragSource(null);
    },
    [dragSource, reorderColumns],
  );

  const handleDragEnd = useCallback(() => {
    setDragSource(null);
  }, []);

  return (
    <section className="panel-card interactive-card reference-matrix">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">Access 행렬 프리뷰</h2>
          <p className="panel-subtitle">선택 품목의 기준 공정 데이터를 확인합니다.</p>
        </div>
        <div className="panel-header__actions">
          <label className="panel-label" htmlFor="reference-matrix-column-select">
            표시할 컬럼
          </label>
          <select
            id="reference-matrix-column-select"
            data-testid="reference-matrix-column-select"
            multiple
            value={selectedColumns}
            onChange={handleColumnSelectionChange}
            size={Math.min(6, COLUMN_OPTIONS.length)}
            className="panel-multiselect"
            aria-label="표시할 컬럼"
          >
            {COLUMN_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>
      {rows.length === 0 ? (
        <div className="p-4 text-sm text-muted">추천 데이터를 불러오면 행렬이 표시됩니다.</div>
      ) : (
        <div className="reference-matrix__scroll" role="grid" aria-label="Access 행렬 프리뷰">
          <table className="reference-matrix__table">
            <thead>
              <tr>
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    data-testid={`reference-matrix-column-${column.key}`}
                    draggable
                    onDragStart={handleDragStart(column.key)}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    onDrop={handleDrop(column.key)}
                    onDragEnd={handleDragEnd}
                    aria-grabbed={dragSource === column.key}
                  >
                    <span className="reference-matrix__drag-handle" aria-hidden="true">
                      ⋮⋮
                    </span>
                    <span>{column.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.seq}-${row.code}`}>
                  {visibleColumns.map((column) => (
                    <td
                      key={`${row.seq}-${row.code}-${column.key}`}
                      className={column.align === "right" ? "text-right" : undefined}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
