import {
  fetchOutputProfileDetail,
  fetchOutputProfiles,
  // type OutputProfileDetail,
  // type OutputProfileSummary,
} from "@lib/apiClient";

type OutputProfileDetail = any;
type OutputProfileSummary = any;
import { useQuery, useQueryClient } from "@tanstack/react-query";

const LIST_QUERY_KEY = ["output-profiles"] as const;

const detailQueryKey = (profileId: string | null) =>
  [...LIST_QUERY_KEY, profileId] as const;

export function useOutputProfiles() {
  const query = useQuery<OutputProfileSummary[]>({
    queryKey: LIST_QUERY_KEY,
    queryFn: fetchOutputProfiles,
    staleTime: 60_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refresh: query.refetch,
  };
}

export function useOutputProfile(profileId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery<OutputProfileDetail>({
    queryKey: detailQueryKey(profileId),
    queryFn: () => fetchOutputProfileDetail(profileId ?? ""),
    enabled: Boolean(profileId),
    staleTime: 30_000,
  });

  const prefetch = (id: string) =>
    queryClient.prefetchQuery({
      queryKey: detailQueryKey(id),
      queryFn: () => fetchOutputProfileDetail(id),
      staleTime: 30_000,
    });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refresh: query.refetch,
    prefetch,
  };
}
