export interface TensorboardProjectorSummary {
  id: string;
  versionLabel?: string | null;
  tensorName: string;
  sampleCount: number;
  updatedAt?: string | null;
}

export interface TensorboardPointMetadata {
  [key: string]: string | number | null | undefined;
}

export interface TensorboardPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  metadata: TensorboardPointMetadata;
}

export interface TensorboardPointResponse {
  projectorId: string;
  total: number;
  limit: number;
  offset: number;
  points: TensorboardPoint[];
}

export type TensorboardFilterKind = "categorical" | "numeric";

export interface TensorboardFilterField {
  name: string;
  label: string;
  kind: TensorboardFilterKind;
  values?: string[];
}

export interface TensorboardFilterResponse {
  projectorId: string;
  fields: TensorboardFilterField[];
}

export interface TensorboardMetricPoint {
  step: number;
  value: number;
  timestamp?: string | null;
}

export interface TensorboardMetricSeries {
  runId: string;
  metric: string;
  points: TensorboardMetricPoint[];
}

export interface TensorboardConfig {
  projectorPath: string;
  projectorPathExists: boolean;
  modelDir: string;
}

export interface TensorboardTsnePoint {
  id: string;
  x: number;
  y: number;
  progress: number;
  step: number;
  metadata: TensorboardPointMetadata;
}

export interface TensorboardTsneResponse {
  projectorId: string;
  total: number;
  sampled: number;
  requestedPerplexity: number;
  effectivePerplexity: number;
  iterations: number;
  usedPcaFallback: boolean;
  points: TensorboardTsnePoint[];
}

export type TensorboardTsneSummary = Omit<TensorboardTsneResponse, "points">;

export interface TensorboardTsneRequestOptions {
  limit?: number;
  perplexity?: number;
  iterations?: number;
  steps?: number;
  stride?: number;
  filters?: Record<string, string[]>;
}
