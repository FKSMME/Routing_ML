/**
 * CSV Exporter for Routing Data
 *
 * Exports timeline routing data to CSV format per item code
 * Integrates with data mapping and profile settings
 */

import type { TimelineStep } from "@store/routingStore";

export interface CSVExportOptions {
  filename?: string;
  delimiter?: string;
}

/**
 * Convert timeline steps to CSV rows
 */
function timelineToCSVRows(timeline: TimelineStep[], itemCode: string): string[][] {
  const rows: string[][] = [];

  // Header row
  rows.push([
    "Item Code",
    "Sequence",
    "Process Code",
    "Description",
    "Setup Time (min)",
    "Run Time (min)",
    "Wait Time (min)",
    "Routing Set Code",
    "Variant Code",
    "Primary Routing",
    "Secondary Routing",
  ]);

  // Data rows
  timeline.forEach((step) => {
    rows.push([
      itemCode,
      String(step.seq),
      step.processCode,
      step.description || "",
      step.setupTime != null ? String(step.setupTime) : "",
      step.runTime != null ? String(step.runTime) : "",
      step.waitTime != null ? String(step.waitTime) : "",
      step.routingSetCode || "",
      step.variantCode || "",
      step.primaryRoutingCode || "",
      step.secondaryRoutingCode || "",
    ]);
  });

  return rows;
}

/**
 * Convert rows to CSV string
 */
function rowsToCSV(rows: string[][], delimiter = ","): string {
  return rows
    .map((row) =>
      row.map((cell) => {
        // Escape cells containing delimiter, quotes, or newlines
        if (cell.includes(delimiter) || cell.includes('"') || cell.includes("\n")) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(delimiter)
    )
    .join("\n");
}

/**
 * Trigger browser download of CSV file
 */
function downloadCSV(content: string, filename: string): void {
  // Add BOM for Excel UTF-8 compatibility
  const bom = "\uFEFF";
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export single item timeline to CSV
 */
export function exportItemTimelineToCSV(
  timeline: TimelineStep[],
  itemCode: string,
  options: CSVExportOptions = {}
): void {
  const { filename = `routing_${itemCode}_${Date.now()}.csv`, delimiter = "," } = options;

  const rows = timelineToCSVRows(timeline, itemCode);
  const csv = rowsToCSV(rows, delimiter);
  downloadCSV(csv, filename);
}

/**
 * Export multiple items to separate CSV files
 */
export function exportAllItemsToCSV(
  items: Array<{ itemCode: string; timeline: TimelineStep[] }>,
  options: CSVExportOptions = {}
): void {
  const timestamp = Date.now();

  items.forEach(({ itemCode, timeline }) => {
    if (timeline.length === 0) {
      console.warn(`Skipping empty timeline for ${itemCode}`);
      return;
    }

    const filename = options.filename
      ? options.filename.replace("{itemCode}", itemCode)
      : `routing_${itemCode}_${timestamp}.csv`;

    exportItemTimelineToCSV(timeline, itemCode, { ...options, filename });
  });
}
