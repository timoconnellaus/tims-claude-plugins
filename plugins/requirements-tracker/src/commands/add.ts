/**
 * Create a new requirement file
 */

import {
  loadConfig,
  requirementExists,
  saveRequirement,
  isValidRequirementPath,
} from "../lib/store";
import type { Requirement, SourceType } from "../lib/types";

const VALID_SOURCE_TYPES: SourceType[] = [
  "doc",
  "slack",
  "email",
  "meeting",
  "ticket",
  "manual",
];

interface AddArgs {
  cwd: string;
  path: string;
  gherkin: string;
  sourceType: string;
  sourceDesc: string;
  sourceUrl?: string;
  sourceDate?: string;
  force?: boolean;
}

export async function add(args: AddArgs): Promise<void> {
  const {
    cwd,
    path,
    gherkin,
    sourceType,
    sourceDesc,
    sourceUrl,
    sourceDate,
    force,
  } = args;

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    console.error("Not initialized. Run 'req init' first.");
    process.exit(1);
  }

  // Validate path format
  if (!isValidRequirementPath(path)) {
    console.error("Invalid requirement path. Must end with REQ_*.yml");
    console.error("Example: auth/REQ_login.yml");
    process.exit(1);
  }

  // Validate gherkin format
  const gherkinLower = gherkin.toLowerCase();
  if (
    !gherkinLower.includes("given") ||
    !gherkinLower.includes("when") ||
    !gherkinLower.includes("then")
  ) {
    console.error(
      "Invalid gherkin format. Must include 'Given', 'When', and 'Then' keywords."
    );
    console.error(
      "Example: Given a user is logged in When they click logout Then they are redirected to login page"
    );
    process.exit(1);
  }

  // Validate source type
  if (!VALID_SOURCE_TYPES.includes(sourceType as SourceType)) {
    console.error(`Invalid source type: ${sourceType}`);
    console.error(
      `Valid types: ${VALID_SOURCE_TYPES.join(", ")}`
    );
    process.exit(1);
  }

  // Check if file exists
  if (await requirementExists(cwd, path)) {
    if (!force) {
      console.error(`Requirement already exists: ${path}`);
      console.error("Use --force to overwrite.");
      process.exit(1);
    }
    console.log("Overwriting existing requirement...");
  }

  // Create requirement
  const requirement: Requirement = {
    gherkin,
    source: {
      type: sourceType as SourceType,
      description: sourceDesc,
      url: sourceUrl,
      date: sourceDate,
    },
    tests: [],
    status: "planned",
  };

  // Save requirement (creates parent directories automatically)
  await saveRequirement(cwd, path, requirement);

  console.log(`Created requirement: ${path}`);
  console.log(`  Source: ${sourceType} - ${sourceDesc}`);
  if (sourceUrl) {
    console.log(`  URL: ${sourceUrl}`);
  }
  if (sourceDate) {
    console.log(`  Date: ${sourceDate}`);
  }
}
