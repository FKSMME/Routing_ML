import { hasItemCodesDragData, readItemCodesDragData } from "@lib/dragAndDrop";
import { FormEvent, forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";

interface PredictionControlsProps {
  itemCodes: string[];
  onChangeItemCodes: (codes: string[]) => void;
  topK: number;
  onChangeTopK: (value: number) => void;
  threshold: number;
  onChangeThreshold: (value: number) => void;
  loading: boolean;
  onSubmit: () => void;
  errorMessage?: string | null;
}

const splitItemCodes = (value: string): string[] =>
  value
    .split(/\r?\n|,|;|\t/)
    .map((code) => code.trim())
    .filter(Boolean);

const MAX_ITEM_CODES = 50;

const mergeItemCodes = (current: string[], incoming: string[]): string[] => {
  const result: string[] = [...current];
  for (const raw of incoming) {
    if (!raw) continue;
    const code = raw.trim();
    if (!code) continue;
    if (!result.includes(code)) {
      result.push(code);
    }
    if (result.length >= MAX_ITEM_CODES) {
      break;
    }
  }
  return result.slice(0, MAX_ITEM_CODES);
};

export interface PredictionControlsHandle {
  appendItemCodes: (codes: string[]) => void;
}

export const PredictionControls = forwardRef<PredictionControlsHandle, PredictionControlsProps>(function PredictionControls(
  {
    itemCodes,
    onChangeItemCodes,
    topK,
    onChangeTopK,
    threshold,
    onChangeThreshold,
    loading,
    onSubmit,
    errorMessage,
  },
  ref,
) {
  const [inputValue, setInputValue] = useState(itemCodes.join("\n"));
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    setInputValue(itemCodes.join("\n"));
  }, [itemCodes]);

  const appendItemCodes = useCallback((incoming: string[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) {
      return;
    }
    setInputValue((previous) => {
      const existing = splitItemCodes(previous);
      const next = mergeItemCodes(existing, incoming);
      return next.join("\n");
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      appendItemCodes,
    }),
    [appendItemCodes],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const codes = splitItemCodes(inputValue);
    onChangeItemCodes(codes);
    onSubmit();
  };

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLTextAreaElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      const payload = readItemCodesDragData(event.dataTransfer);
      if (!payload || payload.items.length === 0) {
        return;
      }
      appendItemCodes(payload.items);
    },
    [appendItemCodes],
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLTextAreaElement>) => {
    if (!hasItemCodesDragData(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLTextAreaElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return;
    }
    setIsDragOver(false);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="panel-card interactive-card space-y-4 prediction-panel">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-accent-strong">품목 코드 목록</label>
        <textarea
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          rows={8}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`input-field prediction-panel__textarea ${isDragOver ? "prediction-panel__textarea--drag-over" : ""}`}
          placeholder={"ITEM-001\nITEM-002"}
        />
        <p className="text-xs text-muted">
          줄바꿈 또는 콤마로 여러 품목을 입력하세요. 좌측 ERP 리스트에서 Drag & Drop으로 빠르게 추가할 수 있습니다. 최대 {MAX_ITEM_CODES}건을
          지원합니다.
        </p>
      </div>

      <div className="prediction-grid">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-accent-strong">추천 개수 (Top K)</label>
          <input
            type="number"
            min={1}
            max={50}
            value={topK}
            onChange={(event) => onChangeTopK(Number(event.target.value))}
            className="input-field"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-accent-strong">최소 유사도 (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={Math.round(threshold * 100)}
            onChange={(event) => onChangeThreshold(Number(event.target.value) / 100)}
            className="input-field"
          />
        </div>
      </div>

      {errorMessage ? (
        <p className="prediction-panel__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "추천 불러오는 중..." : "추천 실행"}
      </button>
    </form>
  );
});
