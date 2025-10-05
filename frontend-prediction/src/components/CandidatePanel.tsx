import type { OperationStep } from "@app-types/routing";
import {
  createRecommendationBucketKey,
  createRecommendationOperationKey,
  useRoutingStore,
} from "@store/routingStore";
import { Activity, Database, Edit3, EyeOff, Plus, Search, Settings, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import type { DragEvent, MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { CandidateSettingsModal } from "./CandidateSettingsModal";

interface OperationBucket {
  itemCode: string;
  candidateId: string | null;
  operations: OperationStep[];
}

interface CandidateOperation {
  id: string;
  operation: OperationStep;
  source: "default" | "custom";
  entryId?: string;
}

export function CandidatePanel() {
  const activeProductId = useRoutingStore((state) => state.activeProductId);
  const recommendations = useRoutingStore((state) => state.recommendations);
  const customRecommendations = useRoutingStore((state) => state.customRecommendations);
  const hiddenRecommendationKeys = useRoutingStore((state) => state.hiddenRecommendationKeys);
  const insertOperation = useRoutingStore((state) => state.insertOperation);
  const addCustomRecommendation = useRoutingStore((state) => state.addCustomRecommendation);
  const updateCustomRecommendation = useRoutingStore((state) => state.updateCustomRecommendation);
  const removeCustomRecommendation = useRoutingStore((state) => state.removeCustomRecommendation);
  const hideRecommendation = useRoutingStore((state) => state.hideRecommendation);
  const restoreRecommendation = useRoutingStore((state) => state.restoreRecommendation);
  const restoreAllRecommendations = useRoutingStore((state) => state.restoreAllRecommendations);
  const loading = useRoutingStore((state) => state.loading);
  const productTabs = useRoutingStore((state) => state.productTabs);
  const timelineLength = useRoutingStore((state) => state.timeline.length);
  const dirty = useRoutingStore((state) => state.dirty);
  const lastSavedAt = useRoutingStore((state) => state.lastSavedAt);
  const erpRequired = useRoutingStore((state) => state.erpRequired);
  const setERPRequired = useRoutingStore((state) => state.setERPRequired);
  const processGroups = useRoutingStore((state) => state.processGroups);
  const activeProcessGroupId = useRoutingStore((state) => state.activeProcessGroupId);
  const setActiveProcessGroup = useRoutingStore((state) => state.setActiveProcessGroup);

  const [filter, setFilter] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);

  const bucket = useMemo<OperationBucket | null>(() => {
    if (!activeProductId) {
      return null;
    }
    return recommendations.find((item) => item.itemCode === activeProductId) ?? null;
  }, [activeProductId, recommendations]);

  const bucketCandidateId = bucket?.candidateId ?? null;
  const bucketKey = bucket ? createRecommendationBucketKey(bucket.itemCode, bucketCandidateId) : null;

  const activeTab = useMemo(() => {
    if (!activeProductId) {
      return null;
    }
    return productTabs.find((tab) => tab.id === activeProductId) ?? null;
  }, [activeProductId, productTabs]);

  const bucketCustomEntries = useMemo(
    () =>
      bucket
        ? customRecommendations.filter(
            (entry) =>
              entry.itemCode === bucket.itemCode && entry.candidateId === bucketCandidateId,
          )
        : [],
    [bucket, bucketCandidateId, customRecommendations],
  );

  const hiddenKeys = useMemo(
    () => (bucketKey ? hiddenRecommendationKeys[bucketKey] ?? [] : []),
    [bucketKey, hiddenRecommendationKeys],
  );

  const visibleOperations = useMemo<CandidateOperation[]>(() => {
    if (!bucket) {
      return [];
    }
    const keyword = filter.trim().toLowerCase();
    const hiddenSet = new Set(hiddenKeys);
    const defaultOperations: CandidateOperation[] = bucket.operations
      .filter((operation) => !hiddenSet.has(createRecommendationOperationKey(operation)))
      .map((operation) => ({
        id: `default-${createRecommendationOperationKey(operation)}`,
        operation,
        source: "default" as const,
      }));
    const customOperations: CandidateOperation[] = bucketCustomEntries.map((entry) => ({
      id: `custom-${entry.id}`,
      operation: entry.operation,
      source: "custom" as const,
      entryId: entry.id,
    }));
    const combined = [...customOperations, ...defaultOperations];
    if (!keyword) {
      return combined;
    }
    return combined.filter((item) => {
      const source = `${item.operation.PROC_CD} ${item.operation.PROC_DESC ?? ""}`.toLowerCase();
      return source.includes(keyword);
    });
  }, [bucket, bucketCustomEntries, filter, hiddenKeys]);

  const hiddenOperations = useMemo(() => {
    if (!bucket) {
      return [];
    }
    const hiddenSet = new Set(hiddenKeys);
    return bucket.operations.filter((operation) =>
      hiddenSet.has(createRecommendationOperationKey(operation)),
    );
  }, [bucket, hiddenKeys]);

  const visibleCount = bucket ? visibleOperations.length : 0;
  const customCount = bucketCustomEntries.length;
  const hiddenCount = hiddenOperations.length;

  const activeProcessGroup = useMemo(
    () => processGroups.find((group) => group.id === activeProcessGroupId) ?? null,
    [activeProcessGroupId, processGroups],
  );

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

  const handleEditCustom = (entryId: string) => {
    setPendingEditId(entryId);
    setSettingsOpen(true);
  };

  const handleRemoveOperation = (item: CandidateOperation) => (event: MouseEvent) => {
    event.stopPropagation();
    if (!bucket) {
      return;
    }
    if (item.source === "custom" && item.entryId) {
      removeCustomRecommendation(item.entryId);
      return;
    }
    const operationKey = createRecommendationOperationKey(item.operation);
    hideRecommendation(bucket.itemCode, bucketCandidateId, operationKey);
  };

  const handleOpenSettings = () => {
    setPendingEditId(null);
    setSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setPendingEditId(null);
    setSettingsOpen(false);
  };

  return (
    <section className="panel-card interactive-card candidate-panel">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">후보 공정 블록</h2>
          <p className="panel-subtitle">추천 공정, 사용자 정의 공정, ERP 토글을 한 화면에서 확인하세요.</p>
        </div>
        <div className="candidate-summary__meta">
          <span className="candidate-summary__meta-item" aria-label="표시 중인 공정 수">
            <Activity size={14} /> {visibleCount}
          </span>
          <span className="candidate-summary__meta-item" aria-label="사용자 정의 공정 수">
            <Plus size={14} /> {customCount}
          </span>
          <span className="candidate-summary__meta-item" aria-label="숨김 처리된 공정 수">
            <EyeOff size={14} /> {hiddenCount}
          </span>
          <span className="candidate-summary__meta-item" aria-label="타임라인 단계">
            <Database size={14} /> {timelineLength}
          </span>
        </div>
      </header>

      <div className="candidate-summary">
        <div className="candidate-summary__item">
          <span className="candidate-summary__label">활성 품목</span>
          <span className="candidate-summary__value">{activeTab?.productName ?? "선택되지 않음"}</span>
          {activeTab?.candidateId ? (
            <span className="candidate-summary__hint">Candidate #{activeTab.candidateId}</span>
          ) : null}
        </div>
        <div className="candidate-summary__item">
          <span className="candidate-summary__label">타임라인</span>
          <span className="candidate-summary__value">{timelineLength}</span>
          <span className={`candidate-summary__status${dirty ? " is-dirty" : ""}`}>
            {dirty ? "변경됨" : lastSavedAt ? `저장됨 (${new Date(lastSavedAt).toLocaleTimeString()})` : "저장 전"}
          </span>
        </div>
        <div className="candidate-summary__item candidate-summary__item--toggle">
          <span className="candidate-summary__label">ERP 인터페이스</span>
          <button
            type="button"
            className={`candidate-erp-toggle${erpRequired ? " is-active" : ""}`}
            onClick={() => setERPRequired(!erpRequired)}
            aria-pressed={erpRequired}
            aria-label="ERP 인터페이스 필요 여부 토글"
          >
            {erpRequired ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            <span>{erpRequired ? "ON" : "OFF"}</span>
          </button>
          <p className="candidate-summary__hint">INTERFACE 저장과 Access 연동은 ERP ON 시에만 가능합니다.</p>
        </div>
        <div className="candidate-summary__item candidate-summary__item--group">
          <span className="candidate-summary__label">공정 그룹</span>
          <div className="candidate-summary__value candidate-summary__value--select">
            <select
              value={activeProcessGroupId ?? ""}
              onChange={(event) =>
                setActiveProcessGroup(event.target.value ? event.target.value : null)
              }
              aria-label="활성 공정 그룹 선택"
            >
              <option value="">선택되지 않음</option>
              {processGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} · {group.type === "machining" ? "가공" : "후처리"}
                </option>
              ))}
            </select>
          </div>
          {activeProcessGroup ? (
            <span className="candidate-summary__hint">
              기본 컬럼 {activeProcessGroup.defaultColumns.length}개 · 고정값
              {` ${Object.keys(activeProcessGroup.fixedValues).length}개`}
            </span>
          ) : (
            <span className="candidate-summary__hint">워크스페이스에서 공정 그룹을 구성하세요.</span>
          )}
        </div>
      </div>

      <div className="candidate-filter">
        <Search size={14} className="candidate-filter__icon" />
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="공정 코드/설명 검색"
        />
      </div>

      <div className="candidate-manage">
        <button type="button" className="candidate-manage__button" onClick={handleOpenSettings}>
          <Settings size={16} /> 추천 관리
        </button>
      </div>

      {loading ? (
        <div className="candidate-placeholder">추천 공정을 불러오는 중입니다...</div>
      ) : !bucket ? (
        <div className="candidate-placeholder">활성 품목이 없습니다. 품목을 검색해 주세요.</div>
      ) : visibleOperations.length === 0 ? (
        <div className="candidate-placeholder">
          {filter.trim()
            ? "조건에 맞는 후보 공정이 없습니다."
            : hiddenCount > 0
            ? "숨김 처리된 공정만 있습니다. 아래 목록에서 복원하세요."
            : "등록된 후보 공정이 없습니다. 사용자 정의 공정을 추가해 보세요."}
        </div>
      ) : (
        <div className="candidate-list" role="list">
          {visibleOperations.map((item) => (
            <div
              key={item.id}
              role="listitem"
              className={`candidate-block${item.source === "custom" ? " is-custom" : ""}`}
              draggable
              onDragStart={handleDragStart(item.operation)}
              onDoubleClick={handleDoubleClick(item.operation)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleDoubleClick(item.operation)();
                }
              }}
            >
              <header className="candidate-block__header">
                <span className="candidate-block__code">{item.operation.PROC_CD}</span>
                <span className="candidate-block__seq">#{item.operation.PROC_SEQ}</span>
                {item.source === "custom" ? (
                  <span className="candidate-block__badge">사용자 정의</span>
                ) : null}
              </header>
              <p className="candidate-block__desc">{item.operation.PROC_DESC ?? "설명 없음"}</p>
              <div className="candidate-block__meta">
                <span>세팅 {item.operation.SETUP_TIME ?? "-"}</span>
                <span>가공 {item.operation.RUN_TIME ?? "-"}</span>
                <span>대기 {item.operation.WAIT_TIME ?? "-"}</span>
              </div>
              <div className="candidate-block__actions">
                {item.source === "custom" && item.entryId ? (
                  <button
                    type="button"
                    className="candidate-block__action"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (item.entryId) {
                        handleEditCustom(item.entryId);
                      }
                    }}
                    aria-label="사용자 정의 공정 편집"
                  >
                    <Edit3 size={14} /> 편집
                  </button>
                ) : null}
                <button
                  type="button"
                  className="candidate-block__action"
                  onClick={handleRemoveOperation(item)}
                  aria-label={item.source === "custom" ? "사용자 정의 공정 삭제" : "추천 공정 숨기기"}
                >
                  <Trash2 size={14} /> {item.source === "custom" ? "삭제" : "숨기기"}
                </button>
              </div>
              <p className="candidate-block__hint">드래그 또는 더블 클릭으로 추가</p>
            </div>
          ))}
        </div>
      )}

      <CandidateSettingsModal
        open={settingsOpen}
        onClose={handleCloseSettings}
        bucket={bucket ? { itemCode: bucket.itemCode, candidateId: bucketCandidateId } : null}
        customEntries={customRecommendations}
        hiddenOperations={hiddenOperations}
        recommendationOperations={bucket?.operations ?? []}
        addCustomRecommendation={addCustomRecommendation}
        updateCustomRecommendation={updateCustomRecommendation}
        removeCustomRecommendation={removeCustomRecommendation}
        hideRecommendation={hideRecommendation}
        restoreRecommendation={restoreRecommendation}
        restoreAllRecommendations={restoreAllRecommendations}
        initialEditId={pendingEditId}
      />
    </section>
  );
}
