import type { ExportConfigModel } from "@app-types/workflow";

interface ExportOptionsPanelProps {
  config?: ExportConfigModel;
  selectedFormats: string[];
  onToggleFormat: (format: string, enabled: boolean) => void;
  withVisualization: boolean;
  onToggleVisualization: (value: boolean) => void;
}

const FORMAT_LABELS: Record<string, string> = {
  csv: "CSV",
  txt: "TXT",
  excel: "Excel",
  json: "JSON",
  parquet: "Parquet",
  cache: "Cache",
  erp: "ERP", // 옵션으로 노출
};

export function ExportOptionsPanel({
  config,
  selectedFormats,
  onToggleFormat,
  withVisualization,
  onToggleVisualization,
}: ExportOptionsPanelProps) {
  const isDisabled = (format: string) => {
    if (!config) return false;
    switch (format) {
      case "csv":
        return !config.enable_csv;
      case "txt":
        return !config.enable_txt;
      case "excel":
        return !config.enable_excel;
      case "json":
        return !config.enable_json;
      case "parquet":
        return !config.enable_parquet;
      case "cache":
        return !config.enable_cache_save;
      case "erp":
        return !config.erp_interface_enabled;
      default:
        return false;
    }
  };

  return (
    <section className="panel-card interactive-card">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">출력 & 시각화</h2>
          <p className="panel-subtitle">필요한 내보내기 포맷과 시각화 옵션을 선택합니다.</p>
        </div>
      </header>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-accent-strong">출력 포맷</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {Object.entries(FORMAT_LABELS).map(([format, label]) => {
              const disabled = isDisabled(format);
              const selected = selectedFormats.includes(format);
              return (
                <label
                  key={format}
                  className="export-chip"
                  data-disabled={disabled}
                  data-selected={selected}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={selected}
                    disabled={disabled}
                    onChange={(event) => onToggleFormat(format, event.target.checked)}
                  />
                  <span className="text-sm font-medium">{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <label className="flex items-center justify-between gap-4 text-sm">
          <div>
            <p className="font-semibold text-accent-strong">시각화 결과 포함</p>
            <p className="text-xs text-muted">TensorBoard Projector 및 Neo4j 그래프 스냅샷을 함께 생성합니다.</p>
          </div>
          <input
            type="checkbox"
            className="accent-accent h-5 w-5"
            checked={withVisualization}
            onChange={(event) => onToggleVisualization(event.target.checked)}
          />
        </label>
      </div>
    </section>
  );
}
