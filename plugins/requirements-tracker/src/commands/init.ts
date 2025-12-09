/**
 * Initialize .requirements/ folder with config
 */

import {
  requirementsDirExists,
  createRequirementsDir,
  saveConfig,
} from "../lib/store";
import type { Config } from "../lib/types";

export async function init(args: {
  cwd: string;
  force?: boolean;
  testRunner?: string;
  testGlob?: string;
}): Promise<void> {
  const { cwd, force, testRunner = "bun test", testGlob = "**/*.test.{ts,js}" } = args;

  // Check for existing config
  if (await requirementsDirExists(cwd)) {
    if (!force) {
      console.log(".requirements/ folder already exists.");
      console.log("Use --force to reconfigure.");
      return;
    }
    console.log("Reconfiguring...");
  }

  // Create config
  const config: Config = {
    testRunner,
    testGlob,
  };

  // Create directory and save config
  await createRequirementsDir(cwd);
  await saveConfig(cwd, config);

  console.log("Initialized .requirements/");
  console.log(`  testRunner: ${testRunner}`);
  console.log(`  testGlob: ${testGlob}`);
}
