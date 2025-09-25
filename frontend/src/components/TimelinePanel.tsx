import type { RoutingSummary } from "@types/routing";

interface TimelinePanelProps {
  routings: RoutingSummary[];
  loading: boolean;
}

export function TimelinePanel({ routings, loading }: TimelinePanelProps) {
  return (
    <section className="h-full rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl">
      <header className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-100">공정 타임라인</h2>
        <p className="text-xs text-slate-500">선택된 품목의 공정 시퀀스를 확인하세요.</p>
      </header>
      {loading ? (
        <div className="p-6 text-sm text-slate-500">공정을 불러오는 중입니다...</div>
      ) : routings.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">예측된 공정이 없습니다.</div>
      ) : (
        <div className="space-y-4 overflow-y-auto p-4" style={{ maxHeight: "70vh" }}>
          {routings.map((routing) => (
            <article key={`${routing.ITEM_CD}-${routing.CANDIDATE_ID ?? "ml"}`} className="rounded-lg border border-slate-800 bg-slate-950/70">
              <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-sm">
                <span className="font-semibold text-slate-100">{routing.ITEM_CD}</span>
                <span className="text-xs text-emerald-400">{routing.CANDIDATE_ID ?? "ML"}</span>
              </header>
              <ol className="space-y-2 p-4 text-sm">
                {routing.operations.map((operation) => (
                  <li key={`${routing.ITEM_CD}-${operation.PROC_SEQ}`} className="rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">#{operation.PROC_SEQ}</p>
                    <p className="text-sm font-semibold text-slate-100">{operation.PROC_CD}</p>
                    <p className="text-xs text-slate-400">{operation.PROC_DESC ?? "설명 없음"}</p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-400">
                      <span>세팅: {operation.SETUP_TIME ?? "-"}</span>
                      <span>가공: {operation.RUN_TIME ?? "-"}</span>
                      <span>대기: {operation.WAIT_TIME ?? "-"}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
