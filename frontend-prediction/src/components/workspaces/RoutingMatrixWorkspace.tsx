import { CardShell } from "@components/common/CardShell";
import { useRoutingStore } from "@store/routingStore";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { ChangeEvent, CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface MatrixComboSummary {
  key: string;
  routingSetCode: string | null;
  variantCode: string | null;
  primaryRoutingCode: string | null;
  secondaryRoutingCode: string | null;
  count: number;
}

type MatrixField =
  | "routingSetCode"
  | "variantCode"
  | "primaryRoutingCode"
  | "secondaryRoutingCode";

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const headerCellStyle: CSSProperties = {
  textAlign: "left",
  padding: "0.5rem",
  fontSize: "0.75rem",
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border-subtle)",
};

const cellStyle: CSSProperties = {
  padding: "0.5rem",
  borderBottom: "1px solid var(--border-subtle)",
};

const ITEMS_PER_PAGE = 20;

export function RoutingMatrixWorkspace() {
  const definitions = useRoutingStore((state) => state.routingMatrixDefinitions);
  const timeline = useRoutingStore((state) => state.timeline);
  const addDefinition = useRoutingStore((state) => state.addRoutingMatrixDefinition);
  const updateDefinition = useRoutingStore((state) => state.updateRoutingMatrixDefinition);
  const removeDefinition = useRoutingStore((state) => state.removeRoutingMatrixDefinition);
  const setDefinitions = useRoutingStore((state) => state.setRoutingMatrixDefinitions);

  const [currentPage, setCurrentPage] = useState(1);

  const hasDefinitions = definitions.length > 0;
  const totalPages = Math.max(1, Math.ceil(definitions.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedDefinitions = definitions.slice(startIndex, endIndex);

  const timelineCombos = useMemo<MatrixComboSummary[]>(() => {
    const combos = new Map<string, MatrixComboSummary>();
    timeline.forEach((step) => {
      const routingSet = step.routingSetCode ?? step.metadata?.routingSetCode ?? null;
      const variant = step.variantCode ?? step.metadata?.variantCode ?? null;
      const primary = step.primaryRoutingCode ?? step.metadata?.primaryRoutingCode ?? null;
      const secondary = step.secondaryRoutingCode ?? step.metadata?.secondaryRoutingCode ?? null;
      const key = [routingSet ?? "", variant ?? "", primary ?? "", secondary ?? ""].join("::");
      const existing = combos.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        combos.set(key, {
          key,
          routingSetCode: routingSet,
          variantCode: variant,
          primaryRoutingCode: primary,
          secondaryRoutingCode: secondary,
          count: 1,
        });
      }
    });
    return Array.from(combos.values()).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }, [timeline]);

  const hasTimelineCombos = timelineCombos.length > 0;

  // Reset to page 1 when definitions length changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const handleAddRow = useCallback(() => {
    addDefinition();
  }, [addDefinition]);

  const handleImportTimeline = useCallback(() => {
    if (!hasTimelineCombos) {
      return;
    }
    setDefinitions(
      timelineCombos.map((combo) => ({
        routingSetCode: combo.routingSetCode ?? null,
        variantCode: combo.variantCode ?? null,
        primaryRoutingCode: combo.primaryRoutingCode ?? null,
        secondaryRoutingCode: combo.secondaryRoutingCode ?? null,
      })),
    );
  }, [hasTimelineCombos, setDefinitions, timelineCombos]);

  const handleClearAll = useCallback(() => {
    if (!hasDefinitions) {
      return;
    }
    setDefinitions([]);
  }, [hasDefinitions, setDefinitions]);

  const handleFieldChange = useCallback(
    (id: string, field: MatrixField) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        updateDefinition(id, { [field]: event.target.value });
      },
    [updateDefinition],
  );

  const handleRemoveRow = useCallback(
    (id: string) => {
      removeDefinition(id);
    },
    [removeDefinition],
  );

  return (
    <div className="workspace-grid" role="region" aria-label="Routing matrix management">
      <section className="workspace-column">
        <CardShell tone="default" className="workspace-panel" innerClassName="workspace-panel__surface">
          <header className="workspace-panel__header">
            <div>
              <h2>라우팅 행렬 설정</h2>
              <p className="workspace-panel__subtitle">
                필터와 내보내기에 사용할 라우팅 세트 · Variant · 주/부라우팅 조합을 정의합니다. 행렬이 비어 있는 경우
                타임라인에서 감지한 조합이 자동으로 사용됩니다.
              </p>
            </div>
            <div className="workspace-toolbar">
              <button type="button" className="workspace-toolbar__btn" onClick={handleAddRow}>
                <Plus size={14} /> 행 추가
              </button>
              <button
                type="button"
                className="workspace-toolbar__btn"
                onClick={handleImportTimeline}
                disabled={!hasTimelineCombos}
                title={hasTimelineCombos ? "타임라인 조합을 불러옵니다." : "타임라인에 조합이 없습니다."}
              >
                <RefreshCw size={14} /> 타임라인 반영
              </button>
              <button
                type="button"
                className="workspace-toolbar__btn"
                onClick={handleClearAll}
                disabled={!hasDefinitions}
              >
                <Trash2 size={14} /> 초기화
              </button>
            </div>
          </header>

          <div className="workspace-panel__body">
            <table style={tableStyle} className="mapping-table">
              <thead>
                <tr>
                  <th style={headerCellStyle}>Routing Set</th>
                  <th style={headerCellStyle}>Variant</th>
                  <th style={headerCellStyle}>주 라우팅</th>
                  <th style={headerCellStyle}>부 라우팅</th>
                  <th style={headerCellStyle}>관리</th>
                </tr>
              </thead>
              <tbody>
                {definitions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ ...cellStyle, textAlign: "center", color: "var(--text-muted)" }}>
                      라우팅 행렬이 비어 있습니다. 상단 버튼으로 행을 추가하거나 타임라인에서 불러오세요.
                    </td>
                  </tr>
                ) : (
                  paginatedDefinitions.map((row) => (
                    <tr key={row.id}>
                      <td style={cellStyle}>
                        <input
                          type="text"
                          value={row.routingSetCode ?? ""}
                          onChange={handleFieldChange(row.id, "routingSetCode")}
                          placeholder="예: RS-001"
                        />
                      </td>
                      <td style={cellStyle}>
                        <input
                          type="text"
                          value={row.variantCode ?? ""}
                          onChange={handleFieldChange(row.id, "variantCode")}
                          placeholder="Variant 코드"
                        />
                      </td>
                      <td style={cellStyle}>
                        <input
                          type="text"
                          value={row.primaryRoutingCode ?? ""}
                          onChange={handleFieldChange(row.id, "primaryRoutingCode")}
                          placeholder="주 라우팅 코드"
                        />
                      </td>
                      <td style={cellStyle}>
                        <input
                          type="text"
                          value={row.secondaryRoutingCode ?? ""}
                          onChange={handleFieldChange(row.id, "secondaryRoutingCode")}
                          placeholder="부 라우팅 코드"
                        />
                      </td>
                      <td style={{ ...cellStyle, width: "80px" }}>
                        <button
                          type="button"
                          className="workspace-toolbar__btn"
                          onClick={() => handleRemoveRow(row.id)}
                        >
                          <Trash2 size={14} /> 삭제
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {hasDefinitions && totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem 0.5rem",
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                  전체 {definitions.length}개 중 {startIndex + 1}-{Math.min(endIndex, definitions.length)}
                </span>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="workspace-toolbar__btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    title="이전 페이지"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ padding: "0 0.5rem", fontSize: "0.875rem" }}>
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    className="workspace-toolbar__btn"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    title="다음 페이지"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </CardShell>
      </section>

      <aside className="workspace-column">
        <CardShell tone="overlay" className="workspace-panel" innerClassName="workspace-panel__surface">
          <header className="workspace-panel__header">
            <div>
              <h2>타임라인 조합 미리보기</h2>
              <p className="workspace-panel__subtitle">
                현재 타임라인에서 감지한 조합입니다. 행렬을 설정하지 않으면 아래 목록이 그대로 사용됩니다.
              </p>
            </div>
          </header>
          <div className="workspace-panel__body">
            {timelineCombos.length === 0 ? (
              <p className="empty-hint">타임라인에서 라우팅 조합을 찾을 수 없습니다.</p>
            ) : (
              <ul className="workspace-summary-list" role="list">
                {timelineCombos.map((combo) => (
                  <li key={combo.key} className="workspace-summary-list__item">
                    {(combo.routingSetCode ?? "기본")}
                    {" / "}
                    {(combo.variantCode ?? "-")}
                    {" / "}
                    {(combo.primaryRoutingCode ?? "-")}
                    {" / "}
                    {(combo.secondaryRoutingCode ?? "-")}
                    {` · ${combo.count}단계`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardShell>
      </aside>
    </div>
  );
}
