import type { TrainingStatus } from "@lib/apiClient";
import { fetchTrainingStatus } from "@lib/apiClient";
import { useQuery } from "@tanstack/react-query";

const QUERY_KEY = ["training-status"];

export function useTrainingStatus() {
  const query = useQuery<TrainingStatus>({
    queryKey: QUERY_KEY,
    queryFn: fetchTrainingStatus,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refresh: query.refetch,
  };
}
