import type {
  MasterDataConnectionStatus,
  MasterDataItemResponse,
  MasterDataLogsResponse,
  MasterDataTreeNode,
} from "@app-types/masterData";
import type { DatabaseMetadataResponse } from "@lib/apiClient";
import {
  downloadMasterDataLog,
  fetchDatabaseMetadata,
  fetchMasterDataItem,
  fetchMasterDataLogs,
  fetchMasterDataTree,
  postUiAudit,
} from "@lib/apiClient";
import { MASTER_DATA_MOCK } from "@lib/masterDataMock";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseMasterDataState {
  search: string;
  setSearch: (value: string) => void;
  filteredTree: MasterDataTreeNode[];
  treeQuery: string;
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
  databaseMetadata: DatabaseMetadataResponse | null;
  searchMetadataChips: MasterDataSearchMetadataChip[];
  searchItem: (itemCode: string) => Promise<MasterDataItemResponse | null>;
  isSearchLoading: boolean;
  isTreeLoading: boolean;
  isMatrixLoading: boolean;
  isMetadataLoading: boolean;
  refreshLogs: () => void;
  downloadLog: () => Promise<void>;
}

export interface MasterDataSearchMetadataChip {
  key: string;
  label: string;
  value: string;
}

function buildMetadataChips(response: MasterDataItemResponse): MasterDataSearchMetadataChip[] {
  const firstRow = response.rows[0];
  if (!firstRow) {
    return [];
  }
  return response.columns
    .map((column) => {
      const value = firstRow.values[column.key];
      if (!value) {
        return null;
      }
      return {
        key: column.key,
        label: column.label,
        value,
      } satisfies MasterDataSearchMetadataChip;
    })
    .filter((chip): chip is MasterDataSearchMetadataChip => chip !== null)
    .slice(0, 10);
}

const MOCK_TREE = MASTER_DATA_MOCK.tree as unknown as MasterDataTreeNode[];
const MOCK_DEFAULT_ITEM = Object.keys(MASTER_DATA_MOCK.matrices)[0] ?? null;

export function useMasterData(): UseMasterDataState {
  const queryClient = useQueryClient();
  const [search, setSearchState] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeItemId, setActiveItemIdState] = useState<string | null>(MOCK_DEFAULT_ITEM);
  const [tabs, setTabs] = useState<string[]>(MOCK_DEFAULT_ITEM ? [MOCK_DEFAULT_ITEM] : []);
  const [searchMetadataChips, setSearchMetadataChips] = useState<MasterDataSearchMetadataChip[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const hasLoggedInitialSelection = useRef(false);
  const lastSearchedItemRef = useRef<string | null>(null);

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
    queryFn: async () => fetchMasterDataTree(debouncedSearch || undefined),
    staleTime: 60_000,
  });

  const metadataQuery = useQuery({
    queryKey: ["mssql-metadata"],
    queryFn: () => fetchDatabaseMetadata(),
    staleTime: 300_000,
    placeholderData: (previousData) => previousData,
  });

  const treeData = treeQuery.data;
  const activeTreeQuery = debouncedSearch;

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

  const searchItem = useCallback(
    async (itemCode: string) => {
      const trimmed = itemCode.trim();
      if (!trimmed) {
        setSearchMetadataChips([]);
        lastSearchedItemRef.current = null;
        return null;
      }
      setIsSearchLoading(true);
      try {
        const response = await fetchMasterDataItem(trimmed);
        queryClient.setQueryData(["master-data-item", response.item_code], response);
        setTabs((prev) => {
          if (prev.includes(response.item_code)) {
            return prev;
          }
          return [...prev, response.item_code];
        });
        handleSetActiveItemId(response.item_code);
        setSearchMetadataChips(buildMetadataChips(response));
        lastSearchedItemRef.current = response.item_code;
        void postUiAudit({
          action: "master_data.search.item",
          payload: { item_code: response.item_code },
        });
        return response;
      } catch (error) {
        setSearchMetadataChips([]);
        lastSearchedItemRef.current = null;
        if (isAxiosError(error) && error.response?.status === 404) {
          throw new Error(`Item ${trimmed} was not found in MSSQL master data.`);
        }
        if (error instanceof Error) {
          throw error;
        }
        throw new Error("Failed to search MSSQL master data.");
      } finally {
        setIsSearchLoading(false);
      }
    },
    [handleSetActiveItemId, queryClient],
  );

  const logsQuery = useQuery({
    queryKey: ["master-data-logs"],
    queryFn: () => fetchMasterDataLogs(),
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

  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setSearchMetadataChips([]);
      lastSearchedItemRef.current = null;
    } else if (
      lastSearchedItemRef.current &&
      trimmed.toLowerCase() !== lastSearchedItemRef.current.toLowerCase()
    ) {
      setSearchMetadataChips([]);
    }
  }, [search]);

  const logsData = logsQuery.data ?? {
    logs: MASTER_DATA_MOCK.logs,
    connection: {
      status: "connected" as const,
      server: "K3-DB.ksm.co.kr,1433",
      database: "KsmErp",
      last_checked: "",
    },
  };

  const connectionStatus = logsData.connection ?? {
    status: "disconnected" as const,
    server: undefined,
    database: undefined,
    last_checked: null,
  };

  const databaseMetadata = metadataQuery.data ?? null;

  return {
    search,
    setSearch,
    filteredTree,
    treeQuery: activeTreeQuery,
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
    databaseMetadata,
    searchMetadataChips,
    searchItem,
    isSearchLoading,
    isTreeLoading: treeQuery.isFetching,
    isMatrixLoading: itemQuery.isFetching,
    isMetadataLoading: metadataQuery.isFetching,
    refreshLogs: () => {
      void logsQuery.refetch();
      void postUiAudit({ action: "master_data.logs.refresh" });
    },
    downloadLog: async () => {
      await downloadMutation.mutateAsync();
    },
  };
}
