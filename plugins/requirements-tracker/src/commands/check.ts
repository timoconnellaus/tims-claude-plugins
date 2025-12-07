import { loadRequirements, saveRequirements, requirementsFileExists } from "../lib/store";
import { parseTestFiles } from "../lib/testParser";
import type { CheckResult } from "../lib/types";

const HELP = `
Run verification checks on requirements.

USAGE:
  bun req check [options]

OPTIONS:
  --coverage   Show requirements without tests
  --orphans    Show tests not linked to any requirement
  --run        Run tests and update verification status
  --json       Output as JSON
  --help, -h   Show this help message

EXAMPLES:
  bun req check
  bun req check --coverage
  bun req check --orphans
  bun req check --run
`.trim();

interface ParsedArgs {
  coverage: boolean;
  orphans: boolean;
  run: boolean;
  json: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  return {
    coverage: args.includes("--coverage"),
    orphans: args.includes("--orphans"),
    run: args.includes("--run"),
    json: args.includes("--json"),
  };
}

async function runTests(command: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(command.split(" "), {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

export async function check(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  if (!requirementsFileExists()) {
    throw new Error("requirements.json not found. Run 'bun req init' first.");
  }

  const opts = parseArgs(args);
  const showAll = !opts.coverage && !opts.orphans && !opts.run;

  const data = loadRequirements();
  const result: CheckResult = {
    requirementsWithoutTests: [],
    testsWithoutRequirements: [],
    passingRequirements: [],
    failingRequirements: [],
    untestedRequirements: [],
  };

  // Find requirements without tests
  for (const [id, req] of Object.entries(data.requirements)) {
    if (req.tests.length === 0) {
      result.requirementsWithoutTests.push(id);
      result.untestedRequirements.push(id);
    }
  }

  // Find orphan tests (tests not linked to any requirement)
  if (showAll || opts.orphans) {
    const allLinkedTests = new Set<string>();
    for (const req of Object.values(data.requirements)) {
      for (const test of req.tests) {
        allLinkedTests.add(`${test.file}:${test.identifier}`);
      }
    }

    // Parse test files to find all tests
    for (const runner of data.config.testRunners) {
      const testsInFiles = await parseTestFiles(runner.pattern);
      for (const test of testsInFiles) {
        const key = `${test.file}:${test.identifier}`;
        if (!allLinkedTests.has(key)) {
          result.testsWithoutRequirements.push({
            runner: runner.name,
            file: test.file,
            identifier: test.identifier,
          });
        }
      }
    }
  }

  // Run tests if requested
  if (opts.run) {
    const reqsByRunner = new Map<string, string[]>();

    for (const [id, req] of Object.entries(data.requirements)) {
      for (const test of req.tests) {
        const list = reqsByRunner.get(test.runner) ?? [];
        if (!list.includes(id)) list.push(id);
        reqsByRunner.set(test.runner, list);
      }
    }

    for (const runner of data.config.testRunners) {
      const reqIds = reqsByRunner.get(runner.name) ?? [];
      if (reqIds.length === 0) continue;

      console.log(`Running ${runner.name}: ${runner.command}`);
      const passed = await runTests(runner.command);
      const timestamp = new Date().toISOString();

      for (const id of reqIds) {
        if (passed) {
          data.requirements[id].lastVerified = timestamp;
          result.passingRequirements.push(id);
        } else {
          result.failingRequirements.push(id);
        }
      }
    }

    saveRequirements(data);
  }

  // Output results
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (showAll || opts.coverage) {
    console.log("\n=== Coverage ===");
    if (result.requirementsWithoutTests.length === 0) {
      console.log("All requirements have tests linked.");
    } else {
      console.log("Requirements without tests:");
      for (const id of result.requirementsWithoutTests) {
        console.log(`  - ${id}: ${data.requirements[id].description}`);
      }
    }
  }

  if (showAll || opts.orphans) {
    console.log("\n=== Orphan Tests ===");
    if (result.testsWithoutRequirements.length === 0) {
      console.log("All tests are linked to requirements.");
    } else {
      console.log("Tests not linked to any requirement:");
      for (const test of result.testsWithoutRequirements) {
        console.log(`  - ${test.file}:${test.identifier} (${test.runner})`);
      }
    }
  }

  if (opts.run) {
    console.log("\n=== Test Results ===");
    console.log(`Passing: ${result.passingRequirements.length}`);
    console.log(`Failing: ${result.failingRequirements.length}`);

    if (result.failingRequirements.length > 0) {
      console.log("\nFailing requirements:");
      for (const id of result.failingRequirements) {
        console.log(`  - ${id}: ${data.requirements[id].description}`);
      }
    }
  }

  // Summary
  if (showAll) {
    const total = Object.keys(data.requirements).length;
    const withTests = total - result.requirementsWithoutTests.length;
    console.log("\n=== Summary ===");
    console.log(`Total requirements: ${total}`);
    console.log(`With tests: ${withTests}`);
    console.log(`Without tests: ${result.requirementsWithoutTests.length}`);
    console.log(`Orphan tests: ${result.testsWithoutRequirements.length}`);
  }
}
