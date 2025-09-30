import { MasterDataInfoPanel } from "@components/master-data/MasterDataInfoPanel";
import { MasterDataItemInput } from "@components/master-data/MasterDataItemInput";
import { MasterDataMatrixPanel } from "@components/master-data/MasterDataMatrix";
import { MasterDataMetadataPanel } from "@components/master-data/MasterDataMetadataPanel";
import { MasterDataSearchPanel } from "@components/master-data/MasterDataSearchPanel";
import { MasterDataTabs } from "@components/master-data/MasterDataTabs";
import { MasterDataTree } from "@components/master-data/MasterDataTree";
import { useMasterData } from "@hooks/useMasterData";
import { postUiAudit } from "@lib/apiClient";
import { useCallback } from "react";

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
    isTreeLoading,
    isMatrixLoading,
    isMetadataLoading,
    refreshLogs,
    downloadLog,
    searchMetadataChips,
    searchItem,
    isSearchLoading,
  } = useMasterData();

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
        <MasterDataInfoPanel connection={connectionStatus} logs={logs} onDownloadLog={downloadLog} onRefresh={refreshLogs} />
        <MasterDataMetadataPanel metadata={accessMetadata} isLoading={isMetadataLoading || isTreeLoading} />
      </aside>
    </div>
  );
}
