import type { TestLink } from "../../lib/types";

interface ConfirmationIndicatorProps {
  test: TestLink;
}

export function ConfirmationIndicator({ test }: ConfirmationIndicatorProps) {
  if (!test.confirmation) {
    return (
      <span className="confirmation-indicator confirmation-none" title="Not confirmed">
        −
      </span>
    );
  }

  // For now, we show confirmed status
  // Full staleness checking would require comparing current file hash
  const confirmedAt = new Date(test.confirmation.confirmedAt).toLocaleDateString();
  const title = test.confirmation.confirmedBy
    ? `Confirmed by ${test.confirmation.confirmedBy} on ${confirmedAt}`
    : `Confirmed on ${confirmedAt}`;

  return (
    <span className="confirmation-indicator confirmation-confirmed" title={title}>
      ✓
    </span>
  );
}

interface RequirementConfirmationSummaryProps {
  tests: TestLink[];
}

export function RequirementConfirmationSummary({ tests }: RequirementConfirmationSummaryProps) {
  if (tests.length === 0) return null;

  const confirmed = tests.filter(t => t.confirmation).length;
  const total = tests.length;

  if (confirmed === 0) return null;

  const allConfirmed = confirmed === total;

  return (
    <span
      className={`confirmation-summary ${allConfirmed ? "all-confirmed" : "partial-confirmed"}`}
      title={`${confirmed}/${total} tests confirmed`}
    >
      {allConfirmed ? "✓" : "◐"}
    </span>
  );
}
