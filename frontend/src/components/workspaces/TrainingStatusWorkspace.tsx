import type {
  FeatureStatistic,
  FeatureStatisticsMap,
  TrainingMetadataInfo,
  TrainingMetricHistoryEntry,
  TrainingMetricsSummary,
  TrainingRunHistoryEntry,
} from "@app-types/training";
import { useTrainingStatus } from "@hooks/useTrainingStatus";
import { useWorkflowConfig } from "@hooks/useWorkflowConfig";
import type { WorkflowConfigResponse } from "@app-types/workflow";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { Activity, Clock, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface StatusMessage {
  type: "success" | "error";
  text: string;
}

const HEATMAP_COLUMNS: Array<keyof FeatureStatistic> = ["variance", "independence", "domain_weight"];

function formatTimestamp(timestamp?: string | null): string {
  if (!timestamp) {
    return "-";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleString();
}

function formatMinutes(durationSec?: number): string {
  if (durationSec == null) {
    return "-";
  }
  const minutes = durationSec / 60;
  if (!Number.isFinite(minutes)) {
    return "-";
  }
  return `${minutes.toFixed(1)}분`;
}

function formatFeatureLabel(featureId: string): string {
  return featureId.replace(/_/g, " ");
}

function extractFeatureStatistics(raw: FeatureStatisticsMap | { features?: FeatureStatisticsMap } | undefined) {
  if (!raw) {
    return {} as FeatureStatisticsMap;
  }
  if ("features" in raw && raw.features) {
    return raw.features as FeatureStatisticsMap;
  }
  return raw as FeatureStatisticsMap;
}

function buildTrendOption(history: TrainingMetricHistoryEntry[]): EChartsOption {
  const sorted = [...history].sort((a, b) => {
    const left = a.timestamp ?? "";
    const right = b.timestamp ?? "";
    return left < right ? -1 : left > right ? 1 : 0;
  });

  const labels = sorted.map((entry) => {
    if (entry.timestamp) {
      const date = new Date(entry.timestamp);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString();
      }
    }
    return entry.label;
  });

  const durationSeries = sorted.map((entry) => {
    const duration = typeof entry.metrics?.duration_sec === "number" ? entry.metrics.duration_sec : null;
    return duration != null ? Number((duration / 60).toFixed(2)) : null;
  });

  const sampleSeries = sorted.map((entry) => {
    if (typeof entry.metrics?.samples === "number") {
      return entry.metrics.samples;
    }
    const totalItems = entry.metadata?.training_info?.total_items;
    return typeof totalItems === "number" ? totalItems : null;
  });

  const rmseSeries = sorted.map((entry) => {
    const rmse = entry.metrics?.rmse;
    return typeof rmse === "number" ? Number(rmse.toFixed(3)) : null;
  });

  const option: EChartsOption = {
    tooltip: { trigger: "axis" },
    legend: { data: ["학습 시간(분)", "샘플 수", "RMSE"] },
    grid: { left: 56, right: 40, top: 32, bottom: 40 },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { interval: 0, rotate: labels.length > 4 ? 30 : 0 },
    },
    yAxis: [
      { type: "value", name: "학습 시간(분)", axisLabel: { formatter: "{value}" } },
      { type: "value", name: "샘플 수", position: "right" },
    ],
    series: [
      {
        name: "학습 시간(분)",
        type: "line",
        data: durationSeries,
        smooth: true,
        connectNulls: true,
      },
      {
        name: "샘플 수",
        type: "bar",
        yAxisIndex: 1,
        data: sampleSeries,
      },
      {
        name: "RMSE",
        type: "line",
        data: rmseSeries,
        smooth: true,
        connectNulls: true,
      },
    ],
  };

  return option;
}

function buildHeatmapOption(features: FeatureStatisticsMap, selected: string[]): EChartsOption {
  const rows = selected.length > 0 ? selected : Object.keys(features);
  const columns = HEATMAP_COLUMNS;
  const values = rows.flatMap((feature, rowIndex) =>
    columns.map((column, columnIndex) => {
      const value = features[feature]?.[column] ?? 0;
      return [columnIndex, rowIndex, Number(value.toFixed ? Number(value.toFixed(4)) : value)];
    }),
  );

  const numericValues = values.map(([, , value]) => (typeof value === "number" ? value : 0));
  const minValue = Math.min(...numericValues, 0);
  const maxValue = Math.max(...numericValues, 1);

  const option: EChartsOption = {
    tooltip: {
      position: "top",
      formatter: (params) => {
        const candidate = Array.isArray((params as { value?: unknown }).value)
          ? ((params as { value: unknown[] }).value as unknown[])
          : Array.isArray((params as { data?: unknown }).data)
            ? ((params as { data: unknown[] }).data as unknown[])
            : [];
        const [columnIndex, rowIndex, value] = candidate as [number, number, number];
        return `${columns[columnIndex]}<br/>${formatFeatureLabel(rows[rowIndex])}: ${value}`;
      },
    },
    grid: { height: "80%", top: 10 },
    xAxis: {
      type: "category",
      data: columns,
      axisLabel: { interval: 0 },
    },
    yAxis: {
      type: "category",
      data: rows.map((feature) => formatFeatureLabel(feature)),
      axisLabel: { interval: 0 },
    },
    visualMap: {
      min: minValue,
      max: maxValue,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
    },
    series: [
      {
        name: "Feature statistics",
        type: "heatmap",
        data: values,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0, 0, 0, 0.4)",
          },
        },
      },
    ],
  };

  return option;
}

function getDatasetSummary(trainingMetrics: Record<string, unknown> | undefined, metadata: Record<string, unknown> | undefined) {
  const datasetPath = typeof trainingMetrics?.dataset_path === "string" ? trainingMetrics.dataset_path : null;
  const samples = typeof trainingMetrics?.samples === "number"
    ? trainingMetrics.samples
    : typeof metadata?.training_info === "object" && metadata.training_info && typeof (metadata.training_info as Record<string, unknown>).total_items === "number"
      ? ((metadata.training_info as Record<string, unknown>).total_items as number)
      : null;
  return { datasetPath, samples };
}

function buildFeatureList(weights: Record<string, number> | undefined, state: Record<string, boolean>) {
  const entries = Object.entries(weights ?? {});
  entries.sort(([, weightA], [, weightB]) => weightB - weightA);
  return entries.map(([featureId, weight]) => ({
    id: featureId,
    label: formatFeatureLabel(featureId),
    weight,
    active: state[featureId] ?? true,
  }));
}

function TrainingMetricCards({
  status,
  datasetPath,
  samples,
  durationLabel,
  featureUpdated,
}: {
  status: string;
  datasetPath: string | null;
  samples: number | null;
  durationLabel: string;
  featureUpdated: string | null;
}) {
  const cards = [
    {
      title: "상태",
      value: status,
      sub: "학습 파이프라인",
    },
    {
      title: "데이터셋",
      value: datasetPath ? datasetPath.split("/").slice(-1)[0] : "경로 미지정",
      sub: datasetPath ?? "-",
    },
    {
      title: "샘플 수",
      value: samples != null ? samples.toLocaleString() : "-",
      sub: "training_metrics.json",
    },
    {
      title: "최근 실행",
      value: durationLabel,
      sub: featureUpdated ?? "업데이트 시간 미상",
    },
  ];

  return (
    <div className="training-metrics">
      {cards.map((card) => (
        <article key={card.title} className="training-metric">
          <h3>{card.title}</h3>
          <span>{card.value}</span>
          <p>{card.sub}</p>
        </article>
      ))}
    </div>
  );
}

function TrainingRunList({ history }: { history: TrainingRunHistoryEntry[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted">등록된 학습 이력이 없습니다.</p>;
  }

  return (
    <ul className="training-run-list" role="list">
      {history.map((run, index) => (
        <li key={`${run.version_name ?? index}-${run.trained_at ?? index}`} role="listitem">
          <span className="training-run-list__time">
            <Clock size={14} /> {formatTimestamp(run.trained_at)}
          </span>
          <span className="training-run-list__user">
            <Activity size={14} /> {run.requested_by ?? "unknown"}
          </span>
          <span className="training-run-list__result">{run.status ?? "-"}</span>
          <span className="training-run-list__duration">{run.version_name ?? "-"}</span>
        </li>
      ))}
    </ul>
  );
}

function getFeatureOverrides(config: WorkflowConfigResponse | undefined) {
  return config?.data_source?.column_overrides ?? {};
}

export function TrainingStatusWorkspace() {
  const { data: status, isLoading, isFetching, refresh } = useTrainingStatus();
  const { data: workflowConfig, saveConfig } = useWorkflowConfig();

  const [selectedFeatures, setSelectedFeatures] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [savingFeature, setSavingFeature] = useState(false);

  const featureWeights = status?.metrics?.feature_weights;
  const trainingMetrics = (status?.metrics?.training_metrics ?? {}) as TrainingMetricsSummary;
  const trainingMetadata = (status?.metrics?.training_metadata ?? {}) as TrainingMetadataInfo;
  const featureStatistics = extractFeatureStatistics(status?.metrics?.feature_statistics);
  const runHistory = (status?.metrics?.run_history ?? []) as TrainingRunHistoryEntry[];
  const metricHistory = (status?.metrics?.metric_history ?? []) as TrainingMetricHistoryEntry[];

  useEffect(() => {
    if (featureWeights?.active_features) {
      setSelectedFeatures({ ...featureWeights.active_features });
    }
  }, [featureWeights?.active_features]);

  const featureList = useMemo(() => buildFeatureList(featureWeights?.weights, selectedFeatures), [featureWeights?.weights, selectedFeatures]);

  const topHeatmapFeatures = useMemo(() => {
    const entries = Object.entries(featureStatistics);
    entries.sort(([, a], [, b]) => (b?.domain_weight ?? 0) - (a?.domain_weight ?? 0));
    return entries.slice(0, 12).map(([feature]) => feature);
  }, [featureStatistics]);

  const trendOption = useMemo(() => buildTrendOption(metricHistory), [metricHistory]);
  const heatmapOption = useMemo(() => buildHeatmapOption(featureStatistics, topHeatmapFeatures), [featureStatistics, topHeatmapFeatures]);

  const { datasetPath, samples } = getDatasetSummary(trainingMetrics, trainingMetadata);
  const durationLabel = formatMinutes(typeof trainingMetrics.duration_sec === "number" ? trainingMetrics.duration_sec : undefined);
  const featureUpdated = featureWeights?.timestamp ?? null;

  const latestStatus = status?.status ?? "unknown";

  const handleToggle = async (featureId: string, nextValue: boolean) => {
    if (!workflowConfig) {
      setMessage({ type: "error", text: "워크플로우 구성을 불러오지 못했습니다." });
      return;
    }
    const previous = { ...selectedFeatures };
    const updated = { ...previous, [featureId]: nextValue };
    setSelectedFeatures(updated);
    setSavingFeature(true);
    try {
      const overrides = { ...getFeatureOverrides(workflowConfig) };
      const activeFeatures = Object.keys(updated).filter((key) => updated[key]);
      overrides.features = activeFeatures;
      await saveConfig({ data_source: { column_overrides: overrides } });
      setMessage({ type: "success", text: `피처 ${activeFeatures.length}개 저장 완료` });
    } catch (error) {
      setSelectedFeatures(previous);
      setMessage({ type: "error", text: "피처 저장에 실패했습니다. 다시 시도해 주세요." });
    } finally {
      setSavingFeature(false);
    }
  };

  const tensorboardUrl = (trainingMetrics.tensorboard_url as string | undefined) ?? "https://tensorboard.internal/routing";

  return (
    <div className="training-workspace" role="region" aria-label="Model training status">
      <header className="panel-header mb-4">
        <div>
          <h1 className="panel-title text-xl">학습 상태 모니터링</h1>
          <p className="panel-subtitle">최근 학습 이력과 피처 구성을 확인하고 조정할 수 있습니다.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => refresh()} disabled={isFetching}>
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} /> 새로고침
        </button>
      </header>

      {message ? (
        <div className={`status-banner status-banner--${message.type}`} role="status">
          {message.text}
        </div>
      ) : null}

      <TrainingMetricCards
        status={latestStatus}
        datasetPath={datasetPath}
        samples={samples}
        durationLabel={durationLabel}
        featureUpdated={featureUpdated}
      />

      <div className="training-content-grid">
        <section className="panel-card training-panel">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">TensorBoard 링크</h2>
              <p className="panel-subtitle">실제 학습 로그와 임베딩을 추적합니다.</p>
            </div>
          </header>
          <div className="training-link">
            <a href={tensorboardUrl} onClick={(event) => event.preventDefault()}>
              <ExternalLink size={16} /> {tensorboardUrl}
            </a>
            <p className="text-xs text-muted">보안 네트워크 연결이 필요할 수 있습니다.</p>
          </div>
        </section>

        <section className="panel-card training-panel">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">피처 가중치</h2>
              <p className="panel-subtitle">학습 파이프라인에 포함할 피처를 선택하세요.</p>
            </div>
          </header>
          {featureList.length === 0 ? (
            <p className="text-sm text-muted">가중치 정보를 불러오는 중입니다...</p>
          ) : (
            <ul className="feature-weight-list" role="list">
              {featureList.map((feature) => (
                <li key={feature.id} role="listitem">
                  <label className="feature-weight">
                    <input
                      type="checkbox"
                      checked={feature.active}
                      disabled={savingFeature}
                      onChange={(event) => handleToggle(feature.id, event.target.checked)}
                    />
                    <span className="feature-weight__label">{feature.label}</span>
                    <span className="feature-weight__value">{(feature.weight * 100).toFixed(0)}%</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel-card training-panel training-visual">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">지표 추세</h2>
              <p className="panel-subtitle">training_metrics.json / training_metadata.json 기반</p>
            </div>
          </header>
          {metricHistory.length === 0 ? (
            <div className="training-chart-placeholder" role="img" aria-label="Metric trend empty state">
              <p className="text-sm text-muted">표시할 실행 이력이 없습니다.</p>
            </div>
          ) : (
            <ReactECharts option={trendOption} style={{ height: 280 }} />
          )}
        </section>

        <section className="panel-card training-panel training-heatmap">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">피처 통계 히트맵</h2>
              <p className="panel-subtitle">feature_statistics.json에서 추출한 분산/독립도/도메인 가중치</p>
            </div>
          </header>
          {Object.keys(featureStatistics).length === 0 ? (
            <div className="training-chart-placeholder" role="img" aria-label="Feature heatmap empty state">
              <p className="text-sm text-muted">피처 통계 정보를 찾을 수 없습니다.</p>
            </div>
          ) : (
            <ReactECharts option={heatmapOption} style={{ height: 320 }} />
          )}
        </section>
      </div>

      <section className="panel-card training-panel">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">학습 실행 이력</h2>
            <p className="panel-subtitle">model_registry · training_metrics.json 기반</p>
          </div>
        </header>
          <TrainingRunList history={runHistory} />
      </section>

      <footer className="training-footer">
        <p>
          <Sparkles size={14} /> API 기반 학습 상태 모니터링 · {isLoading ? "로드 중" : `진행률 ${status?.progress ?? 0}%`}
        </p>
      </footer>
    </div>
  );
}
