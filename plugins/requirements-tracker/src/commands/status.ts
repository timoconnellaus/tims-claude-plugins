/**
 * Get or set implementation status for a requirement
 */

import { loadConfig, loadRequirement, saveRequirement } from "../lib/store";
import type { ImplementationStatus } from "../lib/types";

interface StatusArgs {
  cwd: string;
  path: string;
  done?: boolean;
  planned?: boolean;
}

export async function status(args: StatusArgs): Promise<void> {
  const { cwd, path, done, planned } = args;

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

  // If no flags, just show current status
  if (!done && !planned) {
    console.log(`${path}: ${requirement.data.status}`);
    return;
  }

  // Validate mutually exclusive flags
  if (done && planned) {
    console.error("Cannot specify both --done and --planned");
    process.exit(1);
  }

  // Determine new status
  const newStatus: ImplementationStatus = done ? "done" : "planned";
  const currentStatus = requirement.data.status;

  // Check if already at desired status
  if (currentStatus === newStatus) {
    console.log(`${path} is already ${newStatus}`);
    return;
  }

  // Warn if marking done without tests
  if (newStatus === "done" && requirement.data.tests.length === 0) {
    console.log("Warning: Marking as done without any linked tests.");
    console.log(`Consider linking tests with: req link ${path} <file:identifier>`);
    console.log();
  }

  // Update status
  requirement.data.status = newStatus;
  await saveRequirement(cwd, path, requirement.data);

  console.log(`Status updated: ${path}`);
  console.log(`  ${currentStatus} -> ${newStatus}`);
}
