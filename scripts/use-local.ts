#!/usr/bin/env bun

/**
 * Switch to using local development versions of the CLIs
 *
 * Creates symlinks in ~/.bun/bin pointing to the local TypeScript source files.
 * Changes to the source are immediately reflected without rebuilding.
 *
 * Usage: bun run use:local
 */

import { join } from "path";
import { existsSync, unlinkSync, symlinkSync, readlinkSync } from "fs";

const ROOT = join(import.meta.dir, "..");
const BUN_BIN = join(process.env.HOME!, ".bun", "bin");

const PLUGINS = [
  { name: "requirements-tracker", bin: "req", cli: "plugins/requirements-tracker/src/cli.ts" },
  { name: "docs-skill", bin: "docs", cli: "plugins/docs-skill/src/cli.ts" },
];

async function main() {
  console.log("Switching to local development CLIs...\n");

  for (const plugin of PLUGINS) {
    const cliPath = join(ROOT, plugin.cli);
    const binPath = join(BUN_BIN, plugin.bin);

    console.log(`Linking ${plugin.bin}...`);

    try {
      // Check if target exists
      if (!existsSync(cliPath)) {
        console.error(`  ✗ Source not found: ${cliPath}`);
        continue;
      }

      // Remove existing binary/symlink if exists
      if (existsSync(binPath)) {
        // Check if it's already pointing to the right place
        try {
          const currentTarget = readlinkSync(binPath);
          if (currentTarget === cliPath) {
            console.log(`  ✓ Already linked to local source`);
            continue;
          }
        } catch {
          // Not a symlink, remove it
        }
        unlinkSync(binPath);
      }

      // Create symlink to local source
      symlinkSync(cliPath, binPath);
      console.log(`  ✓ ${binPath} -> ${cliPath}`);
    } catch (error) {
      console.error(`  ✗ Failed to link ${plugin.bin}: ${error}`);
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
