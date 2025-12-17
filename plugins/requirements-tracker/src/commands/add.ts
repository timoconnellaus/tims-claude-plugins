/**
 * Create a new requirement file
 */

import {
  loadConfig,
  requirementExists,
  saveRequirement,
  isValidRequirementPath,
} from "../lib/store";
import { parseAndFormat } from "../lib/gherkin";
import type { Requirement, SourceType, Priority } from "../lib/types";

const VALID_SOURCE_TYPES: SourceType[] = [
  "doc",
  "slack",
  "email",
  "meeting",
  "ticket",
  "manual",
];

const VALID_PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];

interface AddArgs {
  cwd: string;
  path: string;
  gherkin: string;
  sourceType: string;
  sourceDesc: string;
  sourceUrl?: string;
  sourceDate?: string;
  force?: boolean;
  priority?: string;
  dependsOn?: string[];
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
    priority,
    dependsOn,
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

  // Parse and auto-format gherkin
  const formatResult = parseAndFormat(gherkin);
  if ("error" in formatResult) {
    console.error(`Invalid gherkin format: ${formatResult.error}`);
    console.error("");
    console.error("Expected format (one keyword per line):");
    console.error("  Given a user is logged in");
    console.error("  And they have items in cart");
    console.error("  When they click checkout");
    console.error("  Then the payment page opens");
    process.exit(1);
  }
  const formattedGherkin = formatResult.formatted;

  // Validate source type
  if (!VALID_SOURCE_TYPES.includes(sourceType as SourceType)) {
    console.error(`Invalid source type: ${sourceType}`);
    console.error(
      `Valid types: ${VALID_SOURCE_TYPES.join(", ")}`
    );
    process.exit(1);
  }

  // Validate priority if provided
  if (priority && !VALID_PRIORITIES.includes(priority as Priority)) {
    console.error(`Invalid priority: ${priority}`);
    console.error(`Valid priorities: ${VALID_PRIORITIES.join(", ")}`);
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
    gherkin: formattedGherkin,
    source: {
      type: sourceType as SourceType,
      description: sourceDesc,
      url: sourceUrl,
      date: sourceDate,
    },
    tests: [],
    status: "planned",
  };

  // Add optional fields if provided
  if (priority) {
    requirement.priority = priority as Priority;
  }
  if (dependsOn && dependsOn.length > 0) {
    requirement.dependencies = dependsOn.map((dep) => ({ path: dep }));
  }

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
  if (priority) {
    console.log(`  Priority: ${priority}`);
  }
  if (dependsOn && dependsOn.length > 0) {
    console.log(`  Dependencies: ${dependsOn.join(", ")}`);
  }
}
