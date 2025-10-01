import type { OperationStep } from "@app-types/routing";
import {
  createRecommendationBucketKey,
  createRecommendationOperationKey,
  useRoutingStore,
} from "@store/routingStore";
import {
  Activity,
  Database,
  Edit3,
  EyeOff,
  Plus,
  RotateCcw,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Undo2,
} from "lucide-react";
import type { DragEvent, FormEvent, MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";

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

interface CustomFormState {
  code: string;
  seq: string;
  desc: string;
  setup: string;
  run: string;
  wait: string;
}

const createEmptyFormState = (): CustomFormState => ({
  code: "",
  seq: "",
  desc: "",
  setup: "",
  run: "",
  wait: "",
});

const toFormNumber = (value: number | null | undefined): string =>
  typeof value === "number" ? String(value) : "";

const parseOptionalNumber = (input: string): { value: number | null; valid: boolean } => {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { value: null, valid: true };
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    return { value: null, valid: false };
  }
  return { value: numeric, valid: true };
};

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

  const [filter, setFilter] = useState("");
  const [formState, setFormState] = useState<CustomFormState>(createEmptyFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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

  useEffect(() => {
    setFormState(createEmptyFormState());
    setEditingId(null);
    setFormError(null);
  }, [bucket?.itemCode, bucketCandidateId]);

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

  const resetForm = () => {
    setFormState(createEmptyFormState());
    setEditingId(null);
    setFormError(null);
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bucket) {
      setFormError("활성 품목을 먼저 선택해 주세요.");
      return;
    }
    const code = formState.code.trim();
    if (!code) {
      setFormError("공정 코드를 입력해 주세요.");
      return;
    }
    const seqValue = Number(formState.seq.trim());
    if (!Number.isFinite(seqValue) || !Number.isInteger(seqValue) || seqValue <= 0) {
      setFormError("유효한 공정 순번(양의 정수)을 입력해 주세요.");
      return;
    }

    const setup = parseOptionalNumber(formState.setup);
    const run = parseOptionalNumber(formState.run);
    const wait = parseOptionalNumber(formState.wait);
    if (!setup.valid || !run.valid || !wait.valid) {
      setFormError("세팅/가공/대기 시간은 숫자로 입력해 주세요.");
      return;
    }

    const operation: OperationStep = {
      PROC_CD: code,
      PROC_SEQ: seqValue,
      PROC_DESC: formState.desc.trim() ? formState.desc.trim() : undefined,
      SETUP_TIME: setup.value,
      RUN_TIME: run.value,
      WAIT_TIME: wait.value,
    };

    if (editingId) {
      updateCustomRecommendation(editingId, operation);
    } else {
      addCustomRecommendation({
        itemCode: bucket.itemCode,
        candidateId: bucketCandidateId,
        operation,
      });
    }

    resetForm();
  };

  const handleEditCustom = (entryId: string) => {
    const entry = bucketCustomEntries.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }
    const { operation } = entry;
    setFormState({
      code: operation.PROC_CD ?? "",
      seq: operation.PROC_SEQ !== undefined ? String(operation.PROC_SEQ) : "",
      desc: operation.PROC_DESC ?? "",
      setup: toFormNumber(operation.SETUP_TIME),
      run: toFormNumber(operation.RUN_TIME),
      wait: toFormNumber(operation.WAIT_TIME),
    });
    setEditingId(entryId);
    setFormError(null);
  };

  const handleRemoveOperation = (item: CandidateOperation) => (event: MouseEvent) => {
    event.stopPropagation();
    if (!bucket) {
      return;
    }
    if (item.source === "custom" && item.entryId) {
      removeCustomRecommendation(item.entryId);
      if (editingId === item.entryId) {
        resetForm();
      }
      return;
    }
    const operationKey = createRecommendationOperationKey(item.operation);
    hideRecommendation(bucket.itemCode, bucketCandidateId, operationKey);
  };

  const formDisabled = !bucket;

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

      <form className="candidate-custom-form" onSubmit={handleFormSubmit}>
        <div className="candidate-custom-form__header">
          <h3>사용자 정의 공정 {editingId ? "수정" : "추가"}</h3>
          {editingId ? <span className="candidate-custom-form__badge">편집 중</span> : null}
        </div>
        <p className="candidate-custom-form__hint">활성 품목에 맞춤 공정을 직접 추가하거나 기존 항목을 수정할 수 있습니다.</p>
        {formError ? <p className="candidate-custom-form__error">{formError}</p> : null}
        <div className="candidate-custom-form__grid">
          <label>
            <span>공정 코드*</span>
            <input
              type="text"
              value={formState.code}
              onChange={(event) => setFormState((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="예: CUT-01"
              required
              disabled={formDisabled}
            />
          </label>
          <label>
            <span>순번*</span>
            <input
              type="number"
              value={formState.seq}
              onChange={(event) => setFormState((prev) => ({ ...prev, seq: event.target.value }))}
              placeholder="예: 10"
              min={1}
              step={1}
              required
              disabled={formDisabled}
            />
          </label>
          <label className="candidate-custom-form__wide">
            <span>설명</span>
            <input
              type="text"
              value={formState.desc}
              onChange={(event) => setFormState((prev) => ({ ...prev, desc: event.target.value }))}
              placeholder="공정 설명 입력"
              disabled={formDisabled}
            />
          </label>
          <label>
            <span>세팅 시간</span>
            <input
              type="text"
              value={formState.setup}
              onChange={(event) => setFormState((prev) => ({ ...prev, setup: event.target.value }))}
              placeholder="분"
              disabled={formDisabled}
            />
          </label>
          <label>
            <span>가공 시간</span>
            <input
              type="text"
              value={formState.run}
              onChange={(event) => setFormState((prev) => ({ ...prev, run: event.target.value }))}
              placeholder="분"
              disabled={formDisabled}
            />
          </label>
          <label>
            <span>대기 시간</span>
            <input
              type="text"
              value={formState.wait}
              onChange={(event) => setFormState((prev) => ({ ...prev, wait: event.target.value }))}
              placeholder="분"
              disabled={formDisabled}
            />
          </label>
        </div>
        <div className="candidate-custom-form__actions">
          <button type="submit" className="candidate-custom-form__submit" disabled={formDisabled}>
            <Plus size={14} /> {editingId ? "공정 업데이트" : "공정 추가"}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm} className="candidate-custom-form__cancel">
              취소
            </button>
          ) : null}
        </div>
      </form>

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
                      handleEditCustom(item.entryId);
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

      {bucket && hiddenOperations.length > 0 ? (
        <div className="candidate-hidden">
          <div className="candidate-hidden__header">
            <h3>숨김 처리된 공정 ({hiddenCount})</h3>
            <button
              type="button"
              className="candidate-hidden__restore-all"
              onClick={() => restoreAllRecommendations(bucket.itemCode, bucketCandidateId)}
            >
              <RotateCcw size={14} /> 모두 복원
            </button>
          </div>
          <ul className="candidate-hidden__list">
            {hiddenOperations.map((operation) => {
              const key = createRecommendationOperationKey(operation);
              return (
                <li key={`hidden-${key}`} className="candidate-hidden__item">
                  <span className="candidate-hidden__label">
                    {operation.PROC_CD} #{operation.PROC_SEQ}
                  </span>
                  <button
                    type="button"
                    className="candidate-hidden__restore"
                    onClick={() => restoreRecommendation(bucket.itemCode, bucketCandidateId, key)}
                  >
                    <Undo2 size={14} /> 복원
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
