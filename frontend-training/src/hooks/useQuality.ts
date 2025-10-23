import type { QualityHistoryResponse, QualityMetrics } from "@lib/apiClient";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const QUALITY_METRICS_KEY = ["quality-metrics"];
const QUALITY_HISTORY_KEY = ["quality-history"];

/**
 * Fetch current quality metrics (latest cycle)
 */
async function fetchQualityMetrics(): Promise<QualityMetrics | null> {
  try {
    const response = await axios.get<QualityMetrics>("/api/training/quality/latest");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null; // No quality data available yet
    }
    throw error;
  }
}

/**
 * Fetch quality history (last N cycles)
 */
async function fetchQualityHistory(params?: {
  limit?: number;
  startDate?: string;
  endDate?: string;
}): Promise<QualityHistoryResponse> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set("limit", params.limit.toString());
  if (params?.startDate) queryParams.set("start_date", params.startDate);
  if (params?.endDate) queryParams.set("end_date", params.endDate);

  const url = `/api/training/quality/history${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const response = await axios.get<QualityHistoryResponse>(url);
  return response.data;
}

/**
 * Hook to fetch current quality metrics
 */
export function useQualityMetrics() {
  const query = useQuery<QualityMetrics | null>({
    queryKey: QUALITY_METRICS_KEY,
    queryFn: fetchQualityMetrics,
    staleTime: 60_000, // 1 minute
    refetchInterval: 300_000, // 5 minutes
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refresh: query.refetch,
  };
}

/**
 * Hook to fetch quality history
 */
export function useQualityHistory(params?: {
  limit?: number;
  startDate?: string;
  endDate?: string;
}) {
  const query = useQuery<QualityHistoryResponse>({
    queryKey: [...QUALITY_HISTORY_KEY, params],
    queryFn: () => fetchQualityHistory(params),
    staleTime: 60_000, // 1 minute
    enabled: true,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refresh: query.refetch,
  };
}
