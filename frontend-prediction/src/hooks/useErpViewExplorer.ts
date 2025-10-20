import { fetchViewExplorerSample, fetchViewExplorerViews, type ViewExplorerSampleResponse, type ViewExplorerView } from "@lib/apiClient";
import { useQuery } from "@tanstack/react-query";

export function useErpViews() {
  const query = useQuery<ViewExplorerView[]>({
    queryKey: ["erp-views"],
    queryFn: () => fetchViewExplorerViews(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    views: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export interface UseErpViewSampleOptions {
  limit?: number;
  page?: number;
  pageSize?: number;
  search?: string;
  searchColumn?: string | null;
  enabled?: boolean;
}

export function useErpViewSample(
  viewName: string | null | undefined,
  { limit, page, pageSize, search, searchColumn, enabled = true }: UseErpViewSampleOptions = {},
) {
  const normalizedSearch = search?.trim();
  const normalizedSearchColumn =
    searchColumn && searchColumn.length > 0 ? searchColumn : undefined;

  return useQuery<ViewExplorerSampleResponse>({
    queryKey: [
      "erp-view-sample",
      viewName,
      limit ?? null,
      page ?? null,
      pageSize ?? null,
      normalizedSearch ?? "",
      normalizedSearchColumn ?? "",
    ],
    queryFn: () => {
      if (!viewName) {
        throw new Error("viewName is required to fetch sample data");
      }
      return fetchViewExplorerSample(viewName, {
        limit,
        page,
        pageSize,
        search: normalizedSearch && normalizedSearch.length > 0 ? normalizedSearch : undefined,
        searchColumn: normalizedSearchColumn,
      });
    },
    enabled: Boolean(viewName) && enabled,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
}
