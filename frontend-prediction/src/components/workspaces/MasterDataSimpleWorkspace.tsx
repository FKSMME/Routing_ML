/**
 * Simplified Master Data Workspace
 * Only shows ERP View: dbo.BI_ITEM_INFO_VIEW
 */
import { useErpViewSample } from "@hooks/useErpViewExplorer";
import { Layers, Search } from "lucide-react";
import { useCallback, useEffect, useState, FormEvent, ChangeEvent } from "react";

const PAGE_SIZE_OPTIONS = [10, 20, 30];
const DEFAULT_PAGE_SIZE = 30;

export function MasterDataSimpleWorkspace() {
  const [viewSearch, setViewSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [activeColumn, setActiveColumn] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const {
    data: viewSample,
    isFetching: isViewLoading,
    refetch: refetchViewSample,
  } = useErpViewSample("dbo.BI_ITEM_INFO_VIEW", {
    page: currentPage,
    pageSize,
    search: viewSearch.length > 0 ? viewSearch : undefined,
    searchColumn: activeColumn === "ALL" ? undefined : activeColumn,
    enabled: true,
  });

  const erpColumns = viewSample?.columns ?? [];
  const erpRows = viewSample?.data ?? [];
  const totalRowCount = viewSample?.row_count ?? 0;

  useEffect(() => {
    setSearchDraft(viewSearch);
  }, [viewSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [viewSearch, activeColumn]);

  const responsePage = viewSample?.page ?? currentPage;
  const responsePageSize = viewSample?.page_size ?? pageSize;
  const totalPages =
    viewSample?.total_pages ??
    (responsePageSize > 0 ? Math.max(1, Math.ceil(totalRowCount / responsePageSize)) : 1);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex =
    totalRowCount === 0 ? 0 : Math.max((responsePage - 1) * responsePageSize, 0);
  const endIndex =
    totalRowCount === 0 ? 0 : Math.min(startIndex + erpRows.length, totalRowCount);
  const effectivePage =
    totalPages === 0 ? 1 : Math.min(Math.max(responsePage, 1), totalPages);
  const primaryColumn = erpColumns[0]?.name;

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const keyword = searchDraft.trim();
      const isSame = keyword === viewSearch;
      setViewSearch(keyword);
      setCurrentPage(1);
      if (isSame) {
        void refetchViewSample();
      }
    },
    [refetchViewSample, searchDraft, viewSearch],
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

  return (
    <div className="master-data-simple-workspace">
      <section className="master-data-simple-full">
        <div className="panel-card master-data-view-panel">
          <header className="master-data-view-header">
            <div className="master-data-view-header__meta">
              <h2 className="panel-title">ERP View: dbo.BI_ITEM_INFO_VIEW</h2>
              <p className="panel-subtitle">
                <strong>{erpRows.length}</strong>건 (총 {totalRowCount}건) · 컬럼{" "}
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
            </aside>

            <div className="master-data-view-main">
              {isViewLoading ? (
                <div className="master-data-view-empty">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                  <p className="mt-3 text-sm text-muted">ERP 데이터를 불러오는 중...</p>
                </div>
              ) : erpRows.length === 0 ? (
                <div className="master-data-view-empty">
                  <Layers size={18} />
                  <p className="mt-2 text-sm text-muted">표시할 데이터가 없습니다.</p>
                </div>
              ) : (
                <div className="master-data-view-grid">
                  {erpRows.map((row, index) => (
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
              {totalRowCount > 0 ? (
                <div className="master-data-view-pagination">
                  <div className="master-data-view-pagination__info">
                    {startIndex + 1} - {endIndex} / {totalRowCount}건 표시
                  </div>
                  <div className="master-data-view-pagination__controls">
                    <button
                      type="button"
                      onClick={() => handlePageChange(effectivePage - 1)}
                      disabled={effectivePage <= 1}
                    >
                      이전
                    </button>
                    <span>
                      {effectivePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePageChange(effectivePage + 1)}
                      disabled={effectivePage >= totalPages}
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
