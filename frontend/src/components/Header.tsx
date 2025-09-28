interface HeaderProps {
  onRefresh: () => void;
  loading: boolean;
  title: string;
  description: string;
}

export function Header({ onRefresh, loading, title, description }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-accent-strong">Routing-ML</p>
          <h1 className="text-3xl font-semibold text-primary">{title}</h1>
          <p className="text-sm text-muted">{description}</p>
        </div>
        <button onClick={onRefresh} disabled={loading} className="btn-primary">
          {loading ? "새로고침 중..." : "새로 고침"}
        </button>
      </div>
    </header>
  );
}
