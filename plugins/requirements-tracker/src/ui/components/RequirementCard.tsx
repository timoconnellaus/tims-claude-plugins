import { useState } from "react";
import type {
  VerificationStatus,
  ImplementationStatus,
  TestLink,
  AIAssessment,
  Question,
  Source,
  TestResultStatus,
} from "../../lib/types";
import { StatusBadge, CoverageBadge } from "./StatusBadge";

// Extended TestLink with runtime data from server
interface TestLinkWithResult extends TestLink {
  isStale: boolean;
  lastResult?: TestResultStatus;
  lastRunAt?: string;
}

interface RequirementData {
  id: string;
  testCount: number;
  verification: VerificationStatus;
  coverageSufficient: boolean | null;
  unansweredQuestions: number;
  status: ImplementationStatus;
  gherkin: string;
  mainSource?: Source;
  tests: TestLinkWithResult[];
  aiAssessment?: AIAssessment;
  questions?: Question[];
}

interface RequirementCardProps {
  requirement: RequirementData;
}

export function RequirementCard({ requirement }: RequirementCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-gray-600 truncate">
              {requirement.id}
            </span>
            <StatusBadge
              status={requirement.status}
              verification={requirement.verification}
            />
            <CoverageBadge sufficient={requirement.coverageSufficient} />
            {requirement.unansweredQuestions > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                {requirement.unansweredQuestions} question
                {requirement.unansweredQuestions !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transform transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Requirement
            </h4>
            <pre className="bg-gray-50 p-3 rounded text-sm text-gray-800 whitespace-pre-wrap font-mono">
              {requirement.gherkin}
            </pre>
            {requirement.mainSource && (
              <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                  {requirement.mainSource.type}
                </span>
                <span>{requirement.mainSource.description}</span>
                {requirement.mainSource.url && (
                  <a
                    href={requirement.mainSource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    ↗
                  </a>
                )}
                {requirement.mainSource.date && (
                  <span className="text-gray-400">({requirement.mainSource.date})</span>
                )}
              </div>
            )}
          </div>

          {requirement.tests.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Linked Tests ({requirement.tests.length})
              </h4>
              <ul className="space-y-1">
                {requirement.tests.map((test, idx) => (
                  <li
                    key={idx}
                    className="text-sm font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded flex items-center gap-2"
                  >
                    {/* Test result indicator with symbol */}
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 text-xs font-bold ${
                        test.lastResult === "passed"
                          ? "bg-green-100 text-green-700"
                          : test.lastResult === "failed" || test.lastResult === "error"
                            ? "bg-red-100 text-red-700"
                            : test.lastResult === "skipped"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-400"
                      }`}
                      title={
                        test.lastResult === "passed"
                          ? `Passed${test.lastRunAt ? ` at ${new Date(test.lastRunAt).toLocaleString()}` : ""}`
                          : test.lastResult === "failed"
                            ? `Failed${test.lastRunAt ? ` at ${new Date(test.lastRunAt).toLocaleString()}` : ""}`
                            : test.lastResult === "error"
                              ? `Error${test.lastRunAt ? ` at ${new Date(test.lastRunAt).toLocaleString()}` : ""}`
                              : test.lastResult === "skipped"
                                ? `Skipped${test.lastRunAt ? ` at ${new Date(test.lastRunAt).toLocaleString()}` : ""}`
                                : "No test results - run tests to see status"
                      }
                    >
                      {test.lastResult === "passed"
                        ? "✓"
                        : test.lastResult === "failed" || test.lastResult === "error"
                          ? "✗"
                          : test.lastResult === "skipped"
                            ? "–"
                            : "?"}
                    </span>
                    <span className="truncate">
                      {test.file}:{test.identifier}
                    </span>
                    {test.isStale && (
                      <span className="text-yellow-600 text-xs flex-shrink-0">(stale)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {requirement.aiAssessment && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                AI Assessment
              </h4>
              <div
                className={`p-3 rounded text-sm ${
                  requirement.aiAssessment.sufficient
                    ? "bg-green-50 text-green-800"
                    : "bg-red-50 text-red-800"
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
                  Assessed: {new Date(requirement.aiAssessment.assessedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {requirement.questions && requirement.questions.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Questions
              </h4>
              <ul className="space-y-2">
                {requirement.questions.map((q, idx) => (
                  <li key={idx} className="bg-gray-50 p-3 rounded text-sm">
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
                      <div className="mt-1 text-yellow-600 text-xs">
                        Unanswered
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
