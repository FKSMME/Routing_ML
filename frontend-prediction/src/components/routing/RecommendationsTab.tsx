import { useRoutingStore } from "@store/routingStore";
import { type DragEvent,useCallback, useEffect, useId, useMemo, useState } from "react";

import { RoutingCanvas, type RoutingCanvasProps } from "./RoutingCanvas";

type ViewMode = "timeline" | "recommendations";

interface RecommendationsTabProps extends RoutingCanvasProps {
  initialView?: ViewMode;
}

export function RecommendationsTab({ initialView = "recommendations", ...canvasProps }: RecommendationsTabProps) {
  const activeProductId = useRoutingStore((state) => state.activeProductId);
  const productTabs = useRoutingStore((state) => state.productTabs);
  const insertOperation = useRoutingStore((state) => state.insertOperation);

  const [view, setView] = useState<ViewMode>(initialView);
  const [dropPreviewIndex, setDropPreviewIndex] = useState<number | null>(null);
  const baseId = useId();

  // Read from productTabs instead of recommendations for automatic sync
  const activeBucket = useMemo(
    () => {
      const tab = productTabs.find(t => t.id === activeProductId);
      if (!tab) return null;

      // Convert timeline steps back to operations for display
      const operations = tab.timeline.map(step => ({
        PROC_SEQ: step.seq,
        PROC_CD: step.processCode,
        PROC_DESC: step.description ?? undefined,
        SETUP_TIME: step.setupTime ?? undefined,
        RUN_TIME: step.runTime ?? undefined,
        WAIT_TIME: step.waitTime ?? undefined,
        metadata: step.metadata ?? undefined,
      }));

      return {
        itemCode: tab.productCode,
        candidateId: tab.candidateId ?? null,
        operations,
      };
    },
    [activeProductId, productTabs],
  );

  const operations = activeBucket?.operations ?? [];
  const hasRecommendations = operations.length > 0;

  // Task 3.3: 뷰 상태 변경 추적
  useEffect(() => {
    console.log("[RecommendationsTab] 뷰 상태 변경:", view);
  }, [view]);

  // Task 3.3: Initialize view based on recommendations
  useEffect(() => {
    // 추천 데이터가 없으면 Timeline 뷰로만 제한
    if (!hasRecommendations && view !== "timeline") {
      console.log("[RecommendationsTab] 추천 데이터 없음 - Timeline 뷰로 강제 전환");
      setView("timeline");
    }
    // initialView는 초기 진입 시에만 적용 (이후 사용자 선택 존중)
    // 무한 루프 방지를 위해 제거
  }, [hasRecommendations, view]);

  const handleSelectView = useCallback((mode: ViewMode) => () => {
    // Task 3.3: Canvas 탭 전환 로그 추가
    console.log("[RecommendationsTab] 뷰 전환 요청:", mode, "| 현재 뷰:", view, "| 추천 데이터 존재:", hasRecommendations);

    if (mode === "recommendations" && !hasRecommendations) {
      console.warn("[RecommendationsTab] Recommendations 뷰 전환 차단 - 추천 데이터 없음");
      return;
    }

    console.log("[RecommendationsTab] 뷰 전환 실행:", mode);
    setView(mode);
  }, [hasRecommendations, view]);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDropPreviewIndex(null);
      const transfer = event.dataTransfer.getData("application/routing-operation");
      if (!transfer) {
        return;
      }
      try {
        const payload = JSON.parse(transfer);
        if (!payload?.operation) {
          return;
        }
        // Calculate drop position based on mouse position
        const target = event.currentTarget;
        const rect = target.getBoundingClientRect();
        const y = event.clientY - rect.top;
        const itemHeight = 80; // Approximate height of each recommendation item
        const dropIndex = Math.max(0, Math.min(operations.length, Math.floor(y / itemHeight)));
        insertOperation(payload, dropIndex);
      } catch (error) {
        console.warn("Failed to parse drag payload", error);
      }
    },
    [insertOperation, operations.length],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      // Calculate drop preview position
      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      const y = event.clientY - rect.top;
      const itemHeight = 80;
      const previewIndex = Math.max(0, Math.min(operations.length, Math.floor(y / itemHeight)));
      setDropPreviewIndex(previewIndex);
    },
    [operations.length],
  );

  const handleDragLeave = useCallback(() => {
    setDropPreviewIndex(null);
  }, []);

  const timelineTabId = `${baseId}-timeline-tab`;
  const recommendationsTabId = `${baseId}-recommendations-tab`;
  const timelinePanelId = `${baseId}-timeline-panel`;
  const recommendationsPanelId = `${baseId}-recommendations-panel`;

  return (
    <div className="timeline-view">
      <div className="timeline-view__tabs" role="tablist" aria-label="라우팅 시각화 모드">
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
          블루프린트
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
          라우팅
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
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="timeline-recommendations__summary">
              <span>
                Recommended flow for <strong>{activeProductId}</strong>
              </span>
              {activeBucket?.candidateId ? <span>Candidate {activeBucket.candidateId}</span> : null}
            </div>
            {operations.length === 0 ? (
              <div className="timeline-placeholder">No recommendations available. Drag candidate blocks here to add them.</div>
            ) : (
              <ol className="timeline-recommendations__list" data-testid="recommendations-list" style={{ position: "relative" }}>
                {operations.map((operation, index) => {
                  const key = `${operation.PROC_SEQ}-${operation.PROC_CD}`;
                  return (
                    <div key={key} style={{ display: "contents" }}>
                      {dropPreviewIndex === index && (
                        <li className="timeline-recommendations__drop-indicator">
                          <div style={{
                            height: "4px",
                            backgroundColor: "#5b76d8",
                            borderRadius: "2px",
                            margin: "8px 0"
                          }} />
                        </li>
                      )}
                      <li className="timeline-recommendations__item">
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
                    </div>
                  );
                })}
                {dropPreviewIndex === operations.length && (
                  <li className="timeline-recommendations__drop-indicator" key="drop-end">
                    <div style={{
                      height: "4px",
                      backgroundColor: "#5b76d8",
                      borderRadius: "2px",
                      margin: "8px 0"
                    }} />
                  </li>
                )}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RecommendationsTab;
