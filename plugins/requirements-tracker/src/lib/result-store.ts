/**
 * Test results store - loading test results from JUnit XML
 */

import { readFile, stat } from "fs/promises";
import { join } from "path";
import { junitXml } from "./result-parsers";
import {
  REQUIREMENTS_DIR,
  TEST_RESULTS_FILE,
  type TestRunResults,
  type TestResult,
  type TestLink,
  type TestResultStatus,
} from "./types";

/**
 * Get path to test results file
 */
export function getTestResultsPath(cwd: string): string {
  return join(cwd, REQUIREMENTS_DIR, TEST_RESULTS_FILE);
}

/**
 * Load test results from JUnit XML file
 * @returns TestRunResults or null if file doesn't exist
 */
export async function loadTestResults(
  cwd: string
): Promise<TestRunResults | null> {
  const path = getTestResultsPath(cwd);
  try {
    const content = await readFile(path, "utf-8");

    // Check if it's valid JUnit XML
    if (!junitXml.canParse(content)) {
      console.warn("Test results file is not valid JUnit XML");
      return null;
    }

    // Parse the XML
    const { results, summary } = junitXml.parse(content);

    // Get file modification time as lastRunAt
    const stats = await stat(path);

    return {
      importedAt: stats.mtime.toISOString(),
      sourceFile: TEST_RESULTS_FILE,
      format: "junit-xml",
      summary,
      results,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Normalize a file path for matching
 * - Remove leading ./
 * - Normalize slashes
 * - Lowercase for case-insensitive matching
 */
function normalizePath(path: string): string {
  return path
    .replace(/^\.\//, "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

/**
 * Normalize an identifier for matching
 * - Trim whitespace
 * - Collapse multiple spaces
 */
function normalizeIdentifier(id: string): string {
  return id.trim().replace(/\s+/g, " ");
}

/**
 * Find the matching test result for a test link
 * @returns The matching TestResult or null
 */
export function matchResultToTestLink(
  testLink: TestLink,
  results: TestResult[]
): TestResult | null {
  const normalizedFile = normalizePath(testLink.file);
  const normalizedIdentifier = normalizeIdentifier(testLink.identifier);

  // First try exact match
  for (const result of results) {
    if (
      normalizePath(result.file) === normalizedFile &&
      normalizeIdentifier(result.identifier) === normalizedIdentifier
    ) {
      return result;
    }
  }

  // Try matching just the filename (without directory) + identifier
  // This helps when paths differ between test runner and tracked tests
  const filename = normalizedFile.split("/").pop() || "";
  for (const result of results) {
    const resultFilename = normalizePath(result.file).split("/").pop() || "";
    if (
      resultFilename === filename &&
      normalizeIdentifier(result.identifier) === normalizedIdentifier
    ) {
      return result;
    }
  }

  return null;
}

/**
 * Get the result status for a test link
 * @returns The status or undefined if no match found
 */
export function getTestLinkResult(
  testLink: TestLink,
  results: TestResult[]
): TestResultStatus | undefined {
  const match = matchResultToTestLink(testLink, results);
  return match?.status;
}
