#!/usr/bin/env bun

/**
 * Switch to using installed (compiled) versions of the CLIs
 *
 * Removes symlinks from ~/.bun/bin and copies installed binaries from ~/.local/bin
 *
 * Usage: bun run use:installed
 */

import { join } from "path";
import { existsSync, unlinkSync, copyFileSync, lstatSync } from "fs";

const BUN_BIN = join(process.env.HOME!, ".bun", "bin");
const INSTALL_DIR = join(process.env.HOME!, ".local", "bin");

const PLUGINS = [
  { name: "requirements-tracker", bin: "req" },
  { name: "docs-skill", bin: "docs" },
];

async function main() {
  console.log("Switching to installed CLIs...\n");

  for (const plugin of PLUGINS) {
    const bunBinPath = join(BUN_BIN, plugin.bin);
    const installedPath = join(INSTALL_DIR, plugin.bin);

    console.log(`Restoring ${plugin.bin}...`);

    try {
      // Check if installed binary exists
      if (!existsSync(installedPath)) {
        console.log(`  ⚠ No installed binary at ${installedPath}`);
        console.log(`    Run the install script to download binaries.`);
        continue;
      }

      // Remove existing symlink/file in bun bin
      if (existsSync(bunBinPath)) {
        const stats = lstatSync(bunBinPath);
        if (stats.isSymbolicLink()) {
          console.log(`  - Removing symlink`);
        }
        unlinkSync(bunBinPath);
      }

      // Copy installed binary to bun bin
      copyFileSync(installedPath, bunBinPath);
      console.log(`  ✓ Copied ${installedPath} -> ${bunBinPath}`);
    } catch (error) {
      console.error(`  ✗ Failed to restore ${plugin.bin}: ${error}`);
    }
  }

  console.log("\nInstalled mode active.");
  console.log(`CLIs run from: ${BUN_BIN}`);
  console.log("\nIf binaries are not installed, run:");
  console.log("  curl -fsSL https://raw.githubusercontent.com/timoconnellaus/tims-claude-plugins/main/scripts/install.sh | bash");
  console.log("\nTo switch back to local development:");
  console.log("  bun run use:local");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
