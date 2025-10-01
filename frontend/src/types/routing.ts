export interface TimelineStepMetadata {
  routingSetCode?: string | null;
  variantCode?: string | null;
  primaryRoutingCode?: string | null;
  secondaryRoutingCode?: string | null;
  branchCode?: string | null;
  branchLabel?: string | null;
  branchPath?: string | null;
  queueTime?: number | null;
  moveTime?: number | null;
  machineHours?: number | null;
  actualSetupTime?: number | null;
  actualRunTime?: number | null;
  leadTime?: number | null;
  runTimeQuantity?: number | null;
  runTimeUnit?: string | null;
  insideFlag?: string | null;
  resourceCode?: string | null;
  resourceName?: string | null;
  timeUnit?: string | null;
  milestoneFlag?: string | null;
  inspectionFlag?: string | null;
  sqlValues?: Record<string, unknown> | null;
  extra?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface OperationStep {
  PROC_SEQ: number;
  PROC_CD: string;
  PROC_DESC?: string;
  SETUP_TIME?: number | null;
  RUN_TIME?: number | null;
  WAIT_TIME?: number | null;
  metadata?: TimelineStepMetadata | null;
}

export interface RoutingSummary {
  ITEM_CD: string;
  CANDIDATE_ID?: string | null;
  generated_at?: string;
  operations: OperationStep[];
}

export interface CandidateRouting {
  CANDIDATE_ITEM_CD: string;
  SIMILARITY_SCORE: number;
  RANK: number;
  HAS_ROUTING?: string | null;
  PROCESS_COUNT?: number | null;
  metadata?: Record<string, unknown>;
}

export interface VisualizationSnapshot {
  tensorboard?: string | null;
  neo4j?: {
    workspace?: string | null;
    browser_url?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface FeatureWeightsProfile {
  name: string;
  description?: string;
  weights?: Record<string, number>;
}

export interface FeatureWeightsSummary {
  weights?: Record<string, number>;
  active_features?: Record<string, boolean>;
  profiles?: FeatureWeightsProfile[];
}

export interface ExportErrorInfo {
  path: string;
  error: string;
}

export interface PredictionMetrics {
  requested_items?: number;
  returned_routings?: number;
  returned_candidates?: number;
  threshold?: number;
  generated_at?: string;
  feature_weights?: FeatureWeightsSummary;
  visualization?: VisualizationSnapshot;
  exported_files?: string[];
  export_errors?: ExportErrorInfo[];
}

export interface PredictionResponse {
  items: RoutingSummary[];
  candidates: CandidateRouting[];
  metrics: PredictionMetrics;
}

export interface RoutingInterfaceRequestPayload {
  groupId: string;
  reason?: string;
  exportFormats?: string[];
}

export interface RoutingInterfaceResponse {
  group_id: string;
  exported_files: string[];
  erp_path?: string | null;
  message: string;
}

export interface RoutingGroupStep {
  seq: number;
  process_code: string;
  description?: string | null;
  duration_min?: number | null;
  setup_time?: number | null;
  wait_time?: number | null;
  routing_set_code?: string | null;
  variant_code?: string | null;
  primary_routing_code?: string | null;
  secondary_routing_code?: string | null;
  branch_code?: string | null;
  branch_label?: string | null;
  branch_path?: string | null;
  sql_values?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export type ProcessGroupType = "machining" | "post-process";

export type ProcessGroupColumnType = "string" | "number" | "boolean" | "date";

export interface ProcessGroupColumnDefinition {
  id: string;
  key: string;
  label: string;
  dataType: ProcessGroupColumnType;
  description?: string | null;
}

export interface ProcessGroupDefinition {
  id: string;
  name: string;
  description?: string | null;
  type: ProcessGroupType;
  defaultColumns: ProcessGroupColumnDefinition[];
  fixedValues: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoutingGroupCreatePayload {
  groupName: string;
  itemCodes: string[];
  steps: RoutingGroupStep[];
  erpRequired: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface RoutingGroupCreateResponse {
  group_id: string;
  version: number;
  owner: string;
  updated_at: string;
}

export interface RoutingGroupSummary {
  group_id: string;
  group_name: string;
  item_codes: string[];
  step_count: number;
  version: number;
  updated_at: string;
}

export interface RoutingGroupListResponse {
  items: RoutingGroupSummary[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface RoutingGroupDetail extends RoutingGroupSummary {
  steps: RoutingGroupStep[];
  erp_required: boolean;
  metadata?: Record<string, unknown> | null;
  owner: string;
}
