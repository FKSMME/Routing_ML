
import {
  fetchTrainingFeatureWeights,
  fetchTrainingMetrics,
  fetchTrainingRunHistory,
  fetchTrainingStatus,
  patchTrainingFeatures,
  postUiAudit,
  type TrainingFeatureWeight,
  type TrainingMetricsResponse,
  type TrainingRunRecord,
  type TrainingStatus,
} from "@lib/apiClient";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { Activity, Clock, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const POLL_INTERVAL_MS = 15_000;

type ToastKind = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  type: ToastKind;
  title: string;
  description?: string;
}

interface MetricCardViewModel {
  id: string;
  title: string;
  value: string;
  subtitle?: string;
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.toLocaleString()}`;
}

function formatDuration(durationSeconds?: number | null, label?: string | null): string {
  if (label) {
    return label;
  }
  if (durationSeconds == null || Number.isNaN(Number(durationSeconds))) {
    return "-";
  }
  const totalSeconds = Math.max(0, Math.round(Number(durationSeconds)));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

export function TrainingStatusWorkspace() {
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [metrics, setMetrics] = useState<TrainingMetricsResponse | null>(null);
  const [featureWeights, setFeatureWeights] = useState<TrainingFeatureWeight[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<Record<string, boolean>>({});
  const [runHistory, setRunHistory] = useState<TrainingRunRecord[]>([]);
  const [isSavingFeature, setIsSavingFeature] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (featureWeights.length === 0) {
      return;
    }
    setSelectedFeatures(() => {
      const next: Record<string, boolean> = {};
      for (const feature of featureWeights) {
        next[feature.id] = feature.enabled;
      }
      return next;
    });
  }, [featureWeights]);

  const showToast = useCallback((message: Omit<ToastMessage, "id">) => {
    setToast({ ...message, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 5_000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  const loadDashboard = useCallback(async () => {
    const [statusResult, metricsResult, featureResult, runResult] = await Promise.allSettled([
      fetchTrainingStatus(),
      fetchTrainingMetrics(),
      fetchTrainingFeatureWeights(),
      fetchTrainingRunHistory(15),
    ]);

    let hadError = false;

    if (statusResult.status === "fulfilled") {
      if (isMountedRef.current) {
        setStatus(statusResult.value);
      }
    } else {
      hadError = true;
      console.error("Failed to load training status", statusResult.reason);
    }

    if (metricsResult.status === "fulfilled") {
      if (isMountedRef.current) {
        setMetrics(metricsResult.value);
      }
    } else {
      hadError = true;
      console.error("Failed to load training metrics", metricsResult.reason);
    }

    if (featureResult.status === "fulfilled") {
      if (isMountedRef.current) {
        setFeatureWeights(featureResult.value);
      }
    } else {
      hadError = true;
      console.error("Failed to load feature weights", featureResult.reason);
    }

    if (runResult.status === "fulfilled") {
      if (isMountedRef.current) {
        setRunHistory(runResult.value);
      }
    } else {
      hadError = true;
      console.error("Failed to load training run history", runResult.reason);
    }

    if (hadError) {
      showToast({
        type: "error",
        title: "일부 데이터를 불러오지 못했습니다",
        description: "페이지를 새로고침하거나 잠시 후 다시 시도해 주세요.",
      });
    }

    if (isMountedRef.current) {
      setIsInitialLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;

    const runFetch = async () => {
      if (cancelled) {
        return;
      }
      await loadDashboard();
    };

    void runFetch();

    const timer = setInterval(() => {
      void runFetch();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loadDashboard]);

  const tensorboardUrl = useMemo(() => {
    if (metrics?.tensorboard_url && metrics.tensorboard_url.trim().length > 0) {
      return metrics.tensorboard_url;
    }
    const derived = status?.metrics?.tensorboard_url;
    if (typeof derived === "string" && derived.trim().length > 0) {
      return derived;
    }
    return undefined;
  }, [metrics, status]);

  const metricCards = useMemo<MetricCardViewModel[]>(() => {
    const cards: MetricCardViewModel[] = [];

    if (metrics?.cards && metrics.cards.length > 0) {
      for (const card of metrics.cards) {
        cards.push({
          id: card.id ?? card.title,
          title: card.title,
          value: typeof card.value === "number" ? card.value.toLocaleString() : String(card.value ?? "-"),
          subtitle: card.subtitle ?? undefined,
        });
      }
      return cards;
    }

    if (status?.latest_version?.version_name) {
      cards.push({
        id: "latest-version",
        title: "Latest model",
        value: status.latest_version.version_name,
        subtitle: status.latest_version.activated_at
          ? `Activated ${formatDate(status.latest_version.activated_at)}`
          : status.latest_version.created_at
            ? `Created ${formatDate(status.latest_version.created_at)}`
            : undefined,
      });
    }

    if (status?.status) {
      cards.push({
        id: "job-status",
        title: "Job status",
        value: status.status,
        subtitle: status.message ?? undefined,
      });
    }

    if (typeof status?.progress === "number") {
      cards.push({
        id: "progress",
        title: "Progress",
        value: `${status.progress}%`,
        subtitle: status.started_at ? `Started ${formatDate(status.started_at)}` : undefined,
      });
    }

    return cards;
  }, [metrics, status]);

  const metricTrendOption = useMemo<EChartsOption | null>(() => {
    const trend = metrics?.metric_trend ?? [];
    if (trend.length === 0) {
      return null;
    }
    return {
      tooltip: {
        trigger: "axis",
      },
      grid: { left: "3%", right: "4%", bottom: "5%", containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: trend.map((point) => formatDate(point.timestamp)),
      },
      yAxis: {
        type: "value",
        name: metrics?.metric_trend_label ?? "Metric",
      },
      series: [
        {
          name: metrics?.metric_trend_label ?? "Metric",
          type: "line",
          smooth: true,
          areaStyle: {},
          data: trend.map((point) => point.value),
        },
      ],
    };
  }, [metrics]);

  const heatmapOption = useMemo<EChartsOption | null>(() => {
    const heatmap = metrics?.heatmap;
    if (!heatmap || heatmap.values.length === 0) {
      return null;
    }
    const flatValues = heatmap.values.flat();
    if (flatValues.length === 0) {
      return null;
    }
    const min = Math.min(...flatValues);
    const max = Math.max(...flatValues);
    const unitSuffix = heatmap.unit ? ` ${heatmap.unit}` : "";

    return {
      tooltip: {
        position: "top",
        formatter: (params: unknown) => {
          const value = (params as { value?: [number, number, number] }).value ?? [0, 0, 0];
          const [xIndex, yIndex, val] = value;
          const xLabel = heatmap.xLabels[xIndex] ?? "";
          const yLabel = heatmap.yLabels[yIndex] ?? "";
          return `${yLabel} / ${xLabel}: ${val}${unitSuffix}`;
        },
      },
      grid: { height: "70%", top: "5%" },
      xAxis: {
        type: "category",
        data: heatmap.xLabels,
        splitArea: { show: true },
      },
      yAxis: {
        type: "category",
        data: heatmap.yLabels,
        splitArea: { show: true },
      },
      visualMap: {
        min,
        max,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
      },
      series: [
        {
          name: heatmap.label ?? "Heatmap",
          type: "heatmap",
          data: heatmap.values.flatMap((row, rowIndex) =>
            row.map((value, columnIndex) => [columnIndex, rowIndex, value]),
          ),
          label: {
            show: true,
            formatter: (params: unknown) => {
              const value = (params as { value?: [number, number, number] }).value ?? [0, 0, 0];
              return `${value[2]}${unitSuffix}`;
            },
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0, 0, 0, 0.35)",
            },
          },
        },
      ],
    };
  }, [metrics]);

  const handleToggle = useCallback(
    async (featureId: string) => {
      if (!isMountedRef.current) {
        return;
      }
      const previous = selectedFeatures[featureId] ?? false;
      const updatedSelection = { ...selectedFeatures, [featureId]: !previous };

      setSelectedFeatures(updatedSelection);
      setFeatureWeights((weights) =>
        weights.map((feature) =>
          feature.id === featureId ? { ...feature, enabled: !previous } : feature,
        ),
      );
      setIsSavingFeature(true);

      try {
        const response = await patchTrainingFeatures({ features: updatedSelection });
        showToast({
          type: "success",
          title: "피처 구성이 저장되었습니다",
          description: `업데이트 시각: ${formatDate(response.timestamp)}`,
        });
        await postUiAudit({
          action: "trainer.features.update",
          payload: {
            feature_id: featureId,
            enabled: !previous,
            features: updatedSelection,
            updated: response.updated,
            disabled: response.disabled,
          },
        }).catch((auditError) => {
          console.error("Failed to write audit log", auditError);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
        if (isMountedRef.current) {
          setSelectedFeatures((current) => ({ ...current, [featureId]: previous }));
          setFeatureWeights((weights) =>
            weights.map((feature) =>
              feature.id === featureId ? { ...feature, enabled: previous } : feature,
            ),
          );
        }
        showToast({
          type: "error",
          title: "피처 구성을 저장하지 못했습니다",
          description: message,
        });
        await postUiAudit({
          action: "trainer.features.update.error",
          payload: {
            feature_id: featureId,
            enabled: previous,
            error: message,
          },
        }).catch((auditError) => {
          console.error("Failed to write audit log for error", auditError);
        });
      } finally {
        if (isMountedRef.current) {
          setIsSavingFeature(false);
        }
      }
    },
    [selectedFeatures, showToast],
  );

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

      {toast ? (
        <div className={`training-toast training-toast--${toast.type}`} role="status" aria-live="polite">
          <strong>{toast.title}</strong>
          {toast.description ? <span>{toast.description}</span> : null}
        </div>
      ) : null}

      <div className="training-metrics">
        {metricCards.length > 0 ? (
          metricCards.map((card) => (
            <article key={card.id} className="training-metric">
              <h3>{card.title}</h3>
              <span>{card.value}</span>
              {card.subtitle ? <p>{card.subtitle}</p> : null}
            </article>
          ))
        ) : (
          <article className="training-metric">
            <h3>Metrics</h3>
            <span>{isInitialLoading ? "Loading…" : "No data"}</span>
            <p>실시간 지표를 불러오는 중입니다.</p>
          </article>
        )}
      </div>

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

            {tensorboardUrl ? (
              <a href={tensorboardUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> {tensorboardUrl}
              </a>
            ) : (
              <p className="training-empty">TensorBoard URL is not configured.</p>
            )}
            <p className="text-xs text-muted">Opens in a new window. VPN required.</p>

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
            {isSavingFeature ? (
              <span className="panel-status" role="status">
                <Loader2 size={14} className="spin" /> Saving…
              </span>
            ) : null}
          </header>

          {featureWeights.length > 0 ? (
            <ul className="feature-weight-list" role="list">
              {featureWeights.map((feature) => (

          {featureList.length === 0 ? (
            <p className="text-sm text-muted">가중치 정보를 불러오는 중입니다...</p>
          ) : (
            <ul className="feature-weight-list" role="list">
              {featureList.map((feature) => (

                <li key={feature.id} role="listitem">
                  <label className="feature-weight">
                    <input
                      type="checkbox"
                      checked={selectedFeatures[feature.id] ?? false}
                      onChange={() => void handleToggle(feature.id)}
                      disabled={isSavingFeature}
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
          ) : (
            <p className="training-empty">{isInitialLoading ? "Loading feature weights…" : "Feature weights unavailable."}</p>

          )}
        </section>

        <section className="panel-card training-panel training-visual">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">Metric trend</h2>
              <p className="panel-subtitle">Last executions overview.</p>
            </div>
          </header>
          <div className="training-chart" role="img" aria-label="Training metric trend">
            {metricTrendOption ? (
              <ReactECharts option={metricTrendOption} style={{ height: 240 }} />
            ) : (
              <p className="training-empty">{isInitialLoading ? "Loading chart…" : "Metric trend unavailable."}</p>
            )}
          </div>
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
          <div className="training-heatmap" role="img" aria-label="Training duration heatmap">
            {heatmapOption ? (
              <ReactECharts option={heatmapOption} style={{ height: 260 }} />
            ) : (
              <p className="training-empty">{isInitialLoading ? "Loading heatmap…" : "Heatmap data unavailable."}</p>
            )}
          </div>
          {Object.keys(featureStatistics).length === 0 ? (
            <div className="training-chart-placeholder" role="img" aria-label="Feature heatmap empty state">
              <p className="text-sm text-muted">피처 통계 정보를 찾을 수 없습니다.</p>
            </div>
          ) : (
            <ReactECharts option={heatmapOption} style={{ height: 320 }} />
          )}
>        </section>
      </div>

      <section className="panel-card training-panel">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">학습 실행 이력</h2>
            <p className="panel-subtitle">model_registry · training_metrics.json 기반</p>
          </div>
        </header>

        <ul className="training-run-list" role="list">
          {runHistory.length > 0 ? (
            runHistory.map((run) => (
              <li key={run.id ?? run.timestamp} role="listitem">
                <span className="training-run-list__time">
                  <Clock size={14} /> {formatDate(run.timestamp)}
                </span>
                <span className="training-run-list__user">
                  <Activity size={14} /> {run.user || "-"}
                </span>
                <span className="training-run-list__result">{run.result}</span>
                <span className="training-run-list__duration">
                  {formatDuration(run.duration_seconds, run.duration_label)}
                </span>
              </li>
            ))
          ) : (
            <li className="training-empty" role="listitem">
              {isInitialLoading ? "Loading run history…" : "No run history available."}
            </li>
          )}
        </ul>
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
