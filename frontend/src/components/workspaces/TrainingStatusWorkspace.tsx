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

      <div className="training-content-grid">
        <section className="panel-card training-panel">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">TensorBoard link</h2>
              <p className="panel-subtitle">Open the external viewer to inspect training runs.</p>
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
          </div>
        </section>

        <section className="panel-card training-panel">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">Feature weights</h2>
              <p className="panel-subtitle">Toggle features used for model retraining.</p>
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
                <li key={feature.id} role="listitem">
                  <label className="feature-weight">
                    <input
                      type="checkbox"
                      checked={selectedFeatures[feature.id] ?? false}
                      onChange={() => void handleToggle(feature.id)}
                      disabled={isSavingFeature}
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
        </section>

        <section className="panel-card training-panel training-heatmap">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">Heatmap</h2>
              <p className="panel-subtitle">Average duration by operation.</p>
            </div>
          </header>
          <div className="training-heatmap" role="img" aria-label="Training duration heatmap">
            {heatmapOption ? (
              <ReactECharts option={heatmapOption} style={{ height: 260 }} />
            ) : (
              <p className="training-empty">{isInitialLoading ? "Loading heatmap…" : "Heatmap data unavailable."}</p>
            )}
          </div>
        </section>
      </div>

      <section className="panel-card training-panel">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">Run log</h2>
            <p className="panel-subtitle">Model training timeline.</p>
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
      </section>

      <footer className="training-footer">
        <p>
          <Sparkles size={14} /> The training console will run as a dedicated service. This page is monitoring only.
        </p>
      </footer>
    </div>
  );
}
