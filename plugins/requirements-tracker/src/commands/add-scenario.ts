/**
 * Add a scenario to a requirement
 */

import {
  loadConfig,
  loadRequirement,
  saveRequirement,
  isValidRequirementPath,
} from "../lib/store";
import { parseGherkin, formatGherkin, validateGherkinStructure } from "../lib/gherkin";
import type { Scenario } from "../lib/types";

export class AddScenarioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AddScenarioError";
  }
}

export async function addScenario(args: {
  cwd: string;
  path: string; // e.g., "auth/REQ_login.yml"
  name: string; // scenario name (snake_case preferred)
  gherkin: string; // Given/When/Then scenario
  suggested?: boolean; // if true, marks as AI-suggested pending acceptance
}): Promise<void> {
  const { cwd, path, name, gherkin, suggested } = args;

  // Validate path format
  if (!isValidRequirementPath(path)) {
    throw new AddScenarioError(
      "Invalid requirement path. Must end with REQ_*.yml (e.g., auth/REQ_login.yml)"
    );
  }

  // Validate name
  if (!name || name.trim() === "") {
    throw new AddScenarioError("Scenario name cannot be empty.");
  }

  // Parse and auto-format gherkin (normalizes to one keyword per line)
  const parseResult = parseGherkin(gherkin);
  if (!parseResult.success) {
    throw new AddScenarioError(`Invalid gherkin: ${parseResult.error}`);
  }

  // Validate structure (keyword ordering)
  const structureValidation = validateGherkinStructure(parseResult.steps);
  if (!structureValidation.valid) {
    throw new AddScenarioError(
      `Invalid gherkin structure: ${structureValidation.errors.join(", ")}`
    );
  }

  // Format to normalized form (one keyword per line)
  const formattedGherkin = formatGherkin(parseResult.steps);

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    throw new AddScenarioError("Not initialized. Run 'req init' first.");
  }

  // Load requirement
  const requirement = await loadRequirement(cwd, path);
  if (!requirement) {
    throw new AddScenarioError(`Requirement not found: ${path}`);
  }

  // Initialize scenarios array if needed
  if (!requirement.data.scenarios) {
    requirement.data.scenarios = [];
  }

  // Check for duplicate scenario name
  const existingScenario = requirement.data.scenarios.find(
    (s) => s.name === name
  );
  if (existingScenario) {
    throw new AddScenarioError(`Scenario with name "${name}" already exists.`);
  }

  // Create new scenario with normalized gherkin
  const newScenario: Scenario = {
    name,
    gherkin: formattedGherkin,
  };

  // Only add suggested flag if true (keep YAML clean)
  if (suggested) {
    newScenario.suggested = true;
  }

  // Add to requirement
  requirement.data.scenarios.push(newScenario);

  // Save requirement file
  await saveRequirement(cwd, path, requirement.data);

  console.log(`Added scenario: ${name}`);
  console.log(`  Requirement: ${path}`);
  if (suggested) {
    console.log(`  Status: Suggested (pending acceptance)`);
  }
  console.log(
    `\nRequirement now has ${requirement.data.scenarios.length} scenario(s).`
  );
}
