import type { CandidateRouting } from "@types/routing";

interface CandidatePanelProps {
  candidates: CandidateRouting[];
  loading: boolean;
}

export function CandidatePanel({ candidates, loading }: CandidatePanelProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">후보 라우팅</h2>
          <p className="text-xs text-slate-500">유사도 상위 후보 목록입니다.</p>
        </div>
        <span className="text-sm text-emerald-400">{candidates.length}건</span>
      </header>

      {loading ? (
        <div className="p-6 text-sm text-slate-500">예측 데이터를 불러오는 중입니다...</div>
      ) : candidates.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">표시할 후보가 없습니다. 품목 코드를 확인하세요.</div>
      ) : (
        <div className="overflow-hidden">
          <table className="w-full min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">품목</th>
                <th className="px-4 py-3">유사도</th>
                <th className="px-4 py-3">랭크</th>
                <th className="px-4 py-3">라우팅 여부</th>
                <th className="px-4 py-3">공정 수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {candidates.map((candidate) => (
                <tr key={`${candidate.CANDIDATE_ITEM_CD}-${candidate.RANK}`} className="hover:bg-slate-900/70">
                  <td className="px-4 py-3 font-medium text-slate-100">{candidate.CANDIDATE_ITEM_CD}</td>
                  <td className="px-4 py-3 text-emerald-300">{(candidate.SIMILARITY_SCORE * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-slate-300">{candidate.RANK}</td>
                  <td className="px-4 py-3 text-slate-300">{candidate.HAS_ROUTING ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-300">{candidate.PROCESS_COUNT ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
