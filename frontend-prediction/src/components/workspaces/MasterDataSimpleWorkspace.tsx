/**
 * Simplified Master Data Workspace
 * Only shows ERP View: dbo.BI_ITEM_INFO_VIEW
 */
import { useErpViewSample } from "@hooks/useErpViewExplorer";
import { Layers, Search } from "lucide-react";
import { useMemo, useState } from "react";

export function MasterDataSimpleWorkspace() {
  const [viewSearch, setViewSearch] = useState("");
  const [activeColumn, setActiveColumn] = useState<string>("ALL");

  const {
    data: viewSample,
    isFetching: isViewLoading,
  } = useErpViewSample("dbo.BI_ITEM_INFO_VIEW", { limit: 200, enabled: true });

  const erpColumns = viewSample?.columns ?? [];
  const erpRows = viewSample?.data ?? [];

  const filteredErpRows = useMemo(() => {
    if (erpRows.length === 0) {
      return [];
    }
    const keyword = viewSearch.trim().toLowerCase();
    return erpRows.filter((row) => {
      if (!keyword) {
        return true;
      }
      if (activeColumn !== "ALL") {
        const value = row[activeColumn];
        return value != null && String(value).toLowerCase().includes(keyword);
      }
      return erpColumns.some((column) => {
        const value = row[column.name];
        return value != null && String(value).toLowerCase().includes(keyword);
      });
    });
  }, [erpRows, viewSearch, activeColumn, erpColumns]);

  const primaryColumn = erpColumns[0]?.name;

  return (
    <div className="master-data-simple-workspace">
      <section className="master-data-simple-full">
        <div className="panel-card master-data-view-panel">
          <header className="panel-header master-data-view-header">
            <div>
              <h2 className="panel-title">ERP View: dbo.BI_ITEM_INFO_VIEW</h2>
              <p className="panel-subtitle">
                {filteredErpRows.length}건 (총 {erpRows.length}건) · 컬럼 {erpColumns.length}개
              </p>
            </div>
            <div className="master-data-view-controls">
              <div className="master-data-view-search">
                <Search size={16} className="input-icon" />
                <input
                  type="text"
                  placeholder="데이터 검색..."
                  value={viewSearch}
                  onChange={(event) => setViewSearch(event.target.value)}
                />
              </div>
              <div className="master-data-view-columns">
                <button
                  type="button"
                  className={`master-data-view-column-chip${activeColumn === "ALL" ? " is-active" : ""}`}
                  onClick={() => setActiveColumn("ALL")}
                >
                  전체
                </button>
                {erpColumns.map((column) => (
                  <button
                    key={column.name}
                    type="button"
                    className={`master-data-view-column-chip${activeColumn === column.name ? " is-active" : ""}`}
                    onClick={() => setActiveColumn(column.name)}
                  >
                    {column.name}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {isViewLoading ? (
            <div className="master-data-view-empty">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              <p className="mt-3 text-sm text-muted">ERP 데이터를 불러오는 중...</p>
            </div>
          ) : filteredErpRows.length === 0 ? (
            <div className="master-data-view-empty">
              <Layers size={18} />
              <p className="mt-2 text-sm text-muted">표시할 데이터가 없습니다.</p>
            </div>
          ) : (
            <div className="master-data-view-grid">
              {filteredErpRows.map((row, index) => (
                <article key={`${primaryColumn ?? "row"}-${index}`} className="master-data-view-card">
                  <header className="master-data-view-card__header">
                    <span className="master-data-view-card__title">
                      {primaryColumn && row[primaryColumn] ? String(row[primaryColumn]) : `ROW ${index + 1}`}
                    </span>
                    <span className="master-data-view-card__meta">#{index + 1}</span>
                  </header>
                  <dl className="master-data-view-card__body">
                    {erpColumns.map((column) => {
                      const value = row[column.name];
                      return (
                        <div key={column.name} className="master-data-view-card__field">
                          <dt>{column.name}</dt>
                          <dd>{value !== null && value !== undefined && value !== "" ? String(value) : "-"}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
