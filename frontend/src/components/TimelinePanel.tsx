import type { RoutingSummary } from "@app-types/routing";

interface TimelinePanelProps {
  routings: RoutingSummary[];
  loading: boolean;
}

export function TimelinePanel({ routings, loading }: TimelinePanelProps) {
  return (
    <section className="panel-card interactive-card h-full">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">공정 타임라인</h2>
          <p className="panel-subtitle">선택된 품목의 공정 시퀀스를 확인하세요.</p>
        </div>
      </header>
      {loading ? (
        <div className="p-6 text-sm text-muted">공정을 불러오는 중입니다...</div>
      ) : routings.length === 0 ? (
        <div className="p-6 text-sm text-muted">예측된 공정이 없습니다.</div>
      ) : (
        <div className="space-y-4 overflow-y-auto p-4" style={{ maxHeight: "70vh" }}>
          {routings.map((routing) => (
            <article key={`${routing.ITEM_CD}-${routing.CANDIDATE_ID ?? "ml"}`} className="timeline-card">
              <header className="timeline-card__header">
                <span className="font-semibold text-primary">{routing.ITEM_CD}</span>
                <span className="text-xs text-accent">{routing.CANDIDATE_ID ?? "ML"}</span>
              </header>
              <ol className="space-y-2 p-4 text-sm">
                {routing.operations.map((operation) => (
                  <li key={`${routing.ITEM_CD}-${operation.PROC_SEQ}`} className="timeline-step">
                    <p className="text-xs uppercase tracking-wide text-muted">#{operation.PROC_SEQ}</p>
                    <p className="text-sm font-semibold text-primary">{operation.PROC_CD}</p>
                    <p className="text-xs text-muted">{operation.PROC_DESC ?? "설명 없음"}</p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted">
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
