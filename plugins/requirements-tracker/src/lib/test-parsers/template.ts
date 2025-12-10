/**
 * Template parser - matches test calls using template literal strings
 */

import { TestParser, TestMatch } from "./index";

/**
 * Matches: it(`name`, ...), test(`name with ${static}`, ...), Bun.test(`name`, ...)
 * Only matches template literals (backticks)
 * The identifier includes the full template content (including ${} expressions)
 */
const PATTERN = /(?:it|test|Bun\.test)\s*\(\s*`([^`]+)`\s*,/g;

export const templateParser: TestParser = {
  name: "template",

  findMatches(content: string): TestMatch[] {
    const matches: TestMatch[] = [];
    let match;

    // Reset regex state
    PATTERN.lastIndex = 0;

    while ((match = PATTERN.exec(content)) !== null) {
      const identifier = match[1]; // The template content (may include ${} expressions)
      const startPosition = match.index + match[0].length; // Position after the comma

      matches.push({
        identifier,
        startPosition,
      });
    }

    return matches;
  },
};
