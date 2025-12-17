/**
 * Check test coverage and verification status
 */

import {
  loadConfig,
  loadAllRequirements,
  loadRequirementsInPath,
  loadIgnoredTests,
  saveRequirement,
} from "../lib/store";
import { getTestsWithCache } from "../lib/cache";
import { isValidGherkinFormat } from "../lib/gherkin";
import type {
  CheckResult,
  VerificationStatus,
  TestLink,
  ParsedRequirement,
  ImplementationStatus,
  Priority,
  DependencyIssue,
  PriorityBreakdown,
  GherkinFormatIssue,
} from "../lib/types";

/**
 * Determine verification status for a requirement
 */
function getVerificationStatus(
  tests: TestLink[],
  currentHashes: Map<string, string>,
  hasAssessment: boolean
): VerificationStatus {
  // No tests = nothing to verify
  if (tests.length === 0) {
    return "n/a";
  }

  // Has tests but no assessment = unverified
  if (!hasAssessment) {
    return "unverified";
  }

  // Has assessment - check if any test hashes changed
  for (const test of tests) {
    const key = `${test.file}:${test.identifier}`;
    const currentHash = currentHashes.get(key);
    if (currentHash && currentHash !== test.hash) {
      return "stale";
    }
  }

  // Assessment exists and no hashes changed
  return "verified";
}

export async function check(args: {
  cwd: string;
  path?: string;
  json?: boolean;
  noCache?: boolean;
}): Promise<void> {
  const { cwd, path, json, noCache } = args;

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    console.error("Not initialized. Run 'req init' first.");
    process.exit(1);
  }

  // Load requirements (filtered by path if provided)
  const loadResult = path
    ? await loadRequirementsInPath(cwd, path)
    : await loadAllRequirements(cwd);

  // Report validation errors
  if (loadResult.errors.length > 0) {
    console.error("Validation errors:");
    for (const error of loadResult.errors) {
      console.error(`  ${error.message}`);
    }
    process.exit(1);
  }

  const requirements = loadResult.requirements;

  if (requirements.length === 0) {
    if (json) {
      console.log(
        JSON.stringify({
          requirements: [],
          orphanedTests: [],
          dependencyIssues: [],
          gherkinIssues: [],
          summary: {
            totalRequirements: 0,
            planned: 0,
            done: 0,
            untested: 0,
            tested: 0,
            unverified: 0,
            verified: 0,
            stale: 0,
            orphanedTestCount: 0,
            unansweredQuestions: 0,
            byPriority: { critical: 0, high: 0, medium: 0, low: 0, unset: 0 },
            blockedRequirements: 0,
            unverifiedNFRs: 0,
            gherkinFormatIssues: 0,
          },
        })
      );
    } else {
      console.log("No requirement files found in .requirements/");
      console.log("Create requirement files like: auth/REQ_login.yml");
    }
    return;
  }

  // Load ignored tests
  const ignoredTestsFile = await loadIgnoredTests(cwd);
  const ignoredTestKeys = new Set(
    ignoredTestsFile.tests.map((t) => `${t.file}:${t.identifier}`)
  );

  // Extract all tests from codebase (using cache if valid)
  const { tests: allExtractedTests, fromCache } = await getTestsWithCache(
    cwd,
    config.testGlob,
    noCache
  );

  if (!json) {
    if (fromCache) {
      console.log("Using cached test data");
    } else {
      console.log(`Extracted ${allExtractedTests.length} tests from test files`);
    }
  }

  const testHashMap = new Map<string, string>();
  for (const test of allExtractedTests) {
    testHashMap.set(`${test.file}:${test.identifier}`, test.hash);
  }

  // Update test hashes in requirement files (and clear assessments if changed)
  for (const req of requirements) {
    let modified = false;
    for (const test of req.data.tests) {
      const key = `${test.file}:${test.identifier}`;
      const currentHash = testHashMap.get(key);
      if (currentHash && test.hash !== currentHash) {
        test.hash = currentHash;
        modified = true;
        // Clear assessment since hash changed
        delete req.data.aiAssessment;
      }
    }
    if (modified) {
      await saveRequirement(cwd, req.path, req.data);
    }
  }

  // Build a map of requirement paths to their status for dependency checking
  const reqStatusMap = new Map<string, ImplementationStatus>();
  for (const req of requirements) {
    reqStatusMap.set(req.path, req.data.status);
  }

  // Build results - group by folder
  const result: CheckResult = {
    requirements: [],
    orphanedTests: [],
    dependencyIssues: [],
    gherkinIssues: [],
    summary: {
      totalRequirements: 0,
      planned: 0,
      done: 0,
      untested: 0,
      tested: 0,
      unverified: 0,
      verified: 0,
      stale: 0,
      orphanedTestCount: 0,
      unansweredQuestions: 0,
      byPriority: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        unset: 0,
      },
      blockedRequirements: 0,
      unverifiedNFRs: 0,
      gherkinFormatIssues: 0,
    },
  };

  // Group requirements by folder path
  const groupedReqs = new Map<string, ParsedRequirement[]>();
  for (const req of requirements) {
    // Extract folder path (e.g., "auth/REQ_login.yml" -> "auth/")
    const lastSlash = req.path.lastIndexOf("/");
    const folderPath = lastSlash >= 0 ? req.path.slice(0, lastSlash + 1) : "";

    if (!groupedReqs.has(folderPath)) {
      groupedReqs.set(folderPath, []);
    }
    groupedReqs.get(folderPath)!.push(req);
  }

  // Analyze each group
  const linkedTestKeys = new Set<string>();

  for (const [folderPath, groupReqs] of Array.from(groupedReqs.entries()).sort()) {
    const groupResult = {
      path: folderPath || "(root)",
      requirements: [] as {
        id: string;
        testCount: number;
        verification: VerificationStatus;
        coverageSufficient: boolean | null;
        unansweredQuestions: number;
        status: ImplementationStatus;
        priority?: Priority;
        dependencyIssues?: string[];
        unverifiedNFRCount: number;
      }[],
    };

    for (const req of groupReqs) {
      result.summary.totalRequirements++;

      // Track linked tests
      for (const test of req.data.tests) {
        linkedTestKeys.add(`${test.file}:${test.identifier}`);
      }

      // Get implementation status
      const reqStatus: ImplementationStatus = req.data.status;
      if (reqStatus === "planned") {
        result.summary.planned++;
      } else {
        result.summary.done++;
      }

      // Get verification status
      const verification = getVerificationStatus(
        req.data.tests,
        testHashMap,
        !!req.data.aiAssessment
      );

      // Update summary counts (only for "done" requirements)
      if (reqStatus === "done") {
        if (req.data.tests.length === 0) {
          result.summary.untested++;
        } else {
          result.summary.tested++;
        }

        switch (verification) {
          case "unverified":
            result.summary.unverified++;
            break;
          case "verified":
            result.summary.verified++;
            break;
          case "stale":
            result.summary.stale++;
            break;
        }
      }

      // Count unanswered questions
      const unanswered = (req.data.questions || []).filter((q) => !q.answer).length;
      result.summary.unansweredQuestions += unanswered;

      // Track priority breakdown
      const priority = req.data.priority;
      if (priority) {
        result.summary.byPriority[priority]++;
      } else {
        result.summary.byPriority.unset++;
      }

      // Check for dependency issues (blocking deps that aren't "done")
      const depIssues: string[] = [];
      if (req.data.dependencies) {
        for (const dep of req.data.dependencies) {
          const blocking = dep.blocking !== false; // default to true
          if (blocking) {
            const depStatus = reqStatusMap.get(dep.path);
            // Issue if dependency doesn't exist or isn't "done"
            if (!depStatus || depStatus !== "done") {
              depIssues.push(dep.path);
            }
          }
        }
      }
      if (depIssues.length > 0) {
        result.summary.blockedRequirements++;
        result.dependencyIssues.push({
          requirement: req.path,
          blockedBy: depIssues,
        });
      }

      // Count unverified NFRs
      const nfrs = req.data.nfrs || [];
      const unverifiedNFRCount = nfrs.filter((nfr) => !nfr.verified).length;
      result.summary.unverifiedNFRs += unverifiedNFRCount;

      // Validate gherkin format
      const gherkinValidation = isValidGherkinFormat(req.data.gherkin);
      if (!gherkinValidation.valid) {
        result.gherkinIssues.push({
          requirement: req.path,
          errors: gherkinValidation.errors,
        });
        result.summary.gherkinFormatIssues++;
      }

      // Also validate scenarios if present
      if (req.data.scenarios) {
        for (const scenario of req.data.scenarios) {
          const scenarioValidation = isValidGherkinFormat(scenario.gherkin);
          if (!scenarioValidation.valid) {
            result.gherkinIssues.push({
              requirement: `${req.path} (scenario: ${scenario.name})`,
              errors: scenarioValidation.errors,
            });
            result.summary.gherkinFormatIssues++;
          }
        }
      }

      // Use path as ID (e.g., "auth/REQ_login.yml")
      groupResult.requirements.push({
        id: req.path,
        testCount: req.data.tests.length,
        verification,
        coverageSufficient: req.data.aiAssessment?.sufficient ?? null,
        unansweredQuestions: unanswered,
        status: reqStatus,
        priority,
        dependencyIssues: depIssues.length > 0 ? depIssues : undefined,
        unverifiedNFRCount,
      });
    }

    result.requirements.push(groupResult);
  }

  // Find orphaned tests (excluding ignored tests)
  for (const test of allExtractedTests) {
    const key = `${test.file}:${test.identifier}`;
    if (!linkedTestKeys.has(key) && !ignoredTestKeys.has(key)) {
      result.orphanedTests.push(test);
    }
  }
  result.summary.orphanedTestCount = result.orphanedTests.length;

  // Output
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Human-readable output
  console.log("\nRequirements Tracker Status");
  console.log("===========================\n");
  console.log("Summary:");
  console.log(`  Total requirements: ${result.summary.totalRequirements}`);
  console.log(`  Planned: ${result.summary.planned}`);
  console.log(`  Done: ${result.summary.done}`);
  console.log(`  Untested: ${result.summary.untested}`);
  console.log(`  Unverified: ${result.summary.unverified}`);
  console.log(`  Verified: ${result.summary.verified}`);
  console.log(`  Stale: ${result.summary.stale}`);
  console.log(`  Orphaned tests: ${result.summary.orphanedTestCount}`);
  if (ignoredTestsFile.tests.length > 0) {
    console.log(`  Ignored tests: ${ignoredTestsFile.tests.length}`);
  }

  // Priority breakdown (only show if any requirements have priority set)
  const { byPriority } = result.summary;
  const hasPriorities = byPriority.critical > 0 || byPriority.high > 0 || byPriority.medium > 0 || byPriority.low > 0;
  if (hasPriorities) {
    console.log("\nPriority breakdown:");
    if (byPriority.critical > 0) console.log(`  Critical: ${byPriority.critical}`);
    if (byPriority.high > 0) console.log(`  High: ${byPriority.high}`);
    if (byPriority.medium > 0) console.log(`  Medium: ${byPriority.medium}`);
    if (byPriority.low > 0) console.log(`  Low: ${byPriority.low}`);
    if (byPriority.unset > 0) console.log(`  Unset: ${byPriority.unset}`);
  }

  // Show planned requirements
  const planned = result.requirements.flatMap((g) =>
    g.requirements.filter((r) => r.status === "planned").map((r) => r.id)
  );

  if (planned.length > 0) {
    console.log("\nPlanned requirements (not yet implemented):");
    for (const reqPath of planned) {
      console.log(`  - ${reqPath}`);
    }
  }

  // Show untested requirements (only "done" ones)
  const untested = result.requirements.flatMap((g) =>
    g.requirements.filter((r) => r.status === "done" && r.testCount === 0).map((r) => r.id)
  );

  if (untested.length > 0) {
    console.log("\nUntested requirements:");
    for (const reqPath of untested) {
      console.log(`  - ${reqPath}`);
    }
  }

  // Show unverified requirements (only "done" ones)
  const unverified = result.requirements.flatMap((g) =>
    g.requirements.filter((r) => r.status === "done" && r.verification === "unverified").map((r) => r.id)
  );

  if (unverified.length > 0) {
    console.log("\nUnverified requirements (need AI assessment):");
    for (const reqPath of unverified) {
      console.log(`  - ${reqPath}`);
    }
  }

  // Show stale requirements (only "done" ones)
  const stale = result.requirements.flatMap((g) =>
    g.requirements.filter((r) => r.status === "done" && r.verification === "stale").map((r) => r.id)
  );

  if (stale.length > 0) {
    console.log("\nStale requirements (tests changed, need re-assessment):");
    for (const reqPath of stale) {
      console.log(`  - ${reqPath}`);
    }
  }

  // Show orphaned tests (first 20)
  if (result.orphanedTests.length > 0) {
    console.log("\nOrphaned tests (not linked to any requirement):");
    for (const test of result.orphanedTests.slice(0, 20)) {
      console.log(`  - ${test.file}: ${test.identifier}`);
    }
    if (result.orphanedTests.length > 20) {
      console.log(`  ... and ${result.orphanedTests.length - 20} more`);
    }
  }

  // Show requirements with unanswered questions
  const withQuestions = result.requirements.flatMap((g) =>
    g.requirements.filter((r) => r.unansweredQuestions > 0).map((r) => ({
      id: r.id,
      count: r.unansweredQuestions,
    }))
  );

  if (withQuestions.length > 0) {
    console.log("\nRequirements with unanswered questions:");
    for (const req of withQuestions) {
      console.log(`  - ${req.id}: ${req.count} question(s)`);
    }
  }

  // Show dependency issues
  if (result.dependencyIssues.length > 0) {
    console.log("\nDependency issues:");
    for (const issue of result.dependencyIssues) {
      console.log(`  - ${issue.requirement}: blocked by ${issue.blockedBy.join(", ")}`);
    }
  }

  // Show unverified NFRs summary
  if (result.summary.unverifiedNFRs > 0) {
    console.log(`\nUnverified NFRs: ${result.summary.unverifiedNFRs}`);
    // List requirements with unverified NFRs
    const withUnverifiedNFRs = result.requirements.flatMap((g) =>
      g.requirements.filter((r) => r.unverifiedNFRCount > 0).map((r) => ({
        id: r.id,
        count: r.unverifiedNFRCount,
      }))
    );
    for (const req of withUnverifiedNFRs) {
      console.log(`  - ${req.id}: ${req.count} unverified NFR(s)`);
    }
  }

  // Show gherkin format issues
  if (result.gherkinIssues.length > 0) {
    console.log("\nGherkin format issues:");
    for (const issue of result.gherkinIssues) {
      console.log(`  - ${issue.requirement}:`);
      for (const err of issue.errors) {
        console.log(`      ${err}`);
      }
    }
  }

  console.log();
}
