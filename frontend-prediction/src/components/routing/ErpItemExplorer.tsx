import React, { useCallback, useEffect, useMemo, useState, FormEvent, ChangeEvent } from "react";
import { Filter, Loader2, RefreshCw, Search } from "lucide-react";

import { useErpViewSample, useErpViews } from "@hooks/useErpViewExplorer";
import { hasItemCodesDragData, readItemCodesDragData, setItemCodesDragData } from "@lib/dragAndDrop";
import type { ViewExplorerColumn } from "@lib/apiClient";

interface ErpItemExplorerProps {
  onAddItems: (items: string[]) => void;
}

const DEFAULT_VIEW_MATCHERS = [/ITEM/i, /PRODUCT/i, /MASTER/i];
const DEFAULT_COLUMN_MATCHERS = [/ITEM_CD/i, /ITEM/i, /CODE/i];
const PAGE_SIZE_OPTIONS = [10, 20, 30];
const DEFAULT_PAGE_SIZE = 30;

const normalizeItems = (items: string[]): string[] => {
  return Array.from(
    new Set(
      items
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
};

export function ErpItemExplorer({ onAddItems }: ErpItemExplorerProps) {
  const { views, isLoading: isViewsLoading, error: viewsError, refetch: refetchViews } = useErpViews();
  const [selectedView, setSelectedView] = useState<string | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isDraggingOverImport, setIsDraggingOverImport] = useState(false);
  const [hasRequestedData, setHasRequestedData] = useState(false);

  const defaultViewName = useMemo(() => {
    if (views.length === 0) {
      return null;
    }
    for (const matcher of DEFAULT_VIEW_MATCHERS) {
      const matched = views.find((view) => matcher.test(view.view_name) || matcher.test(view.full_name));
      if (matched) {
        return matched.full_name;
      }
    }
    return views[0]?.full_name ?? null;
  }, [views]);

  useEffect(() => {
    if (!selectedView && defaultViewName) {
      setSelectedView(defaultViewName);
    }
  }, [defaultViewName, selectedView]);

  const {
    data: viewSample,
    isFetching: isSampleLoading,
    isError: isSampleError,
    error: sampleError,
    refetch: refetchSample,
  } = useErpViewSample(selectedView, {
    page: currentPage,
    pageSize,
    search: search.length > 0 ? search : undefined,
    searchColumn: selectedColumn ?? undefined,
    enabled: Boolean(selectedView) && hasRequestedData,
  });

  const columnOptions: ViewExplorerColumn[] = viewSample?.columns ?? [];
  const totalRowCount = viewSample?.row_count ?? 0;

  const defaultColumnName = useMemo(() => {
    if (columnOptions.length === 0) {
      return null;
    }
    for (const matcher of DEFAULT_COLUMN_MATCHERS) {
      const matched = columnOptions.find((column) => matcher.test(column.name));
      if (matched) {
        return matched.name;
      }
    }
    return columnOptions[0]?.name ?? null;
  }, [columnOptions]);

  useEffect(() => {
    if (!selectedColumn && defaultColumnName) {
      setSelectedColumn(defaultColumnName);
    }
  }, [defaultColumnName, selectedColumn]);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedColumn]);

  useEffect(() => {
    if (!selectedView) {
      return;
    }
    setSelectedColumn(null);
    setSelectedItems(new Set());
    setSearch("");
    setSearchDraft("");
    setCurrentPage(1);
    setHasRequestedData(false);
  }, [selectedView]);

  const sampleRows = (viewSample?.data ?? []) as Array<Record<string, unknown>>;
  const responsePage = viewSample?.page ?? currentPage;
  const responsePageSize = viewSample?.page_size ?? pageSize;
  const totalPages = viewSample?.total_pages ?? (responsePageSize > 0 ? Math.max(1, Math.ceil(totalRowCount / responsePageSize)) : 1);
  const pageStartIndex = totalRowCount === 0 ? 0 : Math.max((responsePage - 1) * responsePageSize, 0);
  const effectivePage = totalPages === 0 ? 1 : Math.min(Math.max(responsePage, 1), totalPages);
  const startIndex = totalRowCount === 0 ? 0 : pageStartIndex;
  const endIndex = totalRowCount === 0 ? 0 : Math.min(pageStartIndex + sampleRows.length, totalRowCount);

  const availableItems = useMemo(() => {
    if (!selectedColumn) {
      return [];
    }
    const values = sampleRows
      .map((row) => {
        const value = row[selectedColumn];
        if (typeof value === "string") {
          return value.trim();
        }
        if (value === null || value === undefined) {
          return "";
        }
        if (typeof value === "number") {
          return String(value);
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        return String(value);
      })
      .filter((value) => value.length > 0);
    return normalizeItems(values);
  }, [sampleRows, selectedColumn]);

  const filteredItems = availableItems;
  const paginatedItems = filteredItems;
  const selectedCount = selectedItems.size;

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const keyword = searchDraft.trim();
      const isSameKeyword = keyword === search;
      setSearch(keyword);
      setCurrentPage(1);
      setHasRequestedData(true);
      if (hasRequestedData && isSameKeyword) {
        void refetchSample({ cancelRefetch: false });
      }
    },
    [hasRequestedData, refetchSample, search, searchDraft],
  );

  const handlePageSizeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const nextSize = Number(event.target.value);
    setPageSize(nextSize);
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setCurrentPage((prev) => {
        const clamped = Math.min(Math.max(nextPage, 1), totalPages);
        return clamped === prev ? prev : clamped;
      });
    },
    [totalPages],
  );

  const handleToggleSelection = useCallback((item: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }
      return next;
    });
  }, []);

  const handleSelectFiltered = useCallback(() => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      for (const item of filteredItems) {
        next.add(item);
      }
      return next;
    });
  }, [filteredItems]);

  const handleClearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const handleQuickAdd = useCallback(
    (items: string[]) => {
      const normalized = normalizeItems(items);
      if (normalized.length === 0) {
        return;
      }
      onAddItems(normalized);
    },
    [onAddItems],
  );

  const handleRefreshViews = useCallback(() => {
    void refetchViews({ cancelRefetch: false });
  }, [refetchViews]);

  const handleRefreshSample = useCallback(() => {
    void refetchSample({ cancelRefetch: false });
  }, [refetchSample]);

  const statusMessage = useMemo(() => {
    if (isViewsLoading) {
      return "ERP View 목록을 불러오는 중입니다.";
    }
    if (viewsError) {
      return "ERP View 목록을 불러오지 못했습니다.";
    }
    if (!selectedView) {
      return "ERP View를 선택하세요.";
    }
    if (!hasRequestedData) {
      return "검색 버튼을 눌러 데이터를 불러오세요.";
    }
    if (isSampleLoading) {
      return "ERP View 데이터를 불러오는 중입니다.";
    }
    if (sampleError) {
      return "ERP View 데이터를 불러오지 못했습니다.";
    }
    if (!selectedColumn) {
      return "컬럼을 선택하세요.";
    }
    if (totalRowCount === 0) {
      return "선택한 조건에서 항목을 찾을 수 없습니다.";
    }
    if (availableItems.length === 0) {
      return "현재 페이지에 표시할 항목이 없습니다.";
    }
    return null;
  }, [
    availableItems.length,
    hasRequestedData,
    isSampleLoading,
    isViewsLoading,
    sampleError,
    selectedColumn,
    selectedView,
    totalRowCount,
    viewsError,
  ]);

  const clearImportDragState = useCallback(() => {
    const dragData = readItemCodesDragData();
    if (!dragData) {
      return;
    }
    setIsDraggingOverImport(false);
  }, []);

  useEffect(() => {
    const handleDragLeaveWindow = () => {
      setIsDraggingOverImport(false);
    };
    window.addEventListener("dragend", handleDragLeaveWindow);
    window.addEventListener("drop", handleDragLeaveWindow);
    return () => {
      window.removeEventListener("dragend", handleDragLeaveWindow);
      window.removeEventListener("drop", handleDragLeaveWindow);
    };
  }, []);

  const handleDragStart = useCallback(
    (event: React.DragEvent, items: string[], source: string) => {
      const normalized = normalizeItems(items);
      if (normalized.length === 0) {
        event.preventDefault();
        return;
      }
      setItemCodesDragData(event.dataTransfer, {
        items: normalized,
        viewName: selectedView ?? undefined,
        columnName: selectedColumn ?? undefined,
        filterValue: search || null,
        source,
      });
      event.currentTarget.classList.add("is-dragging");
    },
    [search, selectedColumn, selectedView],
  );

  const handleDragEnd = useCallback((event: React.DragEvent) => {
    event.currentTarget.classList.remove("is-dragging");
  }, []);

  const handleItemDoubleClick = useCallback(
    (item: string) => {
      handleQuickAdd([item]);
    },
    [handleQuickAdd],
  );

  const handleDropOnExplorer = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDraggingOverImport(false);
      const data = readItemCodesDragData();
      if (!data) {
        return;
      }
      if (data.items && data.items.length > 0) {
        handleQuickAdd(data.items);
      }
    },
    [handleQuickAdd],
  );

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!hasItemCodesDragData(event.dataTransfer)) {
      return;
    }
    setIsDraggingOverImport(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDraggingOverImport(false);
    }
  }, []);

  return (
    <div
      className={["erp-item-explorer", isDraggingOverImport ? "erp-item-explorer--drop-target" : ""].join(" ")}
      onDrop={handleDropOnExplorer}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <header className="erp-item-explorer__header">
        <div className="erp-item-explorer__header-top">
          <h3 className="erp-item-explorer__title">📦 ERP View Item 리스트</h3>
          <div className="erp-item-explorer__actions">
            <button
              type="button"
              className="erp-item-explorer__action"
              onClick={handleRefreshViews}
              title="ERP View 목록 새로고침"
            >
              <RefreshCw size={16} />
            </button>
            <button
              type="button"
              className="erp-item-explorer__action"
              onClick={handleRefreshSample}
              disabled={!selectedView || !hasRequestedData}
              title="샘플 데이터 새로고침"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="erp-item-explorer__field-grid">
          <label className="erp-item-explorer__field">
            <span className="erp-item-explorer__field-label">ERP View</span>
            <select
              value={selectedView ?? ""}
              onChange={(event) => setSelectedView(event.target.value || null)}
              className="erp-item-explorer__select"
            >
              <option value="">선택하세요</option>
              {views.map((view) => (
                <option key={view.full_name} value={view.full_name}>
                  {view.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-item-explorer__field">
            <span className="erp-item-explorer__field-label">컬럼</span>
            <select
              value={selectedColumn ?? ""}
              onChange={(event) => setSelectedColumn(event.target.value || null)}
              className="erp-item-explorer__select"
              disabled={columnOptions.length === 0}
            >
              <option value="">선택하세요</option>
              {columnOptions.map((column) => (
                <option key={column.name} value={column.name}>
                  {column.name} ({column.type})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="erp-item-explorer__search-row">
          <form className="erp-item-explorer__search" onSubmit={handleSearchSubmit}>
            <Search size={16} />
            <input
              type="search"
              placeholder="품목 코드 검색..."
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
            <button type="submit">검색</button>
          </form>
          <div className="erp-item-explorer__filters">
            <button type="button" onClick={handleSelectFiltered} disabled={filteredItems.length === 0}>
              <Filter size={14} />
              필터 선택 ({filteredItems.length})
            </button>
            <button type="button" onClick={handleClearSelection} disabled={selectedCount === 0}>
              선택 해제 ({selectedCount})
            </button>
          </div>
        </div>
*** End of File
        <div className="erp-item-explorer__drag-strip">
          <div
            className={["erp-item-explorer__chip", availableItems.length === 0 ? "is-disabled" : ""].join(" ")}
            draggable={availableItems.length > 0}
            onDragStart={(event) => handleDragStart(event, availableItems, "all")}
            onDragEnd={handleDragEnd}
            role="button"
            tabIndex={-1}
          >
            전체 노드 ({availableItems.length})
          </div>
          <div
            className={["erp-item-explorer__chip", filteredItems.length === 0 ? "is-disabled" : ""].join(" ")}
            draggable={filteredItems.length > 0}
            onDragStart={(event) => handleDragStart(event, filteredItems, "filtered")}
            onDragEnd={handleDragEnd}
            role="button"
            tabIndex={-1}
          >
            필터 결과 ({filteredItems.length})
          </div>
          <div
            className={["erp-item-explorer__chip", selectedCount === 0 ? "is-disabled" : ""].join(" ")}
            draggable={selectedCount > 0}
            onDragStart={(event) => handleDragStart(event, Array.from(selectedItems), "selected")}
            onDragEnd={handleDragEnd}
            role="button"
            tabIndex={-1}
          >
            선택한 노드 ({selectedCount})
          </div>
          <button
            type="button"
            className="erp-item-explorer__chip erp-item-explorer__chip--primary"
            disabled={selectedCount === 0}
            onClick={() => handleQuickAdd(Array.from(selectedItems))}
          >
            선택 추가
          </button>
          <button
            type="button"
            className="erp-item-explorer__chip erp-item-explorer__chip--primary"
            disabled={filteredItems.length === 0}
            onClick={() => handleQuickAdd(filteredItems)}
          >
            필터 추가
          </button>
        </div>
      </header>

      <div className="erp-item-explorer__content">
        {statusMessage ? (
          <div className="erp-item-explorer__status">
            {isSampleLoading || isViewsLoading ? <Loader2 className="erp-item-explorer__spinner" size={18} /> : null}
            <span>{statusMessage}</span>
            {viewsError && (
              <p className="erp-item-explorer__error-detail">
                {(viewsError instanceof Error ? viewsError.message : String(viewsError)) ?? ""}
              </p>
            )}
            {sampleError && (
              <p className="erp-item-explorer__error-detail">
                {(sampleError instanceof Error ? sampleError.message : String(sampleError)) ?? ""}
              </p>
            )}
          </div>
        ) : (
          <div className="erp-item-explorer__grid-wrapper">
            <div className="erp-item-explorer__grid">
              {paginatedItems.map((item) => {
                const isSelected = selectedItems.has(item);
                return (
                  <button
                    key={item}
                    type="button"
                    className={["erp-item-explorer__item", isSelected ? "is-selected" : ""].filter(Boolean).join(" ")}
                    onClick={() => handleToggleSelection(item)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                    draggable
                    onDragStart={(event) => {
                      const itemsToDrag = selectedItems.has(item) ? Array.from(selectedItems) : [item];
                      handleDragStart(event, itemsToDrag, "item");
                    }}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="erp-item-explorer__item-code">{item}</span>
                    {isSelected ? <span className="erp-item-explorer__item-check">선택됨</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!statusMessage && paginatedItems.length > 0 ? (
        <footer className="erp-item-explorer__footer">
          <div className="erp-item-explorer__footer-info">
            {totalRowCount === 0
              ? "표시할 데이터가 없습니다."
              : `${startIndex + 1} - ${endIndex} / ${totalRowCount}건 표시`}
          </div>
          <div className="erp-item-explorer__footer-controls">
            <button type="button" onClick={() => handlePageChange(effectivePage - 1)} disabled={effectivePage <= 1}>
              이전
            </button>
            <span>
              {effectivePage} / {totalPages}
            </span>
            <button type="button" onClick={() => handlePageChange(effectivePage + 1)} disabled={effectivePage >= totalPages}>
              다음
            </button>
          </div>
          <div className="erp-item-explorer__footer-size">
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
        </footer>
      ) : null}
    </div>
  );
}
