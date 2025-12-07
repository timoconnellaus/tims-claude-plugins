import type { FilterState } from "./FilterBar";

export interface CoverageData {
  criticalWithoutTests: string[];
  highWithoutTests: string[];
  staleConfirmations: { reqId: string; testSpec: string }[];
  totalRequirements: number;
  withTests: number;
  withoutTests: number;
  verified: number;
  archived: number;
  allTags: string[];
  byPriority: { critical: number; high: number; medium: number; low: number };
  byStatus: { draft: number; approved: number; implemented: number; released: number };
}

interface CoverageDashboardProps {
  coverage: CoverageData;
  onFilterClick: (filter: Partial<FilterState>) => void;
}

export function CoverageDashboard({ coverage, onFilterClick }: CoverageDashboardProps) {
  const criticalCount = coverage.criticalWithoutTests.length;
  const highCount = coverage.highWithoutTests.length;
  const staleCount = coverage.staleConfirmations.length;
  const coveragePercent = coverage.totalRequirements > 0
    ? Math.round((coverage.withTests / coverage.totalRequirements) * 100)
    : 0;

  return (
    <div className="coverage-dashboard">
      <div
        className={`coverage-card ${criticalCount > 0 ? "coverage-card-danger" : ""}`}
        onClick={() => onFilterClick({ priorities: ["critical"], testStatus: "untested" })}
        title="Click to filter"
      >
        <div className="coverage-card-value">{criticalCount}</div>
        <div className="coverage-card-label">Critical without tests</div>
      </div>

      <div
        className={`coverage-card ${highCount > 0 ? "coverage-card-warning" : ""}`}
        onClick={() => onFilterClick({ priorities: ["high"], testStatus: "untested" })}
        title="Click to filter"
      >
        <div className="coverage-card-value">{highCount}</div>
        <div className="coverage-card-label">High priority without tests</div>
      </div>

      <div
        className="coverage-card coverage-card-info"
        onClick={() => onFilterClick({ testStatus: "all", priorities: [] })}
        title="Click to show all"
      >
        <div className="coverage-card-value">{coveragePercent}%</div>
        <div className="coverage-card-label">
          Test coverage ({coverage.withTests}/{coverage.totalRequirements})
        </div>
      </div>

      <div
        className="coverage-card"
        onClick={() => onFilterClick({ testStatus: "verified" })}
        title="Click to filter"
      >
        <div className="coverage-card-value">{coverage.verified}</div>
        <div className="coverage-card-label">Verified</div>
      </div>

      {staleCount > 0 && (
        <div
          className="coverage-card coverage-card-warning"
          title="Tests that may need re-confirmation"
        >
          <div className="coverage-card-value">{staleCount}</div>
          <div className="coverage-card-label">Confirmed tests</div>
        </div>
      )}

      <div className="coverage-card">
        <div className="coverage-card-value">{coverage.archived}</div>
        <div className="coverage-card-label">Archived</div>
      </div>
    </div>
  );
}

interface PriorityBreakdownProps {
  byPriority: CoverageData["byPriority"];
  onPriorityClick: (priority: "critical" | "high" | "medium" | "low") => void;
}

export function PriorityBreakdown({ byPriority, onPriorityClick }: PriorityBreakdownProps) {
  return (
    <div className="breakdown-row">
      <span className="breakdown-label">By Priority:</span>
      <div className="breakdown-chips">
        <span
          className="breakdown-chip priority-critical"
          onClick={() => onPriorityClick("critical")}
        >
          {byPriority.critical} critical
        </span>
        <span
          className="breakdown-chip priority-high"
          onClick={() => onPriorityClick("high")}
        >
          {byPriority.high} high
        </span>
        <span
          className="breakdown-chip priority-medium"
          onClick={() => onPriorityClick("medium")}
        >
          {byPriority.medium} medium
        </span>
        <span
          className="breakdown-chip priority-low"
          onClick={() => onPriorityClick("low")}
        >
          {byPriority.low} low
        </span>
      </div>
    </div>
  );
}

interface StatusBreakdownProps {
  byStatus: CoverageData["byStatus"];
  onStatusClick: (status: "draft" | "approved" | "implemented" | "released") => void;
}

export function StatusBreakdown({ byStatus, onStatusClick }: StatusBreakdownProps) {
  return (
    <div className="breakdown-row">
      <span className="breakdown-label">By Status:</span>
      <div className="breakdown-chips">
        <span
          className="breakdown-chip req-status-draft"
          onClick={() => onStatusClick("draft")}
        >
          {byStatus.draft} draft
        </span>
        <span
          className="breakdown-chip req-status-approved"
          onClick={() => onStatusClick("approved")}
        >
          {byStatus.approved} approved
        </span>
        <span
          className="breakdown-chip req-status-implemented"
          onClick={() => onStatusClick("implemented")}
        >
          {byStatus.implemented} implemented
        </span>
        <span
          className="breakdown-chip req-status-released"
          onClick={() => onStatusClick("released")}
        >
          {byStatus.released} released
        </span>
      </div>
    </div>
  );
}
