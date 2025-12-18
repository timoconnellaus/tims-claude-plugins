#!/usr/bin/env bun

/**
 * Switch to using installed (compiled) versions of the CLIs
 *
 * This removes the bun link symlinks, falling back to installed binaries in ~/.local/bin
 *
 * Usage: bun run use:installed
 */

import { $ } from "bun";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");
const INSTALL_DIR = `${process.env.HOME}/.local/bin`;

const PLUGINS = [
  { name: "requirements-tracker", dir: "plugins/requirements-tracker", bin: "req" },
  { name: "docs-skill", dir: "plugins/docs-skill", bin: "docs" },
];

async function main() {
  console.log("Switching to installed CLIs...\n");

  for (const plugin of PLUGINS) {
    const pluginDir = join(ROOT, plugin.dir);
    console.log(`Unlinking ${plugin.name}...`);

    try {
      // Remove bun link
      await $`bun unlink`.cwd(pluginDir).quiet();
      console.log(`  ✓ Unlinked ${plugin.name}`);
    } catch {
      console.log(`  - ${plugin.name} was not linked`);
    }

    // Check if installed binary exists
    const installedPath = join(INSTALL_DIR, plugin.bin);
    const exists = await Bun.file(installedPath).exists();
    if (exists) {
      console.log(`  ✓ Using installed binary: ${installedPath}`);
    } else {
      console.log(`  ⚠ No installed binary found at ${installedPath}`);
    }
  }

  console.log("\nInstalled mode active.");
  console.log(`CLIs run from: ${INSTALL_DIR}`);
  console.log("\nIf binaries are not installed, run:");
  console.log("  curl -fsSL https://raw.githubusercontent.com/timoconnellaus/tims-claude-plugins/main/scripts/install.sh | bash");
  console.log("\nTo switch back to local development:");
  console.log("  bun run use:local");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
