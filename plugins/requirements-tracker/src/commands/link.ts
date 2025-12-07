import {
  loadRequirements,
  saveRequirements,
  createHistoryEntry,
  requirementsFileExists,
} from "../lib/store";
import type { TestLink } from "../lib/types";

const LINK_HELP = `
Link a test to a requirement.

USAGE:
  bun req link <id> <file:identifier> [options]

OPTIONS:
  --runner <name>  Test runner name (must match one in config, or first runner used)
  --by <name>      Who is linking this test
  --help, -h       Show this help message

EXAMPLES:
  bun req link REQ-001 tests/auth.test.ts:loginTest
  bun req link REQ-001 tests/auth.spec.ts:"login flow" --runner e2e
`.trim();

const UNLINK_HELP = `
Unlink a test from a requirement.

USAGE:
  bun req unlink <id> <file:identifier>

OPTIONS:
  --help, -h  Show this help message

EXAMPLES:
  bun req unlink REQ-001 tests/auth.test.ts:loginTest
`.trim();

function parseTestSpec(spec: string): { file: string; identifier: string } {
  const colonIndex = spec.lastIndexOf(":");
  if (colonIndex === -1) {
    throw new Error(`Invalid test spec: ${spec}. Format: file:identifier`);
  }
  return {
    file: spec.slice(0, colonIndex),
    identifier: spec.slice(colonIndex + 1),
  };
}

export async function link(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(LINK_HELP);
    return;
  }

  if (!requirementsFileExists()) {
    throw new Error("requirements.json not found. Run 'bun req init' first.");
  }

  const positional: string[] = [];
  let runner: string | undefined;
  let by: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--runner" && args[i + 1]) {
      runner = args[i + 1];
      i++;
    } else if (arg === "--by" && args[i + 1]) {
      by = args[i + 1];
      i++;
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    throw new Error("Usage: bun req link <id> <file:identifier>");
  }

  const [id, testSpec] = positional;
  const { file, identifier } = parseTestSpec(testSpec);

  const data = loadRequirements();

  if (!data.requirements[id]) {
    throw new Error(`Requirement ${id} not found`);
  }

  // Determine runner
  const runnerName = runner ?? data.config.testRunners[0]?.name ?? "default";
  if (runner && !data.config.testRunners.find((r) => r.name === runner)) {
    console.warn(`Warning: Runner '${runner}' not found in config.testRunners`);
  }

  // Check for duplicate
  const existing = data.requirements[id].tests.find(
    (t) => t.file === file && t.identifier === identifier
  );
  if (existing) {
    console.log(`Test already linked to ${id}`);
    return;
  }

  const testLink: TestLink = {
    runner: runnerName,
    file,
    identifier,
    linkedAt: new Date().toISOString(),
  };

  data.requirements[id].tests.push(testLink);
  data.requirements[id].history.push(
    createHistoryEntry("modified", `Linked test: ${file}:${identifier}`, by)
  );

  saveRequirements(data);
  console.log(`Linked ${file}:${identifier} to ${id}`);
}

export async function unlink(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(UNLINK_HELP);
    return;
  }

  if (!requirementsFileExists()) {
    throw new Error("requirements.json not found. Run 'bun req init' first.");
  }

  const positional = args.filter((a) => !a.startsWith("--"));

  if (positional.length < 2) {
    throw new Error("Usage: bun req unlink <id> <file:identifier>");
  }

  const [id, testSpec] = positional;
  const { file, identifier } = parseTestSpec(testSpec);

  const data = loadRequirements();

  if (!data.requirements[id]) {
    throw new Error(`Requirement ${id} not found`);
  }

  const index = data.requirements[id].tests.findIndex(
    (t) => t.file === file && t.identifier === identifier
  );

  if (index === -1) {
    console.log(`Test not linked to ${id}`);
    return;
  }

  data.requirements[id].tests.splice(index, 1);
  data.requirements[id].history.push(
    createHistoryEntry("modified", `Unlinked test: ${file}:${identifier}`)
  );

  saveRequirements(data);
  console.log(`Unlinked ${file}:${identifier} from ${id}`);
}
