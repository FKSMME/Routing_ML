import type { PredictionMetrics } from "@types/routing";

interface VisualizationSummaryProps {
  metrics?: PredictionMetrics;
}

export function VisualizationSummary({ metrics }: VisualizationSummaryProps) {
  if (!metrics) {
    return null;
  }

  const exportedFiles = metrics.exported_files ?? [];
  const tensorboardPath = typeof metrics.visualization?.tensorboard === "string" ? metrics.visualization.tensorboard : undefined;
  const neo4jInfo = metrics.visualization?.neo4j as Record<string, unknown> | undefined;

  return (
    <section className="panel-card interactive-card">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">시각화 & 전달물</h2>
          <p className="panel-subtitle">TensorBoard, Neo4j, 파일 내보내기 현황을 확인하세요.</p>
        </div>
      </header>

      <div className="space-y-4 text-sm">
        <div>
          <p className="text-xs font-semibold text-accent-strong">TensorBoard Projector</p>
          <p className="text-xs text-muted">
            {tensorboardPath ? `생성 경로: ${tensorboardPath}` : "최근 예측에서 생성된 TensorBoard 스냅샷이 없습니다."}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-accent-strong">Neo4j 그래프</p>
          <p className="text-xs text-muted">
            {neo4jInfo?.browser_url ? (
              <span>
                워크스페이스 {neo4jInfo.workspace ?? "-"}, 브라우저 {neo4jInfo.browser_url as string}
              </span>
            ) : (
              "생성된 그래프 데이터가 없습니다."
            )}
          </p>
        </div>

        {exportedFiles.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-accent-strong">내보낸 파일</p>
            <ul className="space-y-1 text-xs text-muted">
              {exportedFiles.map((file) => (
                <li key={file} className="truncate">{file}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
