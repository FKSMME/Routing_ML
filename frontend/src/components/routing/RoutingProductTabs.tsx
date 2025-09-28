import { useRoutingStore } from "@store/routingStore";

export function RoutingProductTabs() {
  const tabs = useRoutingStore((state) => state.productTabs);
  const active = useRoutingStore((state) => state.activeProductId);
  const setActiveProduct = useRoutingStore((state) => state.setActiveProduct);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="routing-tabs">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveProduct(tab.id)}
            className={`routing-tab${isActive ? " routing-tab--active" : ""}`}
          >
            <span className="routing-tab__code">{tab.productCode}</span>
            {tab.candidateId ? <span className="routing-tab__badge">{tab.candidateId}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
