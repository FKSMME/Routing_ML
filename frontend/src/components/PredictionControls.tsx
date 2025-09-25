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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200">품목 코드</label>
        <textarea
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          placeholder="ITEM-001, ITEM-002"
        />
        <p className="text-xs text-slate-500">콤마로 구분하여 다수의 품목을 입력할 수 있습니다.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200">Top-K 후보 수</label>
        <input
          type="number"
          min={1}
          max={50}
          value={topK}
          onChange={(event) => onChangeTopK(Number(event.target.value))}
          className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200">유사도 임계값</label>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(threshold * 100)}
          onChange={(event) => onChangeThreshold(Number(event.target.value) / 100)}
          className="w-full"
        />
        <p className="text-xs text-slate-400">현재 값: {(threshold * 100).toFixed(0)}%</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        {loading ? "예측 중..." : "예측 실행"}
      </button>
    </form>
  );
}
