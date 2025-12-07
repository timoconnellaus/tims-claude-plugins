import Fuse, { type IFuseOptions } from "fuse.js";
import { loadRequirements, loadArchive, requirementsFileExists } from "../lib/store";
import { extractTestBody, hashTestBody } from "../lib/testParser";
import type { Requirement, Priority, RequirementStatus, SourceType, TestLink } from "../lib/types";

const HELP = `
List requirements.

USAGE:
  bun req list [options]

FILTER OPTIONS:
  --status <status>      Filter by test status: passing, failing, untested, all (default: all)
  --tag <tag>            Filter by tag (can be repeated, OR logic by default)
  --all-tags             Use AND logic for tags (must have all specified tags)
  --priority <level>     Filter by priority: critical, high, medium, low
  --req-status <status>  Filter by requirement status: draft, approved, implemented, released
  --source <type>        Filter by source type: doc, ai, slack, jira, manual
  --search <text>        Fuzzy search across description, ID, tags, source

OTHER OPTIONS:
  --archived             Show archived requirements instead
  --json                 Output as JSON
  --help, -h             Show this help message

EXAMPLES:
  bun req list
  bun req list --status untested
  bun req list --tag auth --priority critical
  bun req list --tag auth --tag security --all-tags
  bun req list --req-status approved --search login
`.trim();

type TestStatus = "passing" | "failing" | "untested" | "all";

const VALID_PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
const VALID_REQ_STATUSES: RequirementStatus[] = ["draft", "approved", "implemented", "released"];
const VALID_SOURCES: SourceType[] = ["doc", "ai", "slack", "jira", "manual"];

interface FilterOptions {
  testStatus: TestStatus;
  tags: string[];
  allTags: boolean;
  priority?: Priority;
  reqStatus?: RequirementStatus;
  sourceType?: SourceType;
  searchText?: string;
  archived: boolean;
  json: boolean;
}

function parseArgs(args: string[]): FilterOptions {
  let testStatus: TestStatus = "all";
  const tags: string[] = [];
  let allTags = false;
  let priority: Priority | undefined;
  let reqStatus: RequirementStatus | undefined;
  let sourceType: SourceType | undefined;
  let searchText: string | undefined;
  let archived = false;
  let json = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--status" && args[i + 1]) {
      const val = args[i + 1] as TestStatus;
      if (!["passing", "failing", "untested", "all"].includes(val)) {
        throw new Error(`Invalid test status: ${val}`);
      }
      testStatus = val;
      i++;
    } else if (arg === "--tag" && args[i + 1]) {
      tags.push(args[i + 1]);
      i++;
    } else if (arg === "--all-tags") {
      allTags = true;
    } else if (arg === "--priority" && args[i + 1]) {
      const val = args[i + 1] as Priority;
      if (!VALID_PRIORITIES.includes(val)) {
        throw new Error(`Invalid priority: ${val}. Valid: ${VALID_PRIORITIES.join(", ")}`);
      }
      priority = val;
      i++;
    } else if (arg === "--req-status" && args[i + 1]) {
      const val = args[i + 1] as RequirementStatus;
      if (!VALID_REQ_STATUSES.includes(val)) {
        throw new Error(`Invalid requirement status: ${val}. Valid: ${VALID_REQ_STATUSES.join(", ")}`);
      }
      reqStatus = val;
      i++;
    } else if (arg === "--source" && args[i + 1]) {
      const val = args[i + 1] as SourceType;
      if (!VALID_SOURCES.includes(val)) {
        throw new Error(`Invalid source type: ${val}. Valid: ${VALID_SOURCES.join(", ")}`);
      }
      sourceType = val;
      i++;
    } else if (arg === "--search" && args[i + 1]) {
      searchText = args[i + 1];
      i++;
    } else if (arg === "--archived") {
      archived = true;
    } else if (arg === "--json") {
      json = true;
    }
  }

  return { testStatus, tags, allTags, priority, reqStatus, sourceType, searchText, archived, json };
}

function getTestStatus(req: Requirement): "passing" | "failing" | "untested" {
  if (req.tests.length === 0) return "untested";
  return req.lastVerified ? "passing" : "untested";
}

interface RequirementWithId extends Requirement {
  id: string;
}

const FUSE_OPTIONS: IFuseOptions<RequirementWithId> = {
  threshold: 0.4,
  keys: [
    { name: "description", weight: 1 },
    { name: "id", weight: 0.8 },
    { name: "tags", weight: 0.6 },
    { name: "source.reference", weight: 0.5 },
  ],
};

function filterRequirements(
  reqs: Record<string, Requirement>,
  opts: FilterOptions
): [string, Requirement][] {
  let entries = Object.entries(reqs);

  // Fuzzy search with Fuse.js
  if (opts.searchText) {
    const items: RequirementWithId[] = entries.map(([id, req]) => ({ ...req, id }));
    const fuse = new Fuse(items, FUSE_OPTIONS);
    const results = fuse.search(opts.searchText);
    const matchedIds = new Set(results.map(r => r.item.id));
    entries = entries.filter(([id]) => matchedIds.has(id));
  }

  return entries.filter(([, req]) => {
    // Test status filter
    if (opts.testStatus !== "all") {
      if (getTestStatus(req) !== opts.testStatus) return false;
    }

    // Tag filter
    if (opts.tags.length > 0) {
      const reqTags = req.tags ?? [];
      if (opts.allTags) {
        // AND: must have all specified tags
        if (!opts.tags.every(t => reqTags.includes(t))) return false;
      } else {
        // OR: must have at least one
        if (!opts.tags.some(t => reqTags.includes(t))) return false;
      }
    }

    // Priority filter
    if (opts.priority) {
      const reqPriority = req.priority ?? "medium";
      if (reqPriority !== opts.priority) return false;
    }

    // Requirement status filter
    if (opts.reqStatus) {
      const status = req.status ?? "draft";
      if (status !== opts.reqStatus) return false;
    }

    // Source type filter
    if (opts.sourceType && req.source.type !== opts.sourceType) return false;

    return true;
  });
}

function formatPriority(priority: Priority): string {
  return priority.toUpperCase();
}

type ConfirmationStatus = "confirmed" | "stale" | "unconfirmed";

async function getConfirmationStatus(test: TestLink): Promise<ConfirmationStatus> {
  if (!test.confirmation) return "unconfirmed";

  const body = await extractTestBody(test.file, test.identifier);
  if (!body) return "stale"; // Can't find test anymore

  const currentHash = hashTestBody(body);
  return currentHash === test.confirmation.hash ? "confirmed" : "stale";
}

function confirmationIcon(status: ConfirmationStatus): string {
  switch (status) {
    case "confirmed": return "✓";
    case "stale": return "⚠";
    case "unconfirmed": return "-";
  }
}

export async function list(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  if (!requirementsFileExists()) {
    throw new Error("requirements.json not found. Run 'bun req init' first.");
  }

  const opts = parseArgs(args);

  const source = opts.archived ? loadArchive() : loadRequirements();
  const requirements = "requirements" in source ? source.requirements : {};

  const entries = filterRequirements(requirements, opts);

  if (opts.json) {
    console.log(JSON.stringify(Object.fromEntries(entries), null, 2));
    return;
  }

  if (entries.length === 0) {
    console.log(opts.archived ? "No archived requirements." : "No requirements found.");
    return;
  }

  console.log(opts.archived ? "Archived Requirements:" : "Requirements:");
  console.log("");

  for (const [id, req] of entries) {
    const testCount = req.tests.length;
    const statusIcon = testCount === 0 ? "○" : req.lastVerified ? "●" : "◐";
    const priority = req.priority ?? "medium";
    const reqStatus = req.status ?? "draft";
    const tags = req.tags ?? [];

    console.log(`${statusIcon} ${id}: ${req.description}`);

    // Metadata line
    const metaParts: string[] = [];
    metaParts.push(`Priority: ${formatPriority(priority)}`);
    metaParts.push(`Status: ${reqStatus}`);
    if (tags.length > 0) {
      metaParts.push(`Tags: [${tags.join(", ")}]`);
    }
    console.log(`   ${metaParts.join("  ")}`);

    // Source line
    const sourceInfo = req.source.reference
      ? `[${req.source.type}: ${req.source.reference}]`
      : `[${req.source.type}]`;
    console.log(`   Source: ${sourceInfo}`);

    // Tests line
    console.log(`   Tests: ${testCount} linked`);
    if (req.tests.length > 0) {
      for (const test of req.tests) {
        const status = await getConfirmationStatus(test);
        const icon = confirmationIcon(status);
        const staleTag = status === "stale" ? " [stale]" : "";
        console.log(`     ${icon} ${test.file}:${test.identifier} (${test.runner})${staleTag}`);
      }
    }
    console.log("");
  }

  console.log(`Legend: ○ untested  ◐ tests linked  ● verified passing`);
  console.log(`Test confirmation: ✓ confirmed  ⚠ stale  - unconfirmed`);
}
