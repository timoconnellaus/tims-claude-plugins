#!/usr/bin/env bun

/**
 * Switch to using local development versions of the CLIs
 *
 * This uses `bun link` to create symlinks from ~/.bun/bin to the local source files.
 * Changes to the TypeScript source are immediately reflected without rebuilding.
 *
 * Usage: bun run use:local
 */

import { $ } from "bun";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");

const PLUGINS = [
  { name: "requirements-tracker", dir: "plugins/requirements-tracker" },
  { name: "docs-skill", dir: "plugins/docs-skill" },
];

async function main() {
  console.log("Switching to local development CLIs...\n");

  for (const plugin of PLUGINS) {
    const pluginDir = join(ROOT, plugin.dir);
    console.log(`Linking ${plugin.name}...`);

    try {
      // Run bun link in the plugin directory
      await $`bun link`.cwd(pluginDir);
      console.log(`  ✓ Linked ${plugin.name}`);
    } catch (error) {
      console.error(`  ✗ Failed to link ${plugin.name}: ${error}`);
    }
  }

  console.log("\nLocal development mode active.");
  console.log("CLIs now run from source: changes take effect immediately.");
  console.log("\nTo switch back to installed binaries:");
  console.log("  bun run use:installed");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
