import type { Requirement, Priority, RequirementStatus } from "../../lib/types";
import { TestStatusBadge } from "./TestStatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { RequirementStatusBadge } from "./RequirementStatusBadge";
import { TagChips } from "./TagChips";
import { ConfirmationIndicator } from "./ConfirmationIndicator";

interface RequirementDetailProps {
  id: string;
  requirement: Requirement;
  isArchived: boolean;
  onEdit: () => void;
  onClose: () => void;
  onPriorityChange?: (priority: Priority) => void;
  onStatusChange?: (status: RequirementStatus) => void;
  onTagAdd?: (tag: string) => void;
  onTagRemove?: (tag: string) => void;
  onArchive?: () => void;
  onRestore?: () => void;
  allTags?: string[];
  githubRepo?: string; // owner/repo format for building GitHub URLs
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function RequirementDetail({
  id,
  requirement,
  isArchived,
  onEdit,
  onClose,
  onPriorityChange,
  onStatusChange,
  onTagAdd,
  onTagRemove,
  onArchive,
  onRestore,
  allTags = [],
  githubRepo,
}: RequirementDetailProps) {
  return (
    <div className="requirement-detail">
      <div className="detail-header">
        <div className="detail-title">
          <TestStatusBadge requirement={requirement} />
          <h2>{id}</h2>
          {isArchived && <span className="archived-badge">Archived</span>}
        </div>
        <div className="detail-actions">
          {!isArchived && (
            <button className="btn-edit" onClick={onEdit}>
              Edit
            </button>
          )}
          {!isArchived && onArchive && (
            <button className="btn-archive" onClick={onArchive}>
              Archive
            </button>
          )}
          {isArchived && onRestore && (
            <button className="btn-restore" onClick={onRestore}>
              Restore
            </button>
          )}
          <button className="btn-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="detail-meta">
        <div className="detail-meta-item">
          <span className="detail-meta-label">Priority</span>
          <PriorityBadge
            priority={requirement.priority}
            editable={!isArchived && !!onPriorityChange}
            onChange={onPriorityChange}
          />
        </div>
        <div className="detail-meta-item">
          <span className="detail-meta-label">Status</span>
          <RequirementStatusBadge
            status={requirement.status}
            editable={!isArchived && !!onStatusChange}
            onChange={onStatusChange}
          />
        </div>
      </div>

      <section className="detail-section">
        <h3>Tags</h3>
        <TagChips
          tags={requirement.tags ?? []}
          allTags={allTags}
          editable={!isArchived && !!(onTagAdd && onTagRemove)}
          onAdd={onTagAdd}
          onRemove={onTagRemove}
        />
        {(!requirement.tags || requirement.tags.length === 0) && !onTagAdd && (
          <p className="no-tags">No tags.</p>
        )}
      </section>

      <section className="detail-section">
        <h3>Description</h3>
        <p className="description-text">{requirement.description}</p>
      </section>

      {requirement.githubIssue && (
        <section className="detail-section">
          <h3>GitHub Issue</h3>
          <div className="github-issue-display">
            {githubRepo ? (
              <a
                href={`https://github.com/${githubRepo}/issues/${requirement.githubIssue.number}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`github-issue-link ${requirement.githubIssue.state === "closed" ? "closed" : ""}`}
              >
                <span className="github-icon">
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                  </svg>
                </span>
                <span className="issue-number">#{requirement.githubIssue.number}</span>
                {requirement.githubIssue.state && (
                  <span className={`issue-state issue-state-${requirement.githubIssue.state}`}>
                    {requirement.githubIssue.state}
                  </span>
                )}
              </a>
            ) : (
              <span className="github-issue-no-repo">
                #{requirement.githubIssue.number}
                {requirement.githubIssue.state && (
                  <span className={`issue-state issue-state-${requirement.githubIssue.state}`}>
                    {requirement.githubIssue.state}
                  </span>
                )}
              </span>
            )}
            {requirement.githubIssue.title && (
              <p className="issue-title">{requirement.githubIssue.title}</p>
            )}
            {requirement.githubIssue.lastSynced && (
              <p className="issue-synced">Last synced: {formatDate(requirement.githubIssue.lastSynced)}</p>
            )}
          </div>
        </section>
      )}

      <section className="detail-section">
        <h3>Source</h3>
        <dl>
          <dt>Type</dt>
          <dd>{requirement.source.type}</dd>
          {requirement.source.reference && (
            <>
              <dt>Reference</dt>
              <dd>{requirement.source.reference}</dd>
            </>
          )}
          <dt>Captured</dt>
          <dd>{formatDate(requirement.source.capturedAt)}</dd>
        </dl>
      </section>

      <section className="detail-section">
        <h3>Tests ({requirement.tests.length})</h3>
        {requirement.tests.length === 0 ? (
          <p className="no-tests">No tests linked.</p>
        ) : (
          <ul className="tests-list">
            {requirement.tests.map((test, i) => (
              <li key={i} className="test-item">
                <div className="test-info">
                  <ConfirmationIndicator test={test} />
                  <code>{test.file}:{test.identifier}</code>
                  <span className="test-runner">({test.runner})</span>
                </div>
                {test.confirmation && (
                  <div className="test-confirmation-details">
                    <span>Confirmed {formatDate(test.confirmation.confirmedAt)}</span>
                    {test.confirmation.confirmedBy && (
                      <span> by {test.confirmation.confirmedBy}</span>
                    )}
                    {test.confirmation.note && (
                      <p className="confirmation-note">{test.confirmation.note}</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {requirement.lastVerified && (
          <p className="last-verified">
            Last verified: {formatDate(requirement.lastVerified)}
          </p>
        )}
      </section>

      <section className="detail-section">
        <h3>History</h3>
        <ul className="history-list">
          {requirement.history.map((entry, i) => (
            <li key={i} className={`history-entry action-${entry.action}`}>
              <span className="history-action">{entry.action.replace(/_/g, " ")}</span>
              <span className="history-time">{formatDate(entry.timestamp)}</span>
              {entry.by && <span className="history-by">by {entry.by}</span>}
              {entry.note && <span className="history-note">{entry.note}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
