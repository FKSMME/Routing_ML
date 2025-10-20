import type { OperationStep } from "@app-types/routing";
import {
  createRecommendationOperationKey,
  type CustomRecommendationEntry,
  type CustomRecommendationInput,
} from "@store/routingStore";
import { Edit3, EyeOff, Plus, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import type { FormEventHandler, MouseEventHandler } from "react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import { DialogContainer } from "./common/DialogContainer";

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

export interface CandidateSettingsModalProps {
  open: boolean;
  onClose: () => void;
  bucket: { itemCode: string; candidateId: string | null } | null;
  customEntries: CustomRecommendationEntry[];
  hiddenOperations: OperationStep[];
  recommendationOperations: OperationStep[];
  addCustomRecommendation: (input: CustomRecommendationInput) => void;
  updateCustomRecommendation: (entryId: string, operation: OperationStep) => void;
  removeCustomRecommendation: (entryId: string) => void;
  hideRecommendation: (itemCode: string, candidateId: string | null, key: string) => void;
  restoreRecommendation: (itemCode: string, candidateId: string | null, key: string) => void;
  restoreAllRecommendations: (itemCode: string, candidateId: string | null) => void;
  initialEditId?: string | null;
}

export function CandidateSettingsModal({
  open,
  onClose,
  bucket,
  customEntries,
  hiddenOperations,
  recommendationOperations,
  addCustomRecommendation,
  updateCustomRecommendation,
  removeCustomRecommendation,
  hideRecommendation,
  restoreRecommendation,
  restoreAllRecommendations,
  initialEditId = null,
}: CandidateSettingsModalProps) {
  const [formState, setFormState] = useState<CustomFormState>(createEmptyFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const titleId = useId();

  const bucketKey = bucket ? `${bucket.itemCode}::${bucket.candidateId ?? "null"}` : null;

  const visibleCustomEntries = useMemo(() => {
    if (!bucket) {
      return [] as CustomRecommendationEntry[];
    }
    return customEntries.filter(
      (entry) => entry.itemCode === bucket.itemCode && entry.candidateId === bucket.candidateId,
    );
  }, [bucket, customEntries]);

  const resetForm = useCallback(() => {
    setFormState(createEmptyFormState());
    setEditingId(null);
    setFormError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const applyEditEntry = useCallback(
    (entryId: string) => {
      const entry = visibleCustomEntries.find((item) => item.id === entryId);
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
    },
    [visibleCustomEntries],
  );

  const hiddenOperationKeys = useMemo(() => {
    return new Set(hiddenOperations.map((operation) => createRecommendationOperationKey(operation)));
  }, [hiddenOperations]);

  const visibleDefaultRecommendations = useMemo(() => {
    if (!bucket) {
      return [] as OperationStep[];
    }
    return recommendationOperations.filter(
      (operation) => !hiddenOperationKeys.has(createRecommendationOperationKey(operation)),
    );
  }, [bucket, hiddenOperationKeys, recommendationOperations]);

  useEffect(() => {
    if (!open) {
      return;
    }
    resetForm();
  }, [open, bucket?.itemCode, bucket?.candidateId, resetForm]);

  useEffect(() => {
    if (!open || !initialEditId) {
      return;
    }
    applyEditEntry(initialEditId);
  }, [applyEditEntry, initialEditId, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, open]);

  useEffect(() => {
    if (!open || !editingId) {
      return;
    }
    const stillExists = visibleCustomEntries.some((entry) => entry.id === editingId);
    if (!stillExists) {
      resetForm();
    }
  }, [editingId, open, resetForm, visibleCustomEntries]);

  if (!open) {
    return null;
  }

  const formDisabled = !bucket;

  const handleBackdropClick: MouseEventHandler<HTMLDivElement> = (event) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
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
      const input: CustomRecommendationInput = {
        itemCode: bucket.itemCode,
        candidateId: bucket.candidateId,
        operation,
      };
      addCustomRecommendation(input);
    }

    resetForm();
  };

  return (
    <DialogContainer
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="candidate-settings-backdrop"
      surfaceClassName="candidate-settings-dialog"
      maxWidth={720}
      onClick={handleBackdropClick}
    >
      <header className="candidate-settings__header">
        <div>
          <h2 id={titleId}>후보 공정 관리</h2>
          <p className="candidate-settings__subtitle">
            사용자 정의 공정과 숨김 처리된 추천 공정을 한 곳에서 관리하세요.
          </p>
        </div>
        <button type="button" className="candidate-settings__close" onClick={handleClose} aria-label="닫기">
          <X size={16} />
        </button>
      </header>

      <section className="candidate-settings__section">
        <header className="candidate-settings__section-header">
          <h3>사용자 정의 공정 {editingId ? "수정" : "추가"}</h3>
          {editingId ? <span className="candidate-settings__badge">편집 중</span> : null}
        </header>
        <p className="candidate-settings__hint">활성 품목에 맞춤 공정을 직접 추가하거나 기존 항목을 수정할 수 있습니다.</p>
        {formError ? <p className="candidate-settings__error">{formError}</p> : null}
        <form className="candidate-settings__form" onSubmit={handleSubmit}>
          <div className="candidate-settings__grid">
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
            <label className="candidate-settings__wide">
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
          <div className="candidate-settings__actions">
            <button type="submit" className="candidate-settings__submit" disabled={formDisabled}>
              <Plus size={14} /> {editingId ? "공정 업데이트" : "공정 추가"}
            </button>
            {editingId ? (
              <button type="button" className="candidate-settings__cancel" onClick={resetForm}>
                취소
              </button>
            ) : null}
          </div>
        </form>

        <div className="candidate-settings__list">
          <header className="candidate-settings__list-header">
            <h4>
              사용자 정의 공정 목록 <span className="candidate-settings__count">({visibleCustomEntries.length})</span>
            </h4>
          </header>
          {visibleCustomEntries.length === 0 ? (
            <p className="candidate-settings__empty">등록된 사용자 정의 공정이 없습니다.</p>
          ) : (
            <ul className="candidate-settings__items">
              {visibleCustomEntries.map((entry) => (
                <li key={entry.id} className="candidate-settings__item">
                  <div>
                    <p className="candidate-settings__item-title">
                      {entry.operation.PROC_CD} #{entry.operation.PROC_SEQ}
                    </p>
                    <p className="candidate-settings__item-desc">
                      {entry.operation.PROC_DESC ?? "설명 없음"}
                    </p>
                  </div>
                  <div className="candidate-settings__item-actions">
                    <button
                      type="button"
                      className="candidate-settings__item-button"
                      onClick={() => applyEditEntry(entry.id)}
                    >
                      <Edit3 size={14} /> 편집
                    </button>
                    <button
                      type="button"
                      className="candidate-settings__item-button"
                      onClick={() => removeCustomRecommendation(entry.id)}
                    >
                      <Trash2 size={14} /> 삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="candidate-settings__section">
        <header className="candidate-settings__section-header">
          <h3>추천 공정 목록</h3>
        </header>
        {visibleDefaultRecommendations.length === 0 ? (
          <p className="candidate-settings__empty">
            숨김 처리되지 않은 추천 공정이 없습니다. 아래에서 숨김 공정을 복원해 보세요.
          </p>
        ) : (
          <ul className="candidate-settings__hidden-list">
            {visibleDefaultRecommendations.map((operation) => {
              const key = createRecommendationOperationKey(operation);
              return (
                <li key={`visible-${key}`} className="candidate-settings__hidden-item">
                  <div>
                    <p className="candidate-settings__item-title">
                      {operation.PROC_CD} #{operation.PROC_SEQ}
                    </p>
                    <p className="candidate-settings__item-desc">{operation.PROC_DESC ?? "설명 없음"}</p>
                  </div>
                  <div className="candidate-settings__item-actions">
                    {bucket ? (
                      <button
                        type="button"
                        className="candidate-settings__item-button"
                        onClick={() => hideRecommendation(bucket.itemCode, bucket.candidateId, key)}
                      >
                        <EyeOff size={14} /> 숨기기
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="candidate-settings__section">
        <header className="candidate-settings__section-header">
          <h3>숨김 처리된 추천 공정</h3>
          {bucket && hiddenOperations.length > 0 ? (
            <button
              type="button"
              className="candidate-settings__restore-all"
              onClick={() => restoreAllRecommendations(bucket.itemCode, bucket.candidateId)}
            >
              <RotateCcw size={14} /> 모두 복원
            </button>
          ) : null}
        </header>
        {hiddenOperations.length === 0 ? (
          <p className="candidate-settings__empty">숨김 처리된 공정이 없습니다.</p>
        ) : (
          <ul className="candidate-settings__hidden-list">
            {hiddenOperations.map((operation) => {
              const key = createRecommendationOperationKey(operation);
              return (
                <li key={`hidden-${key}`} className="candidate-settings__hidden-item">
                  <div>
                    <p className="candidate-settings__item-title">
                      {operation.PROC_CD} #{operation.PROC_SEQ}
                    </p>
                    <p className="candidate-settings__item-desc">{operation.PROC_DESC ?? "설명 없음"}</p>
                  </div>
                  <div className="candidate-settings__item-actions">
                    {bucket ? (
                      <button
                        type="button"
                        className="candidate-settings__item-button"
                        onClick={() => restoreRecommendation(bucket.itemCode, bucket.candidateId, key)}
                      >
                        <Undo2 size={14} /> 복원
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {bucketKey && bucket ? (
        <footer className="candidate-settings__footer">
          <p>
            현재 품목: <strong>{bucket.itemCode}</strong>
            {bucket.candidateId ? ` · Candidate #${bucket.candidateId}` : null}
          </p>
        </footer>
      ) : null}
    </DialogContainer>
  );
}

