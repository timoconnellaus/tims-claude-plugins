import { StatusBadge, CoverageBadge } from "./StatusBadge";
import type { RequirementWithData } from "./RequirementList";
import { CRITERIA_KEYS, CRITERIA_LABELS, type VerificationCriteria } from "../../lib/types";

interface RequirementDetailProps {
  requirement: RequirementWithData | null;
  onVerify?: (requirement: RequirementWithData) => void;
  onFixTest?: (requirement: RequirementWithData, test: { file: string; identifier: string }, comment: string) => void;
  onAddTest?: (requirement: RequirementWithData, suggestedTest: { description: string; rationale: string }) => void;
  onAddScenario?: (requirement: RequirementWithData, scenario: { name: string; gherkin: string; rationale: string }) => void;
  onAcceptScenario?: (requirement: RequirementWithData, scenarioName: string) => void;
  onRejectScenario?: (requirement: RequirementWithData, scenarioName: string) => void;
  onRejectSuggestedScenario?: (requirement: RequirementWithData, scenario: { name: string; gherkin: string; rationale: string }) => void;
  onRunTest?: (file: string, identifier: string) => void;
  onRunAllTests?: (requirementPath: string) => void;
  runningTests?: Set<string>;
}

export function RequirementDetail({ requirement, onVerify, onFixTest, onAddTest, onAddScenario, onAcceptScenario, onRejectScenario, onRejectSuggestedScenario, onRunTest, onRunAllTests, runningTests }: RequirementDetailProps) {
  if (!requirement) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p>Select a requirement to view details</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <h2 className="font-mono text-lg text-gray-900">{requirement.id}</h2>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-6">
        <StatusBadge
          status={requirement.status}
          verification={requirement.verification}
        />
        <CoverageBadge sufficient={requirement.coverageSufficient} />
        {/* Priority badge - always show */}
        {requirement.priority ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            requirement.priority === "critical" ? "bg-red-100 text-red-800" :
            requirement.priority === "high" ? "bg-orange-100 text-orange-800" :
            requirement.priority === "medium" ? "bg-yellow-100 text-yellow-800" :
            "bg-gray-100 text-gray-700"
          }`}>
            {requirement.priority.charAt(0).toUpperCase() + requirement.priority.slice(1)}
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-400 border border-dashed border-gray-300">
            No priority
          </span>
        )}
        {requirement.unansweredQuestions > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            {requirement.unansweredQuestions} question
            {requirement.unansweredQuestions !== 1 ? "s" : ""}
          </span>
        )}
        {onVerify && requirement.status === "done" && (
          <button
            onClick={() => onVerify(requirement)}
            className="ml-auto px-2.5 py-1 text-xs font-medium rounded bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
          >
            {requirement.verification === "verified" ? "Re-verify" : "Verify"}
          </button>
        )}
      </div>

      <section className="mb-6">
        {(() => {
          const actualScenarios = requirement.scenarios || [];
          const suggestedFromAssessment = requirement.aiAssessment?.suggestedScenarios || [];
          const totalCount = actualScenarios.length + suggestedFromAssessment.length;
          const hasScenarios = totalCount > 0;

          return (
            <>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Requirement
                {hasScenarios && (
                  <span className="ml-2 text-gray-400 font-normal">
                    (+{totalCount} scenario{totalCount !== 1 ? "s" : ""})
                  </span>
                )}
              </h3>
              <pre className="bg-gray-50 p-3 rounded text-sm text-gray-800 whitespace-pre-wrap font-mono border border-gray-200">
                {requirement.gherkin}
              </pre>
              {hasScenarios && (
                <ul className="mt-3 space-y-2">
                  {/* Actual scenarios (accepted or pending acceptance) */}
                  {actualScenarios.map((scenario, idx) => (
                    <li
                      key={`actual-${idx}`}
                      className={`p-3 rounded border ${
                        scenario.suggested
                          ? "bg-amber-50 border-amber-300 border-dashed"
                          : "bg-indigo-50 border-indigo-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${
                            scenario.suggested ? "text-amber-700" : "text-indigo-700"
                          }`}>
                            {scenario.name}
                          </span>
                          {scenario.suggested && (
                            <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">
                              Pending
                            </span>
                          )}
                        </div>
                        {scenario.suggested && (
                          <div className="flex gap-1">
                            {onAcceptScenario && (
                              <button
                                onClick={() => onAcceptScenario(requirement, scenario.name)}
                                className="px-2 py-0.5 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
                              >
                                Accept
                              </button>
                            )}
                            {onRejectScenario && (
                              <button
                                onClick={() => onRejectScenario(requirement, scenario.name)}
                                className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <pre className={`text-sm whitespace-pre-wrap font-mono ${
                        scenario.suggested ? "text-amber-800" : "text-indigo-800"
                      }`}>
                        {scenario.gherkin}
                      </pre>
                    </li>
                  ))}
                  {/* Suggested scenarios from AI assessment (not yet added) */}
                  {suggestedFromAssessment.map((ss, idx) => (
                    <li
                      key={`suggested-${idx}`}
                      className="p-3 rounded border bg-blue-50 border-blue-300 border-dashed"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-blue-700">
                            {ss.name}
                          </span>
                          <span className="text-xs bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded">
                            AI Suggested
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {onAddScenario && (
                            <button
                              onClick={() => {
                                console.log('[RequirementDetail] Accept button clicked for:', ss.name, 'onAddScenario:', !!onAddScenario);
                                onAddScenario(requirement, ss);
                              }}
                              className="px-2 py-0.5 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
                            >
                              Accept
                            </button>
                          )}
                          {onRejectSuggestedScenario && (
                            <button
                              onClick={() => {
                                console.log('[RequirementDetail] Reject button clicked for:', ss.name);
                                onRejectSuggestedScenario(requirement, ss);
                              }}
                              className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </div>
                      <pre className="text-sm whitespace-pre-wrap font-mono text-blue-800">
                        {ss.gherkin}
                      </pre>
                      <div className="mt-2 text-xs text-blue-600">
                        <span className="font-medium">Why:</span> {ss.rationale}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          );
        })()}
      </section>

      <section className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Source</h3>
        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-200">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700 mr-2">
            {requirement.source.type}
          </span>
          {requirement.source.description}
          {requirement.source.url && (
            <a
              href={requirement.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-blue-600 hover:underline"
            >
              Link
            </a>
          )}
          {requirement.source.date && (
            <span className="ml-2 text-gray-400">
              ({requirement.source.date})
            </span>
          )}
        </div>
      </section>

      {/* Dependencies - always show */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Dependencies
          {requirement.dependencies && requirement.dependencies.length > 0 && (
            <span className="ml-2 text-gray-400 font-normal">
              ({requirement.dependencies.length})
            </span>
          )}
        </h3>
        {requirement.dependencies && requirement.dependencies.length > 0 ? (
          <ul className="space-y-2">
            {requirement.dependencies.map((dep, idx) => (
              <li
                key={idx}
                className="text-sm bg-purple-50 px-3 py-2 rounded border border-purple-200"
              >
                <span className="font-mono text-purple-800">{dep.path}</span>
                {dep.blocking !== false && (
                  <span className="ml-2 text-xs bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded">
                    Blocking
                  </span>
                )}
                {requirement.dependencyIssues?.includes(dep.path) && (
                  <span className="ml-2 text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded">
                    Not done
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-gray-400 bg-gray-50 p-3 rounded border border-dashed border-gray-300">
            No dependencies defined. Add <code className="text-xs bg-gray-200 px-1 rounded">dependencies</code> in YAML to link prerequisites.
          </div>
        )}
      </section>

      {requirement.tests.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">
              Linked Tests ({requirement.tests.length})
              {requirement.verification === "stale" && (
                <span className="ml-2 text-xs bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded font-medium">
                  Stale
                </span>
              )}
            </h3>
            {onRunAllTests && (
              <button
                onClick={() => onRunAllTests(requirement.id)}
                disabled={runningTests && requirement.tests.some(t => runningTests.has(`${t.file}:${t.identifier}`))}
                className="px-2.5 py-1 text-xs font-medium rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {runningTests && requirement.tests.some(t => runningTests.has(`${t.file}:${t.identifier}`))
                  ? "Running..."
                  : "▶ Run All"
                }
              </button>
            )}
          </div>

          {/* Verification Criteria - shown inline with tests */}
          {requirement.aiAssessment?.criteria && (
            <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200">
              <div className="flex flex-wrap gap-1.5">
                {CRITERIA_KEYS.map((key) => {
                  const criterion = requirement.aiAssessment!.criteria![key];
                  const { result, note } = criterion;
                  const colorClass =
                    result === "pass"
                      ? "bg-green-100 text-green-700 border-green-200"
                      : result === "fail"
                        ? "bg-red-100 text-red-700 border-red-200"
                        : "bg-gray-100 text-gray-500 border-gray-200";
                  const icon =
                    result === "pass" ? "✓" : result === "fail" ? "✗" : "—";
                  const shortLabel = CRITERIA_LABELS[key].split(" ").slice(0, 2).join(" ");

                  return (
                    <span
                      key={key}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${colorClass}`}
                      title={`${CRITERIA_LABELS[key]}${note ? `: ${note}` : ""}`}
                    >
                      {icon} {shortLabel}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <ul className="space-y-2">
            {requirement.tests.map((test, idx) => {
              // Find AI comment for this test
              const testComment = requirement.aiAssessment?.testComments?.find(
                (tc) => tc.file === test.file && tc.identifier === test.identifier
              );
              const hasIssue = testComment?.hasIssue;
              const testKey = `${test.file}:${test.identifier}`;
              const isRunning = runningTests?.has(testKey);
              return (
                <li
                  key={idx}
                  className={`text-sm px-3 py-2 rounded border ${
                    hasIssue
                      ? "bg-red-50 border-red-200"
                      : test.isStale
                        ? "bg-orange-50 border-orange-200"
                        : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Test result indicator */}
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          test.lastResult === "passed"
                            ? "bg-green-500"
                            : test.lastResult === "failed" || test.lastResult === "error"
                              ? "bg-red-500"
                              : test.lastResult === "skipped"
                                ? "bg-yellow-500"
                                : "bg-gray-300"
                        }`}
                        title={
                          test.lastResult
                            ? `${test.lastResult}${test.lastRunAt ? ` at ${new Date(test.lastRunAt).toLocaleTimeString()}` : ""}`
                            : "No test results"
                        }
                      />
                      <span className={`font-mono truncate ${hasIssue ? "text-red-800" : test.isStale ? "text-orange-800" : "text-gray-600"}`}>
                        {test.file}:{test.identifier}
                      </span>
                    </div>
                    <div className="flex-none flex items-center gap-1">
                      {onRunTest && (
                        <button
                          onClick={() => onRunTest(test.file, test.identifier)}
                          disabled={isRunning}
                          className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Run this test"
                        >
                          {isRunning ? "..." : "▶"}
                        </button>
                      )}
                      {hasIssue && (
                        <span className="text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded font-medium">
                          Issue
                        </span>
                      )}
                      {test.isStale && (
                        <span className="text-xs bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded font-medium">
                          Changed
                        </span>
                      )}
                    </div>
                  </div>
                  {testComment && (
                    <div className={`mt-2 text-xs p-2 rounded border ${
                      hasIssue
                        ? "text-red-700 bg-red-100/50 border-red-200"
                        : "text-gray-600 bg-white/50 border-gray-200"
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className={`font-medium ${hasIssue ? "text-red-600" : "text-gray-500"}`}>AI:</span>{" "}
                          {testComment.comment}
                        </div>
                        {hasIssue && onFixTest && (
                          <button
                            onClick={() => onFixTest(requirement, { file: test.file, identifier: test.identifier }, testComment.comment)}
                            className="flex-none px-2 py-0.5 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                          >
                            Fix
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Non-Functional Requirements - always show */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Non-Functional Requirements
          {requirement.nfrs && requirement.nfrs.length > 0 && (
            <span className="ml-2 text-gray-400 font-normal">
              ({requirement.nfrs.length})
            </span>
          )}
        </h3>
        {requirement.nfrs && requirement.nfrs.length > 0 ? (
          <ul className="space-y-2">
            {requirement.nfrs.map((nfr, idx) => (
              <li
                key={idx}
                className={`text-sm p-3 rounded border ${
                  nfr.verified
                    ? "bg-green-50 border-green-200"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-medium">
                    {nfr.category}
                  </span>
                  {nfr.verified && (
                    <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded">
                      Verified
                    </span>
                  )}
                </div>
                <div className="text-gray-800">{nfr.description}</div>
                {nfr.threshold && (
                  <div className="mt-1 text-xs text-gray-600 font-mono">
                    Threshold: {nfr.threshold}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-gray-400 bg-gray-50 p-3 rounded border border-dashed border-gray-300">
            No NFRs defined. Add <code className="text-xs bg-gray-200 px-1 rounded">nfrs</code> for performance, security, or accessibility constraints.
          </div>
        )}
      </section>

      {requirement.aiAssessment && (
        <section className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            AI Assessment Summary
          </h3>
          <div
            className={`p-3 rounded text-sm border ${
              requirement.verification === "stale"
                ? "bg-orange-50 text-orange-800 border-orange-200"
                : requirement.aiAssessment.sufficient
                  ? "bg-green-50 text-green-800 border-green-200"
                  : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            <div className="font-medium mb-1">
              {requirement.aiAssessment.sufficient
                ? "Coverage Sufficient"
                : "Coverage Insufficient"}
            </div>
            <div className="text-sm opacity-90">
              {requirement.aiAssessment.notes}
            </div>
            <div className="text-xs mt-2 opacity-70">
              Assessed:{" "}
              {new Date(requirement.aiAssessment.assessedAt).toLocaleString()}
            </div>
          </div>
        </section>
      )}

      {requirement.aiAssessment?.suggestedTests &&
        requirement.aiAssessment.suggestedTests.length > 0 && (
          <section className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Suggested Tests ({requirement.aiAssessment.suggestedTests.length})
            </h3>
            <ul className="space-y-2">
              {requirement.aiAssessment.suggestedTests.map((st, idx) => (
                <li
                  key={idx}
                  className="bg-blue-50 p-3 rounded text-sm border border-blue-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-mono text-blue-800 whitespace-pre-wrap">
                      {st.description}
                    </div>
                    {onAddTest && (
                      <button
                        onClick={() => onAddTest(requirement, st)}
                        className="flex-none px-2 py-0.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      >
                        Add Test
                      </button>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-blue-600">
                    <span className="font-medium">Why:</span> {st.rationale}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

      {requirement.questions && requirement.questions.length > 0 && (
        <section className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Questions</h3>
          <ul className="space-y-2">
            {requirement.questions.map((q, idx) => (
              <li
                key={idx}
                className="bg-gray-50 p-3 rounded text-sm border border-gray-200"
              >
                <div className="font-medium text-gray-800">{q.question}</div>
                {q.answer ? (
                  <div className="mt-1 text-gray-600">
                    <span className="text-green-600 font-medium">A:</span>{" "}
                    {q.answer}
                    {q.answeredAt && (
                      <span className="text-xs text-gray-400 ml-2">
                        ({new Date(q.answeredAt).toLocaleDateString()})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 text-yellow-600 text-xs">Unanswered</div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
