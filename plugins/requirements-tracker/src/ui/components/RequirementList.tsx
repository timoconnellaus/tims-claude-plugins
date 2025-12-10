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
  }>;
  aiAssessment?: {
    sufficient: boolean;
    notes: string;
    assessedAt: string;
    testComments?: Array<{
      file: string;
      identifier: string;
      comment: string;
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
