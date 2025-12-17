/**
 * Move a requirement to a new folder
 */

import { rename, access, mkdir } from "fs/promises";
import { join, dirname, basename } from "path";
import {
  loadConfig,
  loadAllRequirements,
  saveRequirement,
  getRequirementsDir,
  isValidRequirementPath,
  requirementExists,
  loadRequirement,
} from "../lib/store";

interface MoveArgs {
  cwd: string;
  sourcePath: string;
  destPath: string;
}

export async function move(args: MoveArgs): Promise<void> {
  const { cwd, sourcePath, destPath } = args;

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    console.error("Not initialized. Run 'req init' first.");
    process.exit(1);
  }

  // Validate source path format
  if (!isValidRequirementPath(sourcePath)) {
    console.error("Invalid source path. Must end with REQ_*.yml");
    process.exit(1);
  }

  // Validate destination path format
  if (!isValidRequirementPath(destPath)) {
    console.error("Invalid destination path. Must end with REQ_*.yml");
    process.exit(1);
  }

  // Check source exists
  if (!(await requirementExists(cwd, sourcePath))) {
    console.error(`Requirement not found: ${sourcePath}`);
    process.exit(1);
  }

  // Check destination doesn't exist
  if (await requirementExists(cwd, destPath)) {
    console.error(`Destination already exists: ${destPath}`);
    console.error("Use a different destination path.");
    process.exit(1);
  }

  const reqDir = getRequirementsDir(cwd);
  const sourceFullPath = join(reqDir, sourcePath);
  const destFullPath = join(reqDir, destPath);

  // Ensure destination directory exists
  const destDir = dirname(destFullPath);
  await mkdir(destDir, { recursive: true });

  // Move the file
  await rename(sourceFullPath, destFullPath);

  console.log(`Moved: ${sourcePath} -> ${destPath}`);

  // Update any requirements that depend on the moved requirement
  const loadResult = await loadAllRequirements(cwd);
  let updatedCount = 0;

  for (const req of loadResult.requirements) {
    if (!req.data.dependencies) continue;

    let updated = false;
    for (const dep of req.data.dependencies) {
      if (dep.path === sourcePath) {
        dep.path = destPath;
        updated = true;
      }
    }

    if (updated) {
      await saveRequirement(cwd, req.path, req.data);
      updatedCount++;
      console.log(`  Updated dependency in: ${req.path}`);
    }
  }

  if (updatedCount > 0) {
    console.log(`Updated ${updatedCount} requirement(s) with new dependency path.`);
  }
}
