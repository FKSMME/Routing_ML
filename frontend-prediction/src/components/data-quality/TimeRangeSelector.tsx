import React, { useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { format, subDays, subHours } from "date-fns";

export type TimeRange = "24h" | "7d" | "30d" | "custom";

export interface TimeRangeOption {
  value: TimeRange;
  label: string;
  description: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

interface TimeRangeSelectorProps {
  selectedRange: TimeRange;
  onRangeChange: (range: TimeRange, dateRange: DateRange) => void;
  customRange?: DateRange;
  disabled?: boolean;
}

const timeRangeOptions: TimeRangeOption[] = [
  {
    value: "24h",
    label: "Last 24 Hours",
    description: "Past day",
  },
  {
    value: "7d",
    label: "Last 7 Days",
    description: "Past week",
  },
  {
    value: "30d",
    label: "Last 30 Days",
    description: "Past month",
  },
  {
    value: "custom",
    label: "Custom Range",
    description: "Select dates",
  },
];

export function getDateRangeFromSelection(range: TimeRange, customRange?: DateRange): DateRange {
  const now = new Date();

  switch (range) {
    case "24h":
      return { start: subHours(now, 24), end: now };
    case "7d":
      return { start: subDays(now, 7), end: now };
    case "30d":
      return { start: subDays(now, 30), end: now };
    case "custom":
      return customRange || { start: subDays(now, 7), end: now };
    default:
      return { start: subDays(now, 7), end: now };
  }
}

export function TimeRangeSelector({
  selectedRange,
  onRangeChange,
  customRange,
  disabled = false,
}: TimeRangeSelectorProps) {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(
    customRange?.start ? format(customRange.start, "yyyy-MM-dd") : format(subDays(new Date(), 7), "yyyy-MM-dd")
  );
  const [tempEndDate, setTempEndDate] = useState(
    customRange?.end ? format(customRange.end, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
  );

  const handleRangeClick = (range: TimeRange) => {
    if (disabled) return;

    if (range === "custom") {
      setShowCustomPicker(true);
    } else {
      const dateRange = getDateRangeFromSelection(range);
      onRangeChange(range, dateRange);
      setShowCustomPicker(false);
    }
  };

  const handleCustomRangeApply = () => {
    const start = new Date(tempStartDate);
    const end = new Date(tempEndDate);

    if (start > end) {
      alert("Start date must be before end date");
      return;
    }

    onRangeChange("custom", { start, end });
    setShowCustomPicker(false);
  };

  const handleCustomRangeCancel = () => {
    setShowCustomPicker(false);
    // Reset to previous custom range if it exists
    if (customRange) {
      setTempStartDate(format(customRange.start, "yyyy-MM-dd"));
      setTempEndDate(format(customRange.end, "yyyy-MM-dd"));
    }
  };

  return (
    <div className="time-range-selector">
      <div className="flex items-center gap-2 mb-2">
        <Clock size={16} className="text-gray-400" />
        <span className="text-sm font-medium text-gray-300">Time Range</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {timeRangeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => handleRangeClick(option.value)}
            disabled={disabled}
            className={`
              px-3 py-2 rounded-lg text-sm font-medium transition-all
              ${
                selectedRange === option.value
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/50"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
            title={option.description}
          >
            {option.label}
          </button>
        ))}
      </div>

      {showCustomPicker && (
        <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-blue-400" />
            <span className="text-sm font-medium text-gray-300">Custom Date Range</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCustomRangeApply}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handleCustomRangeCancel}
              className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {selectedRange === "custom" && customRange && !showCustomPicker && (
        <div className="mt-2 text-xs text-gray-400">
          {format(customRange.start, "MMM d, yyyy")} - {format(customRange.end, "MMM d, yyyy")}
        </div>
      )}
    </div>
  );
}
