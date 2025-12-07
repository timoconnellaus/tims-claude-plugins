import type { Requirement } from "../../lib/types";

interface TestStatusBadgeProps {
  requirement: Requirement;
}

export function TestStatusBadge({ requirement }: TestStatusBadgeProps) {
  const hasTests = requirement.tests.length > 0;
  const isVerified = !!requirement.lastVerified;

  let status: "untested" | "linked" | "verified";
  let icon: string;
  let label: string;

  if (!hasTests) {
    status = "untested";
    icon = "○";
    label = "Untested";
  } else if (isVerified) {
    status = "verified";
    icon = "●";
    label = "Verified";
  } else {
    status = "linked";
    icon = "◐";
    label = "Tests Linked";
  }

  return (
    <span className={`status-badge status-${status}`} title={label}>
      {icon}
    </span>
  );
}
