/**
 * Link a test to a requirement
 */

import {
  loadConfig,
  loadRequirement,
  saveRequirement,
  isValidRequirementPath,
} from "../lib/store";
import { findTest } from "../lib/test-parser";
import type { TestLink } from "../lib/types";

export async function link(args: {
  cwd: string;
  path: string; // e.g., "auth/REQ_login.yml"
  testSpec: string; // e.g., "src/auth.test.ts:validates login"
}): Promise<void> {
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

  // Validate path format
  if (!isValidRequirementPath(path)) {
    console.error("Invalid requirement path. Must end with REQ_*.yml");
    console.error("Example: auth/REQ_login.yml");
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

  // Find and extract the test
  const extractedTest = await findTest(cwd, file, identifier);
  if (!extractedTest) {
    console.error(`Test not found: ${file}:${identifier}`);
    console.error("Make sure the test exists and matches the identifier exactly.");
    process.exit(1);
  }

  // Check for duplicate
  if (
    requirement.data.tests.some(
      (t) => t.file === file && t.identifier === identifier
    )
  ) {
    console.log("Test is already linked to this requirement.");
    return;
  }

  // Create test link
  const newLink: TestLink = {
    file,
    identifier,
    hash: extractedTest.hash,
  };

  // Add to requirement
  requirement.data.tests.push(newLink);

  // Auto-set status to done when tests are linked
  if (requirement.data.status === "planned") {
    requirement.data.status = "done";
    console.log("Status changed from 'planned' to 'done' (tests linked)");
  }

  // Clear AI assessment since test coverage changed
  delete requirement.data.aiAssessment;

  // Save requirement file
  await saveRequirement(cwd, path, requirement.data);

  console.log(`Linked: ${file}:${identifier}`);
  console.log(`  Requirement: ${path}`);
  console.log(`  Hash: ${newLink.hash.slice(0, 12)}...`);
  console.log(`\nRequirement now has ${requirement.data.tests.length} test(s) linked.`);
}
