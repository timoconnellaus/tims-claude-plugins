/**
 * Update AI assessment for a requirement
 */

import {
  loadConfig,
  loadRequirement,
  saveRequirement,
} from "../lib/store";
import { getTestsWithCache } from "../lib/cache";
import type {
  AIAssessment,
  TestComment,
  SuggestedTest,
  VerificationCriteria,
  CriterionAssessment,
  CriterionResult,
} from "../lib/types";
import { CRITERIA_KEYS, CRITERIA_LABELS } from "../lib/types";

interface AssessResult {
  criteria: VerificationCriteria;
  notes: string;
  testComments?: TestComment[];
  suggestedTests?: SuggestedTest[];
}

// Helper to validate a single criterion
function validateCriterion(
  value: unknown,
  name: string
): CriterionAssessment {
  if (!value || typeof value !== "object") {
    throw new Error(`${name} must be an object with result and optional note`);
  }
  const obj = value as Record<string, unknown>;

  if (!["pass", "fail", "na"].includes(obj.result as string)) {
    throw new Error(`${name}.result must be "pass", "fail", or "na"`);
  }

  if (obj.note !== undefined && typeof obj.note !== "string") {
    throw new Error(`${name}.note must be a string if provided`);
  }

  return {
    result: obj.result as CriterionResult,
    note: obj.note as string | undefined,
  };
}

// Helper to compute 'sufficient' from criteria
function computeSufficient(criteria: VerificationCriteria): boolean {
  for (const key of CRITERIA_KEYS) {
    if (criteria[key].result === "fail") {
      return false;
    }
  }
  return true; // All pass or na
}

export async function assess(args: {
  cwd: string;
  path: string; // e.g., "auth/REQ_login.yml"
  resultJson: string; // JSON string: {"sufficient": true, "notes": "..."}
}): Promise<void> {
  const { cwd, path, resultJson } = args;

  // Parse result
  let assessResult: AssessResult;
  let validatedCriteria: VerificationCriteria;
  try {
    const parsed = JSON.parse(resultJson);

    // Validate notes
    if (typeof parsed.notes !== "string") {
      throw new Error("notes must be a string");
    }

    // Validate criteria object
    if (!parsed.criteria || typeof parsed.criteria !== "object") {
      throw new Error("criteria object is required");
    }

    // Validate each criterion
    validatedCriteria = {} as VerificationCriteria;
    for (const key of CRITERIA_KEYS) {
      if (!(key in parsed.criteria)) {
        throw new Error(`criteria.${key} is required`);
      }
      validatedCriteria[key] = validateCriterion(
        parsed.criteria[key],
        `criteria.${key}`
      );
    }

    // Validate optional testComments
    if (parsed.testComments !== undefined) {
      if (!Array.isArray(parsed.testComments)) {
        throw new Error("testComments must be an array");
      }
      for (const tc of parsed.testComments) {
        if (typeof tc.file !== "string" || typeof tc.identifier !== "string" || typeof tc.comment !== "string") {
          throw new Error("testComments entries must have file, identifier, and comment strings");
        }
        if (typeof tc.hasIssue !== "boolean") {
          throw new Error("testComments entries must have hasIssue boolean");
        }
      }
    }

    // Validate optional suggestedTests
    if (parsed.suggestedTests !== undefined) {
      if (!Array.isArray(parsed.suggestedTests)) {
        throw new Error("suggestedTests must be an array");
      }
      for (const st of parsed.suggestedTests) {
        if (typeof st.description !== "string" || typeof st.rationale !== "string") {
          throw new Error("suggestedTests entries must have description and rationale strings");
        }
      }
    }

    assessResult = {
      criteria: validatedCriteria,
      notes: parsed.notes,
      testComments: parsed.testComments,
      suggestedTests: parsed.suggestedTests,
    };
  } catch (error) {
    console.error("Invalid --result format.");
    console.error('Expected: --result \'{"criteria": {...}, "notes": "...", "testComments": [...], "suggestedTests": [...]}\'');
    console.error("criteria must have all 8 fields: noBugsInTestCode, sufficientCoverage, meaningfulAssertions,");
    console.error("  correctTestSubject, happyPathCovered, edgeCasesAddressed, errorScenariosHandled, wouldFailIfBroke");
    console.error('Each criterion: { "result": "pass"|"fail"|"na", "note": "optional" }');
    if (error instanceof Error) {
      console.error(`Parse error: ${error.message}`);
    }
    process.exit(1);
  }

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    console.error("Not initialized. Run 'req init' first.");
    process.exit(1);
  }

  // Load requirement
  const requirement = await loadRequirement(cwd, path);
  if (!requirement) {
    console.error(`Requirement not found: ${path}`);
    process.exit(1);
  }

  // Update test hashes to current values
  // This ensures the assessment is tied to the actual test code that was evaluated
  if (requirement.data.tests.length > 0) {
    const { tests: allTests } = await getTestsWithCache(cwd, config.testGlob, true);
    const hashMap = new Map(allTests.map((t) => [`${t.file}:${t.identifier}`, t.hash]));

    for (const test of requirement.data.tests) {
      const key = `${test.file}:${test.identifier}`;
      const currentHash = hashMap.get(key);
      if (currentHash) {
        test.hash = currentHash;
      }
    }
  }

  // Compute sufficient from criteria
  const sufficient = computeSufficient(assessResult.criteria);

  // Update assessment
  const assessment: AIAssessment = {
    sufficient,
    notes: assessResult.notes,
    assessedAt: new Date().toISOString(),
    criteria: assessResult.criteria,
    testComments: assessResult.testComments,
    suggestedTests: assessResult.suggestedTests,
  };

  requirement.data.aiAssessment = assessment;

  // Save requirement file
  await saveRequirement(cwd, path, requirement.data);

  console.log("Assessment updated:");
  console.log(`  Requirement: ${path}`);
  console.log(`  Sufficient: ${assessment.sufficient}`);
  console.log("  Criteria:");
  for (const key of CRITERIA_KEYS) {
    const c = assessment.criteria![key];
    const status = c.result === "pass" ? "PASS" : c.result === "fail" ? "FAIL" : "N/A";
    const note = c.note ? ` (${c.note})` : "";
    console.log(`    ${CRITERIA_LABELS[key]}: ${status}${note}`);
  }
  console.log(`  Notes: ${assessment.notes}`);
  if (assessment.testComments?.length) {
    console.log(`  Test comments: ${assessment.testComments.length}`);
  }
  if (assessment.suggestedTests?.length) {
    console.log(`  Suggested tests: ${assessment.suggestedTests.length}`);
  }
}
