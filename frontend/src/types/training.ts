export interface FeatureWeightsSnapshot {
  weights?: Record<string, number>;
  active_features?: Record<string, boolean>;
  timestamp?: string;
  version?: string;
  profiles?: { name: string; description?: string | null; weights?: Record<string, number>; activate?: Record<string, boolean> }[];
}

export interface FeatureStatistic {
  variance?: number;
  independence?: number;
  activity_ratio?: number;
  uniformity?: number;
  non_zero_count?: number;
  unique_values?: number;
  domain_weight?: number;
}

export type FeatureStatisticsMap = Record<string, FeatureStatistic>;

export interface TrainingMetricsSummary {
  samples?: number;
  dataset_path?: string;
  version_name?: string;
  duration_sec?: number;
  dry_run?: boolean;
  manifest_path?: string;
  completed_at?: string;
  rmse?: number;
  mae?: number;
  [key: string]: unknown;
}

export interface TrainingMetadataInfo {
  training_info?: {
    timestamp?: string;
    total_items?: number;
    vector_dimension?: number;
    preprocessor_config?: Record<string, unknown>;
  };
  runtime_versions?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TrainingMetricHistoryEntry {
  label: string;
  timestamp?: string;
  metrics: TrainingMetricsSummary;
  metadata?: TrainingMetadataInfo;
}

export interface TrainingRunHistoryEntry {
  version_name?: string;
  status?: string;
  artifact_dir?: string;
  trained_at?: string;
  requested_by?: string;
  activated_at?: string;
  active_flag?: boolean;
}

export interface TrainingStatusMetrics {
  feature_weights?: FeatureWeightsSnapshot;
  feature_statistics?: FeatureStatisticsMap | { features?: FeatureStatisticsMap };
  training_metrics?: TrainingMetricsSummary;
  training_metadata?: TrainingMetadataInfo;
  metric_history?: TrainingMetricHistoryEntry[];
  run_history?: TrainingRunHistoryEntry[];
  latest_version?: Record<string, unknown> | null;
  [key: string]: unknown;
}
