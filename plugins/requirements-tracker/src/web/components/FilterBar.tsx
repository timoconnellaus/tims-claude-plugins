import type { Priority, RequirementStatus, SourceType } from "../../lib/types";

export type TestStatus = "all" | "untested" | "with-tests" | "verified";
export type SortOption = "id" | "priority" | "status" | "created" | "testCount";

export interface FilterState {
  testStatus: TestStatus;
  priorities: Priority[];
  statuses: RequirementStatus[];
  tags: string[];
  tagMatchMode: "or" | "and";
  sourceTypes: SourceType[];
}

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  sortDirection: "asc" | "desc";
  onSortChange: (sort: SortOption, direction: "asc" | "desc") => void;
  allTags: string[];
  showArchived: boolean;
  onShowArchivedChange: (show: boolean) => void;
}

const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
const STATUSES: RequirementStatus[] = ["draft", "approved", "implemented", "released"];
const SOURCE_TYPES: SourceType[] = ["doc", "ai", "slack", "jira", "manual"];

export function FilterBar({
  filters,
  onFiltersChange,
  searchQuery,
  onSearchChange,
  sortBy,
  sortDirection,
  onSortChange,
  allTags,
  showArchived,
  onShowArchivedChange,
}: FilterBarProps) {
  const togglePriority = (p: Priority) => {
    const newPriorities = filters.priorities.includes(p)
      ? filters.priorities.filter(x => x !== p)
      : [...filters.priorities, p];
    onFiltersChange({ ...filters, priorities: newPriorities });
  };

  const toggleStatus = (s: RequirementStatus) => {
    const newStatuses = filters.statuses.includes(s)
      ? filters.statuses.filter(x => x !== s)
      : [...filters.statuses, s];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const toggleTag = (t: string) => {
    const newTags = filters.tags.includes(t)
      ? filters.tags.filter(x => x !== t)
      : [...filters.tags, t];
    onFiltersChange({ ...filters, tags: newTags });
  };

  const toggleSourceType = (s: SourceType) => {
    const newTypes = filters.sourceTypes.includes(s)
      ? filters.sourceTypes.filter(x => x !== s)
      : [...filters.sourceTypes, s];
    onFiltersChange({ ...filters, sourceTypes: newTypes });
  };

  const clearFilters = () => {
    onFiltersChange({
      testStatus: "all",
      priorities: [],
      statuses: [],
      tags: [],
      tagMatchMode: "or",
      sourceTypes: [],
    });
    onSearchChange("");
  };

  const hasActiveFilters =
    filters.testStatus !== "all" ||
    filters.priorities.length > 0 ||
    filters.statuses.length > 0 ||
    filters.tags.length > 0 ||
    filters.sourceTypes.length > 0 ||
    searchQuery.trim() !== "";

  return (
    <div className="filter-bar">
      <div className="filter-row filter-row-main">
        <div className="filter-group search-group">
          <input
            type="text"
            className="search-input"
            placeholder="Search requirements..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Test Status:</label>
          <select
            value={filters.testStatus}
            onChange={(e) => onFiltersChange({ ...filters, testStatus: e.target.value as TestStatus })}
          >
            <option value="all">All</option>
            <option value="untested">Untested</option>
            <option value="with-tests">With Tests</option>
            <option value="verified">Verified</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Sort:</label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption, sortDirection)}
          >
            <option value="id">ID</option>
            <option value="priority">Priority</option>
            <option value="status">Status</option>
            <option value="created">Created</option>
            <option value="testCount">Test Count</option>
          </select>
          <button
            className="sort-direction-btn"
            onClick={() => onSortChange(sortBy, sortDirection === "asc" ? "desc" : "asc")}
            title={sortDirection === "asc" ? "Ascending" : "Descending"}
          >
            {sortDirection === "asc" ? "↑" : "↓"}
          </button>
        </div>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => onShowArchivedChange(e.target.checked)}
          />
          Archived
        </label>

        {hasActiveFilters && (
          <button className="btn-clear-filters" onClick={clearFilters}>
            Clear Filters
          </button>
        )}
      </div>

      <div className="filter-row filter-row-chips">
        <div className="filter-group">
          <label>Priority:</label>
          <div className="multi-select">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                className={`multi-select-option priority-${p} ${filters.priorities.includes(p) ? "selected" : ""}`}
                onClick={() => togglePriority(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <div className="multi-select">
            {STATUSES.map((s) => (
              <button
                key={s}
                className={`multi-select-option status-${s} ${filters.statuses.includes(s) ? "selected" : ""}`}
                onClick={() => toggleStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label>Source:</label>
          <div className="multi-select">
            {SOURCE_TYPES.map((s) => (
              <button
                key={s}
                className={`multi-select-option ${filters.sourceTypes.includes(s) ? "selected" : ""}`}
                onClick={() => toggleSourceType(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="filter-row filter-row-tags">
          <div className="filter-group">
            <label>Tags:</label>
            <div className="tag-match-toggle">
              <button
                className={filters.tagMatchMode === "or" ? "active" : ""}
                onClick={() => onFiltersChange({ ...filters, tagMatchMode: "or" })}
              >
                OR
              </button>
              <button
                className={filters.tagMatchMode === "and" ? "active" : ""}
                onClick={() => onFiltersChange({ ...filters, tagMatchMode: "and" })}
              >
                AND
              </button>
            </div>
            <div className="multi-select tags-select">
              {allTags.map((t) => (
                <button
                  key={t}
                  className={`multi-select-option ${filters.tags.includes(t) ? "selected" : ""}`}
                  onClick={() => toggleTag(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
