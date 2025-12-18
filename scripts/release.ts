#!/usr/bin/env bun

/**
 * Release script - creates a git tag and pushes to trigger GitHub Actions
 *
 * Usage:
 *   bun run release        # Release current version
 *   bun run release --dry  # Show what would happen without doing it
 */

import { $ } from "bun";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");

async function getVersion(): Promise<string> {
  const pkgPath = join(ROOT, "plugins/requirements-tracker/package.json");
  const pkg = await Bun.file(pkgPath).json();
  return pkg.version;
}

async function hasUncommittedChanges(): Promise<boolean> {
  const result = await $`git status --porcelain`.text();
  return result.trim().length > 0;
}

async function tagExists(tag: string): Promise<boolean> {
  try {
    await $`git rev-parse ${tag}`.quiet();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const isDry = process.argv.includes("--dry");
  const version = await getVersion();
  const tag = `v${version}`;

  console.log(`\nRelease: ${tag}`);
  console.log("─".repeat(40));

  // Check for uncommitted changes
  if (await hasUncommittedChanges()) {
    console.error("Error: You have uncommitted changes. Commit or stash them first.");
    process.exit(1);
  }

  // Check if tag already exists
  if (await tagExists(tag)) {
    console.error(`Error: Tag ${tag} already exists.`);
    console.log("\nTo release a new version, first bump the version:");
    console.log("  bun run version:bump        # patch");
    console.log("  bun run version:bump:minor  # minor");
    console.log("  bun run version:bump:major  # major");
    process.exit(1);
  }

  if (isDry) {
    console.log("\n[DRY RUN] Would execute:");
    console.log(`  git tag ${tag}`);
    console.log(`  git push origin ${tag}`);
    console.log("\nThis will trigger GitHub Actions to build and publish binaries.");
  } else {
    console.log(`\nCreating tag ${tag}...`);
    await $`git tag ${tag}`;

    console.log(`Pushing tag to origin...`);
    await $`git push origin ${tag}`;

    console.log(`\nRelease ${tag} initiated!`);
    console.log("\nGitHub Actions will now:");
    console.log("  1. Build binaries for all platforms");
    console.log("  2. Create a GitHub Release");
    console.log("  3. Upload binaries and checksums");
    console.log("\nCheck progress at:");
    console.log("  https://github.com/timoconnellaus/tims-claude-plugins/actions");
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
