import { useState } from "react";
import type { Requirement, SourceType, Priority, RequirementStatus } from "../../lib/types";
import { TagChips } from "./TagChips";

interface EditModalProps {
  id: string;
  requirement: Requirement;
  onSave: (
    id: string,
    updates: {
      description?: string;
      source?: { type?: SourceType; reference?: string };
      priority?: Priority;
      status?: RequirementStatus;
      addTags?: string[];
      removeTags?: string[];
      githubIssueNumber?: number | null;
    }
  ) => Promise<void>;
  onClose: () => void;
  allTags?: string[];
}

const SOURCE_TYPES: SourceType[] = ["doc", "ai", "slack", "jira", "manual"];
const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
const STATUSES: RequirementStatus[] = ["draft", "approved", "implemented", "released"];

export function EditModal({ id, requirement, onSave, onClose, allTags = [] }: EditModalProps) {
  const [description, setDescription] = useState(requirement.description);
  const [sourceType, setSourceType] = useState<SourceType>(requirement.source.type);
  const [sourceRef, setSourceRef] = useState(requirement.source.reference);
  const [priority, setPriority] = useState<Priority>(requirement.priority ?? "medium");
  const [status, setStatus] = useState<RequirementStatus>(requirement.status ?? "draft");
  const [tags, setTags] = useState<string[]>(requirement.tags ?? []);
  const [githubIssueNumber, setGithubIssueNumber] = useState(
    requirement.githubIssue?.number?.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);

  const originalTags = requirement.tags ?? [];
  const originalGithubNumber = requirement.githubIssue?.number?.toString() ?? "";

  const hasChanges =
    description !== requirement.description ||
    sourceType !== requirement.source.type ||
    sourceRef !== requirement.source.reference ||
    priority !== (requirement.priority ?? "medium") ||
    status !== (requirement.status ?? "draft") ||
    JSON.stringify([...tags].sort()) !== JSON.stringify([...originalTags].sort()) ||
    githubIssueNumber !== originalGithubNumber;

  const handleAddTag = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag]);
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      // Calculate tag changes
      const addedTags = tags.filter(t => !originalTags.includes(t));
      const removedTags = originalTags.filter(t => !tags.includes(t));

      // Calculate GitHub issue change
      let githubIssueNumberUpdate: number | null | undefined = undefined;
      if (githubIssueNumber !== originalGithubNumber) {
        const trimmed = githubIssueNumber.trim();
        githubIssueNumberUpdate = trimmed ? parseInt(trimmed, 10) : null; // empty becomes null (unlink)
      }

      await onSave(id, {
        description: description !== requirement.description ? description : undefined,
        source: {
          type: sourceType !== requirement.source.type ? sourceType : undefined,
          reference: sourceRef !== requirement.source.reference ? sourceRef : undefined,
        },
        priority: priority !== (requirement.priority ?? "medium") ? priority : undefined,
        status: status !== (requirement.status ?? "draft") ? status : undefined,
        addTags: addedTags.length > 0 ? addedTags : undefined,
        removeTags: removedTags.length > 0 ? removedTags : undefined,
        githubIssueNumber: githubIssueNumberUpdate,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit {id}</h2>
          <button className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="priority">Priority</label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as RequirementStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Tags</label>
            <TagChips
              tags={tags}
              allTags={allTags}
              editable
              onAdd={handleAddTag}
              onRemove={handleRemoveTag}
            />
          </div>

          <div className="form-group">
            <label htmlFor="github-issue">GitHub Issue #</label>
            <input
              type="number"
              id="github-issue"
              value={githubIssueNumber}
              onChange={(e) => setGithubIssueNumber(e.target.value)}
              placeholder="123"
              min="1"
            />
            <span className="form-hint">Leave empty to unlink</span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="source-type">Source Type</label>
              <select
                id="source-type"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SourceType)}
              >
                {SOURCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="source-ref">Reference</label>
              <input
                type="text"
                id="source-ref"
                value={sourceRef}
                onChange={(e) => setSourceRef(e.target.value)}
                placeholder="e.g., PROJ-123, specs.md#L42"
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-save" disabled={saving || !hasChanges}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
