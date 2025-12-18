/**
 * Reject a suggested scenario (removes it from the requirement)
 */

import {
  loadConfig,
  loadRequirement,
  saveRequirement,
  isValidRequirementPath,
} from "../lib/store";

export class RejectScenarioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RejectScenarioError";
  }
}

export async function rejectScenario(args: {
  cwd: string;
  path: string; // e.g., "auth/REQ_login.yml"
  scenarioName: string; // name of the scenario to reject
}): Promise<void> {
  const { cwd, path, scenarioName } = args;

  // Validate path format
  if (!isValidRequirementPath(path)) {
    throw new RejectScenarioError(
      "Invalid requirement path. Must end with REQ_*.yml (e.g., auth/REQ_login.yml)"
    );
  }

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    throw new RejectScenarioError("Not initialized. Run 'req init' first.");
  }

  // Load requirement
  const requirement = await loadRequirement(cwd, path);
  if (!requirement) {
    throw new RejectScenarioError(`Requirement not found: ${path}`);
  }

  // Check if scenarios exist
  if (!requirement.data.scenarios || requirement.data.scenarios.length === 0) {
    throw new RejectScenarioError("Requirement has no scenarios.");
  }

  // Find the scenario index
  const scenarioIndex = requirement.data.scenarios.findIndex(
    (s) => s.name === scenarioName
  );
  if (scenarioIndex === -1) {
    throw new RejectScenarioError(`Scenario not found: ${scenarioName}`);
  }

  const scenario = requirement.data.scenarios[scenarioIndex];

  // Only allow rejecting suggested scenarios
  if (!scenario.suggested) {
    throw new RejectScenarioError(
      `Cannot reject scenario "${scenarioName}" - it is not a suggested scenario.`
    );
  }

  // Remove the scenario
  requirement.data.scenarios.splice(scenarioIndex, 1);

  // Clean up empty scenarios array
  if (requirement.data.scenarios.length === 0) {
    delete requirement.data.scenarios;
  }

  // Save requirement file
  await saveRequirement(cwd, path, requirement.data);

  console.log(`Rejected scenario: ${scenarioName}`);
  console.log(`  Requirement: ${path}`);
  console.log(`  Scenario has been removed.`);
}
