export interface WorkflowGraphNode {
  id: string;
  label: string;
  type: string;
  category?: string;
  status?: string;
  position?: { x: number; y: number };
  settings: Record<string, unknown>;
  metrics: Record<string, unknown>;
  doc_refs: string[];
}

export interface WorkflowGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: string;
  label?: string;
}

export interface WorkflowGraphModel {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  design_refs: string[];
  last_saved?: string | null;
}

export interface TrainerRuntimeModel {
  similarity_threshold: number;
  trim_std_enabled: boolean;
  trim_lower_percent: number;
  trim_upper_percent: number;
}

export interface PredictorRuntimeModel {
  similarity_high_threshold: number;
  max_routing_variants: number;
  trim_std_enabled: boolean;
  trim_lower_percent: number;
  trim_upper_percent: number;
}

export interface PowerQueryProfile {
  name: string;
  description?: string | null;
  mapping: Record<string, string>;
}

export interface SQLConfigModel {
  output_columns: string[];
  column_aliases: Record<string, string>;
  available_columns: string[];
  profiles: PowerQueryProfile[];
  active_profile?: string | null;
  exclusive_column_groups: string[][];
  key_columns: string[];
  training_output_mapping: Record<string, string>;
}

export interface BlueprintToggle {
  id: string;
  label: string;
  enabled: boolean;
  description?: string | null;
  shade?: string | null;
  accent?: string | null;
}

export interface DataSourceTableProfile {
  name: string;
  label: string;
  role: "features" | "routing" | "results" | "aux";
  required: boolean;
  columns: string[];
  description?: string | null;
}

export interface DataSourceConfigModel {
  offline_dataset_path?: string | null;
  default_table: string;
  backup_paths: string[];
  table_profiles: DataSourceTableProfile[];
  column_overrides: Record<string, string[]>;
  allow_gui_override: boolean;
  shading_palette: Record<string, string>;
  blueprint_switches: BlueprintToggle[];
  version_hint?: string | null;
}

export interface ExportConfigModel {
  enable_cache_save: boolean;
  enable_excel: boolean;
  enable_csv: boolean;
  enable_txt: boolean;
  enable_parquet: boolean;
  enable_json: boolean;
  enable_database_export: boolean;
  database_target_table?: string | null;
  erp_interface_enabled: boolean;
  erp_protocol?: string | null;
  erp_endpoint?: string | null;
  default_encoding: string;
  export_directory: string;
  compress_on_save: boolean;
}

export interface VisualizationConfigModel {
  tensorboard_projector_dir: string;
  projector_enabled: boolean;
  projector_metadata_columns: string[];
  neo4j_enabled: boolean;
  neo4j_browser_url?: string | null;
  neo4j_workspace?: string | null;
  publish_service_enabled: boolean;
  publish_notes?: string | null;
}

export interface WorkflowConfigResponse {
  graph: WorkflowGraphModel;
  trainer: TrainerRuntimeModel;
  predictor: PredictorRuntimeModel;
  sql: SQLConfigModel;
  data_source: DataSourceConfigModel;
  export: ExportConfigModel;
  visualization: VisualizationConfigModel;
  updated_at: string;
}

export interface WorkflowGraphPatch {
  nodes?: WorkflowGraphNode[];
  edges?: WorkflowGraphEdge[];
  design_refs?: string[];
}

export interface TrainerRuntimePatch {
  similarity_threshold?: number;
  trim_std_enabled?: boolean;
  trim_lower_percent?: number;
  trim_upper_percent?: number;
}

export interface PredictorRuntimePatch {
  similarity_high_threshold?: number;
  max_routing_variants?: number;
  trim_std_enabled?: boolean;
  trim_lower_percent?: number;
  trim_upper_percent?: number;
}

export interface SQLConfigPatch {
  output_columns?: string[];
  column_aliases?: Record<string, string>;
  available_columns?: string[];
  profiles?: PowerQueryProfile[];
  active_profile?: string | null;
  exclusive_column_groups?: string[][];
  key_columns?: string[];
  training_output_mapping?: Record<string, string>;
}

export interface DataSourceConfigPatch {
  offline_dataset_path?: string | null;
  default_table?: string;
  backup_paths?: string[];
  table_profiles?: DataSourceTableProfile[];
  column_overrides?: Record<string, string[]>;
  allow_gui_override?: boolean;
  blueprint_switches?: { id: string; enabled?: boolean; description?: string | null }[];
}

export interface ExportConfigPatch {
  enable_cache_save?: boolean;
  enable_excel?: boolean;
  enable_csv?: boolean;
  enable_txt?: boolean;
  enable_parquet?: boolean;
  enable_json?: boolean;
  enable_database_export?: boolean;
  database_target_table?: string | null;
  erp_interface_enabled?: boolean;
  erp_protocol?: string | null;
  erp_endpoint?: string | null;
  default_encoding?: string;
  export_directory?: string;
  compress_on_save?: boolean;
}

export interface VisualizationConfigPatch {
  tensorboard_projector_dir?: string;
  projector_enabled?: boolean;
  projector_metadata_columns?: string[];
  neo4j_enabled?: boolean;
  neo4j_browser_url?: string | null;
  neo4j_workspace?: string | null;
  publish_service_enabled?: boolean;
  publish_notes?: string | null;
}

export interface WorkflowConfigPatch {
  graph?: WorkflowGraphPatch;
  trainer?: TrainerRuntimePatch;
  predictor?: PredictorRuntimePatch;
  sql?: SQLConfigPatch;
  data_source?: DataSourceConfigPatch;
  export?: ExportConfigPatch;
  visualization?: VisualizationConfigPatch;
}

export interface WorkflowCodeModule {
  node_id: string;
  label: string;
  path: string;
}

export interface WorkflowCodeSyncResponse {
  modules: WorkflowCodeModule[];
  tensorboard_paths?: Record<string, string>;
  updated_at: string;
}
