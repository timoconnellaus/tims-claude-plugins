/**
 * Accept a suggested scenario (removes the suggested flag)
 */

import {
  loadConfig,
  loadRequirement,
  saveRequirement,
  isValidRequirementPath,
} from "../lib/store";

export class AcceptScenarioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcceptScenarioError";
  }
}

export async function acceptScenario(args: {
  cwd: string;
  path: string; // e.g., "auth/REQ_login.yml"
  scenarioName: string; // name of the scenario to accept
}): Promise<void> {
  const { cwd, path, scenarioName } = args;

  // Validate path format
  if (!isValidRequirementPath(path)) {
    throw new AcceptScenarioError(
      "Invalid requirement path. Must end with REQ_*.yml (e.g., auth/REQ_login.yml)"
    );
  }

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    throw new AcceptScenarioError("Not initialized. Run 'req init' first.");
  }

  // Load requirement
  const requirement = await loadRequirement(cwd, path);
  if (!requirement) {
    throw new AcceptScenarioError(`Requirement not found: ${path}`);
  }

  // Check if scenarios exist
  if (!requirement.data.scenarios || requirement.data.scenarios.length === 0) {
    throw new AcceptScenarioError("Requirement has no scenarios.");
  }

  // Find the scenario
  const scenario = requirement.data.scenarios.find(
    (s) => s.name === scenarioName
  );
  if (!scenario) {
    throw new AcceptScenarioError(`Scenario not found: ${scenarioName}`);
  }

  // Check if it's a suggested scenario
  if (!scenario.suggested) {
    throw new AcceptScenarioError(
      `Scenario "${scenarioName}" is not a suggested scenario (already accepted).`
    );
  }

  // Remove the suggested flag
  delete scenario.suggested;

  // Save requirement file
  await saveRequirement(cwd, path, requirement.data);

  console.log(`Accepted scenario: ${scenarioName}`);
  console.log(`  Requirement: ${path}`);
}
