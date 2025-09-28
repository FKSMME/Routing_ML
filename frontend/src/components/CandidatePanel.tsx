import type { OperationStep } from "@app-types/routing";
import { useRoutingStore } from "@store/routingStore";
import { Search } from "lucide-react";
import type { DragEvent } from "react";
import { useMemo, useState } from "react";

interface OperationBucket {
  itemCode: string;
  candidateId: string | null;
  operations: OperationStep[];
}

export function CandidatePanel() {
  const activeProductId = useRoutingStore((state) => state.activeProductId);
  const recommendations = useRoutingStore((state) => state.recommendations);
  const insertOperation = useRoutingStore((state) => state.insertOperation);
  const loading = useRoutingStore((state) => state.loading);

  const [filter, setFilter] = useState("");

  const bucket = useMemo<OperationBucket | null>(() => {
    if (!activeProductId) {
      return null;
    }
    return recommendations.find((item) => item.itemCode === activeProductId) ?? null;
  }, [activeProductId, recommendations]);

  const filteredOperations = useMemo(() => {
    if (!bucket) {
      return [];
    }
    const keyword = filter.trim().toLowerCase();
    if (!keyword) {
      return bucket.operations;
    }
    return bucket.operations.filter((operation) => {
      const source = `${operation.PROC_CD} ${operation.PROC_DESC ?? ""}`.toLowerCase();
      return source.includes(keyword);
    });
  }, [bucket, filter]);

  const handleDragStart = (operation: OperationStep) => (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "application/routing-operation",
      JSON.stringify({ itemCode: bucket?.itemCode ?? "", candidateId: bucket?.candidateId, operation }),
    );
    event.dataTransfer.setData("text/plain", `${operation.PROC_CD}`);
  };

  const handleDoubleClick = (operation: OperationStep) => () => {
    if (!bucket) {
      return;
    }
    insertOperation({ itemCode: bucket.itemCode, candidateId: bucket.candidateId, operation });
  };

  return (
    <section className="panel-card interactive-card candidate-panel">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">후보 공정 블록</h2>
          <p className="panel-subtitle">드래그하여 라우팅 타임라인에 배치하세요.</p>
        </div>
        <span className="text-sm text-accent-strong">{bucket?.operations.length ?? 0}</span>
      </header>

      <div className="candidate-filter">
        <Search size={14} className="candidate-filter__icon" />
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="공정 코드/설명 검색"
        />
      </div>

      {loading ? (
        <div className="candidate-placeholder">추천 공정을 불러오는 중입니다...</div>
      ) : !bucket ? (
        <div className="candidate-placeholder">활성 품목이 없습니다. 품목을 검색해 주세요.</div>
      ) : filteredOperations.length === 0 ? (
        <div className="candidate-placeholder">조건에 맞는 후보 공정이 없습니다.</div>
      ) : (
        <div className="candidate-list" role="list">
          {filteredOperations.map((operation) => (
            <div
              key={`${bucket.itemCode}-${operation.PROC_SEQ}-${operation.PROC_CD}`}
              role="listitem"
              className="candidate-block"
              draggable
              onDragStart={handleDragStart(operation)}
              onDoubleClick={handleDoubleClick(operation)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleDoubleClick(operation)();
                }
              }}
            >
              <header className="candidate-block__header">
                <span className="candidate-block__code">{operation.PROC_CD}</span>
                <span className="candidate-block__seq">#{operation.PROC_SEQ}</span>
              </header>
              <p className="candidate-block__desc">{operation.PROC_DESC ?? "설명 없음"}</p>
              <div className="candidate-block__meta">
                <span>세팅 {operation.SETUP_TIME ?? "-"}</span>
                <span>가공 {operation.RUN_TIME ?? "-"}</span>
                <span>대기 {operation.WAIT_TIME ?? "-"}</span>
              </div>
              <p className="candidate-block__hint">드래그 또는 더블 클릭으로 추가</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
