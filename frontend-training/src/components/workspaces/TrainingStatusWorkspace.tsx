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
import { useTrainingFeatureStore } from "@store/trainingStore";
import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { Activity, Clock, ExternalLink, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  const {
    data: status,
    isLoading: isStatusLoading,
    isFetching: isStatusFetching,
    error: statusError,
    refetch: refetchStatus,
  } = useQuery<TrainingStatus>({
    queryKey: ["trainer", "status"],
    queryFn: fetchTrainingStatus,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });

  const {
    data: metrics,
    isLoading: isMetricsLoading,
    isFetching: isMetricsFetching,
    error: metricsError,
    refetch: refetchMetrics,
  } = useQuery<TrainingMetricsResponse>({
    queryKey: ["trainer", "metrics"],
    queryFn: fetchTrainingMetrics,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });

  const {
    data: featureWeights = [],
    isLoading: isFeaturesLoading,
    isFetching: isFeaturesFetching,
    error: featuresError,
    refetch: refetchFeatures,
  } = useQuery<TrainingFeatureWeight[]>({
    queryKey: ["trainer", "features"],
    queryFn: fetchTrainingFeatureWeights,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });

  const {
    data: runHistory = [],
    isLoading: isRunHistoryLoading,
    isFetching: isRunHistoryFetching,
    error: runHistoryError,
    refetch: refetchRunHistory,
  } = useQuery<TrainingRunRecord[]>({
    queryKey: ["trainer", "run-history"],
    queryFn: () => fetchTrainingRunHistory(15),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });

  const [isSavingFeature, setIsSavingFeature] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const featureToggles = useTrainingFeatureStore((state) => state.toggles);
  const syncFeatureToggles = useTrainingFeatureStore((state) => state.syncFromFeatures);
  const setFeatureToggle = useTrainingFeatureStore((state) => state.setToggle);
  const setFeatureToggles = useTrainingFeatureStore((state) => state.setMany);
  const markFeatureSynced = useTrainingFeatureStore((state) => state.markSynced);

  const isInitialLoading =
    isStatusLoading || isMetricsLoading || isFeaturesLoading || isRunHistoryLoading;
  const isFetching =
    isStatusFetching || isMetricsFetching || isFeaturesFetching || isRunHistoryFetching;

  useEffect(() => {
    if (featureWeights.length === 0) {
      return;
    }
    syncFeatureToggles(featureWeights);
  }, [featureWeights, syncFeatureToggles]);

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

  const firstError = statusError ?? metricsError ?? featuresError ?? runHistoryError;

  useEffect(() => {
    if (firstError) {
      const description = firstError instanceof Error ? firstError.message : undefined;
      showToast({
        type: "error",
        title: "데이터를 불러오지 못했습니다",
        description: description ?? "페이지를 새로고침하거나 잠시 후 다시 시도해 주세요.",
      });
    }
  }, [firstError, showToast]);

  const handleRefresh = useCallback(() => {
    void Promise.allSettled([
      refetchStatus(),
      refetchMetrics(),
      refetchFeatures(),
      refetchRunHistory(),
    ]);
  }, [refetchStatus, refetchMetrics, refetchFeatures, refetchRunHistory]);

  const latestVersion = useMemo(() => {
    const raw = status?.latest_version;
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const version = raw as {
      version_name?: string;
      activated_at?: string | null;
      created_at?: string | null;
    };
    return {
      version_name: typeof version.version_name === "string" ? version.version_name : undefined,
      activated_at: typeof version.activated_at === "string" ? version.activated_at : null,
      created_at: typeof version.created_at === "string" ? version.created_at : null,
    };
  }, [status?.latest_version]);

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

    if (latestVersion?.version_name) {
      cards.push({
        id: "latest-version",
        title: "Latest model",
        value: latestVersion.version_name,
        subtitle: latestVersion.activated_at
          ? `Activated ${formatDate(latestVersion.activated_at)}`
          : latestVersion.created_at
            ? `Created ${formatDate(latestVersion.created_at)}`
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
  }, [latestVersion, metrics, status]);

  const metricTrendOption = useMemo<EChartsOption | null>(() => {
    const trend = metrics?.metric_trend ?? [];
    if (trend.length === 0) {
      return null;
    }
    return {
      tooltip: { trigger: "axis" },
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
    } satisfies EChartsOption;
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
    } satisfies EChartsOption;
  }, [metrics]);

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

  const handleToggle = useCallback(
    async (featureId: string, nextValue: boolean) => {
      const previousSelection = { ...featureToggles };
      const nextSelection = { ...previousSelection, [featureId]: nextValue };

      setFeatureToggle(featureId, nextValue);
      setIsSavingFeature(true);

      try {
        const response = await patchTrainingFeatures({ features: nextSelection });
        markFeatureSynced(response.timestamp);
        showToast({
          type: "success",
          title: "피처 구성이 저장되었습니다",
          description: `업데이트 시각: ${formatDate(response.timestamp)}`,
        });
        await postUiAudit({
          action: "trainer.features.update",
          payload: {
            feature_id: featureId,
            enabled: nextValue,
            features: nextSelection,
            updated: response.updated,
            disabled: response.disabled,
          },
        }).catch((auditError) => {
          console.error("Failed to write audit log", auditError);
        });
        void refetchFeatures();
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
        setFeatureToggles(previousSelection);
        showToast({
          type: "error",
          title: "피처 구성을 저장하지 못했습니다",
          description: message,
        });
        await postUiAudit({
          action: "trainer.features.update.error",
          payload: {
            feature_id: featureId,
            enabled: previousSelection[featureId] ?? false,
            error: message,
          },
        }).catch((auditError) => {
          console.error("Failed to write audit log for error", auditError);
        });
      } finally {
        setIsSavingFeature(false);
      }
    },
    [featureToggles, markFeatureSynced, setFeatureToggle, setFeatureToggles, showToast, refetchFeatures],
  );

  return (
    <div className="training-workspace" role="region" aria-label="Model training status">
      {toast ? (
        <div className={`training-toast training-toast--${toast.type}`} role="status" aria-live="polite">
          <strong>{toast.title}</strong>
          {toast.description ? <span>{toast.description}</span> : null}
        </div>
      ) : null}

      <header className="panel-header mb-4">
        <div>
          <h1 className="panel-title text-xl">학습 상태 모니터링</h1>
          <p className="panel-subtitle">최근 학습 이력과 피처 구성을 확인하고 조정할 수 있습니다.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={handleRefresh} disabled={isFetching}>
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} /> 새로고침
        </button>
      </header>

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
              <h2 className="panel-title">TensorBoard 링크</h2>
              <p className="panel-subtitle">실제 학습 로그와 임베딩을 추적합니다.</p>
            </div>
          </header>
          <div className="training-link">
            {tensorboardUrl ? (
              <>
                <a href={tensorboardUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} /> {tensorboardUrl}
                </a>
                <div
                  className="tensorboard-embed"
                  role="region"
                  aria-label="TensorBoard 실시간 대시보드"
                >
                  <iframe
                    title="TensorBoard dashboard"
                    src={tensorboardUrl}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    allowFullScreen
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                    style={{
                      width: "100%",
                      minHeight: 260,
                      border: "1px solid var(--border-subtle, #e0e7ff)",
                      borderRadius: 8,
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="training-empty">TensorBoard URL is not configured.</p>
            )}
            <p className="text-xs text-muted">Opens in a new window. VPN required.</p>
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

          {featuresError ? (
            <p className="training-empty" role="alert">
              피처 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.
            </p>
          ) : featureWeights.length === 0 ? (
            <p className="training-empty">
              {isFeaturesLoading ? "Loading feature weights…" : "Feature weights unavailable."}
            </p>
          ) : (
            <ul className="feature-weight-list" role="list">
              {featureWeights.map((feature) => {
                const checked = featureToggles[feature.id] ?? feature.enabled;
                return (
                  <li key={feature.id} role="listitem">
                    <label className="feature-weight">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isSavingFeature || isFeaturesFetching}
                        onChange={(event) => void handleToggle(feature.id, event.target.checked)}
                      />
                      <span className="feature-weight__label">{feature.label}</span>
                      <span className="feature-weight__value">{(feature.weight * 100).toFixed(0)}%</span>
                      {feature.description ? (
                        <span className="feature-weight__description">{feature.description}</span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel-card training-panel training-visual">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">지표 추세</h2>
              <p className="panel-subtitle">최근 실행에 대한 핵심 지표 변화</p>
            </div>
          </header>
          <div className="training-chart" role="img" aria-label="Training metric trend">
            {metricTrendOption ? (
              <ReactECharts option={metricTrendOption} style={{ height: 260 }} />
            ) : (
              <p className="training-empty">
                {isMetricsLoading ? "Loading chart…" : "Metric trend unavailable."}
              </p>
            )}
          </div>
        </section>

        <section className="panel-card training-panel training-heatmap">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">피처 통계 히트맵</h2>
              <p className="panel-subtitle">분산·독립도·도메인 가중치 등을 비교합니다.</p>
            </div>
          </header>
          <div className="training-heatmap" role="img" aria-label="Training feature heatmap">
            {heatmapOption ? (
              <ReactECharts option={heatmapOption} style={{ height: 260 }} />
            ) : (
              <p className="training-empty">
                {isMetricsLoading ? "Loading heatmap…" : "Heatmap data unavailable."}
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="panel-card training-panel">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">학습 실행 이력</h2>
            <p className="panel-subtitle">최근 수행된 학습 작업의 결과입니다.</p>
          </div>
        </header>

        {runHistoryError ? (
          <p className="training-empty" role="alert">
            학습 이력을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        ) : (
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
                {isRunHistoryLoading ? "Loading run history…" : "No run history available."}
              </li>
            )}
          </ul>
        )}
      </section>

      <footer className="training-footer">
        <p>
          <Sparkles size={14} /> API 기반 학습 상태 모니터링 ·
          {isStatusLoading ? " 로드 중" : ` 진행률 ${status?.progress ?? 0}%`}
        </p>
      </footer>
    </div>
  );
}
