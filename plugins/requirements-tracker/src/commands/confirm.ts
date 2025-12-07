import {
  loadRequirements,
  saveRequirements,
  createHistoryEntry,
  requirementsFileExists,
} from "../lib/store";
import { extractTestBody, hashTestBody } from "../lib/testParser";
import type { TestConfirmation } from "../lib/types";

const HELP = `
Confirm that a test covers a requirement.

The confirmation is tied to a hash of the test code. If the test changes,
the confirmation becomes stale and needs to be re-confirmed.

USAGE:
  bun req confirm <id> <file:identifier> [options]

OPTIONS:
  --by <name>     Who is confirming
  --note <text>   Confirmation note
  --force         Re-confirm even if already confirmed with same hash
  --help, -h      Show this help message

EXAMPLES:
  bun req confirm REQ-001 tests/auth.test.ts:loginTest
  bun req confirm REQ-001 tests/auth.test.ts:"login flow" --by "John" --note "Reviewed on 2024-01-15"
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

export async function confirm(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  if (!requirementsFileExists()) {
    throw new Error("requirements.json not found. Run 'bun req init' first.");
  }

  const positional: string[] = [];
  let by: string | undefined;
  let note: string | undefined;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--by" && args[i + 1]) {
      by = args[i + 1];
      i++;
    } else if (arg === "--note" && args[i + 1]) {
      note = args[i + 1];
      i++;
    } else if (arg === "--force") {
      force = true;
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    throw new Error("Usage: bun req confirm <id> <file:identifier>");
  }

  const [id, testSpec] = positional;
  const { file, identifier } = parseTestSpec(testSpec);

  const data = loadRequirements();

  if (!data.requirements[id]) {
    throw new Error(`Requirement ${id} not found`);
  }

  // Find the linked test
  const testLink = data.requirements[id].tests.find(
    (t) => t.file === file && t.identifier === identifier
  );

  if (!testLink) {
    throw new Error(
      `Test ${file}:${identifier} is not linked to ${id}. Link it first with: bun req link ${id} ${testSpec}`
    );
  }

  // Extract and hash test body
  const testBody = await extractTestBody(file, identifier);
  if (!testBody) {
    throw new Error(
      `Could not find test "${identifier}" in file ${file}. Make sure the test exists.`
    );
  }

  const hash = hashTestBody(testBody);

  // Check if already confirmed with same hash
  if (testLink.confirmation && testLink.confirmation.hash === hash && !force) {
    console.log(`Test already confirmed with current hash. Use --force to re-confirm.`);
    return;
  }

  // Check if this is a re-confirmation (hash changed)
  const wasStale = testLink.confirmation && testLink.confirmation.hash !== hash;

  // Update confirmation
  const confirmation: TestConfirmation = {
    hash,
    confirmedAt: new Date().toISOString(),
    ...(by && { confirmedBy: by }),
    ...(note && { note }),
  };

  testLink.confirmation = confirmation;

  // Add history entry
  const historyNote = wasStale
    ? `Re-confirmed test (was stale): ${file}:${identifier}`
    : `Confirmed test: ${file}:${identifier}`;
  data.requirements[id].history.push(createHistoryEntry("modified", historyNote, by));

  saveRequirements(data);

  if (wasStale) {
    console.log(`Re-confirmed ${file}:${identifier} for ${id} (test was modified)`);
  } else {
    console.log(`Confirmed ${file}:${identifier} for ${id}`);
  }
}
