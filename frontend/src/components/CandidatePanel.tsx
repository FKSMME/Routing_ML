import type { CandidateRouting } from "@app-types/routing";

interface CandidatePanelProps {
  candidates: CandidateRouting[];
  loading: boolean;
}

export function CandidatePanel({ candidates, loading }: CandidatePanelProps) {
  return (
    <section className="panel-card interactive-card">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">후보 라우팅</h2>
          <p className="panel-subtitle">유사도 상위 후보 목록입니다.</p>
        </div>
        <span className="text-sm text-accent-strong">{candidates.length}건</span>
      </header>

      {loading ? (
        <div className="p-6 text-sm text-muted">예측 데이터를 불러오는 중입니다...</div>
      ) : candidates.length === 0 ? (
        <div className="p-6 text-sm text-muted">표시할 후보가 없습니다. 품목 코드를 확인하세요.</div>
      ) : (
        <div className="overflow-hidden">
          <table className="w-full min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-surface-strong text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">품목</th>
                <th className="px-4 py-3">유사도</th>
                <th className="px-4 py-3">랭크</th>
                <th className="px-4 py-3">라우팅 여부</th>
                <th className="px-4 py-3">공정 수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {candidates.map((candidate) => (
                <tr key={`${candidate.CANDIDATE_ITEM_CD}-${candidate.RANK}`} className="hover-row">
                  <td className="px-4 py-3 font-medium text-primary">{candidate.CANDIDATE_ITEM_CD}</td>
                  <td className="px-4 py-3 text-accent">{(candidate.SIMILARITY_SCORE * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-muted-strong">{candidate.RANK}</td>
                  <td className="px-4 py-3 text-muted-strong">{candidate.HAS_ROUTING ?? "-"}</td>
                  <td className="px-4 py-3 text-muted-strong">{candidate.PROCESS_COUNT ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
