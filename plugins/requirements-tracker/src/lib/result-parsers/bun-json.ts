/**
 * Parser for JSON test results format
 *
 * Supports common JSON formats from test runners like Jest, Vitest, or custom reporters.
 * Expected format:
 * {
 *   "testResults": [
 *     {
 *       "name": "path/to/file.test.ts",
 *       "assertionResults": [
 *         {
 *           "fullName": "test name",
 *           "status": "passed" | "failed" | "pending" | "skipped",
 *           "duration": 123,
 *           "failureMessages": ["error message"]
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * Or simpler flat format:
 * {
 *   "tests": [
 *     {
 *       "file": "path/to/file.test.ts",
 *       "name": "test name",
 *       "status": "pass" | "fail" | "skip",
 *       "duration": 123,
 *       "error": { "message": "..." }
 *     }
 *   ]
 * }
 */

import type { TestResult, TestRunSummary, TestResultStatus } from "../types";

// Jest/Vitest format types
interface JestAssertionResult {
  fullName?: string;
  title?: string;
  status: string;
  duration?: number;
  failureMessages?: string[];
}

interface JestTestResult {
  name?: string;
  testFilePath?: string;
  assertionResults?: JestAssertionResult[];
}

interface JestFormat {
  testResults?: JestTestResult[];
}

// Simple flat format types
interface SimpleTest {
  file: string;
  name?: string;
  identifier?: string;
  status: string;
  duration?: number;
  error?: { message?: string };
  errorMessage?: string;
}

interface SimpleFormat {
  tests?: SimpleTest[];
}

function normalizeStatus(status: string): TestResultStatus {
  const s = status.toLowerCase();
  if (s === "passed" || s === "pass") return "passed";
  if (s === "failed" || s === "fail") return "failed";
  if (s === "skipped" || s === "skip" || s === "pending" || s === "todo")
    return "skipped";
  if (s === "error") return "error";
  return "failed"; // Default unknown to failed
}

function parseJestFormat(data: JestFormat): TestResult[] {
  const results: TestResult[] = [];

  for (const testFile of data.testResults || []) {
    const file = testFile.name || testFile.testFilePath || "unknown";

    for (const assertion of testFile.assertionResults || []) {
      results.push({
        file,
        identifier: assertion.fullName || assertion.title || "unknown",
        status: normalizeStatus(assertion.status),
        duration: assertion.duration,
        errorMessage: assertion.failureMessages?.join("\n"),
      });
    }
  }

  return results;
}

function parseSimpleFormat(data: SimpleFormat): TestResult[] {
  const results: TestResult[] = [];

  for (const test of data.tests || []) {
    results.push({
      file: test.file,
      identifier: test.name || test.identifier || "unknown",
      status: normalizeStatus(test.status),
      duration: test.duration,
      errorMessage: test.error?.message || test.errorMessage,
    });
  }

  return results;
}

export function canParse(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

export function parse(content: string): {
  results: TestResult[];
  summary: TestRunSummary;
} {
  const data = JSON.parse(content);

  let results: TestResult[];

  // Detect format
  if (data.testResults && Array.isArray(data.testResults)) {
    // Jest/Vitest format
    results = parseJestFormat(data);
  } else if (data.tests && Array.isArray(data.tests)) {
    // Simple flat format
    results = parseSimpleFormat(data);
  } else {
    throw new Error(
      "Unknown JSON format: expected 'testResults' or 'tests' array"
    );
  }

  // Calculate summary
  const summary: TestRunSummary = {
    total: results.length,
    passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter(
      (r) => r.status === "failed" || r.status === "error"
    ).length,
    skipped: results.filter((r) => r.status === "skipped").length,
  };

  return { results, summary };
}
