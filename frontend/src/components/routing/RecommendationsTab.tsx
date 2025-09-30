import { useRoutingStore } from "@store/routingStore";
import { useCallback, useEffect, useMemo, useState, useId } from "react";

import { RoutingCanvas, type RoutingCanvasProps } from "./RoutingCanvas";

type ViewMode = "timeline" | "recommendations";

interface RecommendationsTabProps extends RoutingCanvasProps {
  initialView?: ViewMode;
}

export function RecommendationsTab({ initialView = "timeline", ...canvasProps }: RecommendationsTabProps) {
  const activeProductId = useRoutingStore((state) => state.activeProductId);
  const recommendations = useRoutingStore((state) => state.recommendations);

  const [view, setView] = useState<ViewMode>(initialView);
  const baseId = useId();

  const activeBucket = useMemo(
    () => recommendations.find((bucket) => bucket.itemCode === activeProductId) ?? null,
    [activeProductId, recommendations],
  );

  const operations = activeBucket?.operations ?? [];
  const hasRecommendations = operations.length > 0;

  useEffect(() => {
    if (!hasRecommendations) {
      setView("timeline");
    }
  }, [hasRecommendations]);

  const handleSelectView = useCallback((mode: ViewMode) => () => {
    if (mode === "recommendations" && !hasRecommendations) {
      return;
    }
    setView(mode);
  }, [hasRecommendations]);

  const timelineTabId = `${baseId}-timeline-tab`;
  const recommendationsTabId = `${baseId}-recommendations-tab`;
  const timelinePanelId = `${baseId}-timeline-panel`;
  const recommendationsPanelId = `${baseId}-recommendations-panel`;

  return (
    <div className="timeline-view">
      <div className="timeline-view__tabs" role="tablist" aria-label="Timeline view mode">
        <button
          id={timelineTabId}
          type="button"
          role="tab"
          aria-selected={view === "timeline"}
          aria-controls={timelinePanelId}
          className="timeline-view__tab"
          onClick={handleSelectView("timeline")}
          data-testid="timeline-view-tab"
        >
          Timeline
        </button>
        <button
          id={recommendationsTabId}
          type="button"
          role="tab"
          aria-selected={view === "recommendations"}
          aria-controls={recommendationsPanelId}
          className="timeline-view__tab"
          onClick={handleSelectView("recommendations")}
          disabled={!hasRecommendations}
          data-testid="recommendations-view-tab"
        >
          Recommendations
        </button>
      </div>

      <div className="timeline-view__content">
        {view === "timeline" ? (
          <div role="tabpanel" id={timelinePanelId} aria-labelledby={timelineTabId}>
            <RoutingCanvas {...canvasProps} />
          </div>
        ) : (
          <div
            role="tabpanel"
            id={recommendationsPanelId}
            aria-labelledby={recommendationsTabId}
            className="timeline-recommendations"
            data-testid="recommendations-panel"
          >
            <div className="timeline-recommendations__summary">
              <span>
                Recommended flow for <strong>{activeProductId}</strong>
              </span>
              {activeBucket?.candidateId ? <span>Candidate {activeBucket.candidateId}</span> : null}
            </div>
            {operations.length === 0 ? (
              <div className="timeline-placeholder">No recommendations available.</div>
            ) : (
              <ol className="timeline-recommendations__list" data-testid="recommendations-list">
                {operations.map((operation) => (
                  <li
                    key={`${operation.PROC_SEQ}-${operation.PROC_CD}`}
                    className="timeline-recommendations__item"
                  >
                    <span className="timeline-recommendations__seq">#{operation.PROC_SEQ}</span>
                    <div>
                      <p className="timeline-recommendations__code">{operation.PROC_CD}</p>
                      <p className="text-xs text-muted">{operation.PROC_DESC ?? "-"}</p>
                    </div>
                    <div className="timeline-recommendations__metrics">
                      <span>Setup {operation.SETUP_TIME ?? "-"}</span>
                      <span>Run {operation.RUN_TIME ?? "-"}</span>
                      <span>Wait {operation.WAIT_TIME ?? "-"}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RecommendationsTab;
