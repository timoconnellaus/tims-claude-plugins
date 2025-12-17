/**
 * Test result parser registry with auto-detection
 */

import type { TestResult, TestRunSummary } from "../types";
import * as bunJson from "./bun-json";
import * as junitXml from "./junit-xml";

export type ResultFormat = "junit-xml" | "bun-json";

export interface ParseResult {
  format: ResultFormat;
  results: TestResult[];
  summary: TestRunSummary;
}

/**
 * Detect the format of a test results file by its content
 */
export function detectFormat(content: string): ResultFormat | null {
  if (junitXml.canParse(content)) {
    return "junit-xml";
  }
  if (bunJson.canParse(content)) {
    return "bun-json";
  }
  return null;
}

/**
 * Parse test results from content with optional format hint
 * @param content - File content
 * @param format - Optional format hint (auto-detects if not provided)
 * @throws Error if format is unknown or parsing fails
 */
export function parseResults(content: string, format?: ResultFormat): ParseResult {
  const detectedFormat = format || detectFormat(content);

  if (!detectedFormat) {
    throw new Error(
      "Could not detect test results format. Expected JUnit XML or JSON."
    );
  }

  let parseResult: { results: TestResult[]; summary: TestRunSummary };

  switch (detectedFormat) {
    case "junit-xml":
      parseResult = junitXml.parse(content);
      break;
    case "bun-json":
      parseResult = bunJson.parse(content);
      break;
    default:
      throw new Error(`Unknown format: ${detectedFormat}`);
  }

  return {
    format: detectedFormat,
    ...parseResult,
  };
}

// Re-export individual parsers for direct use
export { bunJson, junitXml };
