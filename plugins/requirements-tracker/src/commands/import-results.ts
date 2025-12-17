/**
 * Import test results from a JUnit XML file
 */

import { copyFile, readFile } from "fs/promises";
import { resolve, join } from "path";
import { loadConfig } from "../lib/store";
import { junitXml } from "../lib/result-parsers";
import { REQUIREMENTS_DIR, TEST_RESULTS_FILE } from "../lib/types";

export async function importResults(args: {
  cwd: string;
  file: string;
  format?: string;
}): Promise<void> {
  const { cwd, file } = args;

  // Load config to ensure we're in an initialized project
  const config = await loadConfig(cwd);
  if (!config) {
    console.error("Not initialized. Run 'req init' first.");
    process.exit(1);
  }

  // Resolve and read the file
  const filePath = resolve(cwd, file);
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(`File not found: ${file}`);
      process.exit(1);
    }
    throw error;
  }

  // Verify it's valid JUnit XML
  if (!junitXml.canParse(content)) {
    console.error("File is not valid JUnit XML format.");
    console.error("Only JUnit XML files are supported for import.");
    console.error("Most test runners can output JUnit XML (e.g., 'bun test --reporter=junit')");
    process.exit(1);
  }

  // Parse to get summary for display
  const { summary } = junitXml.parse(content);

  // Copy the file to .requirements/test-results.xml
  const destPath = join(cwd, REQUIREMENTS_DIR, TEST_RESULTS_FILE);
  await copyFile(filePath, destPath);

  // Print summary
  console.log(`Imported ${summary.total} test results from ${file}`);
  console.log(`  Passed: ${summary.passed}`);
  console.log(`  Failed: ${summary.failed}`);
  console.log(`  Skipped: ${summary.skipped}`);
  console.log(`\nResults saved to .requirements/${TEST_RESULTS_FILE}`);
}
