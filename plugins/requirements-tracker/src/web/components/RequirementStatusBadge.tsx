import { useState, useRef, useEffect } from "react";
import type { RequirementStatus } from "../../lib/types";

interface RequirementStatusBadgeProps {
  status: RequirementStatus | undefined;
  editable?: boolean;
  onChange?: (status: RequirementStatus) => void;
}

const STATUSES: RequirementStatus[] = ["draft", "approved", "implemented", "released"];

export function RequirementStatusBadge({ status, editable, onChange }: RequirementStatusBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayStatus = status ?? "draft";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (s: RequirementStatus) => {
    onChange?.(s);
    setIsOpen(false);
  };

  if (!editable) {
    return (
      <span className={`req-status-badge req-status-${displayStatus}`}>
        {displayStatus}
      </span>
    );
  }

  return (
    <div className="inline-dropdown" ref={dropdownRef}>
      <span
        className={`req-status-badge req-status-${displayStatus} editable`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {displayStatus}
      </span>
      {isOpen && (
        <div className="inline-dropdown-menu">
          {STATUSES.map((s) => (
            <div
              key={s}
              className={`inline-dropdown-item ${s === displayStatus ? "selected" : ""}`}
              onClick={() => handleSelect(s)}
            >
              <span className={`req-status-badge req-status-${s}`}>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
