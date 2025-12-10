/**
 * Remove a test from the ignored list
 */

import { loadConfig, loadIgnoredTests, saveIgnoredTests } from "../lib/store";

interface UnignoreTestArgs {
  cwd: string;
  testSpec: string; // "file:identifier" format
}

export async function unignoreTest(args: UnignoreTestArgs): Promise<void> {
  const { cwd, testSpec } = args;

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

  // Load ignored tests
  const ignoredTestsFile = await loadIgnoredTests(cwd);

  // Find test in ignored list
  const testIndex = ignoredTestsFile.tests.findIndex(
    (t) => t.file === file && t.identifier === identifier
  );

  if (testIndex === -1) {
    console.error(`Test not found in ignored list: ${testSpec}`);
    if (ignoredTestsFile.tests.length > 0) {
      console.error("Currently ignored tests:");
      for (const test of ignoredTestsFile.tests) {
        console.error(`  - ${test.file}:${test.identifier}`);
      }
    } else {
      console.error("No tests are currently ignored.");
    }
    process.exit(1);
  }

  // Remove from ignored list
  ignoredTestsFile.tests.splice(testIndex, 1);

  // Save
  await saveIgnoredTests(cwd, ignoredTestsFile);

  console.log(`Removed from ignored list: ${testSpec}`);
  console.log(`\nTotal ignored tests: ${ignoredTestsFile.tests.length}`);
}
