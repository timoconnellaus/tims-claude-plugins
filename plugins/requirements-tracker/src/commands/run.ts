/**
 * Run tests command
 */

import { loadConfig, loadRequirement, isValidRequirementPath } from "../lib/store";
import { runTests, runMultipleTests } from "../lib/test-runner";

export async function run(args: {
  cwd: string;
  target?: string; // file, file:identifier, or requirement.yml
}): Promise<void> {
  const { cwd, target } = args;

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    console.error("Not initialized. Run 'req init' first.");
    process.exit(1);
  }

  // Determine what to run
  let file: string | undefined;
  let identifier: string | undefined;

  if (!target) {
    // No target - run all tests
    console.log("Running all tests...\n");
  } else if (isValidRequirementPath(target)) {
    // Target is a requirement path - run all tests linked to it
    const requirement = await loadRequirement(cwd, target);
    if (!requirement) {
      console.error(`Requirement not found: ${target}`);
      process.exit(1);
    }

    if (requirement.data.tests.length === 0) {
      console.log(`No tests linked to ${target}`);
      return;
    }

    console.log(`Running ${requirement.data.tests.length} test(s) for ${target}...\n`);

    const result = await runMultipleTests(
      cwd,
      requirement.data.tests.map((t) => ({ file: t.file, identifier: t.identifier })),
      true // stream output
    );

    printSummary(result.summary, result.exitCode);
    process.exit(result.exitCode);
    return;
  } else if (target.includes(":")) {
    // Target is file:identifier
    const colonIndex = target.indexOf(":");
    file = target.slice(0, colonIndex);
    identifier = target.slice(colonIndex + 1);
    console.log(`Running test: ${identifier} in ${file}...\n`);
  } else {
    // Target is just a file
    file = target;
    console.log(`Running tests in ${file}...\n`);
  }

  // Run tests
  try {
    const result = await runTests(
      { cwd, file, identifier },
      true // stream output
    );

    printSummary(result.summary, result.exitCode);
    process.exit(result.exitCode);
  } catch (error) {
    console.error(`Error running tests: ${(error as Error).message}`);
    process.exit(1);
  }
}

function printSummary(
  summary: { total: number; passed: number; failed: number; skipped: number },
  exitCode: number
): void {
  console.log("\n" + "─".repeat(50));
  console.log("Test Results:");
  console.log(`  Total:   ${summary.total}`);
  console.log(`  Passed:  ${summary.passed}`);
  console.log(`  Failed:  ${summary.failed}`);
  if (summary.skipped > 0) {
    console.log(`  Skipped: ${summary.skipped}`);
  }
  console.log("─".repeat(50));

  if (exitCode === 0) {
    console.log("✓ All tests passed");
  } else {
    console.log("✗ Some tests failed");
  }
}
