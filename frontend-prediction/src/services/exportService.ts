import type { DataQualityIssue, DataQualityMetrics } from "@lib/apiClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";

/**
 * Export Service
 * Handles CSV and PDF export functionality for Data Quality UI
 */

// ============================================================================
// CSV Export
// ============================================================================

export interface CSVExportOptions {
  filename: string;
  includeHeader?: boolean;
  separator?: "," | ";" | "\t";
}

/**
 * Export issues to CSV format
 */
export function exportIssuesToCSV(
  issues: DataQualityIssue[],
  options: CSVExportOptions = { filename: "data-quality-issues.csv" }
): void {
  const { filename, includeHeader = true, separator = "," } = options;

  // Prepare data for CSV
  const csvData = issues.map((issue) => ({
    ID: issue.id,
    Severity: issue.severity,
    Type: issue.type,
    Message: issue.message,
    "Affected Records": issue.affectedRecords,
    Timestamp: new Date(issue.timestamp).toLocaleString(),
  }));

  // Convert to CSV
  const csv = Papa.unparse(csvData, {
    delimiter: separator,
    header: includeHeader,
  });

  // Download file
  downloadFile(csv, filename, "text/csv");
}

/**
 * Export metrics to CSV format
 */
export function exportMetricsToCSV(
  metrics: DataQualityMetrics,
  options: CSVExportOptions = { filename: "data-quality-metrics.csv" }
): void {
  const { filename, includeHeader = true, separator = "," } = options;

  // Prepare data for CSV
  const csvData = [
    {
      Metric: "Completeness",
      Value: `${metrics.completeness}%`,
      Timestamp: metrics.timestamp,
    },
    {
      Metric: "Consistency",
      Value: `${metrics.consistency}%`,
      Timestamp: metrics.timestamp,
    },
    {
      Metric: "Validity",
      Value: `${metrics.validity}%`,
      Timestamp: metrics.timestamp,
    },
  ];

  // Add trend data if available
  if (metrics.trends) {
    csvData.push(
      {
        Metric: "Completeness Trend (last 10)",
        Value: metrics.trends.completeness.join(", "),
        Timestamp: metrics.timestamp,
      },
      {
        Metric: "Consistency Trend (last 10)",
        Value: metrics.trends.consistency.join(", "),
        Timestamp: metrics.timestamp,
      },
      {
        Metric: "Validity Trend (last 10)",
        Value: metrics.trends.validity.join(", "),
        Timestamp: metrics.timestamp,
      }
    );
  }

  // Convert to CSV
  const csv = Papa.unparse(csvData, {
    delimiter: separator,
    header: includeHeader,
  });

  // Download file
  downloadFile(csv, filename, "text/csv");
}

// ============================================================================
// PDF Export
// ============================================================================

export interface PDFExportOptions {
  filename: string;
  title: string;
  includeTimestamp?: boolean;
}

/**
 * Export issues to PDF format
 */
export function exportIssuesToPDF(
  issues: DataQualityIssue[],
  options: PDFExportOptions = {
    filename: "data-quality-issues.pdf",
    title: "Data Quality Issues Report",
  }
): void {
  const { filename, title, includeTimestamp = true } = options;

  // Create PDF
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(18);
  doc.text(title, 14, 20);

  // Add timestamp
  if (includeTimestamp) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  }

  // Add summary
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Total Issues: ${issues.length}`, 14, 38);

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  doc.setFontSize(10);
  doc.text(`Critical: ${criticalCount}`, 14, 44);
  doc.text(`Warning: ${warningCount}`, 50, 44);
  doc.text(`Info: ${infoCount}`, 85, 44);

  // Prepare table data
  const tableData = issues.map((issue) => [
    issue.severity,
    issue.type,
    issue.message.substring(0, 50) + (issue.message.length > 50 ? "..." : ""),
    issue.affectedRecords.toLocaleString(),
    new Date(issue.timestamp).toLocaleDateString(),
  ]);

  // Add table
  autoTable(doc, {
    startY: 52,
    head: [["Severity", "Type", "Message", "Affected Records", "Date"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [41, 128, 185] },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 30 },
      2: { cellWidth: 70 },
      3: { cellWidth: 30 },
      4: { cellWidth: 30 },
    },
  });

  // Save PDF
  doc.save(filename);
}

/**
 * Export metrics to PDF format
 */
export function exportMetricsToPDF(
  metrics: DataQualityMetrics,
  options: PDFExportOptions = {
    filename: "data-quality-metrics.pdf",
    title: "Data Quality Metrics Report",
  }
): void {
  const { filename, title, includeTimestamp = true } = options;

  // Create PDF
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(18);
  doc.text(title, 14, 20);

  // Add timestamp
  if (includeTimestamp) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Data Timestamp: ${metrics.timestamp}`, 14, 34);
  }

  // Add metrics
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Current Metrics", 14, 44);

  const metricsData = [
    ["Completeness", `${metrics.completeness}%`, getStatusColor(metrics.completeness)],
    ["Consistency", `${metrics.consistency}%`, getStatusColor(metrics.consistency)],
    ["Validity", `${metrics.validity}%`, getStatusColor(metrics.validity)],
  ];

  autoTable(doc, {
    startY: 50,
    head: [["Metric", "Value", "Status"]],
    body: metricsData,
    theme: "striped",
    headStyles: { fillColor: [41, 128, 185] },
    styles: { fontSize: 12, cellPadding: 4 },
  });

  // Add trend section if available
  if (metrics.trends) {
    const finalY = (doc as any).lastAutoTable.finalY || 50;

    doc.setFontSize(14);
    doc.text("Historical Trends (Last 10 Data Points)", 14, finalY + 15);

    const trendsData = [
      ["Completeness", metrics.trends.completeness.join(", ")],
      ["Consistency", metrics.trends.consistency.join(", ")],
      ["Validity", metrics.trends.validity.join(", ")],
    ];

    autoTable(doc, {
      startY: finalY + 20,
      head: [["Metric", "Trend Values"]],
      body: trendsData,
      theme: "striped",
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 10, cellPadding: 3 },
    });
  }

  // Save PDF
  doc.save(filename);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Download a file to the user's device
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get status color description based on metric value
 */
function getStatusColor(value: number): string {
  if (value >= 95) return "Excellent";
  if (value >= 90) return "Good";
  if (value >= 85) return "Fair";
  if (value >= 75) return "Poor";
  return "Critical";
}
