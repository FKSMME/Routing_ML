import { usePurchaseOrderItems } from "@hooks/usePurchaseOrderItems";
import { FormEvent, useEffect, useState } from "react";

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

export function PredictionControls({
  itemCodes,
  onChangeItemCodes,
  topK,
  onChangeTopK,
  threshold,
  onChangeThreshold,
  loading,
  onSubmit,
  errorMessage,
}: PredictionControlsProps) {
  const [inputValue, setInputValue] = useState(itemCodes.join("\n"));
  const { items: purchaseItems, isLoading: isPurchaseLoading } = usePurchaseOrderItems();
  const [selectedPurchaseItem, setSelectedPurchaseItem] = useState("");

  useEffect(() => {
    setInputValue(itemCodes.join("\n"));
  }, [itemCodes]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const codes = splitItemCodes(inputValue);
    onChangeItemCodes(codes);
    onSubmit();
  };

  const handlePurchaseItemSelect = (itemCode: string) => {
    if (!itemCode) return;

    // Add selected item to textarea (if not already present)
    const currentCodes = splitItemCodes(inputValue);
    if (!currentCodes.includes(itemCode)) {
      const newValue = inputValue ? `${inputValue}\n${itemCode}` : itemCode;
      setInputValue(newValue);
    }

    // Reset dropdown
    setSelectedPurchaseItem("");
  };

  return (
    <form onSubmit={handleSubmit} className="panel-card interactive-card space-y-4 prediction-panel">
      {/* Purchase Order Items Dropdown */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-accent-strong">생산 접수 품목</label>
        <select
          value={selectedPurchaseItem}
          onChange={(e) => handlePurchaseItemSelect(e.target.value)}
          className="input-field"
          disabled={isPurchaseLoading}
        >
          <option value="">
            {isPurchaseLoading ? "로딩 중..." : "품목을 선택하여 추가..."}
          </option>
          {purchaseItems.map((item) => (
            <option key={item.ITEM_CD} value={item.ITEM_CD}>
              {item.ITEM_CD} - {item.PO_NO} ({item.PO_DATE})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">
          생산 접수된 품목을 선택하면 아래 입력창에 자동으로 추가됩니다.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-accent-strong">품목 코드 목록</label>
        <textarea
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          rows={8}
          className="input-field prediction-panel__textarea"
          placeholder={"ITEM-001\nITEM-002"}
        />
        <p className="text-xs text-muted">줄바꿈 또는 콤마로 여러 품목을 입력하세요. 최대 50건을 지원합니다.</p>
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
}
