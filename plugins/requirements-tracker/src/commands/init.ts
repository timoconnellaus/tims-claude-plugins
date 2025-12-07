import {
  requirementsFileExists,
  initRequirementsFile,
  loadRequirements,
  saveRequirements,
} from "../lib/store";
import type { TestRunner } from "../lib/types";

const HELP = `
Initialize requirements.json in the current directory.

USAGE:
  bun req init [options]

OPTIONS:
  --force         Overwrite existing requirements.json
  --runner <spec> Add a test runner (format: name:command:pattern)
                  Can be specified multiple times
  --help, -h      Show this help message

EXAMPLES:
  bun req init
  bun req init --runner "unit:bun test:**/*.test.ts"
  bun req init --runner "unit:bun test:**/*.test.ts" --runner "e2e:bunx playwright test:**/*.spec.ts"
`.trim();

function parseRunner(spec: string): TestRunner {
  const parts = spec.split(":");
  if (parts.length < 3) {
    throw new Error(
      `Invalid runner spec: ${spec}. Format: name:command:pattern`
    );
  }
  const [name, ...rest] = parts;
  // The pattern might contain colons, so rejoin the rest and split at the last colon
  const joined = rest.join(":");
  const lastColon = joined.lastIndexOf(":");
  if (lastColon === -1) {
    throw new Error(
      `Invalid runner spec: ${spec}. Format: name:command:pattern`
    );
  }
  const command = joined.slice(0, lastColon);
  const pattern = joined.slice(lastColon + 1);

  return { name, command, pattern };
}

export async function init(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  const force = args.includes("--force");
  const runners: TestRunner[] = [];

  // Parse --runner arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--runner" && args[i + 1]) {
      runners.push(parseRunner(args[i + 1]));
      i++;
    }
  }

  if (requirementsFileExists() && !force) {
    console.log("requirements.json already exists. Use --force to overwrite.");
    return;
  }

  if (force && requirementsFileExists()) {
    // Preserve existing requirements if forcing
    const existing = loadRequirements();
    existing.config.testRunners = runners.length > 0 ? runners : existing.config.testRunners;
    saveRequirements(existing);
    console.log("requirements.json updated.");
  } else {
    initRequirementsFile();
    if (runners.length > 0) {
      const data = loadRequirements();
      data.config.testRunners = runners;
      saveRequirements(data);
    }
    console.log("requirements.json created.");
  }
}
