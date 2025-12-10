import type { VerificationStatus, ImplementationStatus } from "../../lib/types";

interface StatusBadgeProps {
  status: ImplementationStatus;
  verification: VerificationStatus;
}

export function StatusBadge({ status, verification }: StatusBadgeProps) {
  if (status === "planned") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
        Planned
      </span>
    );
  }

  const verificationStyles: Record<VerificationStatus, string> = {
    verified: "bg-green-100 text-green-800",
    unverified: "bg-yellow-100 text-yellow-800",
    stale: "bg-orange-100 text-orange-800",
    "n/a": "bg-gray-100 text-gray-600",
  };

  const verificationLabels: Record<VerificationStatus, string> = {
    verified: "Verified",
    unverified: "Unverified",
    stale: "Stale",
    "n/a": "No Tests",
  };

  return (
    <div className="flex gap-1.5">
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
        Done
      </span>
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${verificationStyles[verification]}`}
      >
        {verificationLabels[verification]}
      </span>
    </div>
  );
}

interface CoverageBadgeProps {
  sufficient: boolean | null;
}

export function CoverageBadge({ sufficient }: CoverageBadgeProps) {
  if (sufficient === null) {
    return null;
  }

  return sufficient ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
      Coverage OK
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
      Needs Coverage
    </span>
  );
}
