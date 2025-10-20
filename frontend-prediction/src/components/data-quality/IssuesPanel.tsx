import { useEffect, useState } from "react";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { fetchDataQualityReport, type DataQualityReport, type DataQualityIssue } from "@lib/apiClient";
import { IssueBadge, type IssueSeverity } from "./IssueBadge";
import { IssueFilter } from "./IssueFilter";
import { ExportButton, type ExportFormat } from "./ExportButton";
import { exportIssuesToCSV, exportIssuesToPDF } from "../../services/exportService";
import toast, { Toaster } from "react-hot-toast";

type SortField = "timestamp" | "severity" | "type" | "affectedRecords";
type SortOrder = "asc" | "desc";

export function IssuesPanel() {
  const [report, setReport] = useState<DataQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtering
  const [selectedSeverities, setSelectedSeverities] = useState<Set<IssueSeverity | "all">>(
    new Set(["all"])
  );

  // Sorting
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const loadReport = async (showSpinner = true) => {
    try {
      if (showSpinner) {
        setIsRefreshing(true);
      }
      setError(null);
      const data = await fetchDataQualityReport();
      setReport(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load report:", err);
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleManualRefresh = () => {
    loadReport(true);
  };

  const handleExport = async (format: ExportFormat) => {
    try {
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `data-quality-issues-${timestamp}`;

      if (format === "csv") {
        exportIssuesToCSV(filteredIssues, { filename: `${filename}.csv` });
        toast.success(`Exported ${filteredIssues.length} issues to CSV`);
      } else {
        exportIssuesToPDF(filteredIssues, {
          filename: `${filename}.pdf`,
          title: "Data Quality Issues Report",
        });
        toast.success(`Exported ${filteredIssues.length} issues to PDF`);
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export failed. Please try again.");
    }
  };

  const handleFilterChange = (severity: IssueSeverity | "all") => {
    const newSelected = new Set(selectedSeverities);

    if (severity === "all") {
      newSelected.clear();
      newSelected.add("all");
    } else {
      newSelected.delete("all");
      if (newSelected.has(severity)) {
        newSelected.delete(severity);
      } else {
        newSelected.add(severity);
      }

      // If no specific severity selected, select "all"
      if (newSelected.size === 0) {
        newSelected.add("all");
      }
    }

    setSelectedSeverities(newSelected);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const getFilteredAndSortedIssues = (): DataQualityIssue[] => {
    if (!report) return [];

    let filtered = report.issues;

    // Apply filter
    if (!selectedSeverities.has("all")) {
      filtered = filtered.filter((issue) =>
        selectedSeverities.has(issue.severity)
      );
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "timestamp":
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case "severity":
          const severityOrder = { critical: 3, warning: 2, info: 1 };
          comparison = severityOrder[a.severity] - severityOrder[b.severity];
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "affectedRecords":
          comparison = a.affectedRecords - b.affectedRecords;
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  };

  const filteredIssues = getFilteredAndSortedIssues();

  const getCounts = () => {
    if (!report) return { all: 0, critical: 0, warning: 0, info: 0 };
    return {
      all: report.issues.length,
      critical: report.summary.critical,
      warning: report.summary.warning,
      info: report.summary.info,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading issues...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-400">Error: {error}</div>
        <button
          onClick={handleManualRefresh}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">No report data available</div>
      </div>
    );
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? (
      <ChevronUp size={14} className="inline ml-1" />
    ) : (
      <ChevronDown size={14} className="inline ml-1" />
    );
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header with refresh and export buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Data Quality Issues</h2>
          {lastUpdated && (
            <p className="text-sm text-gray-400 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <ExportButton
            onExport={handleExport}
            exportType="issues"
            disabled={filteredIssues.length === 0}
          />
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="text-sm text-gray-400">Total Issues</div>
          <div className="text-3xl font-bold text-white mt-2">{report.issues.length}</div>
        </div>
        <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30">
          <div className="text-sm text-red-400">Critical</div>
          <div className="text-3xl font-bold text-red-400 mt-2">{report.summary.critical}</div>
        </div>
        <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30">
          <div className="text-sm text-yellow-400">Warning</div>
          <div className="text-3xl font-bold text-yellow-400 mt-2">{report.summary.warning}</div>
        </div>
        <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/30">
          <div className="text-sm text-blue-400">Info</div>
          <div className="text-3xl font-bold text-blue-400 mt-2">{report.summary.info}</div>
        </div>
      </div>

      {/* Filter */}
      <IssueFilter
        selectedSeverities={selectedSeverities}
        onFilterChange={handleFilterChange}
        counts={getCounts()}
      />

      {/* Issues Table */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-300"
                  onClick={() => handleSort("severity")}
                >
                  Severity <SortIcon field="severity" />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-300"
                  onClick={() => handleSort("type")}
                >
                  Type <SortIcon field="type" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Message
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-300"
                  onClick={() => handleSort("affectedRecords")}
                >
                  Affected Records <SortIcon field="affectedRecords" />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-300"
                  onClick={() => handleSort("timestamp")}
                >
                  Timestamp <SortIcon field="timestamp" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No issues found matching the selected filters
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <IssueBadge severity={issue.severity} size="sm" />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                      {issue.type}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {issue.message}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                      {issue.affectedRecords.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                      {new Date(issue.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-500">
        Showing {filteredIssues.length} of {report.issues.length} issues
        {report.lastCheck && (
          <span className="ml-4">Last check: {new Date(report.lastCheck).toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}
