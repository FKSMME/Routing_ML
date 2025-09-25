import { Fragment } from "react";

import type { PredictionMetrics } from "@types/routing";

interface MetricsPanelProps {
  metrics?: PredictionMetrics;
  loading: boolean;
}

const metricLabels: Record<keyof PredictionMetrics, string> = {
  requested_items: "요청 품목 수",
  returned_routings: "생성된 라우팅",
  returned_candidates: "후보 수",
  threshold: "임계값",
  generated_at: "생성 시각",
};

export function MetricsPanel({ metrics, loading }: MetricsPanelProps) {
  const entries = metrics ? Object.entries(metrics) : [];

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl">
      <header className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-100">예측 메트릭</h2>
        <p className="text-xs text-slate-500">최근 실행된 예측 결과의 요약 정보입니다.</p>
      </header>
      {loading ? (
        <div className="p-6 text-sm text-slate-500">메트릭을 계산하는 중입니다...</div>
      ) : entries.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">아직 실행된 예측이 없습니다.</div>
      ) : (
        <dl className="grid grid-cols-1 gap-3 p-4 text-sm">
          {entries.map(([key, value]) => (
            <Fragment key={key}>
              <dt className="text-xs uppercase tracking-wide text-slate-500">{metricLabels[key as keyof PredictionMetrics] ?? key}</dt>
              <dd className="text-base font-semibold text-slate-100">
                {key === "threshold" && typeof value === "number"
                  ? `${(value * 100).toFixed(0)}%`
                  : String(value)}
              </dd>
            </Fragment>
          ))}
        </dl>
      )}
    </section>
  );
}
