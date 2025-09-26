interface HeaderProps {
  onRefresh: () => void;
  loading: boolean;
}

export function Header({ onRefresh, loading }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-accent-strong">Routing-ML</p>
          <h1 className="text-3xl font-semibold text-primary">라우팅 예측 콘솔</h1>
          <p className="text-sm text-muted">Access 구조 변경에도 즉시 대응하는 ML 기반 라우팅 어시스턴트입니다.</p>
        </div>
        <button onClick={onRefresh} disabled={loading} className="btn-primary">
          {loading ? "새로고침 중..." : "데이터 새로고침"}
        </button>
      </div>
    </header>
  );
}
