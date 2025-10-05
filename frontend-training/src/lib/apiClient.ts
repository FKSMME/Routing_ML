import type { AuthenticatedUserPayload, LoginRequestPayload, LoginResponsePayload, RegisterRequestPayload, RegisterResponsePayload, UserSession, UserStatusResponsePayload } from "@app-types/auth";
import type { PredictionResponse } from "@app-types/routing";
import type { TrainingStatusMetrics } from "@app-types/training";
import axios from "axios";

// Use relative URL to leverage Vite proxy in development
// In production, set VITE_API_URL environment variable
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  timeout: 60_000,
  withCredentials: true,
});

const toUserSession = (payload: AuthenticatedUserPayload): UserSession => ({
  username: payload.username,
  displayName: payload.display_name ?? undefined,
  status: payload.status,
  isAdmin: payload.is_admin,
  issuedAt: payload.issued_at,
  expiresAt: payload.expires_at,
});

export async function registerUser(payload: RegisterRequestPayload): Promise<RegisterResponsePayload> {
  const response = await api.post<RegisterResponsePayload>("/auth/register", {
    username: payload.username,
    password: payload.password,
    display_name: payload.displayName ?? undefined,
  });
  return response.data;
}

export async function loginUser(payload: LoginRequestPayload): Promise<LoginResponsePayload> {
  const response = await api.post<LoginResponsePayload>("/auth/login", payload);
  return response.data;
}

export async function logoutUser(): Promise<void> {
  await api.post("/auth/logout");
}

export async function fetchCurrentUser(): Promise<UserSession | null> {
  try {
    const response = await api.get<AuthenticatedUserPayload>("/auth/me");
    return toUserSession(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function approveUserAccount(payload: { username: string; makeAdmin?: boolean }): Promise<UserStatusResponsePayload> {
  const response = await api.post<UserStatusResponsePayload>("/auth/admin/approve", {
    username: payload.username,
    make_admin: payload.makeAdmin ?? false,
  });
  return response.data;
}

export async function rejectUserAccount(payload: { username: string; reason?: string | null }): Promise<UserStatusResponsePayload> {
  const response = await api.post<UserStatusResponsePayload>("/auth/admin/reject", {
    username: payload.username,
    reason: payload.reason ?? null,
  });
  return response.data;
}

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

  const response = await api.post<PredictionResponse>("/predict", payload, { timeout: 20_000 });
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
  metrics: TrainingStatusMetrics;
  latest_version?: Record<string, unknown> | null;
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

export interface TrainingMetricCard {
  id?: string;
  title: string;
  value: string | number;
  subtitle?: string | null;
}

export interface TrainingMetricTrendPoint {
  timestamp: string;
  value: number;
  label?: string | null;
}

export interface TrainingHeatmapPayload {
  xLabels: string[];
  yLabels: string[];
  values: number[][];
  unit?: string | null;
  label?: string | null;
}

export interface TrainingMetricsResponse {
  cards?: TrainingMetricCard[];
  tensorboard_url?: string | null;
  metric_trend?: TrainingMetricTrendPoint[];
  metric_trend_label?: string | null;
  heatmap?: TrainingHeatmapPayload | null;
}

export interface TrainingFeatureWeight {
  id: string;
  label: string;
  weight: number;
  enabled: boolean;
  description?: string | null;
}

export interface TrainingRunRecord {
  id?: string;
  timestamp: string;
  user: string;
  result: string;
  duration_seconds?: number | null;
  duration_label?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface TrainingFeaturePatchRequest {
  features: Record<string, boolean>;
}

export interface TrainingFeaturePatchResponse {
  updated: string[];
  disabled?: string[];
  timestamp: string;
}

export async function fetchTrainingMetrics(): Promise<TrainingMetricsResponse> {
  const response = await api.get<TrainingMetricsResponse>("/trainer/metrics");
  return response.data;
}

export async function fetchTrainingFeatureWeights(): Promise<TrainingFeatureWeight[]> {
  const response = await api.get<TrainingFeatureWeight[] | { features?: TrainingFeatureWeight[] }>(
    "/training/features",
  );
  const payload = response.data;
  return Array.isArray(payload) ? payload : payload.features ?? [];
}

export async function fetchTrainingRunHistory(limit = 10): Promise<TrainingRunRecord[]> {
  const response = await api.get<TrainingRunRecord[] | { runs?: TrainingRunRecord[] }>("/trainer/runs", {
    params: { limit },
  });
  const payload = response.data;
  return Array.isArray(payload) ? payload : payload.runs ?? [];
}

export async function patchTrainingFeatures(
  payload: TrainingFeaturePatchRequest,
): Promise<TrainingFeaturePatchResponse> {
  const response = await api.patch<TrainingFeaturePatchResponse>("/training/features", payload);
  return response.data;
}


export async function runTraining(payload: TrainingRequestPayload): Promise<TrainingStatus> {
  const response = await api.post<TrainingStatus>("/trainer/run", payload);
  return response.data;
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type WorkspaceSettingsResponse = any;
export type AccessMetadataResponse = any;
export type OutputProfileColumn = any;
export type WorkflowConfigResponse = any;

// ============================================================================
// STUB FUNCTIONS FOR REMOVED APIs
// These are kept to prevent import errors but will throw or return empty data
// ============================================================================

export async function fetchMasterDataTree(...args: any[]): Promise<any> {
  throw new Error("Master data API removed - feature not available");
}

export async function fetchMasterDataItem(...args: any[]): Promise<any> {
  throw new Error("Master data API removed - feature not available");
}

export async function fetchMasterDataLogs(...args: any[]): Promise<any> {
  throw new Error("Master data API removed - feature not available");
}

export async function downloadMasterDataLog(...args: any[]): Promise<any> {
  throw new Error("Master data API removed - feature not available");
}

export async function fetchWorkflowConfig(...args: any[]): Promise<any> {
  throw new Error("Workflow API removed - feature not available");
}

export async function patchWorkflowConfig(...args: any[]): Promise<any> {
  throw new Error("Workflow API removed - feature not available");
}

export async function regenerateWorkflowCode(...args: any[]): Promise<any> {
  throw new Error("Workflow API removed - feature not available");
}

export async function fetchWorkspaceSettings(...args: any[]): Promise<any> {
  return {};
}

export async function saveWorkspaceSettings(...args: any[]): Promise<any> {
  return { updated_at: new Date().toISOString() };
}

export async function postUiAudit(...args: any[]): Promise<void> {
  // Silently ignore audit calls
  return;
}

export async function postUiAuditBatch(...args: any[]): Promise<void> {
  // Silently ignore audit calls
  return;
}

export async function createRoutingGroup(...args: any[]): Promise<any> {
  throw new Error("Routing groups API removed - feature not available");
}

export async function fetchRoutingGroup(...args: any[]): Promise<any> {
  throw new Error("Routing groups API removed - feature not available");
}

export async function listRoutingGroups(...args: any[]): Promise<any> {
  return { groups: [], total: 0 };
}

export async function triggerRoutingInterface(...args: any[]): Promise<any> {
  throw new Error("Routing interface API removed - feature not available");
}

export async function testAccessConnection(...args: any[]): Promise<any> {
  throw new Error("Access connection API removed - feature not available");
}

export async function fetchAccessMetadata(...args: any[]): Promise<any> {
  throw new Error("Access metadata API removed - feature not available");
}

export async function fetchOutputProfiles(...args: any[]): Promise<any> {
  return [];
}

export async function fetchOutputProfileDetail(...args: any[]): Promise<any> {
  throw new Error("Output profiles API removed - feature not available");
}

export async function generateOutputPreview(...args: any[]): Promise<any> {
  return { columns: [], rows: [] };
}

export async function postRoutingSnapshotsBatch(...args: any[]): Promise<any> {
  return { accepted_snapshot_ids: [], accepted_audit_ids: [], updated_groups: [] };
}

export default api;
