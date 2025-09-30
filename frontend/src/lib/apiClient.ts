import type { AuthenticatedUserPayload, LoginRequestPayload, LoginResponsePayload, RegisterRequestPayload, RegisterResponsePayload, UserSession, UserStatusResponsePayload } from "@app-types/auth";
import type { MasterDataItemResponse, MasterDataLogsResponse, MasterDataTreeResponse } from "@app-types/masterData";
import type {
  PredictionResponse,
  RoutingGroupCreatePayload,
  RoutingGroupCreateResponse,
  RoutingGroupDetail,
  RoutingGroupListResponse,
  RoutingGroupStep,
  RoutingInterfaceRequestPayload,
  RoutingInterfaceResponse,
} from "@app-types/routing";
import type { TrainingStatusMetrics } from "@app-types/training";
import type {
  WorkflowCodeSyncResponse,
  WorkflowConfigPatch,
  WorkflowConfigResponse,
} from "@app-types/workflow";
import axios from "axios";

const fallbackProtocol =
  typeof window !== "undefined" && window.location.protocol
    ? window.location.protocol
    : "http:";
const fallbackHost =
  typeof window !== "undefined" && window.location.hostname
    ? window.location.hostname
    : "10.204.2.28";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ?? `${fallbackProtocol}//${fallbackHost}:8000/api`,
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

  const response = await api.post<PredictionResponse>("/predict", payload);
  return response.data;
}

export async function fetchMetrics(): Promise<Record<string, unknown>> {
  const response = await api.get("/metrics");
  return response.data;
}

export async function fetchWorkflowConfig(): Promise<WorkflowConfigResponse> {
  const response = await api.get<WorkflowConfigResponse>("/workflow/config");
  return response.data;
}

export async function patchWorkflowConfig(
  payload: WorkflowConfigPatch,
): Promise<WorkflowConfigResponse> {
  const response = await api.patch<WorkflowConfigResponse>("/workflow/config", payload);
  return response.data;
}

export async function regenerateWorkflowCode(): Promise<WorkflowCodeSyncResponse> {
  const response = await api.post<WorkflowCodeSyncResponse>("/workflow/code");
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

export async function fetchMasterDataTree(params?: {
  query?: string;
  parentId?: string;
  parentType?: "group" | "family";
}): Promise<MasterDataTreeResponse> {
  const response = await api.get<MasterDataTreeResponse>("/master-data/tree", {
    params: {
      ...(params?.query ? { query: params.query } : {}),
      ...(params?.parentId ? { parent_id: params.parentId } : {}),
      ...(params?.parentType ? { parent_type: params.parentType } : {}),
    },
  });
  return response.data;
}

export async function fetchMasterDataItem(itemCode: string): Promise<MasterDataItemResponse> {
  const response = await api.get<MasterDataItemResponse>(`/master-data/items/${encodeURIComponent(itemCode)}`);
  return response.data;
}

export async function fetchMasterDataLogs(limit = 5): Promise<MasterDataLogsResponse> {
  const response = await api.get<MasterDataLogsResponse>("/master-data/logs", { params: { limit } });
  return response.data;
}

export async function downloadMasterDataLog(): Promise<void> {
  const response = await api.get<Blob>("/master-data/logs/download", { responseType: "blob" });
  const blob = new Blob([response.data], { type: response.headers["content-type"] || "text/plain" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const disposition = response.headers["content-disposition"];
  const filename = disposition?.split("filename=")?.[1]?.replace(/"/g, "").trim() || "master_data.log";
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function runTraining(payload: TrainingRequestPayload): Promise<TrainingStatus> {
  const response = await api.post<TrainingStatus>("/trainer/run", payload);
  return response.data;
}

export default api;

const mapGroupStepToApi = (step: RoutingGroupStep) => ({
  seq: step.seq,
  process_code: step.process_code,
  description: step.description ?? null,
  duration_min: step.duration_min ?? null,
  setup_time: step.setup_time ?? null,
  wait_time: step.wait_time ?? null,
  metadata: step.metadata ?? undefined,
});

export async function createRoutingGroup(payload: RoutingGroupCreatePayload): Promise<RoutingGroupCreateResponse> {
  const response = await api.post<RoutingGroupCreateResponse>("/routing/groups", {
    group_name: payload.groupName,
    item_codes: payload.itemCodes,
    steps: payload.steps.map((step) => mapGroupStepToApi(step)),
    erp_required: payload.erpRequired,
    metadata: payload.metadata ?? undefined,
  });
  return response.data;
}

export async function triggerRoutingInterface(
  payload: RoutingInterfaceRequestPayload,
): Promise<RoutingInterfaceResponse> {
  const response = await api.post<RoutingInterfaceResponse>("/routing/interface", {
    group_id: payload.groupId,
    reason: payload.reason ?? undefined,
    export_formats: payload.exportFormats ?? undefined,
  });
  return response.data;
}

export async function listRoutingGroups(params?: {
  owner?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<RoutingGroupListResponse> {
  const response = await api.get<RoutingGroupListResponse>("/routing/groups", { params });
  return response.data;
}

export async function fetchRoutingGroup(groupId: string): Promise<RoutingGroupDetail> {
  const response = await api.get<RoutingGroupDetail>(`/routing/groups/${encodeURIComponent(groupId)}`);
  return response.data;
}
export interface WorkspaceSettingsPayload {
  version?: number | string;
  layout?: Record<string, unknown> | null;
  routing?: Record<string, unknown> | null;
  algorithm?: Record<string, unknown> | null;
  options?: Record<string, unknown> | null;
  export?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  access?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface WorkspaceSettingsResponse extends WorkspaceSettingsPayload {
  updated_at?: string;
  user?: string | null;
}

export interface UiAuditEventPayload {
  action: string;
  username?: string;
  ip_address?: string;
  payload?: Record<string, unknown> | null;
}

export interface UiAuditBatchPayload {
  events: UiAuditEventPayload[];
  source?: string;
}

export interface RoutingSnapshotPayload {
  id: string;
  created_at: string;
  reason?: string;
  version?: number;
  state: Record<string, unknown>;
}

export interface RoutingAuditPayload {
  id: string;
  action: string;
  level: "info" | "error";
  message?: string;
  context?: Record<string, unknown>;
  created_at: string;
}

export interface RoutingSnapshotBatchPayload {
  snapshots: RoutingSnapshotPayload[];
  audits?: RoutingAuditPayload[];
  source?: string;
}

export interface RoutingSnapshotGroupUpdate {
  group_id: string;
  version: number;
  dirty: boolean;
  updated_at?: string;
  snapshot_id?: string | null;
}

export interface RoutingSnapshotBatchResponse {
  accepted_snapshot_ids?: string[];
  accepted_audit_ids?: string[];
  updated_groups?: RoutingSnapshotGroupUpdate[];
}

export interface AccessConnectionRequest {
  path: string;
  table?: string | null;
}

export interface AccessConnectionResponse {
  ok: boolean;
  message: string;
  path_hash?: string;
  table_profiles?: string[];
  elapsed_ms?: number;
  verified_table?: string | null;
}

export async function fetchWorkspaceSettings(): Promise<WorkspaceSettingsResponse> {
  const response = await api.get<WorkspaceSettingsResponse>("/settings/workspace");
  return response.data;
}

export async function saveWorkspaceSettings(payload: WorkspaceSettingsPayload): Promise<WorkspaceSettingsResponse> {
  const response = await api.put<WorkspaceSettingsResponse>("/settings/workspace", payload);
  return response.data;
}

export async function postUiAuditBatch(payload: UiAuditBatchPayload): Promise<void> {
  if (!payload.events || payload.events.length === 0) {
    return;
  }
  await api.post("/audit/ui/batch", payload);
}

export async function postUiAudit(event: UiAuditEventPayload): Promise<void> {
  await postUiAuditBatch({ events: [event] });
}

export async function postRoutingSnapshotsBatch(
  payload: RoutingSnapshotBatchPayload,
): Promise<RoutingSnapshotBatchResponse> {
  const response = await api.post<RoutingSnapshotBatchResponse>("/routing/groups/snapshots", payload);
  return response.data;
}

export async function testAccessConnection(payload: AccessConnectionRequest): Promise<AccessConnectionResponse> {
  const response = await api.post<AccessConnectionResponse>("/access/connection/test", payload);
  return response.data;
}
export interface AccessMetadataResponse {
  table: string;
  columns: Array<{
    name: string;
    type: string;
    nullable?: boolean;
  }>;
  path?: string | null;
  updated_at?: string;
}

export async function fetchAccessMetadata(params?: { table?: string; path?: string }): Promise<AccessMetadataResponse> {
  const response = await api.get<AccessMetadataResponse>("/access/metadata", { params });
  return response.data;
}

export interface OutputProfileSummary {
  id: string;
  name: string;
  description?: string | null;
  format?: string | null;
  updated_at?: string | null;
}

export interface OutputProfileColumn {
  source: string;
  mapped: string;
  type?: string | null;
  required?: boolean;
}

export interface OutputProfileDetail extends OutputProfileSummary {
  mappings: OutputProfileColumn[];
  sample?: Array<Record<string, unknown>>;
}

export interface OutputPreviewRequest {
  profileId?: string | null;
  mappings: OutputProfileColumn[];
  format?: string | null;
  limit?: number;
}

export interface OutputPreviewResponse {
  format?: string | null;
  columns?: string[] | null;
  rows?: Array<Record<string, unknown>>;
  sample?: Array<Record<string, unknown>>;
  data?: Array<Record<string, unknown>>;
  preview?: Array<Record<string, unknown>>;
}

const isOutputProfileDetail = (value: unknown): value is OutputProfileDetail => {
  if (!value || typeof value !== "object") {
    return false;
  }
  return Array.isArray((value as OutputProfileDetail).mappings);
};

export async function fetchOutputProfiles(): Promise<OutputProfileSummary[]> {
  const response = await api.get<{ profiles?: OutputProfileSummary[] } | OutputProfileSummary[]>("/routing/output-profiles");
  const payload = response.data;
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.profiles)) {
    return payload.profiles;
  }
  return [];
}

export async function fetchOutputProfileDetail(profileId: string): Promise<OutputProfileDetail> {
  const { data } = await api.get<OutputProfileDetail | { profile: OutputProfileDetail }>(
    `/routing/output-profiles/${encodeURIComponent(profileId)}`,
  );

  if (typeof data === "object" && data !== null && "profile" in data) {
    const maybeProfile = (data as { profile?: unknown }).profile;
    if (isOutputProfileDetail(maybeProfile)) {
      return maybeProfile;
    }
  }

  if (isOutputProfileDetail(data)) {
    return data;
  }

  throw new Error("Unexpected output profile response shape");
}

export async function generateOutputPreview(
  payload: OutputPreviewRequest,
): Promise<{ columns: string[]; rows: Array<Record<string, unknown>>; format?: string | null }> {
  const response = await api.post<OutputPreviewResponse | Array<Record<string, unknown>>>(
    "/routing/output-profiles/preview",
    {
      profile_id: payload.profileId ?? null,
      mappings: payload.mappings,
      format: payload.format ?? null,
      limit: payload.limit ?? 5,
    },
  );

  const data = response.data;

  if (Array.isArray(data)) {
    const columns = data[0] ? Object.keys(data[0]) : [];
    return { columns, rows: data, format: payload.format ?? null };
  }

  const rows = data.rows ?? data.sample ?? data.data ?? data.preview ?? [];
  const columns = data.columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  return { columns, rows, format: data.format ?? payload.format ?? null };
}
