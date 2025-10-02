interface MasterDataTabsProps {
  tabs: string[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export function MasterDataTabs({ tabs, activeId, onSelect, onClose }: MasterDataTabsProps) {
  if (tabs.length === 0) {
    return (
      <div className="panel-card">
        <p className="text-muted">No items selected. Use the tree or input box to open items.</p>
      </div>
    );
  }

  return (
    <div className="master-tabs" role="tablist" aria-label="Selected item codes">
      {tabs.map((tab) => {
        const isActive = tab === activeId;
        const className = ["master-tab", isActive ? "is-active" : ""].join(" ").trim();
        return (
          <div key={tab} className={className} role="tab" aria-selected={isActive} data-item={tab}>
            <button type="button" className="master-tab-label" onClick={() => onSelect(tab)}>
              {tab}
            </button>
            <button type="button" className="master-tab-close" onClick={() => onClose(tab)} aria-label={`Close ${tab}`}>
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
