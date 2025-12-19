/**
 * Remove a test link from a requirement
 */

import { loadConfig, loadRequirement, saveRequirement } from "../lib/store";

interface UnlinkArgs {
  cwd: string;
  path: string; // Requirement path e.g. "auth/REQ_login.yml"
  testSpec: string; // "file:identifier" format
}

export async function unlink(args: UnlinkArgs): Promise<void> {
  const { cwd, path, testSpec } = args;

  // Parse test spec
  const colonIndex = testSpec.indexOf(":");
  if (colonIndex === -1) {
    console.error("Invalid test spec. Use format: file:identifier");
    console.error("Example: src/auth.test.ts:validates login");
    process.exit(1);
  }

  const file = testSpec.slice(0, colonIndex);
  const identifier = testSpec.slice(colonIndex + 1);

  if (!file || !identifier) {
    console.error("Invalid test spec. Both file and identifier are required.");
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

  // Find test link
  const testIndex = requirement.data.tests.findIndex(
    (t) => t.file === file && t.identifier === identifier
  );

  if (testIndex === -1) {
    console.error(`Test not linked to this requirement: ${testSpec}`);
    if (requirement.data.tests.length > 0) {
      console.error("Currently linked tests:");
      for (const test of requirement.data.tests) {
        console.error(`  - ${test.file}:${test.identifier}`);
      }
    } else {
      console.error("No tests currently linked to this requirement.");
    }
    process.exit(1);
  }

  // Remove test link
  requirement.data.tests.splice(testIndex, 1);

  // Clear stale AI assessment data, but preserve suggested tests/scenarios
  if (requirement.data.aiAssessment) {
    const { suggestedTests, suggestedScenarios, assessedAt } = requirement.data.aiAssessment;
    if (suggestedTests || suggestedScenarios) {
      requirement.data.aiAssessment = {
        sufficient: false,
        notes: 'Assessment invalidated - test coverage changed',
        assessedAt,
        suggestedTests,
        suggestedScenarios,
      };
    } else {
      delete requirement.data.aiAssessment;
    }
  }

  // Save requirement
  await saveRequirement(cwd, path, requirement.data);

  console.log(`Unlinked: ${testSpec}`);
  console.log(`  From: ${path}`);
  console.log(
    `\nRequirement now has ${requirement.data.tests.length} test(s) linked.`
  );
  if (requirement.data.aiAssessment) {
    console.log("AI assessment cleared (test coverage changed).");
  }
}
