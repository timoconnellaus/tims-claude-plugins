import { createRoot } from "react-dom/client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Dashboard, type FilterType } from "./components/Dashboard";
import { RequirementListItem } from "./components/RequirementListItem";
import { RequirementDetail } from "./components/RequirementDetail";
import { ClaudeChat } from "./chat";
import type {
  GroupWithData,
  RequirementWithData,
} from "./components/RequirementList";
import type { CheckSummary, ExtractedTest } from "../lib/types";

interface ApiData {
  requirements: GroupWithData[];
  orphanedTests: ExtractedTest[];
  summary: CheckSummary;
}

type ApiResponse = ApiData | { error: string };

function App() {
  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>(null);
  const [showChat, setShowChat] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/requirements");
      const json: ApiResponse = await res.json();

      if ("error" in json) {
        setError(json.error);
        setData(null);
      } else {
        setData(json);
        setError(null);
      }
    } catch (err) {
      setError("Failed to fetch requirements");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      if (event.data === "refresh") {
        fetchData();
      }
    };

    eventSource.onerror = () => {
      console.warn("SSE connection lost, will reconnect...");
    };

    return () => {
      eventSource.close();
    };
  }, [fetchData]);

  // Filter requirements based on active filter - must be before early returns
  const filteredGroups = useMemo(() => {
    if (!data) return [];
    if (!filter) return data.requirements;

    const filterFn = (req: RequirementWithData): boolean => {
      switch (filter) {
        case "planned":
          return req.status === "planned";
        case "done":
          return req.status === "done";
        case "untested":
          return req.status === "done" && req.testCount === 0;
        case "verified":
          return req.status === "done" && req.verification === "verified";
        case "unverified":
          return req.status === "done" && req.verification === "unverified";
        case "stale":
          return req.status === "done" && req.verification === "stale";
        default:
          return true;
      }
    };

    return data.requirements
      .map((group) => ({
        ...group,
        requirements: group.requirements.filter(filterFn),
      }))
      .filter((group) => group.requirements.length > 0);
  }, [data, filter]);

  // Flatten all requirements for easy lookup
  const allRequirements = useMemo(
    () => (data ? data.requirements.flatMap((g) => g.requirements) : []),
    [data]
  );

  const selectedReq = useMemo(
    () => allRequirements.find((r) => r.id === selectedReqId) || null,
    [allRequirements, selectedReqId]
  );

  const filteredCount = filteredGroups.reduce(
    (acc, g) => acc + g.requirements.length,
    0
  );

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-medium mb-2">Error</h2>
          <pre className="text-red-600 text-sm whitespace-pre-wrap">
            {error}
          </pre>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="flex-none bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">
            Requirements Tracker
          </h1>
          <button
            onClick={() => setShowChat(!showChat)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              showChat
                ? "bg-violet-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {showChat ? "Hide Chat" : "Chat"}
          </button>
        </div>
      </header>

      {/* Dashboard - compact filter bar */}
      <div className="flex-none px-4 py-2 bg-white border-b border-gray-200">
        <Dashboard
          summary={data.summary}
          activeFilter={filter}
          onFilterChange={setFilter}
        />
      </div>

      {/* Main content: master-detail layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel: scrollable list */}
        <div className="w-80 flex-none border-r border-gray-200 bg-white flex flex-col">
          <div className="flex-none px-3 py-2 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-medium text-gray-700">
              {filter ? `Filtered (${filteredCount})` : `Requirements (${allRequirements.length})`}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredGroups.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                {filter ? "No matching requirements" : "No requirements found"}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredGroups.map((group) => (
                  <div key={group.path}>
                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide px-2 mb-1">
                      {group.path || "(root)"}
                    </h3>
                    <div className="space-y-1">
                      {group.requirements.map((req) => (
                        <RequirementListItem
                          key={req.id}
                          requirement={req}
                          isSelected={req.id === selectedReqId}
                          onClick={() => setSelectedReqId(req.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Orphaned tests at bottom of list */}
            {data.orphanedTests.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h3 className="text-xs font-medium text-orange-600 uppercase tracking-wide px-2 mb-2">
                  Orphaned Tests ({data.orphanedTests.length})
                </h3>
                <div className="space-y-1 px-2">
                  {data.orphanedTests.slice(0, 10).map((test, idx) => (
                    <div
                      key={idx}
                      className="text-xs font-mono text-gray-500 truncate"
                      title={`${test.file}:${test.identifier}`}
                    >
                      {test.identifier}
                    </div>
                  ))}
                  {data.orphanedTests.length > 10 && (
                    <div className="text-xs text-gray-400">
                      +{data.orphanedTests.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Middle panel: detail view */}
        <div className="flex-1 bg-white min-w-0">
          <RequirementDetail requirement={selectedReq} />
        </div>

        {/* Right panel: Chat (collapsible) */}
        {showChat && (
          <div className="w-96 flex-none border-l border-gray-200 bg-white flex flex-col">
            <ClaudeChat
              endpoint="/api/chat"
              headerTitle="Requirements Assistant"
              placeholder="Ask about requirements..."
              persistSession={false}
              className="h-full border-0 rounded-none shadow-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Mount the app
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
