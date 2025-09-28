import { fetchTrainingStatus, runTraining, type TrainingRequestPayload, type TrainingStatus } from "@lib/apiClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

interface TrainingConsoleProps {
  defaultMetadata?: string[];
}

export function TrainingConsole({ defaultMetadata }: TrainingConsoleProps) {
  const [versionLabel, setVersionLabel] = useState<string>("");
  const [dryRun, setDryRun] = useState<boolean>(false);
  const [metadataColumns, setMetadataColumns] = useState<string[]>(defaultMetadata ?? []);

  const statusQuery = useQuery<TrainingStatus>({
    queryKey: ["training-status"],
    queryFn: fetchTrainingStatus,
    refetchInterval: 5_000,
  });

  const runMutation = useMutation({
    mutationFn: (payload: TrainingRequestPayload) => runTraining(payload),
    onSuccess: () => statusQuery.refetch(),
  });

  const isRunning = statusQuery.data?.status === "running";
  const progress = statusQuery.data?.progress ?? 0;

  const formattedMetrics = useMemo(() => {
    const metrics = statusQuery.data?.metrics ?? {};
    return Object.entries(metrics).slice(0, 4);
  }, [statusQuery.data?.metrics]);

  const handleSubmit = () => {
    const payload: TrainingRequestPayload = {
      version_label: versionLabel || undefined,
      dry_run: dryRun,
      projector_metadata: metadataColumns.length > 0 ? metadataColumns : undefined,
    };
    runMutation.mutate(payload);
  };

  return (
    <section className="panel-card interactive-card">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">모델 학습 콘솔</h2>
          <p className="panel-subtitle">학습을 별도 GUI에서 실행하고 버전별로 관리합니다.</p>
        </div>
      </header>

      <div className="space-y-4 text-sm">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-accent-strong">버전 라벨</span>
          <input
            type="text"
            placeholder="예: version_2025Q1"
            value={versionLabel}
            onChange={(event) => setVersionLabel(event.target.value)}
            className="input-field"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-accent-strong">TensorBoard 메타데이터 컬럼</span>
          <textarea
            value={metadataColumns.join(",")}
            onChange={(event) => setMetadataColumns(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
            rows={2}
            className="input-field"
            placeholder="ITEM_CD, ITEM_NM, GROUP1"
          />
          <span className="text-[11px] text-muted">쉼표로 구분해 입력하세요.</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-accent h-4 w-4"
            checked={dryRun}
            onChange={(event) => setDryRun(event.target.checked)}
          />
          <span className="text-muted">드라이런 (데이터 구조만 검증)</span>
        </label>

        <button
          type="button"
          className="btn-primary"
          disabled={isRunning || runMutation.isPending}
          onClick={handleSubmit}
        >
          {isRunning ? "학습 실행 중" : "학습 시작"}
        </button>

        <div className="rounded-2xl border border-gradient p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-accent-strong">현재 상태</span>
            <span className="text-muted">{statusQuery.data?.status ?? "idle"}</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-surface-weak">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${progress}%`, transition: "width 0.4s ease" }}
            />
          </div>
          <p className="mt-3 text-xs text-muted">{statusQuery.data?.message ?? "대기 중"}</p>
          {statusQuery.data?.version_path ? (
            <p className="mt-2 text-[11px] text-muted">저장 경로: {statusQuery.data.version_path}</p>
          ) : null}
          {formattedMetrics.length > 0 ? (
            <dl className="mt-3 space-y-1 text-[11px] text-muted">
              {formattedMetrics.map(([key, value]) => (
                <div key={key} className="flex justify-between gap-2">
                  <dt className="font-semibold text-accent-soft">{key}</dt>
                  <dd className="truncate text-right">{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}
