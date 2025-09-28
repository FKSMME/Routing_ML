import type {
  MasterDataConnectionStatus,
  MasterDataItemResponse,
  MasterDataLogsResponse,
  MasterDataTreeNode,
} from "@app-types/masterData";
import {
  type AccessMetadataResponse,
  downloadMasterDataLog,
  fetchAccessMetadata,
  fetchMasterDataItem,
  fetchMasterDataLogs,
  fetchMasterDataTree,
  postUiAudit,
} from "@lib/apiClient";
import { MASTER_DATA_MOCK } from "@lib/masterDataMock";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseMasterDataState {
  search: string;
  setSearch: (value: string) => void;
  filteredTree: MasterDataTreeNode[];
  activeItemId: string | null;
  setActiveItemId: (id: string | null) => void;
  tabs: string[];
  addTab: (id: string) => void;
  addTabsFromList: (codes: string[]) => void;
  removeTab: (id: string) => void;
  columns: MasterDataItemResponse["columns"];
  matrixRows: MasterDataItemResponse["rows"];
  logs: MasterDataLogsResponse["logs"];
  connectionStatus: MasterDataConnectionStatus;
  accessMetadata: AccessMetadataResponse | null;
  isTreeLoading: boolean;
  isMatrixLoading: boolean;
  isMetadataLoading: boolean;
  refreshLogs: () => void;
  downloadLog: () => Promise<void>;
}

const MOCK_TREE = MASTER_DATA_MOCK.tree as unknown as MasterDataTreeNode[];
const MOCK_DEFAULT_ITEM = Object.keys(MASTER_DATA_MOCK.matrices)[0] ?? null;

export function useMasterData(): UseMasterDataState {
  const queryClient = useQueryClient();
  const [search, setSearchState] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeItemId, setActiveItemIdState] = useState<string | null>(MOCK_DEFAULT_ITEM);
  const [tabs, setTabs] = useState<string[]>(MOCK_DEFAULT_ITEM ? [MOCK_DEFAULT_ITEM] : []);
  const hasLoggedInitialSelection = useRef(false);

  useEffect(() => {
    const handler = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    if (!debouncedSearch) return;
    void postUiAudit({
      action: "master_data.search",
      payload: { query: debouncedSearch },
    });
  }, [debouncedSearch]);

  const treeQuery = useQuery({
    queryKey: ["master-data-tree", debouncedSearch],
    queryFn: async () => fetchMasterDataTree(debouncedSearch ? { query: debouncedSearch } : undefined),
    staleTime: 60_000,
  });

  const metadataQuery = useQuery({
    queryKey: ["access-metadata"],
    queryFn: () => fetchAccessMetadata(),
    staleTime: 300_000,
  });

  const treeData = treeQuery.data;

  useEffect(() => {
    const defaultItem = treeData?.default_item_code;
    if (!defaultItem) return;

    setTabs((prev) => (prev.length === 0 ? [defaultItem] : prev));
    setActiveItemIdState((prev) => prev ?? defaultItem);
  }, [treeData?.default_item_code]);

  const filteredTree = treeData?.nodes ?? MOCK_TREE;

  const handleSetActiveItemId = useCallback((id: string | null) => {
    setActiveItemIdState(id);
    if (id) {
      void postUiAudit({
        action: "master_data.tab.focus",
        payload: { item_code: id },
      });
    }
  }, []);

  const addTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.includes(id)) {
          return prev;
        }
        return [...prev, id];
      });
      handleSetActiveItemId(id);
      void postUiAudit({
        action: "master_data.tab.open",
        payload: { item_code: id },
      });
    },
    [handleSetActiveItemId],
  );

  const addTabsFromList = useCallback(
    (codes: string[]) => {
      const normalized = Array.from(new Set(codes.map((code) => code.trim()).filter(Boolean)));
      if (normalized.length === 0) {
        return;
      }
      setTabs((prev) => {
        const next = [...prev];
        normalized.forEach((code) => {
          if (!next.includes(code)) {
            next.push(code);
          }
        });
        return next;
      });
      handleSetActiveItemId(normalized[0]);
      void postUiAudit({
        action: "master_data.tab.batch_open",
        payload: { item_codes: normalized },
      });
    },
    [handleSetActiveItemId],
  );

  const removeTab = useCallback(
    (id: string) => {
      setTabs((prev) => prev.filter((item) => item !== id));
      if (activeItemId === id) {
        const remaining = tabs.filter((item) => item !== id);
        const fallback = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        handleSetActiveItemId(fallback);
      }
      void postUiAudit({
        action: "master_data.tab.close",
        payload: { item_code: id },
      });
    },
    [activeItemId, handleSetActiveItemId, tabs],
  );

  useEffect(() => {
    if (!activeItemId) return;
    if (!hasLoggedInitialSelection.current) {
      hasLoggedInitialSelection.current = true;
      return;
    }
    void postUiAudit({
      action: "master_data.item.view",
      payload: { item_code: activeItemId },
    });
  }, [activeItemId]);

  const itemQuery = useQuery({
    queryKey: ["master-data-item", activeItemId],
    enabled: Boolean(activeItemId),
    queryFn: async () => {
      if (!activeItemId) throw new Error("NO_ITEM");
      return fetchMasterDataItem(activeItemId);
    },
    staleTime: 30_000,
  });

  const logsQuery = useQuery({
    queryKey: ["master-data-logs"],
    queryFn: () => fetchMasterDataLogs(5),
    staleTime: 30_000,
  });

  const downloadMutation = useMutation({
    mutationFn: () => downloadMasterDataLog(),
    onSuccess: () => {
      void postUiAudit({ action: "master_data.logs.download" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data-logs"] });
    },
  });

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
  }, []);

  const matrixColumns = itemQuery.data?.columns ?? MASTER_DATA_MOCK.columns;
  const matrixRows = itemQuery.data?.rows ?? (activeItemId ? MASTER_DATA_MOCK.matrices[activeItemId] ?? [] : []);

  const logsData = logsQuery.data ?? {
    logs: MASTER_DATA_MOCK.logs,
    connection: {
      status: "connected" as const,
      path: "//fileserver/routing_data/ROUTING AUTO TEST.accdb",
      last_sync: "",
    },
  };

  const connectionStatus = logsData.connection ?? {
    status: "disconnected" as const,
    path: "",
    last_sync: null,
  };

  const accessMetadata = metadataQuery.data ?? null;

  return {
    search,
    setSearch,
    filteredTree,
    activeItemId,
    setActiveItemId: handleSetActiveItemId,
    tabs,
    addTab,
    addTabsFromList,
    removeTab,
    columns: matrixColumns,
    matrixRows,
    logs: logsData.logs ?? [],
    connectionStatus,
    accessMetadata,
    isTreeLoading: treeQuery.isFetching,
    isMatrixLoading: itemQuery.isFetching,
    isMetadataLoading: metadataQuery.isFetching,
    refreshLogs: () => {
      void logsQuery.refetch();
      void postUiAudit({ action: "master_data.logs.refresh" });
    },
    downloadLog: () => downloadMutation.mutateAsync(),
  };
}
