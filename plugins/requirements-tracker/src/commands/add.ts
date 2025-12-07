import {
  loadRequirements,
  saveRequirements,
  generateId,
  createHistoryEntry,
  requirementsFileExists,
} from "../lib/store";
import type { SourceType, Requirement, Priority, RequirementStatus } from "../lib/types";

const HELP = `
Add a new requirement.

USAGE:
  bun req add <description> [options]

OPTIONS:
  --source <type>     Source type: doc, ai, slack, jira, manual (default: manual)
  --ref <reference>   Reference to the source (e.g., file path, URL, ticket ID)
  --tag <tag>         Add a tag (can be repeated)
  --priority <level>  Priority: critical, high, medium, low (default: medium)
  --status <status>   Status: draft, approved, implemented, released (default: draft)
  --by <name>         Who is adding this requirement
  --help, -h          Show this help message

EXAMPLES:
  bun req add "User can login with email/password"
  bun req add "API rate limiting" --source doc --ref specs/api.md#L42
  bun req add "Fix login bug" --source jira --ref PROJ-123 --priority high
  bun req add "OAuth integration" --tag auth --tag security --status approved
`.trim();

const VALID_SOURCES: SourceType[] = ["doc", "ai", "slack", "jira", "manual"];
const VALID_PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
const VALID_STATUSES: RequirementStatus[] = ["draft", "approved", "implemented", "released"];

function parseArgs(args: string[]): {
  description: string;
  source: SourceType;
  reference: string;
  tags: string[];
  priority: Priority;
  status: RequirementStatus;
  by?: string;
} {
  let description = "";
  let source: SourceType = "manual";
  let reference = "";
  const tags: string[] = [];
  let priority: Priority = "medium";
  let status: RequirementStatus = "draft";
  let by: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--source" && args[i + 1]) {
      const val = args[i + 1] as SourceType;
      if (!VALID_SOURCES.includes(val)) {
        throw new Error(`Invalid source type: ${val}. Valid types: ${VALID_SOURCES.join(", ")}`);
      }
      source = val;
      i++;
    } else if (arg === "--ref" && args[i + 1]) {
      reference = args[i + 1];
      i++;
    } else if (arg === "--tag" && args[i + 1]) {
      tags.push(args[i + 1]);
      i++;
    } else if (arg === "--priority" && args[i + 1]) {
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
      description = arg;
    }
  }

  if (!description) {
    throw new Error("Description is required");
  }

  return { description, source, reference, tags, priority, status, by };
}

export async function add(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  if (!requirementsFileExists()) {
    throw new Error("requirements.json not found. Run 'bun req init' first.");
  }

  const { description, source, reference, tags, priority, status, by } = parseArgs(args);
  const data = loadRequirements();
  const id = generateId(data.requirements);

  const requirement: Requirement = {
    description,
    source: {
      type: source,
      reference,
      capturedAt: new Date().toISOString(),
    },
    tests: [],
    history: [createHistoryEntry("created", undefined, by)],
    tags: tags.length > 0 ? tags : undefined,
    priority,
    status,
  };

  data.requirements[id] = requirement;
  saveRequirements(data);

  const extras: string[] = [];
  if (priority !== "medium") extras.push(`priority: ${priority}`);
  if (status !== "draft") extras.push(`status: ${status}`);
  if (tags.length > 0) extras.push(`tags: [${tags.join(", ")}]`);

  const extraInfo = extras.length > 0 ? ` (${extras.join(", ")})` : "";
  console.log(`Created ${id}: ${description}${extraInfo}`);
}
