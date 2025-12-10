/**
 * Modifiers parser - matches test calls with .only() or .skip() modifiers
 */

import { TestParser, TestMatch } from "./index";

/**
 * Matches: it.only('name', ...), test.skip('name', ...), Bun.test.only('name', ...)
 * Supports single quotes, double quotes, and backticks
 */
const PATTERN =
  /(?:it|test|Bun\.test)\.(?:only|skip)\s*\(\s*(['"`])([^'"`]+)\1\s*,/g;

export const modifiersParser: TestParser = {
  name: "modifiers",

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
