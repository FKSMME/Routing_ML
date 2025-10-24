import { hasItemCodesDragData, readItemCodesDragData } from "@lib/dragAndDrop";
import { useModelStatus } from "@hooks/useModelStatus";
import { useModelVersions } from "@hooks/useModelVersions";
import { FormEvent, forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";

interface PredictionControlsProps {
  itemCodes: string[];
  onChangeItemCodes: (codes: string[]) => void;
  topK: number;
  onChangeTopK: (value: number) => void;
  threshold: number;
  onChangeThreshold: (value: number) => void;
  selectedModelVersion: string;
  onChangeModelVersion: (version: string) => void;
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
    selectedModelVersion,
    onChangeModelVersion,
    loading,
    onSubmit,
    errorMessage,
  },
  ref,
) {
  const [inputValue, setInputValue] = useState(itemCodes.join("\n"));
  const [isDragOver, setIsDragOver] = useState(false);

  // Task 2.3: 모델 상태 조회
  const { data: modelStatus, isLoading: modelStatusLoading } = useModelStatus();

  // Phase 7: 모델 버전 목록 조회
  const { data: modelList, isLoading: modelsLoading } = useModelVersions();

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

    // Task 2.4: 모델 상태 검증
    if (!modelStatus?.loaded) {
      console.error("[PredictionControls] 모델이 로딩되지 않아 예측 실행 불가");
      alert("모델이 로딩되지 않았습니다.\n\n시스템 관리자에게 문의하거나 잠시 후 다시 시도해주세요.");
      return;
    }

    // Task 1.4: 품목 전환 UI 피드백 - 로그 추가
    const codes = splitItemCodes(inputValue);
    console.log("[PredictionControls] 추천 실행 요청 - 품목 개수:", codes.length, "품목:", codes);

    // 품목 유효성 검증
    if (codes.length === 0) {
      console.warn("[PredictionControls] 품목 코드가 비어있습니다");
      alert("품목 코드를 입력해주세요.");
      return;
    }

    if (codes.length > MAX_ITEM_CODES) {
      console.warn("[PredictionControls] 품목 개수 초과:", codes.length);
      alert(`최대 ${MAX_ITEM_CODES}개까지 입력 가능합니다.\n현재: ${codes.length}개`);
      return;
    }

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
          placeholder={"품목 코드 입력\n(한 줄에 하나씩)"}
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

      {/* Task 2.3: 모델 상태 인디케이터 */}
      {!modelStatusLoading && modelStatus && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
            modelStatus.loaded
              ? "bg-green-900/30 text-green-400 border border-green-700/50"
              : "bg-red-900/30 text-red-400 border border-red-700/50"
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${modelStatus.loaded ? "bg-green-400" : "bg-red-400"}`} />
          <div className="flex-1">
            {modelStatus.loaded ? (
              <>
                <span className="font-semibold">모델 로딩됨</span>
                {modelStatus.version && (
                  <span className="ml-2 text-xs opacity-75">({modelStatus.version})</span>
                )}
              </>
            ) : (
              <span className="font-semibold">⚠️ 모델 미로딩</span>
            )}
          </div>
        </div>
      )}

      {/* Phase 7: 모델 선택 및 정보 표시 */}
      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-accent-strong">예측 모델 선택</label>
          <select
            value={selectedModelVersion}
            onChange={(e) => onChangeModelVersion(e.target.value)}
            className="input-field"
            disabled={modelsLoading}
          >
            <option value="default">기본 모델 (default)</option>
            {modelList?.models.map((model) => (
              <option key={model.version_name} value={model.version_name}>
                {model.version_name} {model.active_flag ? "(활성)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* 선택된 모델 정보 박스 */}
        {selectedModelVersion && (
          <div className="rounded-md border border-slate-700 bg-slate-800/30 p-3">
            <div className="text-xs font-semibold text-accent-strong mb-2">모델 정보</div>
            <div className="space-y-1 text-xs text-slate-300">
              {selectedModelVersion === "default" ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">버전:</span>
                    <span className="font-mono">기본 모델</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">상태:</span>
                    <span className="text-green-400">활성</span>
                  </div>
                </>
              ) : (
                (() => {
                  const selectedModel = modelList?.models.find((m) => m.version_name === selectedModelVersion);
                  return selectedModel ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400">버전:</span>
                        <span className="font-mono">{selectedModel.version_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">생성일:</span>
                        <span>{new Date(selectedModel.created_at).toLocaleDateString("ko-KR")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">상태:</span>
                        <span
                          className={
                            selectedModel.status === "active"
                              ? "text-green-400"
                              : selectedModel.status === "pending"
                                ? "text-yellow-400"
                                : "text-slate-400"
                          }
                        >
                          {selectedModel.status === "active" ? "활성" : selectedModel.status === "pending" ? "대기 중" : "중지됨"}
                        </span>
                      </div>
                      {selectedModel.trained_at && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">학습일:</span>
                          <span>{new Date(selectedModel.trained_at).toLocaleDateString("ko-KR")}</span>
                        </div>
                      )}
                    </>
                  ) : null;
                })()
              )}
            </div>
          </div>
        )}
      </div>

      <button type="submit" disabled={loading || !modelStatus?.loaded} className="btn-primary w-full">
        {loading ? "추천 불러오는 중..." : "추천 실행"}
      </button>
    </form>
  );
});
