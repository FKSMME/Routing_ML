export interface OperationStep {
  PROC_SEQ: number;
  PROC_CD: string;
  PROC_DESC?: string;
  SETUP_TIME?: number | null;
  RUN_TIME?: number | null;
  WAIT_TIME?: number | null;
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

export interface PredictionMetrics {
  requested_items?: number;
  returned_routings?: number;
  returned_candidates?: number;
  threshold?: number;
  generated_at?: string;
  feature_weights?: FeatureWeightsSummary;
  visualization?: VisualizationSnapshot;
  exported_files?: string[];
}

export interface PredictionResponse {
  items: RoutingSummary[];
  candidates: CandidateRouting[];
  metrics: PredictionMetrics;
}
