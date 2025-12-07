import { useState, useRef, useEffect } from "react";

interface TagChipsProps {
  tags: string[];
  allTags?: string[];
  editable?: boolean;
  maxDisplay?: number;
  onAdd?: (tag: string) => void;
  onRemove?: (tag: string) => void;
}

export function TagChips({
  tags,
  allTags = [],
  editable = false,
  maxDisplay,
  onAdd,
  onRemove,
}: TagChipsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setIsAdding(false);
        setInputValue("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayTags = maxDisplay && tags.length > maxDisplay
    ? tags.slice(0, maxDisplay)
    : tags;

  const hiddenCount = maxDisplay && tags.length > maxDisplay
    ? tags.length - maxDisplay
    : 0;

  const suggestions = allTags
    .filter(t => !tags.includes(t))
    .filter(t => t.toLowerCase().includes(inputValue.toLowerCase()))
    .slice(0, 5);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      onAdd?.(inputValue.trim());
      setInputValue("");
      setIsAdding(false);
    } else if (e.key === "Escape") {
      setIsAdding(false);
      setInputValue("");
    }
  };

  const handleSuggestionClick = (tag: string) => {
    onAdd?.(tag);
    setInputValue("");
    setIsAdding(false);
    setShowSuggestions(false);
  };

  if (tags.length === 0 && !editable) {
    return null;
  }

  return (
    <div className="tag-chips">
      {displayTags.map((tag) => (
        <span key={tag} className="tag-chip">
          {tag}
          {editable && onRemove && (
            <span
              className="tag-chip-remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(tag);
              }}
            >
              ×
            </span>
          )}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="tag-chip tag-chip-overflow">+{hiddenCount}</span>
      )}
      {editable && onAdd && (
        <>
          {isAdding ? (
            <div className="tag-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                className="tag-add-input"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                placeholder="tag..."
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="tag-suggestions" ref={suggestionsRef}>
                  {suggestions.map((tag) => (
                    <div
                      key={tag}
                      className="tag-suggestion"
                      onClick={() => handleSuggestionClick(tag)}
                    >
                      {tag}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span
              className="tag-chip tag-chip-add"
              onClick={() => setIsAdding(true)}
            >
              +
            </span>
          )}
        </>
      )}
    </div>
  );
}
