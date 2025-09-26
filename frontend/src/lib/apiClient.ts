import axios from "axios";

import type { PredictionResponse } from "@types/routing";

import type { WorkflowConfigPatch, WorkflowConfigResponse } from "@types/workflow";


const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
  timeout: 60_000,
});

export async function predictRoutings(params: {
  itemCodes: string[];
  topK: number;
  threshold: number;
  featureWeights?: Record<string, number>;
  weightProfile?: string | null;
  exportFormats?: string[];
  withVisualization?: boolean;
}): Promise<PredictionResponse> {
  const payload: Record<string, unknown> = {
    item_codes: params.itemCodes,
    top_k: params.topK,
    similarity_threshold: params.threshold,
    with_visualization: params.withVisualization ?? false,
  };
  if (params.featureWeights && Object.keys(params.featureWeights).length > 0) {
    payload.feature_weights = params.featureWeights;
  }
  if (params.weightProfile) {
    payload.weight_profile = params.weightProfile;
  }
  if (params.exportFormats && params.exportFormats.length > 0) {
    payload.export_formats = params.exportFormats;
  }

  const response = await api.post<PredictionResponse>("/predict", payload);
  return response.data;
}

export async function fetchMetrics(): Promise<Record<string, unknown>> {
  const response = await api.get("/metrics");
  return response.data;
}


export async function fetchWorkflowConfig(): Promise<WorkflowConfigResponse> {
  const response = await api.get<WorkflowConfigResponse>("/workflow/graph");
  return response.data;
}

export async function patchWorkflowConfig(
  payload: WorkflowConfigPatch,
): Promise<WorkflowConfigResponse> {
  const response = await api.patch<WorkflowConfigResponse>("/workflow/graph", payload);
  return response.data;
}

export interface TrainingStatus {
  job_id?: string | null;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  progress: number;
  message?: string | null;
  version_path?: string | null;
  metrics: Record<string, unknown>;
}

export interface TrainingRequestPayload {
  version_label?: string | null;
  projector_metadata?: string[];
  dry_run?: boolean;
}

export async function fetchTrainingStatus(): Promise<TrainingStatus> {
  const response = await api.get<TrainingStatus>("/trainer/status");
  return response.data;
}

export async function runTraining(payload: TrainingRequestPayload): Promise<TrainingStatus> {
  const response = await api.post<TrainingStatus>("/trainer/run", payload);
  return response.data;
}

export default api;
