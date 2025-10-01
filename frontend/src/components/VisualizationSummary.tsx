import type { PredictionMetrics } from "@app-types/routing";

interface VisualizationSummaryProps {
  metrics?: PredictionMetrics;
}

export function VisualizationSummary({ metrics }: VisualizationSummaryProps) {
  if (!metrics) {
    return null;
  }

  const exportedFiles = metrics.exported_files ?? [];
  const exportErrors = metrics.export_errors ?? [];
  const hasExportedFiles = exportedFiles.length > 0;
  const hasExportErrors = exportErrors.length > 0;
  const visualization = metrics.visualization ?? {};
  const tensorboardPath =
    typeof visualization.tensorboard === "string" && visualization.tensorboard.trim() !== ""
      ? visualization.tensorboard
      : undefined;
  const neo4jInfo = visualization.neo4j ?? null;
  const neo4jWorkspace =
    typeof neo4jInfo?.workspace === "string" && neo4jInfo.workspace.trim() !== ""
      ? neo4jInfo.workspace
      : undefined;
  const neo4jBrowserUrl =
    typeof neo4jInfo?.browser_url === "string" && neo4jInfo.browser_url.trim() !== ""
      ? neo4jInfo.browser_url
      : undefined;

  return (
    <section className="panel-card interactive-card">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">시각화 & 전달물</h2>
          <p className="panel-subtitle">TensorBoard, Neo4j, 파일 내보내기 현황을 확인하세요.</p>
        </div>
      </header>

      <div className="space-y-4 text-sm">
        <div
          className="rounded-2xl bg-surface-weak/70 p-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-xs font-semibold text-accent-strong">내보내기 상태</p>
          {hasExportErrors ? (
            <p className="text-xs font-medium" style={{ color: "var(--danger-strong)" }}>
              총 {exportErrors.length}건의 내보내기 실패가 발생했습니다. 관리자에게 전달하여 조치하세요.
            </p>
          ) : hasExportedFiles ? (
            <p className="text-xs text-accent">
              총 {exportedFiles.length}개의 파일을 성공적으로 저장했습니다.
            </p>
          ) : (
            <p className="text-xs text-muted">최근 실행된 내보내기 결과가 없습니다.</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-accent-strong">TensorBoard Projector</p>
          <p className="text-xs text-muted">
            {tensorboardPath ? `생성 경로: ${tensorboardPath}` : "최근 예측에서 생성된 TensorBoard 스냅샷이 없습니다."}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-accent-strong">Neo4j 그래프</p>
          <p className="text-xs text-muted">
            {neo4jBrowserUrl ? (
              <span>
                워크스페이스 {neo4jWorkspace ?? "-"}, 브라우저 {neo4jBrowserUrl}
              </span>
            ) : (
              "생성된 그래프 데이터가 없습니다."
            )}
          </p>
        </div>

        {hasExportedFiles ? (
          <div>
            <p className="text-xs font-semibold text-accent-strong">내보낸 파일</p>
            <ul className="space-y-1 text-xs text-muted">
              {exportedFiles.map((file) => (
                <li key={file} className="truncate">{file}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasExportErrors ? (
          <div>
            <p className="text-xs font-semibold text-accent-strong">실패한 내보내기</p>
            <ul className="space-y-1 text-[11px]" style={{ color: "var(--danger-strong)" }}>
              {exportErrors.map((entry, index) => {
                const key = `${entry.path}-${index}`;
                return (
                  <li key={key} className="truncate">
                    <span className="font-semibold">{entry.path}:</span> {entry.error}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
