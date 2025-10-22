import type { AuthenticatedUserPayload, LoginRequestPayload, LoginResponsePayload, RegisterRequestPayload, RegisterResponsePayload, UserSession, UserStatusResponsePayload } from "@app-types/auth";
import type { MasterDataItemResponse, MasterDataLogsResponse, MasterDataTreeResponse } from "@app-types/masterData";
import type { PredictionResponse } from "@app-types/routing";
import type { TrainingStatusMetrics } from "@app-types/training";
import type {
  TensorboardFilterResponse,
  TensorboardMetricSeries,
  TensorboardPointResponse,
  TensorboardProjectorSummary,
  TensorboardConfig,
} from "@app-types/tensorboard";
import axios from "axios";

// Use relative URL to leverage Vite proxy in development
// In production, set VITE_API_URL environment variable
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  timeout: 60_000,
  withCredentials: true,
});

// 401 Unauthorized 에러 핸들링 인터셉터
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      // 401 에러이고, /auth/me 엔드포인트가 아닌 경우에만 처리
      // /auth/me는 fetchCurrentUser에서 이미 처리하므로 제외
      if (error.response?.status === 401 && !error.config?.url?.includes('/auth/me')) {
        // 인증이 필요한 페이지에서 401 에러 발생 시
        // 사용자에게 알림 표시 (콘솔 대신 사용자 친화적 메시지)
        console.warn('인증이 필요합니다. 로그인 페이지로 이동하지 않습니다.');
        // 실제 프로덕션에서는 로그인 페이지로 리다이렉트 가능:
        // window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

const toUserSession = (payload: AuthenticatedUserPayload): UserSession => ({
  username: payload.username,
  displayName: payload.display_name ?? undefined,
  status: payload.status,
  isAdmin: payload.is_admin,
  issuedAt: payload.issued_at,
  expiresAt: payload.expires_at,
});

type TensorboardProjectorPointRequestOptions = {
  filters?: Record<string, string[]>;
  limit?: number;
  offset?: number;
  stride?: number;
  sample?: number;
};

interface ExportTensorboardProjectorPayload {
  sample_every?: number;
  max_rows?: number;
}

const mapProjectorSummary = (payload: Record<string, any>): TensorboardProjectorSummary => ({
  id: payload.id,
  versionLabel: payload.version_label ?? payload.versionLabel ?? null,
  tensorName: payload.tensor_name ?? payload.tensorName ?? "",
  sampleCount: payload.sample_count ?? payload.sampleCount ?? 0,
  updatedAt: payload.updated_at ?? payload.updatedAt ?? null,
});

const mapTensorboardConfig = (payload: Record<string, any>): TensorboardConfig => ({
  projectorPath: payload.projector_path ?? payload.projectorPath ?? "",
  projectorPathExists: Boolean(payload.projector_path_exists ?? payload.projectorPathExists ?? false),
  modelDir: payload.model_dir ?? payload.modelDir ?? "",
});

const mapFilterResponse = (payload: Record<string, any>): TensorboardFilterResponse => ({
  projectorId: payload.projector_id ?? payload.projectorId ?? "",
  fields: Array.isArray(payload.fields) ? payload.fields : [],
});

const mapPointResponse = (payload: Record<string, any>): TensorboardPointResponse => ({
  projectorId: payload.projector_id ?? payload.projectorId ?? "",
  total: payload.total ?? 0,
  limit: payload.limit ?? 0,
  offset: payload.offset ?? 0,
  points: Array.isArray(payload.points) ? payload.points : [],
});

const mapMetricSeries = (series: Record<string, any>): TensorboardMetricSeries => ({
  runId: series.run_id ?? series.runId ?? "",
  metric: series.metric ?? "",
  points: Array.isArray(series.points)
    ? series.points.map((point: Record<string, any>) => ({
        step: point.step ?? 0,
        value: point.value ?? 0,
        timestamp: point.timestamp ?? null,
      }))
    : [],
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
export type OutputProfileColumn = any;
export type WorkflowConfigResponse = any;

export interface DatabaseMetadataColumn {
  name: string;
  type: string;
  nullable?: boolean;
}

export interface DatabaseMetadataResponse {
  table: string;
  columns: DatabaseMetadataColumn[];
  server?: string;
  database?: string;
  updated_at?: string;
}

export interface DatabaseConnectionTestPayload {
  server: string;
  database: string;
  user: string;
  password: string;
  encrypt?: boolean;
  trustCertificate?: boolean;
}

export interface DatabaseConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// MASTER DATA APIs (MSSQL)
// ============================================================================

export async function fetchMasterDataTree(
  query?: string,
  parentType?: string,
  parentId?: string
): Promise<MasterDataTreeResponse> {
  const params: Record<string, string> = {};
  if (query) params.query = query;
  if (parentType) params.parent_type = parentType;
  if (parentId) params.parent_id = parentId;

  const response = await api.get<MasterDataTreeResponse>("/master-data/tree", { params });
  return response.data;
}

export async function fetchMasterDataItem(itemCode: string): Promise<MasterDataItemResponse> {
  const response = await api.get<MasterDataItemResponse>(`/master-data/items/${encodeURIComponent(itemCode)}`);
  return response.data;
}

export async function fetchMasterDataLogs(): Promise<MasterDataLogsResponse> {
  const response = await api.get<MasterDataLogsResponse>("/master-data/logs");
  return response.data;
}

export async function downloadMasterDataLog(): Promise<Blob> {
  const response = await api.get<Blob>("/master-data/logs/download", { responseType: "blob" });
  return response.data;
}

export async function fetchDatabaseMetadata(params?: { table?: string }): Promise<DatabaseMetadataResponse> {
  const response = await api.get<DatabaseMetadataResponse>("/mssql/metadata", {
    params: params ?? {},
  });
  return response.data;
}

export async function testDatabaseConnection(
  payload: DatabaseConnectionTestPayload
): Promise<DatabaseConnectionTestResult> {
  const response = await api.post<DatabaseConnectionTestResult>("/database/test-connection", {
    server: payload.server,
    database: payload.database,
    user: payload.user,
    password: payload.password,
    encrypt: payload.encrypt ?? false,
    trust_certificate: payload.trustCertificate ?? true,
  });
  return response.data;
}

// ============================================================================
// PLACEHOLDER / LEGACY APIs
// ============================================================================

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
  return;
}

export async function postUiAuditBatch(...args: any[]): Promise<void> {
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

export interface OutputProfileListItem {
  id: string;
  name: string;
  description?: string | null;
  format?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OutputProfileMapping {
  source: string;
  mapped: string;
  type: string;
  required: boolean;
  default_value?: string | null;
}

export interface OutputProfileDetail {
  id: string;
  name: string;
  description?: string | null;
  format: string;
  mappings: OutputProfileMapping[];
  created_at?: string;
  updated_at?: string;
  sample?: Array<Record<string, unknown>>;
}

export interface CreateOutputProfilePayload {
  name: string;
  description?: string | null;
  format?: string;
  mappings?: OutputProfileMapping[];
}

export interface CreateOutputProfileResponse {
  id: string;
  name: string;
  description?: string | null;
  format: string;
  created_at: string;
  updated_at: string;
  message: string;
}

export async function fetchOutputProfiles(): Promise<OutputProfileListItem[]> {
  const response = await api.get<OutputProfileListItem[]>("/routing/output-profiles");
  return response.data;
}

export async function fetchOutputProfileDetail(profileId: string): Promise<OutputProfileDetail> {
  const response = await api.get<OutputProfileDetail>(`/routing/output-profiles/${profileId}`);
  return response.data;
}

export async function createOutputProfile(payload: CreateOutputProfilePayload): Promise<CreateOutputProfileResponse> {
  const response = await api.post<CreateOutputProfileResponse>("/routing/output-profiles", {
    name: payload.name,
    description: payload.description ?? null,
    format: payload.format ?? "CSV",
    mappings: payload.mappings ?? [],
  });
  return response.data;
}

export async function generateOutputPreview(payload: {
  profileId?: string | null;
  mappings: Array<{
    source: string;
    mapped: string;
    type: string;
    required: boolean;
    default_value?: string | null;
  }>;
  format: string;
}): Promise<{ rows: Array<Record<string, unknown>>; columns: string[] }> {
  const response = await api.post<{ rows: Array<Record<string, unknown>>; columns: string[] }>(
    "/routing/output-profiles/preview",
    payload
  );
  return response.data;
}

export async function postRoutingSnapshotsBatch(...args: any[]): Promise<any> {
  return { accepted_snapshot_ids: [], accepted_audit_ids: [], updated_groups: [] };
}

// ============================================================================
// DATA MAPPING APIs (데이터 관계 설정)
// ============================================================================

export interface DataRelationshipMapping {
  training_column: string;
  prediction_column?: string | null;
  output_column: string;
  data_type: "string" | "number" | "boolean" | "date";
  is_required: boolean;
  default_value?: string | null;
  transform_rule?: string | null;
  description?: string | null;
}

export interface DataMappingProfile {
  id: string;
  name: string;
  description?: string | null;
  relationships: DataRelationshipMapping[];
  mappings?: any[]; // Legacy field
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_active: boolean;
}

export interface DataMappingProfileCreate {
  name: string;
  description?: string | null;
  relationships?: DataRelationshipMapping[];
  mappings?: any[];
}

export interface DataMappingProfileUpdate {
  name?: string | null;
  description?: string | null;
  relationships?: DataRelationshipMapping[] | null;
  mappings?: any[] | null;
  is_active?: boolean | null;
}

export interface DataMappingProfileListResponse {
  profiles: DataMappingProfile[];
  total: number;
}

export interface DataMappingApplyRequest {
  profile_id: string;
  routing_group_id: string;
  preview_only: boolean;
}

export interface DataMappingApplyResponse {
  profile_id: string;
  routing_group_id: string;
  columns: string[];
  preview_rows: Array<Record<string, any>>;
  total_rows: number;
  csv_path?: string | null;
  message: string;
}

export async function fetchDataMappingProfiles(): Promise<DataMappingProfileListResponse> {
  const response = await api.get<DataMappingProfileListResponse>("/data-mapping/profiles");
  return response.data;
}

export async function fetchDataMappingProfile(profileId: string): Promise<DataMappingProfile> {
  const response = await api.get<DataMappingProfile>(`/data-mapping/profiles/${profileId}`);
  return response.data;
}

export async function createDataMappingProfile(
  payload: DataMappingProfileCreate
): Promise<DataMappingProfile> {
  const response = await api.post<DataMappingProfile>("/data-mapping/profiles", payload);
  return response.data;
}

export async function updateDataMappingProfile(
  profileId: string,
  payload: DataMappingProfileUpdate
): Promise<DataMappingProfile> {
  const response = await api.patch<DataMappingProfile>(`/data-mapping/profiles/${profileId}`, payload);
  return response.data;
}

export async function deleteDataMappingProfile(profileId: string): Promise<void> {
  await api.delete(`/data-mapping/profiles/${profileId}`);
}

export async function applyDataMapping(
  request: DataMappingApplyRequest
): Promise<DataMappingApplyResponse> {
  const response = await api.post<DataMappingApplyResponse>("/data-mapping/apply", request);
  return response.data;
}

// ============================================================================
// TENSORBOARD APIs (Stub implementations)
// ============================================================================

export async function fetchTensorboardProjectors(): Promise<TensorboardProjectorSummary[]> {
  const response = await api.get<Array<Record<string, any>>>("/training/tensorboard/projectors");
  return response.data.map(mapProjectorSummary);
}

export async function fetchTensorboardProjectorFilters(projectorId: string): Promise<TensorboardFilterResponse> {
  const response = await api.get<Record<string, any>>(
    `/training/tensorboard/projectors/${encodeURIComponent(projectorId)}/filters`
  );
  return mapFilterResponse(response.data);
}

export async function fetchTensorboardProjectorPoints(
  projectorId: string,
  options: TensorboardProjectorPointRequestOptions = {}
): Promise<TensorboardPointResponse> {
  const params: Record<string, any> = {};
  if (typeof options.limit === "number") {
    params.limit = options.limit;
  }
  if (typeof options.offset === "number") {
    params.offset = options.offset;
  }
  if (typeof options.stride === "number") {
    params.stride = options.stride;
  }
  if (typeof options.sample === "number") {
    params.sample = options.sample;
  }
  if (options.filters && Object.keys(options.filters).length > 0) {
    params.filters = JSON.stringify(options.filters);
  }

  const response = await api.get<Record<string, any>>(
    `/training/tensorboard/projectors/${encodeURIComponent(projectorId)}/points`,
    { params }
  );
  return mapPointResponse(response.data);
}

export async function fetchTensorboardMetrics(runId: string): Promise<TensorboardMetricSeries[]> {
  const response = await api.get<Array<Record<string, any>>>(`/training/tensorboard/metrics/${encodeURIComponent(runId)}`);
  return response.data.map(mapMetricSeries);
}

export async function exportTensorboardProjector(
  payload: ExportTensorboardProjectorPayload = {}
): Promise<Record<string, any>> {
  const response = await api.post<Record<string, any>>("/training/tensorboard/projectors/export", payload);
  return response.data;
}

export async function fetchTensorboardConfig(): Promise<TensorboardConfig> {
  const response = await api.get<Record<string, any>>("/training/tensorboard/config");
  return mapTensorboardConfig(response.data);
}


export default api;
