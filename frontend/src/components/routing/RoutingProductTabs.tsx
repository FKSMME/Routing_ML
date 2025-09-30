import type { ReactNode } from "react";

import { useRoutingStore, type RoutingProductTab } from "@store/routingStore";

interface RoutingProductTabsProps {
  renderWorkspace: (tab: RoutingProductTab) => ReactNode;
  emptyState?: ReactNode;
}

export function RoutingProductTabs({ renderWorkspace, emptyState }: RoutingProductTabsProps) {
  const tabs = useRoutingStore((state) => state.productTabs);
  const active = useRoutingStore((state) => state.activeProductId);
  const setActiveProduct = useRoutingStore((state) => state.setActiveProduct);

  if (tabs.length === 0) {
    return emptyState ? (
      <div className="routing-tabs__container routing-tabs__container--empty">{emptyState}</div>
    ) : null;
  }

  const activeTab = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <div className="routing-tabs__container">
      <div className="routing-tabs" role="tablist" aria-label="Routing workspace products">
        {tabs.map((tab) => {
          const isActive = activeTab.id === tab.id;
          return (
            <button
              key={tab.id}
              id={`routing-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`routing-tabpanel-${tab.id}`}
              onClick={() => setActiveProduct(tab.id)}
              className={`routing-tab${isActive ? " routing-tab--active" : ""}`}
            >
              <span className="routing-tab__code">{tab.productCode}</span>
              {tab.candidateId ? <span className="routing-tab__badge">{tab.candidateId}</span> : null}
            </button>
          );
        })}
      </div>
      <div
        className="routing-tabs__panel"
        role="tabpanel"
        id={`routing-tabpanel-${activeTab.id}`}
        aria-labelledby={`routing-tab-${activeTab.id}`}
      >
        <div key={activeTab.id} className="routing-tabs__pane">
          {renderWorkspace(activeTab)}
        </div>
      </div>
    </div>
  );
}
