import { useQuery } from "@tanstack/react-query";

import { predictRoutings } from "@lib/apiClient";
import type { PredictionResponse } from "@app-types/routing";

interface UsePredictOptions {
  itemCodes: string[];
  topK: number;
  threshold: number;
  featureWeights?: Record<string, number>;
  weightProfile?: string | null;
  exportFormats?: string[];
  withVisualization?: boolean;
}

export function usePredictRoutings({
  itemCodes,
  topK,
  threshold,
  featureWeights,
  weightProfile,
  exportFormats,
  withVisualization,
}: UsePredictOptions) {
  return useQuery<PredictionResponse>({
    queryKey: [
      "predict",
      itemCodes,
      topK,
      threshold,
      featureWeights,
      weightProfile,
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
        exportFormats,
        withVisualization,
      }),
    enabled: itemCodes.length > 0,
    staleTime: 30_000,
  });
}
