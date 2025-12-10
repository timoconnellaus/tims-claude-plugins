/**
 * Test file parsing and hash generation
 */

import { readFile } from "fs/promises";
import { glob } from "glob";
import { createHash } from "crypto";
import { join, relative } from "path";
import { ExtractedTest } from "./types";
import { extractTestsFromContent } from "./test-parsers";

/**
 * Compute SHA-256 hash of content
 */
export function computeHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Extract the body of a function starting at a given position
 * Handles nested braces properly
 */
export function extractFunctionBody(content: string, startPos: number): string {
  let braceCount = 0;
  let started = false;
  let bodyStart = startPos;

  for (let i = startPos; i < content.length; i++) {
    const char = content[i];

    // Skip string literals to avoid counting braces inside strings
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      i++;
      while (i < content.length) {
        if (content[i] === "\\") {
          i++; // Skip escaped character
        } else if (content[i] === quote) {
          break;
        }
        i++;
      }
      continue;
    }

    if (char === "{") {
      if (!started) {
        started = true;
        bodyStart = i;
      }
      braceCount++;
    } else if (char === "}") {
      braceCount--;
      if (started && braceCount === 0) {
        return content.slice(bodyStart, i + 1);
      }
    }
  }

  // Fallback: return from start to end
  return content.slice(startPos);
}

/**
 * Extract all tests from a single test file
 */
export async function extractTestsFromFile(
  filePath: string,
  cwd?: string
): Promise<ExtractedTest[]> {
  const content = await readFile(filePath, "utf-8");
  const relativePath = cwd ? relative(cwd, filePath) : filePath;
  return extractTestsFromContent(content, filePath, relativePath);
}

/**
 * Find all test files and extract tests
 */
export async function extractAllTests(
  cwd: string,
  testGlob: string
): Promise<ExtractedTest[]> {
  const testFiles = await glob(testGlob, {
    cwd,
    absolute: true,
    ignore: ["**/node_modules/**"],
  });

  const allTests: ExtractedTest[] = [];

  for (const file of testFiles) {
    try {
      const tests = await extractTestsFromFile(file, cwd);
      allTests.push(...tests);
    } catch (error) {
      // Skip files that can't be parsed
      console.warn(`Warning: Could not parse ${file}`);
    }
  }

  return allTests;
}

/**
 * Find a specific test by file and identifier
 */
export async function findTest(
  cwd: string,
  file: string,
  identifier: string
): Promise<ExtractedTest | null> {
  const fullPath = file.startsWith("/") ? file : join(cwd, file);

  try {
    const tests = await extractTestsFromFile(fullPath, cwd);
    return tests.find((t) => t.identifier === identifier) || null;
  } catch {
    return null;
  }
}
