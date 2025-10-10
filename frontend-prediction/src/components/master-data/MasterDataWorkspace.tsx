import { MasterDataInfoPanel } from "@components/master-data/MasterDataInfoPanel";
import { MasterDataItemInput } from "@components/master-data/MasterDataItemInput";
import { MasterDataMatrixPanel } from "@components/master-data/MasterDataMatrix";
import { MasterDataMetadataPanel } from "@components/master-data/MasterDataMetadataPanel";
import { MasterDataSearchPanel } from "@components/master-data/MasterDataSearchPanel";
import { MasterDataTabs } from "@components/master-data/MasterDataTabs";
import { MasterDataTree } from "@components/master-data/MasterDataTree";
import { useMasterData } from "@hooks/useMasterData";
import { postUiAudit, testMssqlConnection } from "@lib/apiClient";
import { useCallback, useEffect, useMemo, useState } from "react";

interface MasterDataWorkspaceProps {
  layout: string;
}

export function MasterDataWorkspace({ layout }: MasterDataWorkspaceProps) {
  const {
    search,
    setSearch,
    filteredTree,
    treeQuery,
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
    dataSourceMetadata,
    inspectDataSource,
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
  const [serverInput, setServerInput] = useState("");
  const [viewInput, setViewInput] = useState("");
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
    setServerInput(connectionStatus.path || "");
    setViewInput(dataSourceMetadata?.table ?? "");
    if (dataSourceMetadata?.table) {
      setAvailableTables([dataSourceMetadata.table]);
    }
    setIsDialogOpen(true);
  }, [dataSourceMetadata?.table, connectionStatus.path, resetDialogState]);

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const handleTestConnection = useCallback(async () => {
    const trimmedPath = serverInput.trim();
    if (!trimmedPath) {
      setConnectionError("MSSQL 서버 주소를 입력하세요.");
      setConnectionMessage(null);
      return;
    }

    setIsTestingConnection(true);
    setConnectionError(null);
    try {
      const response = await testMssqlConnection({
        path: trimmedPath,
        table: viewInput || undefined,
      });
      const tables = response.table_profiles ?? [];
      setConnectionMessage(response.message);
      setAvailableTables(tables);
      if (response.verified_table) {
        setViewInput(response.verified_table);
      } else if (viewInput && !tables.includes(viewInput)) {
        setViewInput("");
      } else if (!viewInput && tables.length > 0) {
        setViewInput(tables[0]);
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
  }, [serverInput, viewInput]);

  const handleApplyDataSource = useCallback(() => {
    inspectDataSource({
      path: serverInput.trim() || null,
      table: viewInput || null,
    });
    setIsDialogOpen(false);
  }, [serverInput, viewInput, inspectDataSource]);

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
        <MasterDataTree
          nodes={filteredTree}
          query={treeQuery}
          activeId={activeItemId}
          onSelect={addTab}
        />
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
        <MasterDataMetadataPanel metadata={dataSourceMetadata} isLoading={isMetadataLoading || isTreeLoading} />
      </aside>
      {isDialogOpen ? (
        <div className="master-dialog-backdrop" role="dialog" aria-modal="true">
          <div className="master-dialog">
            <header className="master-dialog__header">
              <h2 className="panel-title">MSSQL 소스 연결</h2>
              <p className="panel-subtitle">서버와 뷰를 선택해 기준정보 소스를 업데이트합니다.</p>
            </header>
            <div className="master-dialog__body">
              <label className="master-dialog__label" htmlFor="datasource-server-input">
                MSSQL 서버 주소
              </label>
              <input
                id="datasource-server-input"
                type="text"
                className="master-dialog__input"
                value={serverInput}
                onChange={(event) => setServerInput(event.target.value)}
                placeholder="K3-DB.ksm.co.kr,1433"
              />
              <p className="master-dialog__hint">예: K3-DB.ksm.co.kr,1433</p>

              <label className="master-dialog__label" htmlFor="datasource-view-input">
                MSSQL 뷰
              </label>
              <select
                id="datasource-view-input"
                className="master-dialog__select"
                value={viewInput}
                onChange={(event) => setViewInput(event.target.value)}
                disabled={sortedTables.length === 0}
              >
                {sortedTables.length === 0 ? <option value="">뷰 목록을 불러오려면 먼저 연결을 테스트하세요.</option> : null}
                {sortedTables.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </select>
              <p className="master-dialog__hint">연결 테스트가 성공하면 뷰 목록이 표시됩니다.</p>

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
                onClick={handleApplyDataSource}
                disabled={!serverInput.trim()}
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
