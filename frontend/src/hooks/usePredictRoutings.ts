import { useQuery } from "@tanstack/react-query";

import { predictRoutings } from "@lib/apiClient";
import type { PredictionResponse } from "@types/routing";

interface UsePredictOptions {
  itemCodes: string[];
  topK: number;
  threshold: number;
}

export function usePredictRoutings({ itemCodes, topK, threshold }: UsePredictOptions) {
  return useQuery<PredictionResponse>(
    ["predict", itemCodes, topK, threshold],
    () => predictRoutings({ itemCodes, topK, threshold }),
    {
      enabled: itemCodes.length > 0,
      staleTime: 30_000,
    }
  );
}
