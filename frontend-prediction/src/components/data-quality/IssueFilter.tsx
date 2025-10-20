import { type IssueSeverity } from "./IssueBadge";

interface IssueFilterProps {
  selectedSeverities: Set<IssueSeverity | "all">;
  onFilterChange: (severity: IssueSeverity | "all") => void;
  counts: {
    all: number;
    critical: number;
    warning: number;
    info: number;
  };
}

export function IssueFilter({
  selectedSeverities,
  onFilterChange,
  counts,
}: IssueFilterProps) {
  const filters: Array<{
    id: IssueSeverity | "all";
    label: string;
    color: string;
  }> = [
    { id: "all", label: "All Issues", color: "bg-gray-600 hover:bg-gray-500" },
    { id: "critical", label: "Critical", color: "bg-red-600 hover:bg-red-500" },
    { id: "warning", label: "Warning", color: "bg-yellow-600 hover:bg-yellow-500" },
    { id: "info", label: "Info", color: "bg-blue-600 hover:bg-blue-500" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const isSelected = selectedSeverities.has(filter.id);
        const count = counts[filter.id];

        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${
                isSelected
                  ? `${filter.color} text-white ring-2 ring-offset-2 ring-offset-gray-900 ring-white/20`
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300"
              }
            `}
          >
            {filter.label}
            <span className="ml-2 px-2 py-0.5 rounded-full bg-black/20 text-xs">
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
