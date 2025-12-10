import { StatusBadge } from "./StatusBadge";
import type { RequirementWithData } from "./RequirementList";

interface RequirementListItemProps {
  requirement: RequirementWithData;
  isSelected: boolean;
  onClick: () => void;
}

export function RequirementListItem({
  requirement,
  isSelected,
  onClick,
}: RequirementListItemProps) {
  // Extract just the filename from the path
  const filename = requirement.id.split("/").pop() || requirement.id;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
        isSelected
          ? "bg-blue-50 border border-blue-200"
          : "hover:bg-gray-50 border border-transparent"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`font-mono text-sm truncate ${
            isSelected ? "text-blue-900" : "text-gray-700"
          }`}
        >
          {filename.replace(/^REQ_/, "").replace(/\.yml$/, "")}
        </span>
        <StatusBadge
          status={requirement.status}
          verification={requirement.verification}
        />
      </div>
      <div className="text-xs text-gray-500 mt-1 truncate">
        {requirement.testCount} test{requirement.testCount !== 1 ? "s" : ""}
        {requirement.unansweredQuestions > 0 && (
          <span className="text-yellow-600 ml-2">
            {requirement.unansweredQuestions} question
            {requirement.unansweredQuestions !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </button>
  );
}
