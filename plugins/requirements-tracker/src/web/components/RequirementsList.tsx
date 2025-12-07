import type { Requirement, Priority, RequirementStatus } from "../../lib/types";
import { TestStatusBadge } from "./TestStatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { RequirementStatusBadge } from "./RequirementStatusBadge";
import { TagChips } from "./TagChips";
import { RequirementConfirmationSummary } from "./ConfirmationIndicator";

interface RequirementsListProps {
  requirements: [string, Requirement][];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isArchived: boolean;
  checkedIds?: Set<string>;
  onToggleCheck?: (id: string, checked: boolean) => void;
  onQuickPriorityChange?: (id: string, priority: Priority) => void;
  onQuickStatusChange?: (id: string, status: RequirementStatus) => void;
}

export function RequirementsList({
  requirements,
  selectedId,
  onSelect,
  isArchived,
  checkedIds,
  onToggleCheck,
  onQuickPriorityChange,
  onQuickStatusChange,
}: RequirementsListProps) {
  if (requirements.length === 0) {
    return (
      <div className="requirements-list empty">
        <p>No requirements found.</p>
        {isArchived && <p className="hint">Showing archived requirements.</p>}
      </div>
    );
  }

  const handleCheckboxChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onToggleCheck?.(id, e.target.checked);
  };

  return (
    <div className="requirements-list">
      {requirements.map(([id, req]) => (
        <div
          key={id}
          className={`requirement-card ${selectedId === id ? "selected" : ""} ${checkedIds?.has(id) ? "checked" : ""}`}
          onClick={() => onSelect(id)}
        >
          <div className="card-header">
            {onToggleCheck && (
              <label className="requirement-card-checkbox" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={checkedIds?.has(id) ?? false}
                  onChange={(e) => handleCheckboxChange(id, e)}
                />
              </label>
            )}
            <TestStatusBadge requirement={req} />
            <span className="req-id">{id}</span>
            <RequirementConfirmationSummary tests={req.tests} />
            <span className="test-count" title="Linked tests">
              {req.tests.length} test{req.tests.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="card-meta">
            <PriorityBadge
              priority={req.priority}
              editable={!!onQuickPriorityChange && !isArchived}
              onChange={(p) => onQuickPriorityChange?.(id, p)}
            />
            <RequirementStatusBadge
              status={req.status}
              editable={!!onQuickStatusChange && !isArchived}
              onChange={(s) => onQuickStatusChange?.(id, s)}
            />
            {req.tags && req.tags.length > 0 && (
              <TagChips tags={req.tags} maxDisplay={3} />
            )}
          </div>

          <p className="description">{req.description}</p>

          <div className="card-footer">
            <span className="source-type">{req.source.type}</span>
            {req.source.reference && (
              <span className="source-ref" title={req.source.reference}>
                {req.source.reference.length > 20
                  ? req.source.reference.slice(0, 20) + "..."
                  : req.source.reference}
              </span>
            )}
            {req.githubIssue && (
              <span
                className={`github-badge ${req.githubIssue.state === "closed" ? "closed" : ""}`}
                title={req.githubIssue.title ?? `Issue #${req.githubIssue.number}`}
              >
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                #{req.githubIssue.number}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
