import { Fragment } from "react";

import type { PredictionMetrics } from "@app-types/routing";

interface MetricsPanelProps {
  metrics?: PredictionMetrics;
  loading: boolean;
}

const metricLabels: Partial<Record<keyof PredictionMetrics, string>> = {
  requested_items: "요청 품목 수",
  returned_routings: "생성된 라우팅",
  returned_candidates: "후보 수",
  threshold: "임계값",
  generated_at: "생성 시각",
};

export function MetricsPanel({ metrics, loading }: MetricsPanelProps) {
  const entries = metrics
    ? (Object.entries(metrics) as [keyof PredictionMetrics, unknown][]).filter(([key]) =>
        ["requested_items", "returned_routings", "returned_candidates", "threshold", "generated_at"].includes(key as string),
      )
    : [];
  const activeProfile = metrics?.feature_weights?.profiles?.find((profile) => profile.name === "custom")
    ? "custom"
    : metrics?.feature_weights?.profiles?.find((profile) => profile.name && profile.name !== "default")?.name;

  return (
    <section className="panel-card interactive-card">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">예측 메트릭</h2>
          <p className="panel-subtitle">최근 실행된 예측 결과의 요약 정보입니다.</p>
        </div>
      </header>
      {loading ? (
        <div className="p-6 text-sm text-muted">메트릭을 계산하는 중입니다...</div>
      ) : entries.length === 0 ? (
        <div className="p-6 text-sm text-muted">아직 실행된 예측이 없습니다.</div>
      ) : (
        <div className="space-y-4 p-4">
          <dl className="grid grid-cols-1 gap-3 text-sm">
            {entries.map(([key, value]) => (
              <Fragment key={key}>
                <dt className="text-xs uppercase tracking-wide text-muted">
                  {metricLabels[key] ?? key}
                </dt>
                <dd className="text-base font-semibold text-primary">
                  {key === "threshold" && typeof value === "number" ? `${(value * 100).toFixed(0)}%` : String(value)}
                </dd>
              </Fragment>
            ))}
          </dl>
          {metrics?.feature_weights ? (
            <div className="rounded-2xl bg-surface-weak/70 p-4">
              <p className="text-xs font-semibold text-accent-strong">가중치 프로파일</p>
              <p className="text-xs text-muted">
                활성 프로파일: {activeProfile ?? "default"}
              </p>
              {metrics.feature_weights.weights ? (
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted">
                  {Object.entries(metrics.feature_weights.weights)
                    .slice(0, 4)
                    .map(([feature, value]) => (
                      <div key={feature} className="flex justify-between gap-2">
                        <dt className="font-semibold text-accent-soft">{feature}</dt>
                        <dd>{Number(value).toFixed(2)}</dd>
                      </div>
                    ))}
                </dl>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
