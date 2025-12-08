/**
 * Check test coverage for Linear issues
 */

import { glob } from "glob";
import { readFile } from "fs/promises";
import { loadCache } from "../lib/store";
import { PRIORITY_LABELS } from "../lib/types";

interface ExtractedTest {
  file: string;
  identifier: string;
}

/**
 * Extract test identifiers from a test file
 */
async function extractTests(filePath: string): Promise<ExtractedTest[]> {
  const content = await readFile(filePath, "utf-8");
  const tests: ExtractedTest[] = [];

  // Match describe/it/test patterns
  const patterns = [
    /(?:describe|it|test)\s*\(\s*["'`]([^"'`]+)["'`]/g,
    /Bun\.test\s*\(\s*["'`]([^"'`]+)["'`]/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      tests.push({
        file: filePath,
        identifier: match[1],
      });
    }
  }

  return tests;
}

export async function check(args: {
  cwd: string;
  coverage?: boolean;
  orphans?: boolean;
  json?: boolean;
  testGlob?: string;
}): Promise<void> {
  const { cwd, coverage, orphans, json, testGlob = "**/*.test.{ts,js,tsx,jsx}" } = args;

  // Load cache
  const cache = await loadCache(cwd);
  if (!cache) {
    console.error("No cache found. Run 'req sync' first.");
    process.exit(1);
  }

  const { issues, testLinks } = cache;

  // Build lookup of issues with tests
  const issuesWithTests = new Set(testLinks.map((l) => l.issueId));

  // Issues without tests
  const uncovered = issues.filter((i) => !issuesWithTests.has(i.id));

  // For orphan detection, find all tests in codebase
  let allTests: ExtractedTest[] = [];
  let orphanTests: ExtractedTest[] = [];

  if (orphans || !coverage) {
    // Find test files
    const testFiles = await glob(testGlob, { cwd, absolute: true });

    for (const file of testFiles) {
      const extracted = await extractTests(file);
      allTests.push(...extracted);
    }

    // Build set of linked tests
    const linkedTests = new Set<string>();
    for (const link of testLinks) {
      for (const test of link.tests) {
        linkedTests.add(`${test.file}:${test.identifier}`);
      }
    }

    // Find orphans
    orphanTests = allTests.filter(
      (t) => !linkedTests.has(`${t.file}:${t.identifier}`)
    );
  }

  // Output
  if (json) {
    const result: Record<string, unknown> = {
      totalIssues: issues.length,
      withTests: issuesWithTests.size,
      withoutTests: uncovered.length,
    };

    if (coverage || (!coverage && !orphans)) {
      result.uncovered = uncovered.map((i) => ({
        identifier: i.identifier,
        title: i.title,
        priority: i.priority,
        priorityLabel: PRIORITY_LABELS[i.priority],
        state: i.state.name,
        url: i.url,
      }));
    }

    if (orphans || (!coverage && !orphans)) {
      result.orphanTests = orphanTests.map((t) => ({
        file: t.file,
        identifier: t.identifier,
      }));
      result.totalTests = allTests.length;
      result.orphanCount = orphanTests.length;
    }

    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Human-readable output
  console.log(`\n=== Coverage Report (${cache.teamKey}) ===\n`);
  console.log(`Total issues: ${issues.length}`);
  console.log(`With tests: ${issuesWithTests.size}`);
  console.log(`Without tests: ${uncovered.length}`);

  if (coverage || (!coverage && !orphans)) {
    if (uncovered.length > 0) {
      console.log(`\n--- Issues Without Tests ---\n`);

      // Sort by priority (1=Urgent is highest)
      const sorted = [...uncovered].sort((a, b) => {
        // 0 (no priority) should be last
        const aPri = a.priority === 0 ? 5 : a.priority;
        const bPri = b.priority === 0 ? 5 : b.priority;
        return aPri - bPri;
      });

      for (const issue of sorted) {
        const pri = PRIORITY_LABELS[issue.priority] || "No priority";
        console.log(`  ${issue.identifier} [${pri}] ${issue.title}`);
        console.log(`    State: ${issue.state.name}`);
        console.log(`    ${issue.url}\n`);
      }
    } else {
      console.log(`\nAll issues have linked tests.`);
    }
  }

  if (orphans || (!coverage && !orphans)) {
    console.log(`\n--- Orphan Tests ---\n`);
    console.log(`Total tests found: ${allTests.length}`);
    console.log(`Orphan tests: ${orphanTests.length}`);

    if (orphanTests.length > 0) {
      console.log();
      for (const test of orphanTests.slice(0, 20)) {
        console.log(`  ${test.file}:${test.identifier}`);
      }
      if (orphanTests.length > 20) {
        console.log(`  ... and ${orphanTests.length - 20} more`);
      }
    }
  }

  console.log();
}
