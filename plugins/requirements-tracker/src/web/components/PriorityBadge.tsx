import { useState, useRef, useEffect } from "react";
import type { Priority } from "../../lib/types";

interface PriorityBadgeProps {
  priority: Priority | undefined;
  editable?: boolean;
  onChange?: (priority: Priority) => void;
}

const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];

export function PriorityBadge({ priority, editable, onChange }: PriorityBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayPriority = priority ?? "medium";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (p: Priority) => {
    onChange?.(p);
    setIsOpen(false);
  };

  if (!editable) {
    return (
      <span className={`priority-badge priority-${displayPriority}`}>
        {displayPriority}
      </span>
    );
  }

  return (
    <div className="inline-dropdown" ref={dropdownRef}>
      <span
        className={`priority-badge priority-${displayPriority} editable`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {displayPriority}
      </span>
      {isOpen && (
        <div className="inline-dropdown-menu">
          {PRIORITIES.map((p) => (
            <div
              key={p}
              className={`inline-dropdown-item ${p === displayPriority ? "selected" : ""}`}
              onClick={() => handleSelect(p)}
            >
              <span className={`priority-badge priority-${p}`}>{p}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
