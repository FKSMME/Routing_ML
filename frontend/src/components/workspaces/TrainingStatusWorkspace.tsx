import { Activity, BarChart2, Clock, ExternalLink, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

const MODEL_CARDS = [
  { title: "Active model", value: "routing-ml-v42", sub: "2025-09-28 05:40" },
  { title: "Dataset", value: "TrainingSet-2025Q3", sub: "38,412 rows" },
  { title: "RMSE", value: "0.89", sub: "Latest run" },
  { title: "Feature weights", value: "Updated", sub: "2025-09-28" },
];

const FEATURE_WEIGHTS = [
  { id: "length", label: "Length deviation", weight: 0.24, enabled: true },
  { id: "diameter", label: "Diameter", weight: 0.18, enabled: true },
  { id: "material", label: "Material", weight: 0.12, enabled: true },
  { id: "tolerance", label: "Tolerance", weight: 0.09, enabled: false },
  { id: "machine", label: "Machine type", weight: 0.15, enabled: true },
  { id: "setup", label: "Setup time", weight: 0.11, enabled: true },
];

const RUN_HISTORY = [
  { ts: "2025-09-28 05:40", user: "planner01", result: "Success", duration: "12m" },
  { ts: "2025-09-27 22:15", user: "planner01", result: "Success", duration: "11m" },
  { ts: "2025-09-27 18:02", user: "planner02", result: "Failed", duration: "3m" },
];

export function TrainingStatusWorkspace() {
  const [selectedFeatures, setSelectedFeatures] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    FEATURE_WEIGHTS.forEach((feature) => {
      initial[feature.id] = feature.enabled;
    });
    return initial;
  });

  const featureCards = useMemo(() => FEATURE_WEIGHTS, []);

  const handleToggle = (featureId: string) => {
    setSelectedFeatures((prev) => ({ ...prev, [featureId]: !prev[featureId] }));
  };

  return (
    <div className="training-workspace" role="region" aria-label="Model training status">
      <div className="training-metrics">
        {MODEL_CARDS.map((card) => (
          <article key={card.title} className="training-metric">
            <h3>{card.title}</h3>
            <span>{card.value}</span>
            <p>{card.sub}</p>
          </article>
        ))}
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
            <a href="#" onClick={(event) => event.preventDefault()}>
              <ExternalLink size={16} /> https://tensorboard.internal/routing-ml-v42
            </a>
            <p className="text-xs text-muted">Opens in a new window. VPN required.</p>
          </div>
        </section>

        <section className="panel-card training-panel">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">Feature weights</h2>
              <p className="panel-subtitle">Toggle features used for model retraining.</p>
            </div>
          </header>
          <ul className="feature-weight-list" role="list">
            {featureCards.map((feature) => (
              <li key={feature.id} role="listitem">
                <label className="feature-weight">
                  <input
                    type="checkbox"
                    checked={selectedFeatures[feature.id] ?? false}
                    onChange={() => handleToggle(feature.id)}
                  />
                  <span className="feature-weight__label">{feature.label}</span>
                  <span className="feature-weight__value">{(feature.weight * 100).toFixed(0)}%</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel-card training-panel training-visual">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">Metric trend</h2>
              <p className="panel-subtitle">Last seven executions.</p>
            </div>
          </header>
          <div className="training-chart-placeholder" role="img" aria-label="RMSE trend chart">
            <BarChart2 size={64} />
            <p>Chart placeholder</p>
          </div>
        </section>

        <section className="panel-card training-panel training-heatmap">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">Heatmap</h2>
              <p className="panel-subtitle">Average duration by operation.</p>
            </div>
          </header>
          <div className="training-heatmap-grid">
            {["CUT", "WELD", "PAINT", "QC"].map((operation) => (
              <div key={operation} className="training-heatmap-cell">
                <span>{operation}</span>
                <span className="training-heatmap-cell__value">{(Math.random() * 100).toFixed(0)}%</span>
              </div>
            ))}
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
          {RUN_HISTORY.map((run) => (
            <li key={run.ts} role="listitem">
              <span className="training-run-list__time"><Clock size={14} /> {run.ts}</span>
              <span className="training-run-list__user"><Activity size={14} /> {run.user}</span>
              <span className="training-run-list__result">{run.result}</span>
              <span className="training-run-list__duration">{run.duration}</span>
            </li>
          ))}
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
