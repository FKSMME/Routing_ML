import type { DataMappingApplyResponse } from "@lib/apiClient";
import { Download, X } from "lucide-react";
import { useState } from "react";

interface ComprehensiveRoutingPreviewProps {
  data: DataMappingApplyResponse;
  onClose: () => void;
  onDownload: () => Promise<void>;
}

export function ComprehensiveRoutingPreview({
  data,
  onClose,
  onDownload,
}: ComprehensiveRoutingPreviewProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-morphism rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between p-6 border-b border-dark-border">
          <div>
            <h2 className="heading-2 flex items-center gap-3">
              종합 라우팅 미리보기
            </h2>
            <p className="body-text-secondary mt-1">
              {data.total_rows}개 행 · {data.columns.length}개 컬럼
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {data.message && (
            <div className="mb-4 p-4 rounded-lg bg-primary-500/10 border border-primary-500/30">
              <p className="text-sm text-primary-200">{data.message}</p>
            </div>
          )}

          {/* Preview Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-dark-surface border-b-2 border-primary-500">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary-400">
                    #
                  </th>
                  {data.columns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold text-primary-400"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.preview_rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={data.columns.length + 1}
                      className="px-4 py-8 text-center text-dark-text-secondary"
                    >
                      미리보기 데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  data.preview_rows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-b border-dark-border hover:bg-dark-surface/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-dark-text-tertiary">
                        {rowIndex + 1}
                      </td>
                      {data.columns.map((col) => (
                        <td
                          key={col}
                          className="px-4 py-3 text-xs text-dark-text-primary"
                        >
                          {row[col] !== null && row[col] !== undefined
                            ? String(row[col])
                            : "-"}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data.preview_rows.length > 0 && data.total_rows > data.preview_rows.length && (
            <p className="text-xs text-dark-text-secondary mt-4 text-center">
              미리보기는 최대 10행까지 표시됩니다. 전체 {data.total_rows}행은 CSV 다운로드 시
              포함됩니다.
            </p>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-4 p-6 border-t border-dark-border bg-dark-surface/30">
          <div className="flex-1">
            <p className="text-sm font-medium">프로파일: {data.profile_id}</p>
            <p className="text-xs text-dark-text-secondary mt-1">
              라우팅 그룹: {data.routing_group_id}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
            >
              취소
            </button>
            <button
              type="button"
              className="btn-primary neon-cyan flex items-center gap-2"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              <Download size={18} />
              {isDownloading ? "다운로드 중..." : "CSV 다운로드"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
