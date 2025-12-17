/**
 * Parser for JUnit XML test results format
 *
 * Supports the standard JUnit XML schema used by many test runners:
 * - Bun (via --reporter=junit)
 * - Jest (via jest-junit)
 * - Vitest
 * - pytest
 * - etc.
 *
 * Format:
 * <testsuites>
 *   <testsuite name="..." tests="..." failures="..." errors="..." time="...">
 *     <testcase name="..." classname="..." time="...">
 *       <failure message="...">stack trace</failure>
 *       <error message="...">stack trace</error>
 *       <skipped/>
 *     </testcase>
 *   </testsuite>
 * </testsuites>
 */

import { XMLParser } from "fast-xml-parser";
import type { TestResult, TestRunSummary, TestResultStatus } from "../types";

// XML Parser configured to preserve attributes and handle JUnit format
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) => ["testsuite", "testcase"].includes(name),
});

interface JUnitTestCase {
  "@_name"?: string;
  "@_classname"?: string;
  "@_time"?: string;
  failure?: { "@_message"?: string; "#text"?: string } | string;
  error?: { "@_message"?: string; "#text"?: string } | string;
  skipped?: unknown;
}

interface JUnitTestSuite {
  "@_name"?: string;
  "@_file"?: string;
  testcase?: JUnitTestCase[];
  testsuite?: JUnitTestSuite[]; // Nested testsuites (Bun uses these for describe blocks)
}

interface JUnitRoot {
  testsuites?: {
    testsuite?: JUnitTestSuite[];
  };
  testsuite?: JUnitTestSuite[];
}

function classnameToFile(classname: string): string {
  // Different test runners use different conventions for classname:
  // - Bun: "src/auth.test.ts"
  // - Jest: "src.auth.test" or full path
  // - pytest: "tests.test_auth"

  // If it looks like a file path, use it directly
  if (classname.includes("/") || classname.includes("\\")) {
    return classname;
  }

  // If it contains dots, it might be a package path - convert to file path
  if (classname.includes(".")) {
    // Check if last segment looks like a file (has test in it)
    const parts = classname.split(".");
    const lastPart = parts[parts.length - 1];

    // If last part is "test" or "spec", it's likely a module path
    if (lastPart.toLowerCase() === "test" || lastPart.toLowerCase() === "spec") {
      return parts.join("/") + ".ts";
    }

    // Otherwise treat the whole thing as a path
    return parts.join("/") + ".test.ts";
  }

  return classname;
}

function parseTestCase(tc: JUnitTestCase): {
  name: string;
  classname: string;
  time?: number;
  status: TestResultStatus;
  errorMessage?: string;
} {
  const name = tc["@_name"] || "unknown";
  const classname = tc["@_classname"] || "";
  const timeStr = tc["@_time"];
  const time = timeStr ? parseFloat(timeStr) * 1000 : undefined; // Convert to ms

  let status: TestResultStatus = "passed";
  let errorMessage: string | undefined;

  if (tc.failure !== undefined) {
    status = "failed";
    if (typeof tc.failure === "object") {
      const msg = tc.failure["@_message"];
      const content = tc.failure["#text"];
      if (msg && content) {
        errorMessage = `${msg}\n${content}`;
      } else {
        errorMessage = msg || content;
      }
    } else if (typeof tc.failure === "string") {
      errorMessage = tc.failure;
    }
  } else if (tc.error !== undefined) {
    status = "error";
    if (typeof tc.error === "object") {
      const msg = tc.error["@_message"];
      const content = tc.error["#text"];
      if (msg && content) {
        errorMessage = `${msg}\n${content}`;
      } else {
        errorMessage = msg || content;
      }
    } else if (typeof tc.error === "string") {
      errorMessage = tc.error;
    }
  } else if (tc.skipped !== undefined) {
    status = "skipped";
  }

  return { name, classname, time, status, errorMessage };
}

export function canParse(content: string): boolean {
  const trimmed = content.trim();
  return (
    trimmed.startsWith("<?xml") ||
    trimmed.startsWith("<testsuites") ||
    trimmed.startsWith("<testsuite")
  );
}

/**
 * Recursively extract all test cases from a test suite and its nested suites
 * Bun uses nested testsuites for describe blocks
 */
function extractTestCases(
  suite: JUnitTestSuite,
  parentFile?: string
): TestResult[] {
  const results: TestResult[] = [];

  // Use file from this suite or inherit from parent
  const file = suite["@_file"] || parentFile;

  // Process direct testcases
  const testcases = suite.testcase || [];
  for (const tc of testcases) {
    const { name, classname, time, status, errorMessage } = parseTestCase(tc);

    // Prefer the file attribute from the suite, fall back to classname conversion
    const testFile = file || classnameToFile(classname);

    results.push({
      file: testFile,
      identifier: name,
      status,
      duration: time,
      errorMessage,
    });
  }

  // Recursively process nested testsuites
  const nestedSuites = suite.testsuite || [];
  for (const nested of nestedSuites) {
    results.push(...extractTestCases(nested, file));
  }

  return results;
}

export function parse(content: string): {
  results: TestResult[];
  summary: TestRunSummary;
} {
  const parsed = parser.parse(content) as JUnitRoot;

  // Get test suites - handle both <testsuites><testsuite>... and direct <testsuite>...
  let testsuites: JUnitTestSuite[] = [];

  if (parsed.testsuites?.testsuite) {
    testsuites = parsed.testsuites.testsuite;
  } else if (parsed.testsuite) {
    testsuites = parsed.testsuite;
  }

  // Extract all test cases from all suites (including nested ones)
  const results: TestResult[] = [];
  for (const suite of testsuites) {
    results.push(...extractTestCases(suite));
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
