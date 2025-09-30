import { MasterDataInfoPanel } from "@components/master-data/MasterDataInfoPanel";
import { MasterDataItemInput } from "@components/master-data/MasterDataItemInput";
import { MasterDataMatrixPanel } from "@components/master-data/MasterDataMatrix";
import { MasterDataMetadataPanel } from "@components/master-data/MasterDataMetadataPanel";
import { MasterDataSearchPanel } from "@components/master-data/MasterDataSearchPanel";
import { MasterDataTabs } from "@components/master-data/MasterDataTabs";
import { MasterDataTree } from "@components/master-data/MasterDataTree";
import { useMasterData } from "@hooks/useMasterData";
import { postUiAudit, testAccessConnection } from "@lib/apiClient";
import { useCallback, useEffect, useMemo, useState } from "react";

interface MasterDataWorkspaceProps {
  layout: string;
}

export function MasterDataWorkspace({ layout }: MasterDataWorkspaceProps) {
  const {
    search,
    setSearch,
    filteredTree,
    activeItemId,
    setActiveItemId,
    tabs,
    addTab,
    addTabsFromList,
    removeTab,
    columns,
    matrixRows,
    logs,
    connectionStatus,
    accessMetadata,
    inspectAccessSource,
    isTreeLoading,
    isMatrixLoading,
    isMetadataLoading,
    refreshLogs,
    downloadLog,
    searchMetadataChips,
    searchItem,
    isSearchLoading,
  } = useMasterData();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [accessPathInput, setAccessPathInput] = useState("");
  const [accessTableInput, setAccessTableInput] = useState("");
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const handleCopyRows = useCallback(
    (rows: typeof matrixRows) => {
      void postUiAudit({
        action: "master_data.matrix.copy",
        payload: {
          item_code: activeItemId,
          row_count: rows.length,
        },
      });
    },
    [activeItemId],
  );

  const sortedTables = useMemo(() => {
    return [...new Set(availableTables)].sort((a, b) => a.localeCompare(b));
  }, [availableTables]);

  const resetDialogState = useCallback(() => {
    setConnectionMessage(null);
    setConnectionError(null);
    setAvailableTables([]);
    setIsTestingConnection(false);
  }, []);

  const handleOpenDialog = useCallback(() => {
    resetDialogState();
    setAccessPathInput(connectionStatus.path || "");
    setAccessTableInput(accessMetadata?.table ?? "");
    if (accessMetadata?.table) {
      setAvailableTables([accessMetadata.table]);
    }
    setIsDialogOpen(true);
  }, [accessMetadata?.table, connectionStatus.path, resetDialogState]);

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const handleTestConnection = useCallback(async () => {
    const trimmedPath = accessPathInput.trim();
    if (!trimmedPath) {
      setConnectionError("Access 파일 경로를 입력하세요.");
      setConnectionMessage(null);
      return;
    }

    setIsTestingConnection(true);
    setConnectionError(null);
    try {
      const response = await testAccessConnection({
        path: trimmedPath,
        table: accessTableInput || undefined,
      });
      const tables = response.table_profiles ?? [];
      setConnectionMessage(response.message);
      setAvailableTables(tables);
      if (response.verified_table) {
        setAccessTableInput(response.verified_table);
      } else if (accessTableInput && !tables.includes(accessTableInput)) {
        setAccessTableInput("");
      } else if (!accessTableInput && tables.length > 0) {
        setAccessTableInput(tables[0]);
      }
      if (!response.ok) {
        setConnectionError(response.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "연결 테스트에 실패했습니다.";
      setConnectionError(message);
      setConnectionMessage(null);
    } finally {
      setIsTestingConnection(false);
    }
  }, [accessPathInput, accessTableInput]);

  const handleApplyAccessSource = useCallback(() => {
    inspectAccessSource({
      path: accessPathInput.trim() || null,
      table: accessTableInput || null,
    });
    setIsDialogOpen(false);
  }, [accessPathInput, accessTableInput, inspectAccessSource]);

  useEffect(() => {
    if (!isDialogOpen) {
      return undefined;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDialogOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [isDialogOpen]);

  return (
    <div className="master-data-grid" data-layout={layout}>
      <aside className="master-column master-column-left">
        <MasterDataItemInput onApply={addTabsFromList} />
        <MasterDataSearchPanel
          search={search}
          onSearch={setSearch}
          onSubmit={searchItem}
          metadataChips={searchMetadataChips}
          isSearching={isSearchLoading}
        />
        {isTreeLoading ? <p className="text-sm text-muted">Loading hierarchy...</p> : null}
        <MasterDataTree nodes={filteredTree} activeId={activeItemId} onSelect={addTab} />
      </aside>

      <section className="master-column master-column-center">
        <div className="panel-card">
          <MasterDataTabs tabs={tabs} activeId={activeItemId} onSelect={setActiveItemId} onClose={removeTab} />
        </div>
        <MasterDataMatrixPanel columns={columns} rows={matrixRows} onCopy={handleCopyRows} />
        {isMatrixLoading ? <p className="text-muted text-sm">Loading matrix...</p> : null}
      </section>

      <aside className="master-column master-column-right">
        <MasterDataInfoPanel
          connection={connectionStatus}
          logs={logs}
          onDownloadLog={downloadLog}
          onRefresh={refreshLogs}
          onOpenConnection={handleOpenDialog}
        />
        <MasterDataMetadataPanel metadata={accessMetadata} isLoading={isMetadataLoading || isTreeLoading} />
      </aside>
      {isDialogOpen ? (
        <div className="master-dialog-backdrop" role="dialog" aria-modal="true">
          <div className="master-dialog">
            <header className="master-dialog__header">
              <h2 className="panel-title">Access 소스 연결</h2>
              <p className="panel-subtitle">경로와 테이블을 선택해 기준정보 소스를 업데이트합니다.</p>
            </header>
            <div className="master-dialog__body">
              <label className="master-dialog__label" htmlFor="access-path-input">
                Access 파일 경로
              </label>
              <input
                id="access-path-input"
                type="text"
                className="master-dialog__input"
                value={accessPathInput}
                onChange={(event) => setAccessPathInput(event.target.value)}
                placeholder="\\\\fileserver\\routing\\ROUTING AUTO TEST.accdb"
              />
              <p className="master-dialog__hint">서버에서 접근 가능한 UNC 경로나 절대 경로를 입력하세요.</p>

              <label className="master-dialog__label" htmlFor="access-table-input">
                Access 테이블
              </label>
              <select
                id="access-table-input"
                className="master-dialog__select"
                value={accessTableInput}
                onChange={(event) => setAccessTableInput(event.target.value)}
                disabled={sortedTables.length === 0}
              >
                {sortedTables.length === 0 ? <option value="">테이블을 불러오려면 연결을 테스트하세요.</option> : null}
                {sortedTables.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </select>
              <p className="master-dialog__hint">연결 테스트가 성공하면 테이블 목록이 표시됩니다.</p>

              {connectionMessage ? <p className="master-dialog__status">{connectionMessage}</p> : null}
              {connectionError ? <p className="master-dialog__error">{connectionError}</p> : null}
            </div>
            <footer className="master-dialog__footer">
              <button type="button" className="btn-secondary" onClick={handleCloseDialog}>
                닫기
              </button>
              <button type="button" className="btn-secondary" onClick={handleTestConnection} disabled={isTestingConnection}>
                {isTestingConnection ? "연결 중..." : "연결 테스트"}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleApplyAccessSource}
                disabled={!accessPathInput.trim()}
              >
                적용
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
