/**
 * Rename a requirement file
 */

import { rename as fsRename } from "fs/promises";
import { join, dirname, basename } from "path";
import {
  loadConfig,
  loadAllRequirements,
  saveRequirement,
  getRequirementsDir,
  isValidRequirementPath,
  requirementExists,
} from "../lib/store";

interface RenameArgs {
  cwd: string;
  oldPath: string;
  newName: string;
}

export async function rename(args: RenameArgs): Promise<void> {
  const { cwd, oldPath, newName } = args;

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    console.error("Not initialized. Run 'req init' first.");
    process.exit(1);
  }

  // Validate old path format
  if (!isValidRequirementPath(oldPath)) {
    console.error("Invalid requirement path. Must end with REQ_*.yml");
    process.exit(1);
  }

  // Validate new name format (just the filename)
  let newFileName = newName;
  if (!newFileName.startsWith("REQ_")) {
    newFileName = `REQ_${newFileName}`;
  }
  if (!newFileName.endsWith(".yml")) {
    newFileName = `${newFileName}.yml`;
  }

  // Build new path (same directory, new filename)
  const dir = dirname(oldPath);
  const newPath = dir ? `${dir}/${newFileName}` : newFileName;

  // Validate the constructed path
  if (!isValidRequirementPath(newPath)) {
    console.error(`Invalid new name. Result must match REQ_*.yml pattern.`);
    console.error(`Attempted: ${newPath}`);
    process.exit(1);
  }

  // Check source exists
  if (!(await requirementExists(cwd, oldPath))) {
    console.error(`Requirement not found: ${oldPath}`);
    process.exit(1);
  }

  // Check destination doesn't exist
  if (await requirementExists(cwd, newPath)) {
    console.error(`Destination already exists: ${newPath}`);
    process.exit(1);
  }

  const reqDir = getRequirementsDir(cwd);
  const oldFullPath = join(reqDir, oldPath);
  const newFullPath = join(reqDir, newPath);

  // Rename the file
  await fsRename(oldFullPath, newFullPath);

  console.log(`Renamed: ${oldPath} -> ${newPath}`);

  // Update any requirements that depend on the renamed requirement
  const loadResult = await loadAllRequirements(cwd);
  let updatedCount = 0;

  for (const req of loadResult.requirements) {
    if (!req.data.dependencies) continue;

    let updated = false;
    for (const dep of req.data.dependencies) {
      if (dep.path === oldPath) {
        dep.path = newPath;
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
