/**
 * Simplified Master Data Workspace
 * Only shows ERP View: dbo.BI_ITEM_INFO_VIEW
 */
import { useErpViewSample } from "@hooks/useErpViewExplorer";
import { Layers, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, FormEvent, ChangeEvent } from "react";

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const SAMPLE_EXPANSION_STEP = 500;
const INITIAL_SAMPLE_LIMIT = 500;

export function MasterDataSimpleWorkspace() {
  const [viewSearch, setViewSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [activeColumn, setActiveColumn] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [sampleLimit, setSampleLimit] = useState(INITIAL_SAMPLE_LIMIT);

  const {
    data: viewSample,
    isFetching: isViewLoading,
  } = useErpViewSample("dbo.BI_ITEM_INFO_VIEW", { limit: sampleLimit, enabled: true });

  const erpColumns = viewSample?.columns ?? [];
  const erpRows = viewSample?.data ?? [];
  const totalRowCount = viewSample?.row_count ?? erpRows.length;

  useEffect(() => {
    setSearchDraft(viewSearch);
  }, [viewSearch]);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [viewSearch, activeColumn, erpRows.length]);

  const totalRows = filteredErpRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRows);
  const paginatedRows = filteredErpRows.slice(startIndex, endIndex);
  const primaryColumn = erpColumns[0]?.name;

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setViewSearch(searchDraft.trim());
      setCurrentPage(1);
    },
    [searchDraft],
  );

  const handleColumnSelect = useCallback((columnName: string) => {
    setActiveColumn(columnName);
    setCurrentPage(1);
  }, []);

  const handlePageSizeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(event.target.value));
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((nextPage: number) => {
    setCurrentPage(Math.min(Math.max(nextPage, 1), totalPages));
  }, [totalPages]);

  const canLoadMore = Boolean(
    viewSample && viewSample.row_count > (viewSample.data?.length ?? 0),
  );

  const handleLoadMore = useCallback(() => {
    if (!viewSample) {
      return;
    }
    const targetCount = viewSample.row_count ?? sampleLimit + SAMPLE_EXPANSION_STEP;
    const nextLimit = Math.min(sampleLimit + SAMPLE_EXPANSION_STEP, targetCount);
    if (nextLimit > sampleLimit) {
      setSampleLimit(nextLimit);
    }
  }, [sampleLimit, viewSample]);

  return (
    <div className="master-data-simple-workspace">
      <section className="master-data-simple-full">
        <div className="panel-card master-data-view-panel">
          <header className="master-data-view-header">
            <div className="master-data-view-header__meta">
              <h2 className="panel-title">ERP View: dbo.BI_ITEM_INFO_VIEW</h2>
              <p className="panel-subtitle">
                <strong>{filteredErpRows.length}</strong>건 (총 {totalRowCount}건) · 컬럼{" "}
                <strong>{erpColumns.length}</strong>개
              </p>
            </div>
            <div className="master-data-view-search-row">
              <form className="master-data-view-search" onSubmit={handleSearchSubmit}>
                <Search size={16} className="input-icon" />
                <input
                  type="text"
                  placeholder="데이터 검색..."
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                />
                <button type="submit">검색</button>
              </form>
              <div className="master-data-view-active">
                <span className="master-data-view-active__label">활성 컬럼</span>
                <span className="master-data-view-active__value">
                  {activeColumn === "ALL" ? "전체" : activeColumn}
                </span>
              </div>
            </div>
          </header>

          <div className="master-data-view-layout">
            <aside className="master-data-view-sidebar">
              <h3 className="master-data-view-sidebar__title">컬럼 필터</h3>
              <div className="master-data-view-columns">
                <button
                  type="button"
                  className={`master-data-view-column-chip${activeColumn === "ALL" ? " is-active" : ""}`}
                  onClick={() => handleColumnSelect("ALL")}
                >
                  전체
                </button>
                {erpColumns.map((column) => (
                  <button
                    key={column.name}
                    type="button"
                    className={`master-data-view-column-chip${activeColumn === column.name ? " is-active" : ""}`}
                    onClick={() => handleColumnSelect(column.name)}
                  >
                    {column.name}
                  </button>
                ))}
              </div>
              {canLoadMore ? (
                <button type="button" className="master-data-view-load-more" onClick={handleLoadMore}>
                  더 불러오기 ({viewSample?.data.length ?? erpRows.length}/{viewSample?.row_count ?? sampleLimit})
                </button>
              ) : null}
            </aside>

            <div className="master-data-view-main">
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
                  {paginatedRows.map((row, index) => (
                    <article key={`${primaryColumn ?? "row"}-${startIndex + index}`} className="master-data-view-card">
                      <header className="master-data-view-card__header">
                        <span className="master-data-view-card__title">
                          {primaryColumn && row[primaryColumn]
                            ? String(row[primaryColumn])
                            : `ROW ${startIndex + index + 1}`}
                        </span>
                        <span className="master-data-view-card__meta">#{startIndex + index + 1}</span>
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
              {totalRows > 0 ? (
                <div className="master-data-view-pagination">
                  <div className="master-data-view-pagination__info">
                    {startIndex + 1} - {endIndex} / {totalRows}건 표시
                  </div>
                  <div className="master-data-view-pagination__controls">
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                    >
                      이전
                    </button>
                    <span>
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                    >
                      다음
                    </button>
                  </div>
                  <div className="master-data-view-pagination__size">
                    <label>
                      페이지 크기
                      <select value={pageSize} onChange={handlePageSizeChange}>
                        {PAGE_SIZE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}개
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
