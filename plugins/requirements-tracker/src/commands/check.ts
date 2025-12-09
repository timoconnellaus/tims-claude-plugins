/**
 * Check test coverage and verification status
 */

import { loadConfig, loadAllFeatures, saveFeature } from "../lib/store";
import { extractAllTests } from "../lib/test-parser";
import type {
  CheckResult,
  VerificationStatus,
  TestLink,
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
  json?: boolean;
}): Promise<void> {
  const { cwd, json } = args;

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    console.error("Not initialized. Run 'req init' first.");
    process.exit(1);
  }

  // Load all features
  const features = await loadAllFeatures(cwd);
  if (features.length === 0) {
    if (json) {
      console.log(
        JSON.stringify({
          features: [],
          orphanedTests: [],
          summary: {
            totalFeatures: 0,
            totalRequirements: 0,
            untested: 0,
            tested: 0,
            unverified: 0,
            verified: 0,
            stale: 0,
            orphanedTestCount: 0,
            unansweredQuestions: 0,
          },
        })
      );
    } else {
      console.log("No feature files found in .requirements/");
      console.log("Create feature files like: FEAT_001_user-auth.yml");
    }
    return;
  }

  // Extract all tests from codebase
  if (!json) {
    console.log("Extracting tests from codebase...");
  }
  const allExtractedTests = await extractAllTests(cwd, config.testGlob);
  const testHashMap = new Map<string, string>();
  for (const test of allExtractedTests) {
    testHashMap.set(`${test.file}:${test.identifier}`, test.hash);
  }

  // Update test hashes in feature files (and clear assessments if changed)
  for (const feature of features) {
    let modified = false;
    for (const req of Object.values(feature.data.requirements)) {
      for (const test of req.tests) {
        const key = `${test.file}:${test.identifier}`;
        const currentHash = testHashMap.get(key);
        if (currentHash && test.hash !== currentHash) {
          test.hash = currentHash;
          modified = true;
          // Clear assessment since hash changed
          delete req.aiAssessment;
        }
      }
    }
    if (modified) {
      await saveFeature(cwd, feature);
    }
  }

  // Build results
  const result: CheckResult = {
    features: [],
    orphanedTests: [],
    summary: {
      totalFeatures: features.length,
      totalRequirements: 0,
      untested: 0,
      tested: 0,
      unverified: 0,
      verified: 0,
      stale: 0,
      orphanedTestCount: 0,
      unansweredQuestions: 0,
    },
  };

  // Analyze each feature
  const linkedTestKeys = new Set<string>();

  for (const feature of features) {
    const featureResult = {
      feature: feature.filename,
      requirements: [] as {
        id: string;
        testCount: number;
        verification: VerificationStatus;
        coverageSufficient: boolean | null;
        unansweredQuestions: number;
      }[],
    };

    for (const [id, req] of Object.entries(feature.data.requirements)) {
      result.summary.totalRequirements++;

      // Track linked tests
      for (const test of req.tests) {
        linkedTestKeys.add(`${test.file}:${test.identifier}`);
      }

      // Get verification status
      const verification = getVerificationStatus(
        req.tests,
        testHashMap,
        !!req.aiAssessment
      );

      // Update summary counts
      if (req.tests.length === 0) {
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

      // Count unanswered questions
      const unanswered = (req.questions || []).filter((q) => !q.answer).length;
      result.summary.unansweredQuestions += unanswered;

      featureResult.requirements.push({
        id,
        testCount: req.tests.length,
        verification,
        coverageSufficient: req.aiAssessment?.sufficient ?? null,
        unansweredQuestions: unanswered,
      });
    }

    result.features.push(featureResult);
  }

  // Find orphaned tests
  for (const test of allExtractedTests) {
    const key = `${test.file}:${test.identifier}`;
    if (!linkedTestKeys.has(key)) {
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
  console.log("\n=== Requirements Coverage Report ===\n");
  console.log(`Features: ${result.summary.totalFeatures}`);
  console.log(`Requirements: ${result.summary.totalRequirements}`);
  console.log(`  Untested: ${result.summary.untested}`);
  console.log(`  Tested: ${result.summary.tested}`);
  console.log(`    Unverified: ${result.summary.unverified}`);
  console.log(`    Verified: ${result.summary.verified}`);
  console.log(`    Stale: ${result.summary.stale}`);
  console.log(`Orphaned tests: ${result.summary.orphanedTestCount}`);
  console.log(`Unanswered questions: ${result.summary.unansweredQuestions}`);

  // Show untested requirements
  const untested = result.features.flatMap((f) =>
    f.requirements.filter((r) => r.testCount === 0).map((r) => ({ feature: f.feature, ...r }))
  );

  if (untested.length > 0) {
    console.log("\n--- Untested Requirements ---\n");
    for (const req of untested) {
      console.log(`  ${req.feature} #${req.id}`);
    }
  }

  // Show unverified requirements
  const unverified = result.features.flatMap((f) =>
    f.requirements.filter((r) => r.verification === "unverified").map((r) => ({ feature: f.feature, ...r }))
  );

  if (unverified.length > 0) {
    console.log("\n--- Unverified Requirements (need AI assessment) ---\n");
    for (const req of unverified) {
      console.log(`  ${req.feature} #${req.id} (${req.testCount} test(s))`);
    }
  }

  // Show stale requirements
  const stale = result.features.flatMap((f) =>
    f.requirements.filter((r) => r.verification === "stale").map((r) => ({ feature: f.feature, ...r }))
  );

  if (stale.length > 0) {
    console.log("\n--- Stale Requirements (tests changed, need re-assessment) ---\n");
    for (const req of stale) {
      console.log(`  ${req.feature} #${req.id}`);
    }
  }

  // Show orphaned tests (first 10)
  if (result.orphanedTests.length > 0) {
    console.log("\n--- Orphaned Tests (not linked to any requirement) ---\n");
    for (const test of result.orphanedTests.slice(0, 10)) {
      console.log(`  ${test.file}:${test.identifier}`);
    }
    if (result.orphanedTests.length > 10) {
      console.log(`  ... and ${result.orphanedTests.length - 10} more`);
    }
  }

  // Show requirements with unanswered questions
  const withQuestions = result.features.flatMap((f) =>
    f.requirements.filter((r) => r.unansweredQuestions > 0).map((r) => ({ feature: f.feature, ...r }))
  );

  if (withQuestions.length > 0) {
    console.log("\n--- Requirements With Unanswered Questions ---\n");
    for (const req of withQuestions) {
      console.log(`  ${req.feature} #${req.id}: ${req.unansweredQuestions} question(s)`);
    }
  }

  console.log();
}
