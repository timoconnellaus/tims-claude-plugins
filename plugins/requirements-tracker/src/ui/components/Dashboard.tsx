import type { CheckSummary } from "../../lib/types";

export type FilterType =
  | null
  | "planned"
  | "done"
  | "untested"
  | "verified"
  | "unverified"
  | "stale";

interface DashboardProps {
  summary: CheckSummary;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export function Dashboard({ summary, activeFilter, onFilterChange }: DashboardProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <FilterChip
        label="All"
        value={summary.totalRequirements}
        isActive={activeFilter === null}
        onClick={() => onFilterChange(null)}
      />
      <span className="text-gray-300">|</span>
      <FilterChip
        label="Planned"
        value={summary.planned}
        color="gray"
        isActive={activeFilter === "planned"}
        onClick={() => onFilterChange("planned")}
      />
      <FilterChip
        label="Done"
        value={summary.done}
        color="blue"
        isActive={activeFilter === "done"}
        onClick={() => onFilterChange("done")}
      />
      <span className="text-gray-300">|</span>
      <FilterChip
        label="Untested"
        value={summary.untested}
        color="red"
        isActive={activeFilter === "untested"}
        onClick={() => onFilterChange("untested")}
      />
      <FilterChip
        label="Verified"
        value={summary.verified}
        color="green"
        isActive={activeFilter === "verified"}
        onClick={() => onFilterChange("verified")}
      />
      <FilterChip
        label="Unverified"
        value={summary.unverified}
        color="yellow"
        isActive={activeFilter === "unverified"}
        onClick={() => onFilterChange("unverified")}
      />
      <FilterChip
        label="Stale"
        value={summary.stale}
        color="orange"
        isActive={activeFilter === "stale"}
        onClick={() => onFilterChange("stale")}
      />
    </div>
  );
}

interface FilterChipProps {
  label: string;
  value: number;
  color?: "gray" | "blue" | "green" | "yellow" | "orange" | "red";
  isActive: boolean;
  onClick: () => void;
}

function FilterChip({ label, value, color, isActive, onClick }: FilterChipProps) {
  const baseClasses = "px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer";

  const colorClasses: Record<string, { active: string; inactive: string }> = {
    gray: {
      active: "bg-gray-600 text-white",
      inactive: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    },
    blue: {
      active: "bg-blue-600 text-white",
      inactive: "bg-blue-50 text-blue-700 hover:bg-blue-100",
    },
    green: {
      active: "bg-green-600 text-white",
      inactive: "bg-green-50 text-green-700 hover:bg-green-100",
    },
    yellow: {
      active: "bg-yellow-500 text-white",
      inactive: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100",
    },
    orange: {
      active: "bg-orange-500 text-white",
      inactive: "bg-orange-50 text-orange-700 hover:bg-orange-100",
    },
    red: {
      active: "bg-red-600 text-white",
      inactive: "bg-red-50 text-red-700 hover:bg-red-100",
    },
    default: {
      active: "bg-gray-800 text-white",
      inactive: "bg-gray-100 text-gray-600 hover:bg-gray-200",
    },
  };

  const colors = colorClasses[color || "default"];
  const stateClass = isActive ? colors.active : colors.inactive;

  if (value === 0 && !isActive) {
    return null; // Hide empty filters unless active
  }

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${stateClass}`}
    >
      {label} <span className="opacity-75">{value}</span>
    </button>
  );
}
