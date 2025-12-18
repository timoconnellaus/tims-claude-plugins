#!/usr/bin/env bun

/**
 * Version bump script - keeps all version numbers in sync
 *
 * Usage:
 *   bun run scripts/bump-version.ts          # Bump patch (1.0.0 -> 1.0.1)
 *   bun run scripts/bump-version.ts --minor  # Bump minor (1.0.0 -> 1.1.0)
 *   bun run scripts/bump-version.ts --major  # Bump major (1.0.0 -> 2.0.0)
 *   bun run scripts/bump-version.ts --set 2.0.0  # Set specific version
 *
 * Files updated:
 *   - plugins/requirements-tracker/package.json
 *   - plugins/docs-skill/package.json
 *   - .claude-plugin/marketplace.json
 */

import { join } from "path";

const ROOT = join(import.meta.dir, "..");

// Files that contain version numbers to sync
const VERSION_FILES = [
  {
    path: "plugins/requirements-tracker/package.json",
    type: "package.json" as const,
  },
  {
    path: "plugins/docs-skill/package.json",
    type: "package.json" as const,
  },
  {
    path: ".claude-plugin/marketplace.json",
    type: "marketplace" as const,
  },
];

type BumpType = "patch" | "minor" | "major";

function parseArgs(): { bumpType: BumpType; setVersion?: string } {
  const args = process.argv.slice(2);

  if (args.includes("--major")) {
    return { bumpType: "major" };
  }
  if (args.includes("--minor")) {
    return { bumpType: "minor" };
  }

  const setIndex = args.indexOf("--set");
  if (setIndex !== -1 && args[setIndex + 1]) {
    return { bumpType: "patch", setVersion: args[setIndex + 1] };
  }

  return { bumpType: "patch" };
}

function bumpVersion(current: string, type: BumpType): string {
  const parts = current.split(".").map((n) => parseInt(n, 10));

  switch (type) {
    case "major":
      return `${parts[0] + 1}.0.0`;
    case "minor":
      return `${parts[0]}.${parts[1] + 1}.0`;
    case "patch":
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

async function getCurrentVersion(): Promise<string> {
  // Read from first package.json as source of truth
  const firstFile = VERSION_FILES[0];
  const fullPath = join(ROOT, firstFile.path);
  const content = await Bun.file(fullPath).json();
  return content.version;
}

async function updateFile(
  filePath: string,
  type: "package.json" | "marketplace",
  newVersion: string
): Promise<void> {
  const fullPath = join(ROOT, filePath);
  const content = await Bun.file(fullPath).json();

  if (type === "package.json") {
    content.version = newVersion;
  } else if (type === "marketplace") {
    content.metadata.version = newVersion;
  }

  await Bun.write(fullPath, JSON.stringify(content, null, 2) + "\n");
}

async function main() {
  const { bumpType, setVersion } = parseArgs();
  const currentVersion = await getCurrentVersion();

  const newVersion = setVersion || bumpVersion(currentVersion, bumpType);

  console.log(`Bumping version: ${currentVersion} -> ${newVersion}`);

  for (const file of VERSION_FILES) {
    await updateFile(file.path, file.type, newVersion);
    console.log(`  Updated ${file.path}`);
  }

  console.log(`\nVersion bumped to ${newVersion}`);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
