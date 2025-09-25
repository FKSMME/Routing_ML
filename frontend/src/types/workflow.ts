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
}

export interface WorkflowConfigResponse {
  graph: WorkflowGraphModel;
  trainer: TrainerRuntimeModel;
  predictor: PredictorRuntimeModel;
  sql: SQLConfigModel;
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
}

export interface WorkflowConfigPatch {
  graph?: WorkflowGraphPatch;
  trainer?: TrainerRuntimePatch;
  predictor?: PredictorRuntimePatch;
  sql?: SQLConfigPatch;
}
