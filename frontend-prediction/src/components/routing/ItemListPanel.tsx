import { useRoutingStore } from "@store/routingStore";
import { Package } from "lucide-react";

/**
 * ItemListPanel - 품목 리스트 패널
 *
 * 여러 품목의 라우팅이 생성되었을 때 좌측에 품목 리스트를 표시하고
 * 사용자가 클릭하여 해당 품목의 라우팅을 시각화할 수 있도록 함
 */
export function ItemListPanel() {
  const tabs = useRoutingStore((state) => state.productTabs);
  const activeProductId = useRoutingStore((state) => state.activeProductId);
  const setActiveProduct = useRoutingStore((state) => state.setActiveProduct);

  // 품목이 없을 때
  if (tabs.length === 0) {
    return (
      <div className="item-list-panel">
        <div className="item-list-panel__header">
          <h3 className="item-list-panel__title">
            <Package size={18} />
            <span>품목 목록</span>
          </h3>
        </div>
        <div className="item-list-panel__empty">
          <Package size={32} className="item-list-panel__empty-icon" />
          <p>라우팅 생성 후<br />품목이 표시됩니다</p>
        </div>
      </div>
    );
  }

  // 활성 탭 찾기
  const activeTab = tabs.find((tab) => tab.id === activeProductId) ?? tabs[0];

  return (
    <div className="item-list-panel">
      <div className="item-list-panel__header">
        <h3 className="item-list-panel__title">
          <Package size={18} />
          <span>품목 목록</span>
        </h3>
        <span className="item-list-panel__count">{tabs.length}개</span>
      </div>

      <div className="item-list-panel__list" role="list">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab.id;
          const stepCount = tab.timeline?.length ?? 0;

          return (
            <button
              key={tab.id}
              type="button"
              role="listitem"
              onClick={() => setActiveProduct(tab.id)}
              className={`item-list-panel__item${isActive ? " item-list-panel__item--active" : ""}`}
              aria-current={isActive ? "true" : undefined}
            >
              <div className="item-list-panel__item-header">
                <span className="item-list-panel__item-code">{tab.productCode}</span>
                {tab.candidateId && (
                  <span className="item-list-panel__item-badge">{tab.candidateId}</span>
                )}
              </div>
              <div className="item-list-panel__item-meta">
                <span className="item-list-panel__item-steps">{stepCount}개 공정</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
