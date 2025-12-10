import { StatusBadge, CoverageBadge } from "./StatusBadge";
import type { RequirementWithData } from "./RequirementList";

interface RequirementDetailProps {
  requirement: RequirementWithData | null;
}

export function RequirementDetail({ requirement }: RequirementDetailProps) {
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
        {requirement.unansweredQuestions > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            {requirement.unansweredQuestions} question
            {requirement.unansweredQuestions !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <section className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Requirement</h3>
        <pre className="bg-gray-50 p-3 rounded text-sm text-gray-800 whitespace-pre-wrap font-mono border border-gray-200">
          {requirement.gherkin}
        </pre>
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

      {requirement.tests.length > 0 && (
        <section className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Linked Tests ({requirement.tests.length})
          </h3>
          <ul className="space-y-2">
            {requirement.tests.map((test, idx) => {
              // Find AI comment for this test
              const testComment = requirement.aiAssessment?.testComments?.find(
                (tc) => tc.file === test.file && tc.identifier === test.identifier
              );
              return (
                <li
                  key={idx}
                  className={`text-sm px-3 py-2 rounded border ${
                    test.isStale
                      ? "bg-orange-50 border-orange-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-mono truncate ${test.isStale ? "text-orange-800" : "text-gray-600"}`}>
                      {test.file}:{test.identifier}
                    </span>
                    {test.isStale && (
                      <span className="flex-none text-xs bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded font-medium">
                        Changed
                      </span>
                    )}
                  </div>
                  {testComment && (
                    <div className="mt-2 text-xs text-gray-600 bg-white/50 p-2 rounded border border-gray-200">
                      <span className="font-medium text-gray-500">AI:</span>{" "}
                      {testComment.comment}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {requirement.aiAssessment && (
        <section className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            AI Assessment
            {requirement.verification === "stale" && (
              <span className="ml-2 text-xs bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded font-medium">
                Stale
              </span>
            )}
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
            {requirement.verification === "stale" && (
              <div className="font-medium mb-2 text-orange-700">
                Tests have changed since this assessment - re-assessment needed
              </div>
            )}
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
                  <div className="font-mono text-blue-800 whitespace-pre-wrap">
                    {st.description}
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
