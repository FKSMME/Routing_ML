import { FormEvent, useState } from "react";

interface PredictionControlsProps {
  itemCodes: string[];
  onChangeItemCodes: (codes: string[]) => void;
  topK: number;
  onChangeTopK: (value: number) => void;
  threshold: number;
  onChangeThreshold: (value: number) => void;
  loading: boolean;
  onSubmit: () => void;
}

export function PredictionControls({
  itemCodes,
  onChangeItemCodes,
  topK,
  onChangeTopK,
  threshold,
  onChangeThreshold,
  loading,
  onSubmit,
}: PredictionControlsProps) {
  const [inputValue, setInputValue] = useState(itemCodes.join(","));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const codes = inputValue
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);
    onChangeItemCodes(codes);
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="panel-card interactive-card space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-accent-strong">품목 코드</label>
        <textarea
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          rows={3}
          className="input-field"
          placeholder="ITEM-001, ITEM-002"
        />
        <p className="text-xs text-muted">콤마로 구분하여 다수의 품목을 입력할 수 있습니다.</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-accent-strong">Top-K 후보 수</label>
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
        <label className="text-xs font-semibold text-accent-strong">유사도 임계값</label>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(threshold * 100)}
          onChange={(event) => onChangeThreshold(Number(event.target.value) / 100)}
          className="w-full"
        />
        <p className="text-xs text-muted">현재 값: {(threshold * 100).toFixed(0)}%</p>
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "예측 중..." : "예측 실행"}
      </button>
    </form>
  );
}
