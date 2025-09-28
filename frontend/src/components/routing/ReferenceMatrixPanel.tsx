import { useRoutingStore } from "@store/routingStore";
import { useMemo } from "react";

export function ReferenceMatrixPanel() {
  const activeProductId = useRoutingStore((state) => state.activeProductId);
  const recommendations = useRoutingStore((state) => state.recommendations);

  const rows = useMemo(() => {
    if (!activeProductId) {
      return [];
    }
    const bucket = recommendations.find((item) => item.itemCode === activeProductId);
    if (!bucket) {
      return [];
    }
    return bucket.operations.map((operation) => ({
      seq: operation.PROC_SEQ,
      code: operation.PROC_CD,
      desc: operation.PROC_DESC ?? "-",
      setup: operation.SETUP_TIME ?? "-",
      run: operation.RUN_TIME ?? "-",
      wait: operation.WAIT_TIME ?? "-",
    }));
  }, [activeProductId, recommendations]);

  return (
    <section className="panel-card interactive-card reference-matrix">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">Access 행렬 프리뷰</h2>
          <p className="panel-subtitle">선택 품목의 기준 공정 데이터를 확인합니다.</p>
        </div>
      </header>
      {rows.length === 0 ? (
        <div className="p-4 text-sm text-muted">추천 데이터를 불러오면 행렬이 표시됩니다.</div>
      ) : (
        <div className="reference-matrix__scroll">
          <table className="reference-matrix__table">
            <thead>
              <tr>
                <th>No</th>
                <th>공정 코드</th>
                <th>설명</th>
                <th>세팅</th>
                <th>가공</th>
                <th>대기</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.seq}-${row.code}`}>
                  <td>{row.seq}</td>
                  <td>{row.code}</td>
                  <td>{row.desc}</td>
                  <td>{row.setup}</td>
                  <td>{row.run}</td>
                  <td>{row.wait}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
