interface MasterDataSearchPanelProps {
  search: string;
  onSearch: (value: string) => void;
}

export function MasterDataSearchPanel({ search, onSearch }: MasterDataSearchPanelProps) {
  return (
    <section className="panel-card interactive-card master-search">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">Search hierarchy</h2>
          <p className="panel-subtitle">Filter by item code, name, or attributes</p>
        </div>
      </header>
      <label className="text-sm text-muted" htmlFor="master-search">
        Keyword
      </label>
      <input
        id="master-search"
        className="input-field"
        placeholder="e.g. ITEM-001, A105, DN100"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
      />
      <p className="text-xs text-muted">
        Supports partial match and AND/OR keywords.
      </p>
    </section>
  );
}
