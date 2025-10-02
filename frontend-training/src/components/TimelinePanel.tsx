import { useRoutingStore } from "@store/routingStore";
import { BadgeCheck, Clock3, Redo2, Undo2 } from "lucide-react";
import { useMemo } from "react";

import { RecommendationsTab } from "./routing/RecommendationsTab";

function useTimelineSelectors() {
  return useRoutingStore((state) => ({
    timeline: state.timeline,
    loading: state.loading,
    dirty: state.dirty,
    validationErrors: state.validationErrors,
    activeGroupName: state.activeGroupName,
    lastSavedAt: state.lastSavedAt,
    productTabs: state.productTabs,
    activeProductId: state.activeProductId,
    historyCount: state.history.past.length,
    futureCount: state.history.future.length,
  }));
}

export function TimelinePanel() {
  const {
    timeline,
    loading,
    dirty,
    validationErrors,
    activeGroupName,
    lastSavedAt,
    productTabs,
    activeProductId,
    historyCount,
    futureCount,
  } = useTimelineSelectors();
  const undo = useRoutingStore((state) => state.undo);
  const redo = useRoutingStore((state) => state.redo);

  const canUndo = historyCount > 0;
  const canRedo = futureCount > 0;
  const totalDuration = useMemo(() => timeline.reduce((acc, step) => acc + (step.runTime ?? 0), 0), [timeline]);

  return (
    <section className="panel-card interactive-card routing-timeline">
      <header className="timeline-header">
        <div>
          <h2 className="panel-title">Routing Canvas</h2>
          <p className="panel-subtitle">Adjust recommended order and save as groups.</p>
        </div>
        <div className="timeline-actions">
          <button type="button" className="timeline-action" onClick={undo} disabled={!canUndo}>
            <Undo2 size={16} />
            <span>Undo</span>
          </button>
          <button type="button" className="timeline-action" onClick={redo} disabled={!canRedo}>
            <Redo2 size={16} />
            <span>Redo</span>
          </button>
        </div>
      </header>

      <div className="timeline-status">
        <div className={`timeline-status__indicator ${dirty ? "is-dirty" : "is-clean"}`}>
          <span className="timeline-dot" />
          <span>{dirty ? "Unsaved changes" : "Saved"}</span>
        </div>
        <div className="timeline-status__meta">
          <span className="timeline-meta-item">
            <Clock3 size={14} /> Total runtime {totalDuration.toFixed(1)} 분
          </span>
          {activeGroupName ? (
            <span className="timeline-meta-item">
              <BadgeCheck size={14} /> Active group: {activeGroupName}
            </span>
          ) : null}
          {lastSavedAt ? <span className="timeline-meta-item">Last saved {new Date(lastSavedAt).toLocaleString()}</span> : null}
        </div>
      </div>

      {validationErrors.length > 0 ? (
        <div className="timeline-errors">
          <h3>Validation failed</h3>
          <ul>
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading && productTabs.length === 0 ? (
        <div className="timeline-placeholder">Loading timeline...</div>
      ) : productTabs.length === 0 ? (
        <div className="timeline-placeholder">Search items to generate routing.</div>
      ) : (
        <RecommendationsTab />
      )}

      {activeProductId ? <p className="timeline-footer">Active item: {activeProductId}</p> : null}
    </section>
  );
}
