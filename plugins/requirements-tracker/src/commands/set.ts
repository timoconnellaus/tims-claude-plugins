import {
  loadRequirements,
  saveRequirements,
  createHistoryEntry,
  requirementsFileExists,
} from "../lib/store";
import type { Priority, RequirementStatus } from "../lib/types";

const HELP = `
Set priority or status on a requirement.

USAGE:
  bun req set <id> [options]

OPTIONS:
  --priority <level>  Priority: critical, high, medium, low
  --status <status>   Status: draft, approved, implemented, released
  --by <name>         Who is making this change
  --help, -h          Show this help message

EXAMPLES:
  bun req set REQ-001 --priority critical
  bun req set REQ-001 --status implemented
  bun req set REQ-001 --priority high --status approved
`.trim();

const VALID_PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
const VALID_STATUSES: RequirementStatus[] = ["draft", "approved", "implemented", "released"];

function parseArgs(args: string[]): {
  id: string;
  priority?: Priority;
  status?: RequirementStatus;
  by?: string;
} {
  let id = "";
  let priority: Priority | undefined;
  let status: RequirementStatus | undefined;
  let by: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--priority" && args[i + 1]) {
      const val = args[i + 1] as Priority;
      if (!VALID_PRIORITIES.includes(val)) {
        throw new Error(`Invalid priority: ${val}. Valid priorities: ${VALID_PRIORITIES.join(", ")}`);
      }
      priority = val;
      i++;
    } else if (arg === "--status" && args[i + 1]) {
      const val = args[i + 1] as RequirementStatus;
      if (!VALID_STATUSES.includes(val)) {
        throw new Error(`Invalid status: ${val}. Valid statuses: ${VALID_STATUSES.join(", ")}`);
      }
      status = val;
      i++;
    } else if (arg === "--by" && args[i + 1]) {
      by = args[i + 1];
      i++;
    } else if (!arg.startsWith("--")) {
      id = arg;
    }
  }

  if (!id) {
    throw new Error("Requirement ID is required");
  }

  if (!priority && !status) {
    throw new Error("At least one of --priority or --status is required");
  }

  return { id, priority, status, by };
}

export async function set(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  if (!requirementsFileExists()) {
    throw new Error("requirements.json not found. Run 'bun req init' first.");
  }

  const { id, priority, status, by } = parseArgs(args);
  const data = loadRequirements();

  const requirement = data.requirements[id];
  if (!requirement) {
    throw new Error(`Requirement ${id} not found`);
  }

  const changes: string[] = [];

  if (priority) {
    const oldPriority = requirement.priority ?? "medium";
    if (oldPriority !== priority) {
      requirement.priority = priority;
      requirement.history.push(
        createHistoryEntry("priority_changed", `${oldPriority} -> ${priority}`, by)
      );
      changes.push(`priority: ${priority}`);
    }
  }

  if (status) {
    const oldStatus = requirement.status ?? "draft";
    if (oldStatus !== status) {
      requirement.status = status;
      requirement.history.push(
        createHistoryEntry("status_changed", `${oldStatus} -> ${status}`, by)
      );
      changes.push(`status: ${status}`);
    }
  }

  if (changes.length > 0) {
    saveRequirements(data);
    console.log(`${id}: ${changes.join(", ")}`);
  } else {
    console.log(`${id}: no changes`);
  }
}
