/**
 * init command - Initialize .docs folder
 */

import type { InitArgs } from "../lib/types";
import {
  docsDirExists,
  saveConfig,
  createDefaultConfig,
  getDocsDir,
} from "../lib/store";

export async function init(args: InitArgs): Promise<void> {
  const { cwd } = args;

  // Check if already initialized
  if (await docsDirExists(cwd)) {
    console.log(".docs/ folder already exists.");
    console.log("Use 'docs config' to view or modify your configuration.");
    return;
  }

  // Create default config
  const config = createDefaultConfig();
  await saveConfig(cwd, config);

  console.log("Initialized .docs/");
  console.log(`  Created: ${getDocsDir(cwd)}/config.yml`);
  console.log();
  console.log("Next steps:");
  console.log("  1. Search available docs: docs search <query>");
  console.log('  2. Add topic patterns:    docs config --add "nextjs/**"');
  console.log("  3. Sync docs:             docs pull");
}
