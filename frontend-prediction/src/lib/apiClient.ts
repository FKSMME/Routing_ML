import type { AuthenticatedUserPayload, ChangePasswordRequestPayload, ChangePasswordResponsePayload, LoginRequestPayload, LoginResponsePayload, RegisterRequestPayload, RegisterResponsePayload, UserSession, UserStatusResponsePayload } from "@app-types/auth";
import type { MasterDataItemResponse, MasterDataLogsResponse, MasterDataTreeResponse } from "@app-types/masterData";
import type { PredictionResponse } from "@app-types/routing";
import type { TrainingStatusMetrics } from "@app-types/training";
import type {
  WorkflowCodeSyncResponse,
  WorkflowConfigPatch,
  WorkflowConfigResponse,
} from "@app-types/workflow";
import axios from "axios";

export interface ViewExplorerView {
  schema_name: string;
  view_name: string;
  full_name: string;
  definition?: string | null;
}

export interface ViewExplorerColumn {
  name: string;
  type: string;
  max_length?: number | null;
  precision?: number | null;
  scale?: number | null;
}

export interface ViewExplorerSampleResponse {
  view_name: string;
  columns: ViewExplorerColumn[];
  data: Array<Record<string, unknown>>;
  row_count: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
  has_next?: boolean;
}

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

export async function changePassword(payload: ChangePasswordRequestPayload): Promise<ChangePasswordResponsePayload> {
  const response = await api.post<ChangePasswordResponsePayload>("/auth/change-password", payload);
  return response.data;
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
  modelVersion?: string | null;
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
  if (params.modelVersion) {
    payload.model_version = params.modelVersion;
  }
  if (params.exportFormats && params.exportFormats.length > 0) {
    payload.export_formats = params.exportFormats;
  }

  const response = await api.post<PredictionResponse>("/predict", payload, { timeout: 20_000 });
  return response.data;
}

export async function fetchViewExplorerViews(): Promise<ViewExplorerView[]> {
  const response = await api.get<ViewExplorerView[]>("/view-explorer/views");
  return response.data;
}

export interface ViewExplorerSampleRequestOptions {
  limit?: number;
  page?: number;
  pageSize?: number;
  search?: string;
  searchColumn?: string;
}

export async function fetchViewExplorerSample(
  viewName: string,
  options: ViewExplorerSampleRequestOptions = {},
): Promise<ViewExplorerSampleResponse> {
  const encodedViewName = encodeURIComponent(viewName);
  const params: Record<string, unknown> = {};
  if (options.limit != null) {
    params.limit = options.limit;
  }
  if (options.page != null) {
    params.page = options.page;
  }
  if (options.pageSize != null) {
    params.page_size = options.pageSize;
  }
  if (options.search && options.search.length > 0) {
    params.search = options.search;
  }
  if (options.searchColumn && options.searchColumn.length > 0) {
    params.search_column = options.searchColumn;
  }
  const response = await api.get<ViewExplorerSampleResponse>(
    `/view-explorer/views/${encodedViewName}/sample`,
    {
      params,
    },
  );
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

export interface WorkspaceColumnMappingPayload {
  scope: string;
  source: string;
  target: string;
}

export interface WorkspaceOptionsPayload {
  standard: string[];
  similarity: string[];
  offline_dataset_path: string | null;
  database_target_table: string | null;
  erp_interface: boolean;
  column_mappings: WorkspaceColumnMappingPayload[];
}

export interface WorkspaceAccessPayload {
  path: string | null;
  table: string | null;
}

export interface WorkspaceSettingsPayload {
  version: number | string;
  layout?: Record<string, unknown>;
  routing?: Record<string, unknown>;
  algorithm?: Record<string, unknown>;
  options?: WorkspaceOptionsPayload;
  access?: WorkspaceAccessPayload;
  metadata?: Record<string, unknown>;
  output?: Record<string, unknown>;
}

export interface WorkspaceOptionsResponse {
  standard?: unknown;
  similarity?: unknown;
  offline_dataset_path?: string | null;
  database_target_table?: string | null;
  erp_interface?: boolean;
  column_mappings?: unknown;
  [key: string]: unknown;
}

export interface WorkspaceDataSourceSettings {
  offline_dataset_path?: string | null;
  [key: string]: unknown;
}

export interface WorkspaceExportSettings {
  database_target_table?: string | null;
  erp_interface_enabled?: boolean;
  [key: string]: unknown;
}

export interface WorkspaceSettingsResponse {
  version?: number | string;
  options?: WorkspaceOptionsResponse;
  data_source?: WorkspaceDataSourceSettings;
  export?: WorkspaceExportSettings;
  access?: WorkspaceAccessPayload;
  metadata?: Record<string, unknown>;
  updated_at: string;
  user?: string;
}

export interface UiAuditEvent {
  action: string;
  username?: string;
  entity?: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface UiAuditBatchRequest {
  events: UiAuditEvent[];
  source?: string;
}

export interface RoutingSnapshotsBatchResponse {
  accepted_snapshot_ids: string[];
  accepted_audit_ids: string[];
  updated_groups: string[];
}

export interface RoutingInterfaceRequest {
  groupId: string;
  reason?: string;
}

export interface RoutingInterfaceResponse {
  message?: string;
  erp_path?: string;
  [key: string]: unknown;
}

export interface RoutingGroupListResponse {
  groups: Array<Record<string, unknown>>;
  total: number;
}

export type OutputProfileColumn = OutputProfileMapping;

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

export async function fetchWorkflowConfig(): Promise<WorkflowConfigResponse> {
  throw new Error("Workflow API removed - feature not available");
}

export async function patchWorkflowConfig(_payload: WorkflowConfigPatch): Promise<WorkflowConfigResponse> {
  throw new Error("Workflow API removed - feature not available");
}

export async function regenerateWorkflowCode(): Promise<WorkflowCodeSyncResponse> {
  throw new Error("Workflow API removed - feature not available");
}

export async function fetchWorkspaceSettings(): Promise<WorkspaceSettingsResponse> {
  return {
    version: Date.now(),
    options: {
      standard: [],
      similarity: [],
      offline_dataset_path: null,
      database_target_table: null,
      erp_interface: false,
      column_mappings: [],
    },
    data_source: { offline_dataset_path: null },
    export: { database_target_table: null, erp_interface_enabled: false },
    access: { path: null, table: null },
    updated_at: new Date().toISOString(),
  };
}

export async function saveWorkspaceSettings(payload: WorkspaceSettingsPayload): Promise<WorkspaceSettingsResponse> {
  const options: WorkspaceOptionsPayload = payload.options ?? {
    standard: [],
    similarity: [],
    offline_dataset_path: null,
    database_target_table: null,
    erp_interface: false,
    column_mappings: [],
  };
  const access: WorkspaceAccessPayload = payload.access ?? { path: null, table: null };
  return {
    version: payload.version,
    options: {
      standard: options.standard,
      similarity: options.similarity,
      offline_dataset_path: options.offline_dataset_path,
      database_target_table: options.database_target_table,
      erp_interface: options.erp_interface,
      column_mappings: options.column_mappings,
    },
    data_source: { offline_dataset_path: access.path },
    export: {
      database_target_table: options.database_target_table,
      erp_interface_enabled: options.erp_interface,
    },
    access,
    metadata: payload.metadata,
    updated_at: new Date().toISOString(),
  };
}

export async function postUiAudit(_event: UiAuditEvent): Promise<void> {
  return;
}

export async function postUiAuditBatch(_request: UiAuditBatchRequest): Promise<void> {
  return;
}

export async function createRoutingGroup(): Promise<never> {
  throw new Error("Routing groups API removed - feature not available");
}

export async function fetchRoutingGroup(): Promise<never> {
  throw new Error("Routing groups API removed - feature not available");
}

export async function listRoutingGroups(): Promise<RoutingGroupListResponse> {
  return { groups: [], total: 0 };
}

export async function triggerRoutingInterface(
  _request: RoutingInterfaceRequest
): Promise<RoutingInterfaceResponse> {
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

export async function postRoutingSnapshotsBatch(): Promise<RoutingSnapshotsBatchResponse> {
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
  mappings?: unknown[]; // Legacy field
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_active: boolean;
}

export interface DataMappingProfileCreate {
  name: string;
  description?: string | null;
  relationships?: DataRelationshipMapping[];
  mappings?: unknown[];
}

export interface DataMappingProfileUpdate {
  name?: string | null;
  description?: string | null;
  relationships?: DataRelationshipMapping[] | null;
  mappings?: unknown[] | null;
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
  preview_rows: Array<Record<string, unknown>>;
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
// ITERATIVE TRAINING QUALITY APIs
// ============================================================================

export interface AlertItem {
  item_cd: string;
  proc_cd?: string | null;
  issue: string;
  value: number;
  threshold: number;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface QualityMetrics {
  cycle_id: string;
  sample_size: number;
  strategy: "random" | "stratified" | "recent_bias";
  mae: number;
  trim_mae: number;
  rmse: number;
  process_match: number;
  outsourcing_success: number;
  cv: number;
  sample_count: number;
  alerts: AlertItem[];
  timestamp: string;
  duration_seconds: number;
  items_evaluated: number;
  items_failed: number;
  metadata?: Record<string, unknown>;
}

export interface QualityCycle {
  cycle_id: string;
  timestamp: string;
  metrics: QualityMetrics;
}

export interface QualityHistoryResponse {
  cycles: QualityCycle[];
  total: number;
  start_date?: string;
  end_date?: string;
}

// ============================================================================
// DATA QUALITY APIs
// ============================================================================

export interface DataQualityMetrics {
  completeness: number;
  consistency: number;
  validity: number;
  timestamp: string;
  trends?: {
    completeness: number[];
    consistency: number[];
    validity: number[];
  };
}

export interface DataQualityIssue {
  id: string;
  severity: "critical" | "warning" | "info";
  type: string;
  message: string;
  affectedRecords: number;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface DataQualityReport {
  issues: DataQualityIssue[];
  summary: {
    critical: number;
    warning: number;
    info: number;
  };
  lastCheck: string;
}

export interface ComponentHealth {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  lastCheck: string;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  components: {
    database: ComponentHealth;
    api: ComponentHealth;
    workers: ComponentHealth;
  };
  timestamp: string;
}

export async function fetchDataQualityMetrics(): Promise<DataQualityMetrics> {
  const response = await api.get<DataQualityMetrics>("/data-quality/metrics");
  return response.data;
}

export async function fetchDataQualityReport(): Promise<DataQualityReport> {
  const response = await api.get<DataQualityReport>("/data-quality/report");
  return response.data;
}

export async function fetchPrometheusMetrics(): Promise<string> {
  const response = await api.get<string>("/data-quality/prometheus");
  return response.data;
}

export async function fetchDataQualityHealth(): Promise<HealthStatus> {
  const response = await api.get<HealthStatus>("/data-quality/health");
  return response.data;
}

export interface HistoricalMetricsParams {
  startDate: string; // ISO format
  endDate: string; // ISO format
  interval?: "1h" | "6h" | "1d"; // Data point interval
}

export interface HistoricalMetricsDataPoint {
  timestamp: string;
  metrics: DataQualityMetrics;
}

export interface HistoricalIssuesDataPoint {
  timestamp: string;
  issues: DataQualityIssue[];
}

export interface HistoricalMetricsResponse {
  dataPoints: HistoricalMetricsDataPoint[];
  startDate: string;
  endDate: string;
  interval: string;
}

export interface HistoricalIssuesResponse {
  dataPoints: HistoricalIssuesDataPoint[];
  startDate: string;
  endDate: string;
  interval: string;
}

export async function fetchHistoricalMetrics(params: HistoricalMetricsParams): Promise<HistoricalMetricsResponse> {
  const response = await api.get<HistoricalMetricsResponse>("/data-quality/historical/metrics", {
    params: {
      start_date: params.startDate,
      end_date: params.endDate,
      interval: params.interval ?? "1h",
    },
  });
  return response.data;
}

export async function fetchHistoricalIssues(params: HistoricalMetricsParams): Promise<HistoricalIssuesResponse> {
  const response = await api.get<HistoricalIssuesResponse>("/data-quality/historical/issues", {
    params: {
      start_date: params.startDate,
      end_date: params.endDate,
      interval: params.interval ?? "1h",
    },
  });
  return response.data;
}

// ============================================================================
// DRAWING VIEWER API (ERP Integration)
// ============================================================================

export interface DrawingInfo {
  /**
   * 도면 번호 (DRAW_NO)
   */
  drawingNumber: string;

  /**
   * 리비전 (DRAW_REV)
   */
  revision: string;

  /**
   * 시트 번호 (DRAW_SHEET_NO)
   */
  sheetNumber: string;

  /**
   * 도면 정보 사용 가능 여부
   */
  available: boolean;
}

/**
 * 품목의 도면 정보를 조회합니다.
 *
 * MSSQL item_info 테이블에서 DRAW_NO, DRAW_REV, DRAW_SHEET_NO를 조회합니다.
 *
 * @param itemCode - 품목 코드
 * @returns 도면 정보
 */
export async function fetchDrawingInfo(itemCode: string): Promise<DrawingInfo> {
  const response = await api.get<DrawingInfo>(`/items/${itemCode}/drawing-info`);
  return response.data;
}

// ============================================================================
// MODEL STATUS API (Phase 2 Task 2.2)
// ============================================================================

export interface ModelStatus {
  loaded: boolean;
  model_dir: string | null;
  loaded_at: string | null;
  version: string | null;
  is_enhanced: boolean;
}

/**
 * 현재 로딩된 모델 상태 정보를 조회합니다.
 *
 * @returns 모델 상태 정보
 */
export async function fetchModelStatus(): Promise<ModelStatus> {
  const response = await api.get<ModelStatus>("/model/status");
  return response.data;
}

// ============================================================================
// MODEL VERSIONS API (Phase 7)
// ============================================================================

export interface ModelVersion {
  version_name: string;
  artifact_dir: string;
  manifest_path: string;
  status: string;
  active_flag: boolean;
  requested_by: string | null;
  created_at: string;
  trained_at: string | null;
  activated_at: string | null;
  updated_at: string | null;
}

export interface ModelListResponse {
  models: ModelVersion[];
  active_model: ModelVersion | null;
  total: number;
}

/**
 * 사용 가능한 모델 버전 목록을 조회합니다.
 *
 * @param limit 조회할 최대 개수 (선택 사항)
 * @returns 모델 버전 목록
 */
export async function fetchModelVersions(limit?: number): Promise<ModelListResponse> {
  const params = limit ? { limit } : {};
  const response = await api.get<ModelListResponse>("/models", { params });
  return response.data;
}

/**
 * 현재 활성화된 모델 버전을 조회합니다.
 *
 * @returns 활성 모델 버전 (없으면 null)
 */
export async function fetchActiveModel(): Promise<ModelVersion | null> {
  const response = await api.get<ModelVersion | null>("/models/active");
  return response.data;
}


export default api;
