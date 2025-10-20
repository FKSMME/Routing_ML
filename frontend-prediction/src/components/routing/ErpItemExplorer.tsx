import React, { useCallback, useEffect, useMemo, useState, FormEvent, ChangeEvent } from "react";
import { Filter, Loader2, RefreshCw, Search } from "lucide-react";

import { useErpViewSample, useErpViews } from "@hooks/useErpViewExplorer";
import { hasItemCodesDragData, readItemCodesDragData, setItemCodesDragData } from "@lib/dragAndDrop";

interface ErpItemExplorerProps {
  onAddItems: (items: string[]) => void;
}

const DEFAULT_VIEW_MATCHERS = [/ITEM/i, /PRODUCT/i, /MASTER/i];
const DEFAULT_COLUMN_MATCHERS = [/ITEM_CD/i, /ITEM/i, /CODE/i];
const SAMPLE_LIMIT_STEP = 500;
const INITIAL_SAMPLE_LIMIT = 500;
const PAGE_SIZE_OPTIONS = [25, 50, 100];

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
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sampleLimit, setSampleLimit] = useState(INITIAL_SAMPLE_LIMIT);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isDraggingOverImport, setIsDraggingOverImport] = useState(false);

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
  } = useErpViewSample(selectedView, { limit: sampleLimit, enabled: Boolean(selectedView) });

  const columnOptions = viewSample?.columns ?? [];
  const rowCount = viewSample?.row_count ?? 0;

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
    setCurrentPage(1);
  }, [search, selectedColumn]);

  const sampleRows = viewSample?.data ?? [];
  const availableItems = useMemo(() => {
    if (!selectedColumn) {
      return [];
    }
    const values = (sampleRows ?? [])
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

  useEffect(() => {
    setSelectedItems((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      const next = new Set<string>();
      for (const item of prev) {
        if (availableItems.includes(item)) {
          next.add(item);
        }
      }
      return next;
    });
  }, [availableItems]);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  const filteredItems = useMemo(() => {
    if (search.trim().length === 0) {
      return availableItems;
    }
    const keyword = search.trim().toLowerCase();
    return availableItems.filter((item) => item.toLowerCase().includes(keyword));
  }, [availableItems, search]);

  const selectedCount = selectedItems.size;
  const totalFiltered = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFiltered);
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  const canLoadMore = Boolean(rowCount && sampleRows.length < rowCount);

  const handleSearchSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchDraft.trim());
    setCurrentPage(1);
  }, [searchDraft]);

  const handlePageSizeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(event.target.value));
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((nextPage: number) => {
    setCurrentPage(Math.min(Math.max(nextPage, 1), totalPages));
  }, [totalPages]);

  const handleLoadMore = useCallback(() => {
    if (!rowCount) {
      return;
    }
    const nextLimit = Math.min(sampleLimit + SAMPLE_LIMIT_STEP, rowCount);
    if (nextLimit > sampleLimit) {
      setSampleLimit(nextLimit);
    }
  }, [sampleLimit, rowCount]);

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

  const statusMessage = useMemo(() => {
    if (isViewsLoading || isSampleLoading) {
      return "ERP View 데이터를 불러오는 중입니다.";
    }
    if (viewsError) {
      return "ERP View 목록을 불러오지 못했습니다.";
    }
    if (sampleError) {
      return "ERP View 샘플 데이터를 불러오지 못했습니다.";
    }
    if (!selectedView) {
      return "ERP View를 선택하세요.";
    }
    if (!selectedColumn) {
      return "컬럼을 선택하세요.";
    }
    if (availableItems.length === 0) {
      return "선택한 컬럼에서 항목을 찾을 수 없습니다.";
    }
    return null;
  }, [availableItems.length, isSampleLoading, isViewsLoading, sampleError, selectedColumn, selectedView, viewsError]);

  const clearImportDragState = useCallback(() => {
    if (!hasItemCodesDragData()) {
      return;
    }
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
        filterValue: search.trim() || null,
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
    if (!hasItemCodesDragData()) {
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
              onClick={() => refetchViews()}
              title="ERP View 목록 새로고침"
            >
              <RefreshCw size={16} />
            </button>
            <button
              type="button"
              className="erp-item-explorer__action"
              onClick={() => refetchSample()}
              disabled={!selectedView}
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
            {startIndex + 1} - {endIndex} / {totalFiltered}건 표시
            {rowCount > sampleRows.length ? ` · 샘플 ${sampleRows.length}/${rowCount}` : ""}
          </div>
          <div className="erp-item-explorer__footer-controls">
            <button type="button" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}>
              이전
            </button>
            <span>
              {currentPage} / {totalPages}
            </span>
            <button type="button" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages}>
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
          {canLoadMore ? (
            <button type="button" className="erp-item-explorer__load-more" onClick={handleLoadMore}>
              더 불러오기 ({sampleRows.length}/{rowCount})
            </button>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}
