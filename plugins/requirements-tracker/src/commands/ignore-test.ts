/**
 * Mark a test as intentionally not linked to any requirement
 */

import {
  loadConfig,
  loadIgnoredTests,
  saveIgnoredTests,
} from "../lib/store";
import { extractAllTests } from "../lib/test-parser";
import type { IgnoredTest } from "../lib/types";

interface IgnoreTestArgs {
  cwd: string;
  testSpec: string; // "file:identifier" format
  reason: string;
}

export async function ignoreTest(args: IgnoreTestArgs): Promise<void> {
  const { cwd, testSpec, reason } = args;

  // Parse test spec
  const colonIndex = testSpec.indexOf(":");
  if (colonIndex === -1) {
    console.error("Invalid test spec. Use format: file:identifier");
    console.error("Example: src/auth.test.ts:validates login");
    process.exit(1);
  }

  const file = testSpec.slice(0, colonIndex);
  const identifier = testSpec.slice(colonIndex + 1);

  if (!file || !identifier) {
    console.error("Invalid test spec. Both file and identifier are required.");
    process.exit(1);
  }

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    console.error("Not initialized. Run 'req init' first.");
    process.exit(1);
  }

  // Extract all tests to verify test exists
  console.log("Searching for test in codebase...");
  const allTests = await extractAllTests(cwd, config.testGlob);
  const testExists = allTests.some(
    (t) => t.file === file && t.identifier === identifier
  );

  if (!testExists) {
    console.error(`Test not found in codebase: ${testSpec}`);
    console.error(
      "Make sure the test exists and the file path is relative to the project root."
    );
    process.exit(1);
  }

  // Load ignored tests
  const ignoredTestsFile = await loadIgnoredTests(cwd);

  // Check for duplicates
  const alreadyIgnored = ignoredTestsFile.tests.some(
    (t) => t.file === file && t.identifier === identifier
  );

  if (alreadyIgnored) {
    console.log("Test is already in the ignored list.");
    return;
  }

  // Add to ignored tests
  const ignoredTest: IgnoredTest = {
    file,
    identifier,
    reason,
    ignoredAt: new Date().toISOString(),
  };

  ignoredTestsFile.tests.push(ignoredTest);

  // Save
  await saveIgnoredTests(cwd, ignoredTestsFile);

  console.log(`Ignored test: ${testSpec}`);
  console.log(`  Reason: ${reason}`);
  console.log(`\nTotal ignored tests: ${ignoredTestsFile.tests.length}`);
}
