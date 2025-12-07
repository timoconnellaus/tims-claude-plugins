import { useState, useRef, useEffect } from "react";
import type { Priority, RequirementStatus } from "../../lib/types";

interface BulkActionBarProps {
  selectedCount: number;
  onAddTags: (tags: string[]) => void;
  onSetPriority: (priority: Priority) => void;
  onSetStatus: (status: RequirementStatus) => void;
  onArchive: () => void;
  onClear: () => void;
  allTags: string[];
}

const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
const STATUSES: RequirementStatus[] = ["draft", "approved", "implemented", "released"];

export function BulkActionBar({
  selectedCount,
  onAddTags,
  onSetPriority,
  onSetStatus,
  onArchive,
  onClear,
  allTags,
}: BulkActionBarProps) {
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const priorityRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (priorityRef.current && !priorityRef.current.contains(event.target as Node)) {
        setShowPriorityMenu(false);
      }
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
      if (tagRef.current && !tagRef.current.contains(event.target as Node)) {
        setShowTagMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (selectedCount === 0) return null;

  const handlePrioritySelect = (p: Priority) => {
    onSetPriority(p);
    setShowPriorityMenu(false);
  };

  const handleStatusSelect = (s: RequirementStatus) => {
    onSetStatus(s);
    setShowStatusMenu(false);
  };

  const handleAddTag = (tag: string) => {
    if (tag.trim()) {
      onAddTags([tag.trim()]);
      setTagInput("");
      setShowTagMenu(false);
    }
  };

  return (
    <div className="bulk-action-bar">
      <span className="selection-count">{selectedCount} selected</span>

      <div className="inline-dropdown" ref={priorityRef}>
        <button
          className="btn-bulk"
          onClick={() => {
            setShowPriorityMenu(!showPriorityMenu);
            setShowStatusMenu(false);
            setShowTagMenu(false);
          }}
        >
          Set Priority
        </button>
        {showPriorityMenu && (
          <div className="inline-dropdown-menu dropdown-up">
            {PRIORITIES.map((p) => (
              <div
                key={p}
                className="inline-dropdown-item"
                onClick={() => handlePrioritySelect(p)}
              >
                <span className={`priority-badge priority-${p}`}>{p}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="inline-dropdown" ref={statusRef}>
        <button
          className="btn-bulk"
          onClick={() => {
            setShowStatusMenu(!showStatusMenu);
            setShowPriorityMenu(false);
            setShowTagMenu(false);
          }}
        >
          Set Status
        </button>
        {showStatusMenu && (
          <div className="inline-dropdown-menu dropdown-up">
            {STATUSES.map((s) => (
              <div
                key={s}
                className="inline-dropdown-item"
                onClick={() => handleStatusSelect(s)}
              >
                <span className={`req-status-badge req-status-${s}`}>{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="inline-dropdown" ref={tagRef}>
        <button
          className="btn-bulk"
          onClick={() => {
            setShowTagMenu(!showTagMenu);
            setShowPriorityMenu(false);
            setShowStatusMenu(false);
          }}
        >
          Add Tag
        </button>
        {showTagMenu && (
          <div className="inline-dropdown-menu dropdown-up tag-dropdown">
            <input
              type="text"
              className="tag-dropdown-input"
              placeholder="New tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddTag(tagInput);
                if (e.key === "Escape") setShowTagMenu(false);
              }}
              autoFocus
            />
            {allTags.length > 0 && (
              <div className="tag-suggestions-list">
                {allTags
                  .filter((t) => t.toLowerCase().includes(tagInput.toLowerCase()))
                  .slice(0, 5)
                  .map((t) => (
                    <div
                      key={t}
                      className="inline-dropdown-item"
                      onClick={() => handleAddTag(t)}
                    >
                      {t}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      <button className="btn-bulk btn-danger" onClick={onArchive}>
        Archive
      </button>

      <button className="btn-bulk btn-clear" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
