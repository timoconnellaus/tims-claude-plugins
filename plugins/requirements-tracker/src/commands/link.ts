/**
 * Link a test to a requirement
 */

import {
  loadConfig,
  loadAllFeatures,
  findFeatureByName,
  saveFeature,
} from "../lib/store";
import { findTest } from "../lib/test-parser";
import type { TestLink } from "../lib/types";

export async function link(args: {
  cwd: string;
  featureName: string; // e.g., "user-auth" or "FEAT_001_user-auth"
  reqId: string; // e.g., "1" or "2.1"
  testSpec: string; // e.g., "src/auth.test.ts:validates login"
}): Promise<void> {
  const { cwd, featureName, reqId, testSpec } = args;

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

  // Load features
  const features = await loadAllFeatures(cwd);
  const feature = findFeatureByName(features, featureName);

  if (!feature) {
    console.error(`Feature "${featureName}" not found.`);
    if (features.length > 0) {
      console.error("Available features:");
      for (const f of features) {
        console.error(`  - ${f.filename}`);
      }
    } else {
      console.error("No feature files found. Create one in .requirements/");
    }
    process.exit(1);
  }

  // Find requirement
  const requirement = feature.data.requirements[reqId];
  if (!requirement) {
    console.error(`Requirement "${reqId}" not found in feature.`);
    const reqIds = Object.keys(feature.data.requirements);
    if (reqIds.length > 0) {
      console.error("Available requirements:");
      for (const id of reqIds) {
        console.error(`  - ${id}`);
      }
    } else {
      console.error("No requirements in this feature file.");
    }
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
    requirement.tests.some(
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
  requirement.tests.push(newLink);

  // Clear AI assessment since test coverage changed
  delete requirement.aiAssessment;

  // Save feature file
  await saveFeature(cwd, feature);

  console.log(`Linked: ${file}:${identifier}`);
  console.log(`  Feature: ${feature.filename}`);
  console.log(`  Requirement: ${reqId}`);
  console.log(`  Hash: ${newLink.hash.slice(0, 12)}...`);
  console.log(`\nRequirement now has ${requirement.tests.length} test(s) linked.`);
}
