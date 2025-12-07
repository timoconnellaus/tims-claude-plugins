import { useState, useEffect, useMemo } from "react";
import Fuse from "fuse.js";
import type { RequirementsFile, Requirement, SourceType, Priority, RequirementStatus } from "../lib/types";
import { RequirementsList } from "./components/RequirementsList";
import { RequirementDetail } from "./components/RequirementDetail";
import { EditModal } from "./components/EditModal";
import { FilterBar, type FilterState, type SortOption, type TestStatus } from "./components/FilterBar";
import { CoverageDashboard, type CoverageData } from "./components/CoverageDashboard";
import { BulkActionBar } from "./components/BulkActionBar";

const PRIORITY_ORDER: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<RequirementStatus, number> = { draft: 0, approved: 1, implemented: 2, released: 3 };

export function App() {
  // Core data
  const [requirements, setRequirements] = useState<Record<string, Requirement>>({});
  const [archivedRequirements, setArchivedRequirements] = useState<Record<string, Requirement>>({});
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [githubRepo, setGithubRepo] = useState<string | null>(null);

  // Selection state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // Filter state
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    testStatus: "all",
    priorities: [],
    statuses: [],
    tags: [],
    tagMatchMode: "or",
    sourceTypes: [],
  });
  const [sortBy, setSortBy] = useState<SortOption>("id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqRes, archiveRes, coverageRes, githubRes] = await Promise.all([
        fetch("/api/requirements"),
        fetch("/api/archive"),
        fetch("/api/coverage"),
        fetch("/api/github/status"),
      ]);

      const reqData: RequirementsFile = await reqRes.json();
      const archiveData = await archiveRes.json();
      const coverageData: CoverageData = await coverageRes.json();
      const githubData = await githubRes.json();

      setRequirements(reqData.requirements);
      setArchivedRequirements(archiveData.requirements);
      setCoverage(coverageData);
      setGithubRepo(githubData.repo ?? null);
      setError(null);
    } catch (err) {
      setError("Failed to load requirements");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // All unique tags for autocomplete
  const allTags = coverage?.allTags ?? [];

  // Displayed requirements based on archive toggle
  const displayedRequirements = showArchived ? archivedRequirements : requirements;

  // Fuse.js search index
  const fuse = useMemo(() => {
    const items = Object.entries(displayedRequirements).map(([id, req]) => ({
      id,
      description: req.description,
      tags: req.tags?.join(" ") ?? "",
      source: req.source.reference ?? "",
    }));
    return new Fuse(items, {
      keys: ["id", "description", "tags", "source"],
      threshold: 0.3,
      ignoreLocation: true,
    });
  }, [displayedRequirements]);

  // Filtered and sorted requirements
  const filteredRequirements = useMemo(() => {
    let results = Object.entries(displayedRequirements);

    // Apply search
    if (searchQuery.trim()) {
      const searchResults = fuse.search(searchQuery);
      const matchIds = new Set(searchResults.map(r => r.item.id));
      results = results.filter(([id]) => matchIds.has(id));
    }

    // Apply test status filter
    results = results.filter(([, req]) => {
      if (filters.testStatus === "all") return true;
      if (filters.testStatus === "untested") return req.tests.length === 0;
      if (filters.testStatus === "with-tests") return req.tests.length > 0;
      if (filters.testStatus === "verified") return !!req.lastVerified;
      return true;
    });

    // Apply priority filter
    if (filters.priorities.length > 0) {
      results = results.filter(([, req]) =>
        filters.priorities.includes(req.priority ?? "medium")
      );
    }

    // Apply status filter
    if (filters.statuses.length > 0) {
      results = results.filter(([, req]) =>
        filters.statuses.includes(req.status ?? "draft")
      );
    }

    // Apply tag filter
    if (filters.tags.length > 0) {
      results = results.filter(([, req]) => {
        const reqTags = req.tags ?? [];
        if (filters.tagMatchMode === "and") {
          return filters.tags.every(t => reqTags.includes(t));
        }
        return filters.tags.some(t => reqTags.includes(t));
      });
    }

    // Apply source type filter
    if (filters.sourceTypes.length > 0) {
      results = results.filter(([, req]) =>
        filters.sourceTypes.includes(req.source.type)
      );
    }

    // Sort
    results.sort(([idA, reqA], [idB, reqB]) => {
      let cmp = 0;
      switch (sortBy) {
        case "id":
          cmp = idA.localeCompare(idB);
          break;
        case "priority":
          cmp = PRIORITY_ORDER[reqA.priority ?? "medium"] - PRIORITY_ORDER[reqB.priority ?? "medium"];
          break;
        case "status":
          cmp = STATUS_ORDER[reqA.status ?? "draft"] - STATUS_ORDER[reqB.status ?? "draft"];
          break;
        case "created":
          cmp = new Date(reqA.source.capturedAt).getTime() - new Date(reqB.source.capturedAt).getTime();
          break;
        case "testCount":
          cmp = reqA.tests.length - reqB.tests.length;
          break;
      }
      return sortDirection === "desc" ? -cmp : cmp;
    });

    return results;
  }, [displayedRequirements, searchQuery, filters, sortBy, sortDirection, fuse]);

  // Selected requirement
  const selectedRequirement = selectedId ? displayedRequirements[selectedId] : null;
  const editingRequirement = editingId ? requirements[editingId] : null;

  // API handlers
  const handleSave = async (
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
  ) => {
    try {
      const res = await fetch(`/api/requirements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error("Failed to update");

      await fetchData();
      setEditingId(null);
    } catch (err) {
      console.error(err);
      alert("Failed to save changes");
    }
  };

  const handlePriorityChange = async (id: string, priority: Priority) => {
    await handleSave(id, { priority });
  };

  const handleStatusChange = async (id: string, status: RequirementStatus) => {
    await handleSave(id, { status });
  };

  const handleTagAdd = async (id: string, tag: string) => {
    await handleSave(id, { addTags: [tag] });
  };

  const handleTagRemove = async (id: string, tag: string) => {
    await handleSave(id, { removeTags: [tag] });
  };

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/requirements/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error("Failed to archive");

      await fetchData();
      setSelectedId(null);
    } catch (err) {
      console.error(err);
      alert("Failed to archive requirement");
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/requirements/${id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error("Failed to restore");

      await fetchData();
      setSelectedId(null);
    } catch (err) {
      console.error(err);
      alert("Failed to restore requirement");
    }
  };

  // Bulk operations
  const handleToggleCheck = (id: string, checked: boolean) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleBulkPriority = async (priority: Priority) => {
    try {
      const res = await fetch("/api/requirements/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(checkedIds), priority }),
      });

      if (!res.ok) throw new Error("Failed to update");

      setCheckedIds(new Set());
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to update requirements");
    }
  };

  const handleBulkStatus = async (status: RequirementStatus) => {
    try {
      const res = await fetch("/api/requirements/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(checkedIds), status }),
      });

      if (!res.ok) throw new Error("Failed to update");

      setCheckedIds(new Set());
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to update requirements");
    }
  };

  const handleBulkAddTags = async (tags: string[]) => {
    try {
      const res = await fetch("/api/requirements/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(checkedIds), addTags: tags }),
      });

      if (!res.ok) throw new Error("Failed to update");

      setCheckedIds(new Set());
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to add tags");
    }
  };

  const handleBulkArchive = async () => {
    if (!confirm(`Archive ${checkedIds.size} requirements?`)) return;

    try {
      const res = await fetch("/api/requirements/bulk/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(checkedIds) }),
      });

      if (!res.ok) throw new Error("Failed to archive");

      setCheckedIds(new Set());
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to archive requirements");
    }
  };

  // Dashboard filter click handler
  const handleDashboardFilterClick = (filterUpdate: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...filterUpdate }));
    setShowArchived(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="app loading">
        <div className="spinner" />
        <p>Loading requirements...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="app error">
        <h1>Error</h1>
        <p>{error}</p>
        <button onClick={fetchData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>Requirements Tracker</h1>
      </header>

      {coverage && (
        <CoverageDashboard
          coverage={coverage}
          onFilterClick={handleDashboardFilterClick}
        />
      )}

      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={(sort, dir) => {
          setSortBy(sort);
          setSortDirection(dir);
        }}
        allTags={allTags}
        showArchived={showArchived}
        onShowArchivedChange={(show) => {
          setShowArchived(show);
          setSelectedId(null);
          setCheckedIds(new Set());
        }}
      />

      <main className={selectedId ? "with-detail" : ""}>
        <RequirementsList
          requirements={filteredRequirements}
          selectedId={selectedId}
          onSelect={setSelectedId}
          isArchived={showArchived}
          checkedIds={checkedIds}
          onToggleCheck={handleToggleCheck}
          onQuickPriorityChange={handlePriorityChange}
          onQuickStatusChange={handleStatusChange}
        />

        {selectedRequirement && selectedId && (
          <RequirementDetail
            id={selectedId}
            requirement={selectedRequirement}
            isArchived={showArchived}
            onEdit={() => setEditingId(selectedId)}
            onClose={() => setSelectedId(null)}
            onPriorityChange={(p) => handlePriorityChange(selectedId, p)}
            onStatusChange={(s) => handleStatusChange(selectedId, s)}
            onTagAdd={(t) => handleTagAdd(selectedId, t)}
            onTagRemove={(t) => handleTagRemove(selectedId, t)}
            onArchive={() => handleArchive(selectedId)}
            onRestore={() => handleRestore(selectedId)}
            allTags={allTags}
            githubRepo={githubRepo ?? undefined}
          />
        )}
      </main>

      {editingRequirement && editingId && (
        <EditModal
          id={editingId}
          requirement={editingRequirement}
          onSave={handleSave}
          onClose={() => setEditingId(null)}
          allTags={allTags}
        />
      )}

      <BulkActionBar
        selectedCount={checkedIds.size}
        onAddTags={handleBulkAddTags}
        onSetPriority={handleBulkPriority}
        onSetStatus={handleBulkStatus}
        onArchive={handleBulkArchive}
        onClear={() => setCheckedIds(new Set())}
        allTags={allTags}
      />
    </div>
  );
}
