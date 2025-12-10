/**
 * Standard test parser - matches basic it(), test(), and Bun.test() calls
 */

import { TestParser, TestMatch } from "./index";

/**
 * Matches: it('name', ...), test('name', ...), Bun.test('name', ...)
 * Supports single quotes, double quotes, and backticks
 */
const PATTERN = /(?:it|test|Bun\.test)\s*\(\s*(['"`])([^'"`]+)\1\s*,/g;

export const standardParser: TestParser = {
  name: "standard",

  findMatches(content: string): TestMatch[] {
    const matches: TestMatch[] = [];
    let match;

    // Reset regex state
    PATTERN.lastIndex = 0;

    while ((match = PATTERN.exec(content)) !== null) {
      const identifier = match[2]; // The test name
      const startPosition = match.index + match[0].length; // Position after the comma

      matches.push({
        identifier,
        startPosition,
      });
    }

    return matches;
  },
};
