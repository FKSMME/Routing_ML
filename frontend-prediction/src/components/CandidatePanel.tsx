import type { OperationStep } from "@app-types/routing";
import {
  createRecommendationBucketKey,
  createRecommendationOperationKey,
  useRoutingStore,
} from "@store/routingStore";
import { Activity, Database, Edit3, EyeOff, Plus, Search, Settings, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import type { DragEvent, MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { AnimatedCandidateCard } from "./AnimatedCandidateCard";
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
  itemCode: string;
  candidateId: string | null;
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
  const setSelectedCandidate = useRoutingStore((state) => state.setSelectedCandidate);

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
        itemCode: bucket.itemCode,
        candidateId: bucket.candidateId,
      }));
    const customOperations: CandidateOperation[] = bucketCustomEntries.map((entry) => ({
      id: `custom-${entry.id}`,
      operation: entry.operation,
      source: "custom" as const,
      entryId: entry.id,
      itemCode: entry.itemCode,
      candidateId: entry.candidateId,
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

  const handleCardClick = (item: CandidateOperation) => () => {
    setSelectedCandidate(item.itemCode);
  };

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
    <section className="panel-card interactive-card candidate-panel responsive-container">
      <header className="panel-header candidate-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="panel-title heading-fluid-3">후보 공정 노드</h2>
          <button
            type="button"
            className="candidate-manage__button touch-target"
            onClick={handleOpenSettings}
          >
            <Settings size={16} /> 노드 설정
          </button>
        </div>
        <div className="candidate-filter candidate-header__filter" style={{ width: '100%' }}>
          <Search size={14} className="candidate-filter__icon" />
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="공정 코드/설명 검색"
            style={{ flex: 1 }}
          />
        </div>
      </header>

      <div className="candidate-toolbar">
        <div className="candidate-tags">
          <span className="candidate-tag" aria-label="표시 중인 공정 수">
            <Activity size={13} /> {visibleCount} 표시
          </span>
          <span className="candidate-tag" aria-label="사용자 정의 공정 수">
            <Plus size={13} /> {customCount} 사용자
          </span>
          <span className="candidate-tag" aria-label="숨김 처리된 공정 수">
            <EyeOff size={13} /> {hiddenCount} 숨김
          </span>
          <span className="candidate-tag" aria-label="타임라인 단계">
            <Database size={13} /> 타임라인 {timelineLength}
          </span>
        </div>
        <div className="candidate-controls">
          <button
            type="button"
            className={`candidate-erp-toggle touch-target${erpRequired ? " is-active" : ""}`}
            onClick={() => setERPRequired(!erpRequired)}
            aria-pressed={erpRequired}
            aria-label="ERP 인터페이스 필요 여부 토글"
          >
            {erpRequired ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            <span>{erpRequired ? "ERP ON" : "ERP OFF"}</span>
          </button>
          <label className="candidate-controls__group">
            <span className="candidate-controls__label">공정 그룹</span>
            <select
              value={activeProcessGroupId ?? ""}
              onChange={(event) =>
                setActiveProcessGroup(event.target.value ? event.target.value : null)
              }
              aria-label="활성 공정 그룹 선택"
              className="touch-target"
            >
              <option value="">선택되지 않음</option>
              {processGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} · {group.type === "machining" ? "가공" : "후처리"}
                </option>
              ))}
            </select>
          </label>
        </div>
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
        <div className="candidate-list responsive-grid responsive-grid--auto-fit" role="list" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', overflowX: 'hidden' }}>
          {visibleOperations.map((item, index) => (
            <AnimatedCandidateCard
              key={item.id}
              delay={index * 0.05}
              role="listitem"
              className={`candidate-node-card responsive-card touch-target${item.source === "custom" ? " is-custom" : ""}`}
              style={{ flex: '0 1 calc(50% - 0.5rem)', minWidth: '220px', maxWidth: '100%' }}
              draggable
              onClick={handleCardClick(item)}
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
              <div className="timeline-node candidate-node">
                <header className="timeline-node__header">
                  <div className="timeline-node__title-group">
                    <span className="timeline-node__seq">#{item.operation.PROC_SEQ}</span>
                    <span className="timeline-node__title">{item.operation.PROC_CD}</span>
                  </div>
                  <div className="timeline-node__actions">
                    {item.source === "custom" ? (
                      <span className="candidate-node__badge">사용자 정의</span>
                    ) : null}
                  </div>
                </header>
                <p className="timeline-node__desc">{item.operation.PROC_DESC ?? "설명 없음"}</p>
                <div className="timeline-node__meta candidate-node__metrics">
                  <span className="timeline-node__meta-item">
                    <strong>Setup:</strong> {item.operation.SETUP_TIME ?? "-"}
                  </span>
                  <span className="timeline-node__meta-item">
                    <strong>Run:</strong> {item.operation.RUN_TIME ?? "-"}
                  </span>
                  <span className="timeline-node__meta-item">
                    <strong>Wait:</strong> {item.operation.WAIT_TIME ?? "-"}
                  </span>
                </div>
                <div className="candidate-node__footer">
                  <div className="candidate-node__actions">
                    {item.source === "custom" && item.entryId ? (
                      <button
                        type="button"
                    className="candidate-node__action btn-responsive"
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
                      className="candidate-node__action btn-responsive"
                      onClick={handleRemoveOperation(item)}
                      aria-label={item.source === "custom" ? "사용자 정의 공정 삭제" : "추천 공정 숨기기"}
                    >
                      <Trash2 size={14} /> {item.source === "custom" ? "삭제" : "숨기기"}
                    </button>
                  </div>
                  <p className="candidate-node__hint">드래그 또는 더블 클릭으로 추가</p>
                </div>
              </div>
            </AnimatedCandidateCard>
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
