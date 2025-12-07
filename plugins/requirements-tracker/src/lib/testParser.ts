import { Glob } from "bun";

export interface ParsedTest {
  file: string;
  identifier: string;
}

/**
 * Parse test files matching the given glob pattern and extract test identifiers.
 * Supports common test patterns:
 * - describe("name", ...) / describe('name', ...)
 * - it("name", ...) / it('name', ...)
 * - test("name", ...) / test('name', ...)
 * - Bun.test("name", ...)
 */
export async function parseTestFiles(pattern: string): Promise<ParsedTest[]> {
  const results: ParsedTest[] = [];
  const glob = new Glob(pattern);

  for await (const file of glob.scan({ cwd: process.cwd() })) {
    try {
      const content = await Bun.file(file).text();
      const tests = extractTestIdentifiers(content);

      for (const identifier of tests) {
        results.push({ file, identifier });
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return results;
}

function extractTestIdentifiers(content: string): string[] {
  const identifiers: string[] = [];

  // Match test/it/describe with string literals
  // Patterns: test("name" | test('name' | it("name" | it('name' | describe("name" | describe('name'
  const patterns = [
    /\b(?:test|it|describe)\s*\(\s*["']([^"']+)["']/g,
    /\bBun\.test\s*\(\s*["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      identifiers.push(match[1]);
    }
  }

  return identifiers;
}

/**
 * Check if a specific test identifier exists in a file.
 */
export async function testExistsInFile(
  file: string,
  identifier: string
): Promise<boolean> {
  try {
    const content = await Bun.file(file).text();
    const tests = extractTestIdentifiers(content);
    return tests.includes(identifier);
  } catch {
    return false;
  }
}

/**
 * Extract the full body of a specific test from a file.
 * Returns null if the test is not found.
 */
export async function extractTestBody(
  file: string,
  identifier: string
): Promise<string | null> {
  try {
    const content = await Bun.file(file).text();
    return extractTestBodyFromContent(content, identifier);
  } catch {
    return null;
  }
}

/**
 * Extract test body from content string (exported for testing).
 */
export function extractTestBodyFromContent(
  content: string,
  identifier: string
): string | null {
  // Escape special regex characters in identifier
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Match patterns: test("name" | it("name" | describe("name" | Bun.test("name"
  // Support double quotes, single quotes, and backticks
  // Check Bun.test first, then generic test/it/describe (with negative lookbehind to avoid matching Bun.test twice)
  const patterns = [
    new RegExp(`\\bBun\\.test\\s*\\(\\s*["'\`]${escaped}["'\`]`, "g"),
    new RegExp(`(?<!Bun\\.)\\b(test|it|describe)\\s*\\(\\s*["'\`]${escaped}["'\`]`, "g"),
  ];

  let startIndex = -1;
  for (const pattern of patterns) {
    const match = pattern.exec(content);
    if (match) {
      startIndex = match.index;
      break;
    }
  }

  if (startIndex === -1) return null;

  // Find the opening parenthesis of the test call
  let parenStart = content.indexOf("(", startIndex);
  if (parenStart === -1) return null;

  // Track parentheses to find the end of the test call
  let depth = 1;
  let i = parenStart + 1;

  while (i < content.length && depth > 0) {
    const char = content[i];

    // Skip string literals
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      i++;
      while (i < content.length) {
        if (content[i] === quote && content[i - 1] !== "\\") {
          break;
        }
        // Handle template literal expressions
        if (quote === "`" && content[i] === "$" && content[i + 1] === "{") {
          let braceDepth = 1;
          i += 2;
          while (i < content.length && braceDepth > 0) {
            if (content[i] === "{") braceDepth++;
            else if (content[i] === "}") braceDepth--;
            i++;
          }
          continue;
        }
        i++;
      }
    }
    // Skip comments
    else if (char === "/" && content[i + 1] === "/") {
      while (i < content.length && content[i] !== "\n") i++;
    }
    else if (char === "/" && content[i + 1] === "*") {
      i += 2;
      while (i < content.length - 1 && !(content[i] === "*" && content[i + 1] === "/")) i++;
      i++; // skip the closing /
    }
    // Track parentheses
    else if (char === "(") depth++;
    else if (char === ")") depth--;

    i++;
  }

  if (depth !== 0) return null;

  return content.slice(startIndex, i);
}

/**
 * Hash a test body string for comparison.
 * Normalizes whitespace to make hash stable across formatting changes.
 */
export function hashTestBody(body: string): string {
  // Normalize whitespace: collapse all whitespace to single spaces
  const normalized = body.replace(/\s+/g, " ").trim();
  return Bun.hash(normalized).toString(16);
}
