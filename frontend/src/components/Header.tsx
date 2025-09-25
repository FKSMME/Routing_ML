interface HeaderProps {
  onRefresh: () => void;
  loading: boolean;
}

export function Header({ onRefresh, loading }: HeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-400">Routing-ML</p>
          <h1 className="text-2xl font-semibold text-slate-50">라우팅 예측 콘솔</h1>
          <p className="text-sm text-slate-400">ML 기반 후보 라우팅을 조회하고 저장하세요.</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-md border border-emerald-500 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:border-slate-600 disabled:text-slate-500"
        >
          {loading ? "새로고침 중..." : "데이터 새로고침"}
        </button>
      </div>
    </header>
  );
}
