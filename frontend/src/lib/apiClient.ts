import axios from "axios";

import type { PredictionResponse } from "@types/routing";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
  timeout: 60_000,
});

export async function predictRoutings(params: {
  itemCodes: string[];
  topK: number;
  threshold: number;
}): Promise<PredictionResponse> {
  const response = await api.post<PredictionResponse>("/predict", {
    item_codes: params.itemCodes,
    top_k: params.topK,
    similarity_threshold: params.threshold,
  });
  return response.data;
}

export async function fetchMetrics(): Promise<Record<string, unknown>> {
  const response = await api.get("/metrics");
  return response.data;
}

export default api;
