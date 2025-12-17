import { RequirementCard } from "./RequirementCard";

// Extended type to include full requirement data
export interface RequirementWithData {
  id: string;
  testCount: number;
  verification: "unverified" | "verified" | "stale" | "n/a";
  coverageSufficient: boolean | null;
  unansweredQuestions: number;
  status: "planned" | "done";
  gherkin: string;
  source: {
    type: "doc" | "slack" | "email" | "meeting" | "ticket" | "manual";
    description: string;
    url?: string;
    date?: string;
  };
  tests: Array<{
    file: string;
    identifier: string;
    hash: string;
    isStale: boolean;
    lastResult?: "passed" | "failed" | "skipped" | "error";
    lastRunAt?: string;
  }>;
  aiAssessment?: {
    sufficient: boolean;
    notes: string;
    assessedAt: string;
    criteria?: {
      noBugsInTestCode: { result: "pass" | "fail" | "na"; note?: string };
      sufficientCoverage: { result: "pass" | "fail" | "na"; note?: string };
      meaningfulAssertions: { result: "pass" | "fail" | "na"; note?: string };
      correctTestSubject: { result: "pass" | "fail" | "na"; note?: string };
      happyPathCovered: { result: "pass" | "fail" | "na"; note?: string };
      edgeCasesAddressed: { result: "pass" | "fail" | "na"; note?: string };
      errorScenariosHandled: { result: "pass" | "fail" | "na"; note?: string };
      wouldFailIfBroke: { result: "pass" | "fail" | "na"; note?: string };
    };
    testComments?: Array<{
      file: string;
      identifier: string;
      comment: string;
      hasIssue: boolean;
    }>;
    suggestedTests?: Array<{
      description: string;
      rationale: string;
    }>;
  };
  questions?: Array<{
    question: string;
    answer?: string;
    answeredAt?: string;
  }>;
  // Extended fields
  priority?: "critical" | "high" | "medium" | "low";
  dependencyIssues?: string[];
  unverifiedNFRCount?: number;
  dependencies?: Array<{
    path: string;
    blocking?: boolean;
  }>;
  nfrs?: Array<{
    category: "performance" | "security" | "accessibility" | "reliability" | "scalability" | "other";
    description: string;
    threshold?: string;
    verified?: boolean;
  }>;
  scenarios?: Array<{
    name: string;
    gherkin: string;
  }>;
}

export interface GroupWithData {
  path: string;
  requirements: RequirementWithData[];
}

interface RequirementListProps {
  groups: GroupWithData[];
}

export function RequirementList({ groups }: RequirementListProps) {
  if (groups.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No requirements found.</p>
        <p className="text-sm mt-2">
          Create requirement files in .requirements/ folder
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.path}>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            {group.path}
          </h3>
          <div className="space-y-2">
            {group.requirements.map((req) => (
              <RequirementCard key={req.id} requirement={req} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
