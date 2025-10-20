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
  enabled?: boolean;
}

export function useErpViewSample(
  viewName: string | null | undefined,
  { limit = 200, enabled = true }: UseErpViewSampleOptions = {},
) {
  return useQuery<ViewExplorerSampleResponse>({
    queryKey: ["erp-view-sample", viewName, limit],
    queryFn: () => {
      if (!viewName) {
        throw new Error("viewName is required to fetch sample data");
      }
      return fetchViewExplorerSample(viewName, limit);
    },
    enabled: Boolean(viewName) && enabled,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
  });
}
