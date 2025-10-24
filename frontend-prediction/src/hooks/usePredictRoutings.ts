import type { PredictionResponse } from "@app-types/routing";
import { predictRoutings } from "@lib/apiClient";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface UsePredictOptions {
  itemCodes: string[];
  topK: number;
  threshold: number;
  featureWeights?: Record<string, number>;
  weightProfile?: string | null;
  modelVersion?: string | null;
  exportFormats?: string[];
  withVisualization?: boolean;
  enabled?: boolean;
}

export function usePredictRoutings({
  itemCodes,
  topK,
  threshold,
  featureWeights,
  weightProfile,
  modelVersion,
  exportFormats,
  withVisualization,
  enabled,
}: UsePredictOptions) {
  return useQuery<PredictionResponse>({
    queryKey: [
      "predict",
      itemCodes,
      topK,
      threshold,
      featureWeights,
      weightProfile,
      modelVersion,
      exportFormats,
      withVisualization,
    ],
    queryFn: () =>
      predictRoutings({
        itemCodes,
        topK,
        threshold,
        featureWeights,
        weightProfile,
        modelVersion,
        exportFormats,
        withVisualization,
      }),
    enabled: enabled ?? (itemCodes.length > 0),
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response && error.response.status >= 400 && error.response.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
  });
}
