/**
 * Each parser - matches parametrized tests using .each()
 */

import { TestParser, TestMatch } from "./index";

/**
 * Matches: it.each([...])('name', ...), test.each(...)('name', ...), describe.each(...)('name', ...)
 * The .each() takes a table/array argument, then is called with the test name
 * Supports single quotes, double quotes, and backticks
 *
 * Note: This uses a simpler approach that matches the closing paren of .each()
 * followed by the test name. It handles most common cases.
 */
const PATTERN =
  /(?:it|test|describe)\.each\s*\([^)]*\)\s*\(\s*(['"`])([^'"`]+)\1\s*,/g;

export const eachParser: TestParser = {
  name: "each",

  findMatches(content: string): TestMatch[] {
    const matches: TestMatch[] = [];
    let match;

    // Reset regex state
    PATTERN.lastIndex = 0;

    while ((match = PATTERN.exec(content)) !== null) {
      const identifier = match[2]; // The test name (may contain %s, %d placeholders)
      const startPosition = match.index + match[0].length; // Position after the comma

      matches.push({
        identifier,
        startPosition,
      });
    }

    return matches;
  },
};
