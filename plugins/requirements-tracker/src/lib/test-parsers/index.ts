/**
 * Test parser registry and extraction logic
 */

import { ExtractedTest } from "../types";
import { computeHash, extractFunctionBody } from "../test-parser";

// Import all parsers
import { standardParser } from "./standard";
import { modifiersParser } from "./modifiers";
import { eachParser } from "./each";
import { templateParser } from "./template";

/**
 * Represents a test match found by a parser
 */
export interface TestMatch {
  identifier: string; // The test name/identifier
  startPosition: number; // Position in content to start extracting function body
}

/**
 * Interface for test pattern parsers
 */
export interface TestParser {
  name: string; // Parser name for debugging
  /**
   * Find all test matches in the content.
   * Returns array of matches with identifier and start position for body extraction.
   */
  findMatches(content: string): TestMatch[];
}

/**
 * Registry of all available parsers
 * Order matters: earlier parsers have priority in deduplication
 */
export const parsers: TestParser[] = [
  standardParser, // Standard patterns first (most common)
  modifiersParser, // Modifiers (.only, .skip)
  eachParser, // Parametrized tests
  templateParser, // Template literals (already handled by standard, but separate for clarity)
];

/**
 * Extract all tests from file content using all registered parsers.
 * Deduplicates by identifier (first match wins).
 *
 * @param content - The file content to parse
 * @param filePath - Absolute path to the file (for debugging)
 * @param relativePath - Relative path to use in ExtractedTest results
 * @returns Array of extracted tests with hashes
 */
export function extractTestsFromContent(
  content: string,
  filePath: string,
  relativePath: string
): ExtractedTest[] {
  const tests: ExtractedTest[] = [];
  const seenIdentifiers = new Set<string>();

  // Run all parsers
  for (const parser of parsers) {
    const matches = parser.findMatches(content);

    for (const match of matches) {
      // Skip if we've already seen this identifier (deduplication)
      // This handles cases like it.only('foo') and it('foo') - first match wins
      if (seenIdentifiers.has(match.identifier)) {
        continue;
      }

      // Mark as seen
      seenIdentifiers.add(match.identifier);

      // Extract function body starting from the position after the test name
      const body = extractFunctionBody(content, match.startPosition);

      // Compute hash of the function body
      const hash = computeHash(body);

      tests.push({
        file: relativePath,
        identifier: match.identifier,
        body,
        hash,
      });
    }
  }

  return tests;
}
