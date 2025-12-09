/**
 * Update AI assessment for a requirement
 */

import {
  loadConfig,
  loadAllFeatures,
  findFeatureByName,
  saveFeature,
} from "../lib/store";
import type { AIAssessment } from "../lib/types";

interface AssessResult {
  sufficient: boolean;
  notes: string;
}

export async function assess(args: {
  cwd: string;
  featureName: string;
  reqId: string;
  result: string; // JSON string: {"sufficient": true, "notes": "..."}
}): Promise<void> {
  const { cwd, featureName, reqId, result: resultJson } = args;

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
  } catch (error) {
    console.error("Invalid --result format.");
    console.error('Expected: --result \'{"sufficient": true, "notes": "..."}\'');
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
    }
    process.exit(1);
  }

  // Update assessment
  const assessment: AIAssessment = {
    sufficient: assessResult.sufficient,
    notes: assessResult.notes,
    assessedAt: new Date().toISOString(),
  };

  requirement.aiAssessment = assessment;

  // Save feature file
  await saveFeature(cwd, feature);

  console.log("Assessment updated:");
  console.log(`  Feature: ${feature.filename}`);
  console.log(`  Requirement: ${reqId}`);
  console.log(`  Sufficient: ${assessment.sufficient}`);
  console.log(`  Notes: ${assessment.notes}`);
}
