import { createRoot } from "react-dom/client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Dashboard } from "./components/Dashboard";
import { RequirementTree } from "./components/RequirementTree";
import { RequirementDetail } from "./components/RequirementDetail";
import { DocsViewer } from "./components/DocsViewer";
import { ClaudeChat, type ClaudeChatHandle } from "./chat";
import { useUrlState } from "./hooks/useUrlState";
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
  const [showChat, setShowChat] = useState(false);
  const [docsContent, setDocsContent] = useState("");
  const [showLegend, setShowLegend] = useState(false);

  // URL-based state management
  const [urlState, urlSetters] = useUrlState();
  const { req: selectedReqId, filter, view, doc: docsPage, expanded } = urlState;
  const { setReq: setSelectedReqId, setFilter, setView, setDoc: setDocsPage, setExpanded, toggleExpanded } = urlSetters;

  const chatRef = useRef<ClaudeChatHandle>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - fetchData is stable, and we only want one SSE connection

  // Fetch docs content when page changes
  useEffect(() => {
    if (view === "docs") {
      fetch(`/api/docs/${docsPage}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.content) {
            setDocsContent(data.content);
          } else {
            setDocsContent("# Error\n\nFailed to load documentation.");
          }
        })
        .catch(() => {
          setDocsContent("# Error\n\nFailed to load documentation.");
        });
    }
  }, [view, docsPage]);

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

  // Get requirements that need verification (unverified or stale)
  const requirementsNeedingVerification = useMemo(
    () => allRequirements.filter(
      (r) => r.verification === "unverified" || r.verification === "stale"
    ),
    [allRequirements]
  );

  // Handle verifying a single requirement
  const handleVerifyRequirement = useCallback((req: RequirementWithData) => {
    setShowChat(true);

    // Build test list
    const testList = req.tests.length > 0
      ? req.tests.map((t) => `- ${t.file}:${t.identifier}`).join("\n")
      : "(no tests linked)";

    const prompt = `Please verify requirement **${req.id}**.

**Requirement (Gherkin):**
\`\`\`gherkin
${req.gherkin}
\`\`\`

**Linked Tests to Read:**
${testList}

**Steps:**
1. Read each test file listed above
2. Evaluate each of the 8 verification criteria:
   - **noBugsInTestCode**: Are there bugs in the test code?
   - **sufficientCoverage**: Do tests cover the gherkin steps?
   - **meaningfulAssertions**: Are assertions checking real behavior?
   - **correctTestSubject**: Do tests verify the right thing?
   - **happyPathCovered**: Is the main success flow tested?
   - **edgeCasesAddressed**: Are boundary conditions tested? (use "na" if none apply)
   - **errorScenariosHandled**: Are error cases tested? (use "na" if requirement has none)
   - **wouldFailIfBroke**: Would tests detect if the feature broke?

3. For each test, provide a testComment with:
   - **hasIssue: true** if the test has bugs, wrong assertions, or doesn't properly verify the requirement
   - **hasIssue: false** if the test is correct and useful
   - A comment explaining why

4. Run the assess command with your evaluation:

\`\`\`bash
req assess ${req.id} --result '{
  "criteria": {
    "noBugsInTestCode": { "result": "pass|fail|na", "note": "optional" },
    "sufficientCoverage": { "result": "pass|fail|na", "note": "optional" },
    "meaningfulAssertions": { "result": "pass|fail|na", "note": "optional" },
    "correctTestSubject": { "result": "pass|fail|na", "note": "optional" },
    "happyPathCovered": { "result": "pass|fail|na", "note": "optional" },
    "edgeCasesAddressed": { "result": "pass|fail|na", "note": "optional" },
    "errorScenariosHandled": { "result": "pass|fail|na", "note": "optional" },
    "wouldFailIfBroke": { "result": "pass|fail|na", "note": "optional" }
  },
  "notes": "Summary of your assessment",
  "testComments": [{"file": "path/to/test.ts", "identifier": "test name", "comment": "why this test is good/bad", "hasIssue": true|false}],
  "suggestedTests": [{"description": "...", "rationale": "..."}]
}'
\`\`\`

Note: testComments are required for each linked test. suggestedTests is optional.`;

    // Small delay to ensure chat is rendered before sending
    setTimeout(() => {
      chatRef.current?.sendMessage(prompt);
    }, 100);
  }, []);

  // Handle verifying all unverified/stale requirements
  const handleVerifyAll = useCallback(() => {
    if (requirementsNeedingVerification.length === 0) return;

    setShowChat(true);

    // Build list with test files for each requirement
    const reqList = requirementsNeedingVerification.map((r) => {
      const tests = r.tests.length > 0
        ? r.tests.map((t) => `${t.file}:${t.identifier}`).join(", ")
        : "no tests";
      return `- **${r.id}** (${r.verification}): ${tests}`;
    }).join("\n");

    const prompt = `Please verify these ${requirementsNeedingVerification.length} requirements that need assessment:

${reqList}

**For each requirement:**
1. Read the requirement file to see the gherkin
2. Read the linked test file(s)
3. Evaluate the 8 verification criteria
4. For each test, provide a testComment with hasIssue: true/false and a comment explaining why
5. Run the assess command:

\`\`\`bash
req assess <path> --result '{
  "criteria": {
    "noBugsInTestCode": { "result": "pass|fail|na" },
    "sufficientCoverage": { "result": "pass|fail|na" },
    "meaningfulAssertions": { "result": "pass|fail|na" },
    "correctTestSubject": { "result": "pass|fail|na" },
    "happyPathCovered": { "result": "pass|fail|na" },
    "edgeCasesAddressed": { "result": "pass|fail|na" },
    "errorScenariosHandled": { "result": "pass|fail|na" },
    "wouldFailIfBroke": { "result": "pass|fail|na" }
  },
  "notes": "...",
  "testComments": [{"file": "...", "identifier": "...", "comment": "...", "hasIssue": true|false}],
  "suggestedTests": [...]
}'
\`\`\`

Process them one at a time, running the assess command after each analysis.`;

    // Small delay to ensure chat is rendered before sending
    setTimeout(() => {
      chatRef.current?.sendMessage(prompt);
    }, 100);
  }, [requirementsNeedingVerification]);

  // Handle fixing a broken test
  const handleFixTest = useCallback((req: RequirementWithData, test: { file: string; identifier: string }, comment: string) => {
    setShowChat(true);

    const prompt = `Please fix the broken test for requirement **${req.id}**.

**Requirement (Gherkin):**
\`\`\`gherkin
${req.gherkin}
\`\`\`

**Test to fix:**
- File: ${test.file}
- Test: ${test.identifier}

**Issue identified:**
${comment}

**Steps:**
1. Read the test file: ${test.file}
2. Fix the identified issue
3. Run the test to verify it passes
4. Re-verify the requirement by running:

\`\`\`bash
req assess ${req.id} --result '{...}'
\`\`\``;

    setTimeout(() => {
      chatRef.current?.sendMessage(prompt);
    }, 100);
  }, []);

  // Handle adding a suggested test
  const handleAddTest = useCallback((req: RequirementWithData, suggestedTest: { description: string; rationale: string }) => {
    setShowChat(true);

    // Find appropriate test file from existing tests
    const existingTestFile = req.tests.length > 0 ? req.tests[0].file : null;

    const prompt = `Please add a new test for requirement **${req.id}**.

**Requirement (Gherkin):**
\`\`\`gherkin
${req.gherkin}
\`\`\`

**Test to add:**
${suggestedTest.description}

**Why this test is needed:**
${suggestedTest.rationale}

${existingTestFile ? `**Existing test file:** ${existingTestFile}` : "**Note:** No existing test file found - create an appropriate test file."}

**Steps:**
1. ${existingTestFile ? `Read the existing test file: ${existingTestFile}` : "Create a new test file in the appropriate location"}
2. Add the new test following the existing patterns
3. Run the test to verify it passes
4. Link the test to the requirement:

\`\`\`bash
req link ${req.id} "${existingTestFile || "path/to/test.ts"}:<test name>"
\`\`\`

5. Re-verify the requirement by running:

\`\`\`bash
req assess ${req.id} --result '{...}'
\`\`\``;

    setTimeout(() => {
      chatRef.current?.sendMessage(prompt);
    }, 100);
  }, []);

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView(view === "docs" ? "requirements" : "docs")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === "docs"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {view === "docs" ? "Back" : "Docs"}
            </button>
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
        </div>
      </header>

      {view === "docs" ? (
        /* Documentation view */
        <div className="flex-1 min-h-0">
          <DocsViewer
            content={docsContent}
            currentPage={docsPage}
            onNavigate={setDocsPage}
            onClose={() => setView("requirements")}
          />
        </div>
      ) : (
        /* Requirements view */
        <>
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
            <div className="w-96 flex-none border-r border-gray-200 bg-white flex flex-col">
              <div className="flex-none px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-gray-700">
                    {filter ? `Filtered (${filteredCount})` : `Requirements (${allRequirements.length})`}
                  </h2>
                  <div className="relative">
                    <button
                      onClick={() => setShowLegend(!showLegend)}
                      className="w-5 h-5 text-xs font-medium rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
                      title="Show legend"
                    >
                      ?
                    </button>
                    {showLegend && (
                      <div className="absolute top-7 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs whitespace-nowrap">
                        <div className="font-medium text-gray-700 mb-2">Indicator Legend</div>
                        <div className="space-y-1 text-gray-600">
                          <div><span className="text-green-600 font-medium">R</span>/<span className="text-gray-300">R</span> = Has/no gherkin</div>
                          <div><span className="text-green-600 font-medium">F</span>/<span className="text-gray-300">F</span> = Has/no NFRs</div>
                          <div><span className="text-green-600 font-medium">T:N</span>/<span className="text-red-500">T:N!</span>/<span className="text-gray-300">T:0</span> = Tests ok/issues/none</div>
                          <div><span className="text-green-600 font-medium">C</span>/<span className="text-red-500">C</span>/<span className="text-gray-300">C</span> = Coverage ok/insufficient/not assessed</div>
                          <div><span className="text-green-600 font-medium">D:X/Y</span>/<span className="text-gray-300">D:0</span> = Deps passing</div>
                          <div><span className="text-red-600 font-medium">P1</span>-<span className="text-gray-400 font-medium">P4</span>/<span className="text-gray-300">P-</span> = Priority</div>
                          <div><span className="text-blue-600 font-medium">done</span>/<span className="text-gray-400">plan</span> = Status</div>
                          <div><span className="text-green-600">✓</span>/<span className="text-yellow-500">!</span> = Verified/needs review</div>
                          <div><span className="text-green-600">?</span>/<span className="text-red-500">?N</span> = Questions ok/unanswered</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {requirementsNeedingVerification.length > 0 && (
                  <button
                    onClick={handleVerifyAll}
                    className="px-2 py-1 text-xs font-medium rounded bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
                    title={`Verify ${requirementsNeedingVerification.length} unverified/stale requirement${requirementsNeedingVerification.length !== 1 ? 's' : ''}`}
                  >
                    Verify All ({requirementsNeedingVerification.length})
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {filteredGroups.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    {filter ? "No matching requirements" : "No requirements found"}
                  </div>
                ) : (
                  <RequirementTree
                    groups={filteredGroups}
                    selectedId={selectedReqId}
                    onSelect={setSelectedReqId}
                    expanded={expanded}
                    onSetExpanded={setExpanded}
                    onToggle={toggleExpanded}
                  />
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
              <RequirementDetail
                requirement={selectedReq}
                onVerify={handleVerifyRequirement}
                onFixTest={handleFixTest}
                onAddTest={handleAddTest}
              />
            </div>

            {/* Right panel: Chat (collapsible) */}
            {showChat && (
              <div className="w-96 flex-none border-l border-gray-200 bg-white flex flex-col">
                <ClaudeChat
                  ref={chatRef}
                  endpoint="/api/chat"
                  headerTitle="Requirements Assistant"
                  placeholder="Ask about requirements..."
                  persistSession={false}
                  className="h-full border-0 rounded-none shadow-none"
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Mount the app
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
