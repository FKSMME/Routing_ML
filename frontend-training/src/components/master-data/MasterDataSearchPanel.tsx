import { type FormEvent,useState } from "react";

type MetadataChip = {
  key: string;
  label: string;
  value: string;
};

interface MasterDataSearchPanelProps {
  search: string;
  onSearch: (value: string) => void;
  onSubmit?: (value: string) => Promise<unknown> | unknown;
  metadataChips?: MetadataChip[];
  isSearching?: boolean;
}

export function MasterDataSearchPanel({
  search,
  onSearch,
  onSubmit,
  metadataChips,
  isSearching = false,
}: MasterDataSearchPanelProps) {
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onSubmit) {
      return;
    }
    const value = search.trim();
    if (!value) {
      return;
    }
    try {
      await onSubmit(value);
      setError(null);
    } catch (submissionError) {
      if (submissionError instanceof Error) {
        setError(submissionError.message);
      } else {
        setError("Failed to fetch item data from MSSQL.");
      }
    }
  };

  const canSubmit = Boolean(onSubmit) && search.trim().length > 0;
  const hasChips = Boolean(metadataChips?.length);

  return (
    <section className="panel-card interactive-card master-search">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">Search hierarchy</h2>
          <p className="panel-subtitle">Filter by item code, name, or attributes</p>
        </div>
      </header>
      <form className="master-search__form" onSubmit={handleSubmit} noValidate>
        <label className="text-sm text-muted" htmlFor="master-search">
          Keyword
        </label>
        <div className="master-search__input-group">
          <input
            id="master-search"
            className="input-field"
            placeholder="e.g. ITEM-001, A105, DN100"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? "master-search-error" : undefined}
            aria-busy={isSearching}
          />
          {onSubmit ? (
            <button type="submit" className="btn-secondary" disabled={!canSubmit || isSearching}>
              {isSearching ? "Searching…" : "Search MSSQL"}
            </button>
          ) : null}
        </div>
      </form>
      <p className="text-xs text-muted">Supports partial match and AND/OR keywords.</p>
      {hasChips ? (
        <ul className="master-search__chips" aria-label="MSSQL metadata summary">
          {metadataChips!.map((chip) => (
            <li key={chip.key} className="master-search__chip">
              <span className="master-search__chip-label">{chip.label}</span>
              <span className="master-search__chip-value">{chip.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p id="master-search-error" className="master-search__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
