/**
 * Update AI assessment for a requirement
 */

import {
  loadConfig,
  loadRequirement,
  saveRequirement,
} from "../lib/store";
import type { AIAssessment, TestComment, SuggestedTest } from "../lib/types";

interface AssessResult {
  sufficient: boolean;
  notes: string;
  testComments?: TestComment[];
  suggestedTests?: SuggestedTest[];
}

export async function assess(args: {
  cwd: string;
  path: string; // e.g., "auth/REQ_login.yml"
  resultJson: string; // JSON string: {"sufficient": true, "notes": "..."}
}): Promise<void> {
  const { cwd, path, resultJson } = args;

  // Parse result
  let assessResult: AssessResult;
  try {
    assessResult = JSON.parse(resultJson);
    if (typeof assessResult.sufficient !== "boolean") {
      throw new Error("sufficient must be a boolean");
    }
    if (typeof assessResult.notes !== "string") {
      throw new Error("notes must be a string");
    }
    // Validate optional testComments
    if (assessResult.testComments !== undefined) {
      if (!Array.isArray(assessResult.testComments)) {
        throw new Error("testComments must be an array");
      }
      for (const tc of assessResult.testComments) {
        if (typeof tc.file !== "string" || typeof tc.identifier !== "string" || typeof tc.comment !== "string") {
          throw new Error("testComments entries must have file, identifier, and comment strings");
        }
      }
    }
    // Validate optional suggestedTests
    if (assessResult.suggestedTests !== undefined) {
      if (!Array.isArray(assessResult.suggestedTests)) {
        throw new Error("suggestedTests must be an array");
      }
      for (const st of assessResult.suggestedTests) {
        if (typeof st.description !== "string" || typeof st.rationale !== "string") {
          throw new Error("suggestedTests entries must have description and rationale strings");
        }
      }
    }
  } catch (error) {
    console.error("Invalid --result format.");
    console.error('Expected: --result \'{"sufficient": true, "notes": "...", "testComments": [...], "suggestedTests": [...]}\'');
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

  // Update assessment
  const assessment: AIAssessment = {
    sufficient: assessResult.sufficient,
    notes: assessResult.notes,
    assessedAt: new Date().toISOString(),
    testComments: assessResult.testComments,
    suggestedTests: assessResult.suggestedTests,
  };

  requirement.data.aiAssessment = assessment;

  // Save requirement file
  await saveRequirement(cwd, path, requirement.data);

  console.log("Assessment updated:");
  console.log(`  Requirement: ${path}`);
  console.log(`  Sufficient: ${assessment.sufficient}`);
  console.log(`  Notes: ${assessment.notes}`);
  if (assessment.testComments?.length) {
    console.log(`  Test comments: ${assessment.testComments.length}`);
  }
  if (assessment.suggestedTests?.length) {
    console.log(`  Suggested tests: ${assessment.suggestedTests.length}`);
  }
}
