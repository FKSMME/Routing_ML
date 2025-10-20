import { useState } from "react";
import { Download, FileText, FileSpreadsheet, ChevronDown } from "lucide-react";

export type ExportFormat = "csv" | "pdf";
export type ExportType = "issues" | "metrics";

interface ExportButtonProps {
  onExport: (format: ExportFormat) => void | Promise<void>;
  exportType: ExportType;
  disabled?: boolean;
  className?: string;
}

export function ExportButton({
  onExport,
  exportType,
  disabled = false,
  className = "",
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    setIsOpen(false);
    setIsExporting(true);
    try {
      await onExport(format);
    } finally {
      setIsExporting(false);
    }
  };

  const exportLabel = exportType === "issues" ? "Export Issues" : "Export Metrics";

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download size={16} className={isExporting ? "animate-bounce" : ""} />
        {isExporting ? "Exporting..." : exportLabel}
        <ChevronDown
          size={14}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && !isExporting && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-20 overflow-hidden">
            <button
              onClick={() => handleExport("csv")}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-gray-700 transition-colors"
            >
              <FileSpreadsheet size={18} className="text-green-400" />
              <div>
                <div className="text-sm font-medium">Export as CSV</div>
                <div className="text-xs text-gray-400">
                  For Excel, Google Sheets
                </div>
              </div>
            </button>

            <div className="border-t border-gray-700" />

            <button
              onClick={() => handleExport("pdf")}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-gray-700 transition-colors"
            >
              <FileText size={18} className="text-red-400" />
              <div>
                <div className="text-sm font-medium">Export as PDF</div>
                <div className="text-xs text-gray-400">
                  Formatted report
                </div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
