import type { ProcessGroupColumnType, ProcessGroupType } from "@app-types/routing";
import { CardShell } from "@components/common/CardShell";
import { useRoutingStore } from "@store/routingStore";
import { Layers, Plus, Trash2 } from "lucide-react";
import type { ChangeEvent, CSSProperties } from "react";
import { useMemo } from "react";

const groupTypeOptions: Array<{ value: string; label: string }> = [
  { value: "machining", label: "대체 가공 경로" },
  { value: "post-process", label: "후공정/검사" },
];

const columnTypeOptions: Array<{ value: string; label: string }> = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date/Time" },
];

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  margin: 0,
  padding: 0,
  listStyle: "none",
};

const listItemStyle: CSSProperties = {
  borderRadius: "var(--layout-radius)",
  border: "1px solid var(--border-subtle)",
  padding: "0.75rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  cursor: "pointer",
  background: "var(--surface-subtle)",
};

const listItemActiveStyle: CSSProperties = {
  ...listItemStyle,
  borderColor: "var(--border-strong)",
  background: "var(--surface-card)",
  boxShadow: "var(--shadow-focus)",
};

const columnTableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.85rem",
};

const columnHeaderCell: CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid var(--border-subtle)",
  padding: "0.4rem",
  color: "var(--text-muted)",
};

const columnCell: CSSProperties = {
  borderBottom: "1px solid var(--border-subtle)",
  padding: "0.35rem",
  verticalAlign: "top",
};

export function ProcessGroupsWorkspace() {
  const processGroups = useRoutingStore((state) => state.processGroups);
  const activeProcessGroupId = useRoutingStore((state) => state.activeProcessGroupId);
  const setActiveProcessGroup = useRoutingStore((state) => state.setActiveProcessGroup);
  const addProcessGroup = useRoutingStore((state) => state.addProcessGroup);
  const updateProcessGroup = useRoutingStore((state) => state.updateProcessGroup);
  const removeProcessGroup = useRoutingStore((state) => state.removeProcessGroup);
  const addProcessGroupColumn = useRoutingStore((state) => state.addProcessGroupColumn);
  const updateProcessGroupColumn = useRoutingStore((state) => state.updateProcessGroupColumn);
  const removeProcessGroupColumn = useRoutingStore((state) => state.removeProcessGroupColumn);
  const setProcessGroupFixedValue = useRoutingStore((state) => state.setProcessGroupFixedValue);

  const activeGroup = useMemo(
    () => processGroups.find((group) => group.id === activeProcessGroupId) ?? null,
    [activeProcessGroupId, processGroups],
  );

  const handleGroupNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!activeGroup) {
      return;
    }
    updateProcessGroup(activeGroup.id, { name: event.target.value });
  };

  const handleGroupTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (!activeGroup) {
      return;
    }
    updateProcessGroup(activeGroup.id, { type: event.target.value as ProcessGroupType });
  };

  const handleGroupDescriptionChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeGroup) {
      return;
    }
    updateProcessGroup(activeGroup.id, { description: event.target.value });
  };

  const handleColumnFieldChange =
    (columnId: string, field: "label" | "key" | "description" | "dataType") =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (!activeGroup) {
        return;
      }
      const value = event.target.value;
      switch (field) {
        case "label":
          updateProcessGroupColumn(activeGroup.id, columnId, { label: value });
          break;
        case "key":
          updateProcessGroupColumn(activeGroup.id, columnId, { key: value });
          break;
        case "description":
          updateProcessGroupColumn(activeGroup.id, columnId, { description: value });
          break;
        case "dataType":
          updateProcessGroupColumn(activeGroup.id, columnId, { dataType: value as ProcessGroupColumnType });
          break;
        default:
          break;
      }
    };

  const handleColumnFixedValueChange = (columnKey: string, dataType: string) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!activeGroup) {
        return;
      }
      const inputValue = event.target.value;
      let normalized: unknown = inputValue;
      if (dataType === "number") {
        const numeric = Number(inputValue);
        normalized = Number.isFinite(numeric) ? numeric : inputValue;
      } else if (dataType === "boolean") {
        const lowered = inputValue.trim().toLowerCase();
        if (lowered === "true" || lowered === "false") {
          normalized = lowered === "true";
        }
      }
      setProcessGroupFixedValue(activeGroup.id, columnKey, normalized);
    };

  const handleClearFixedValue = (columnKey: string) => () => {
    if (!activeGroup) {
      return;
    }
    setProcessGroupFixedValue(activeGroup.id, columnKey, undefined);
  };

  const handleAddGroup = () => {
    addProcessGroup({ name: "새 공정 그룹" });
  };

  const handleRemoveGroup = (groupId: string) => {
    removeProcessGroup(groupId);
  };

  return (
    <div className="workspace-grid" role="region" aria-label="공정 그룹 관리">
      <section className="workspace-column">
        <CardShell tone="default" className="workspace-panel" innerClassName="workspace-panel__surface">
          <header className="workspace-panel__header">
            <div>
              <h2>사용자 정의 공정 그룹</h2>
              <p className="workspace-panel__subtitle">
                대체 가공 경로나 후공정 단계에 사용할 고정 컬럼 세트를 정의하세요. 선택된 그룹은 후보 패널과
                내보내기에서 공유됩니다.
              </p>
            </div>
            <div className="workspace-toolbar">
              <button type="button" className="workspace-toolbar__btn" onClick={handleAddGroup}>
                <Plus size={14} /> 그룹 추가
              </button>
            </div>
          </header>
          <div className="workspace-panel__body">
            {processGroups.length === 0 ? (
              <p className="empty-hint">
                저장된 공정 그룹이 없습니다. 상단의 &quot;그룹 추가&quot; 버튼으로 새로운 그룹을 생성하세요.
              </p>
            ) : (
              <ul style={listStyle}>
                {processGroups.map((group) => {
                  const isActive = group.id === activeProcessGroupId;
                  const itemStyle = isActive ? listItemActiveStyle : listItemStyle;
                  return (
                    <li
                      key={group.id}
                      style={itemStyle}
                      onClick={() => setActiveProcessGroup(group.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setActiveProcessGroup(group.id);
                        }
                      }}
                    >
                      <strong style={{ fontSize: "0.95rem" }}>{group.name}</strong>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        <Layers size={12} style={{ marginRight: "0.25rem" }} />
                        {group.type === "machining" ? "대체 가공" : "후공정"} · 컬럼 {group.defaultColumns.length}개
                      </span>
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveProcessGroup(group.id);
                          }}
                        >
                          편집
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemoveGroup(group.id);
                          }}
                        >
                          <Trash2 size={14} /> 삭제
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardShell>
      </section>

      <section className="workspace-column">
        <CardShell tone="default" className="workspace-panel" innerClassName="workspace-panel__surface">
          <header className="workspace-panel__header">
            <div>
              <h2>그룹 상세</h2>
              <p className="workspace-panel__subtitle">
                그룹 이름과 유형을 지정하고, 내보내기 시 항상 포함할 컬럼과 고정값을 입력하세요.
              </p>
            </div>
            {activeGroup ? (
              <div className="workspace-toolbar">
                <button
                  type="button"
                  className="workspace-toolbar__btn"
                  onClick={() => addProcessGroupColumn(activeGroup.id)}
                >
                  <Plus size={14} /> 컬럼 추가
                </button>
                <button
                  type="button"
                  className="workspace-toolbar__btn"
                  onClick={() => handleRemoveGroup(activeGroup.id)}
                >
                  <Trash2 size={14} /> 그룹 삭제
                </button>
              </div>
            ) : null}
          </header>

          <div className="workspace-panel__body">
            {activeGroup ? (
              <div className="workspace-form">
                <div className="workspace-form__grid">
                  <label>
                    <span>그룹 이름</span>
                    <input type="text" value={activeGroup.name} onChange={handleGroupNameChange} placeholder="예: MACH-ALT-A" />
                  </label>
                  <label>
                    <span>그룹 유형</span>
                    <select value={activeGroup.type} onChange={handleGroupTypeChange}>
                      {groupTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="workspace-form__full">
                    <span>설명</span>
                    <textarea
                      value={activeGroup.description ?? ""}
                      onChange={handleGroupDescriptionChange}
                      placeholder="그룹 목적 또는 비고를 입력하세요"
                      rows={3}
                    />
                  </label>
                </div>

                <section style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem" }}>기본 컬럼 구성</h3>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => addProcessGroupColumn(activeGroup.id)}
                    >
                      <Plus size={14} /> 컬럼 추가
                    </button>
                  </header>
                  <table style={columnTableStyle}>
                    <thead>
                      <tr>
                        <th style={columnHeaderCell}>라벨</th>
                        <th style={columnHeaderCell}>컬럼 키</th>
                        <th style={columnHeaderCell}>데이터 유형</th>
                        <th style={columnHeaderCell}>고정값</th>
                        <th style={columnHeaderCell}>관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeGroup.defaultColumns.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ ...columnCell, textAlign: "center", color: "var(--text-muted)" }}>
                            기본 컬럼이 없습니다. &quot;컬럼 추가&quot; 버튼으로 새로운 컬럼을 정의하세요.
                          </td>
                        </tr>
                      ) : (
                        activeGroup.defaultColumns.map((column) => (
                          <tr key={column.id}>
                            <td style={columnCell}>
                              <input
                                type="text"
                                value={column.label}
                                onChange={handleColumnFieldChange(column.id, "label")}
                                placeholder="표시 이름"
                              />
                              <input
                                type="text"
                                value={column.description ?? ""}
                                onChange={handleColumnFieldChange(column.id, "description")}
                                placeholder="설명"
                                style={{ marginTop: "0.35rem" }}
                              />
                            </td>
                            <td style={columnCell}>
                              <input
                                type="text"
                                value={column.key}
                                onChange={handleColumnFieldChange(column.id, "key")}
                                placeholder="예: ROUTE_CD"
                              />
                            </td>
                            <td style={columnCell}>
                              <select value={column.dataType} onChange={handleColumnFieldChange(column.id, "dataType")}>
                                {columnTypeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={columnCell}>
                              <div style={{ display: "flex", gap: "0.35rem" }}>
                                <input
                                  type="text"
                                  value={(activeGroup.fixedValues[column.key] ?? "") as string}
                                  onChange={handleColumnFixedValueChange(column.key, column.dataType)}
                                  placeholder="모든 행에 적용할 값"
                                />
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={handleClearFixedValue(column.key)}
                                  title="고정값 초기화"
                                >
                                  초기화
                                </button>
                              </div>
                            </td>
                            <td style={columnCell}>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => removeProcessGroupColumn(activeGroup.id, column.id)}
                              >
                                <Trash2 size={14} /> 삭제
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </section>
              </div>
            ) : (
              <p className="empty-hint">왼쪽 목록에서 수정할 공정 그룹을 선택하거나 새 그룹을 생성하세요.</p>
            )}
          </div>
        </CardShell>
      </section>
    </div>
  );
}
