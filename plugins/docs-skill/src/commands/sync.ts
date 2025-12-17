/**
 * sync command - Build docs from external sources
 */

import { join } from "path";
import { writeFile, mkdir } from "fs/promises";
import { stringify as stringifyYaml } from "yaml";
import type { SyncArgs, SyncDocsContract, SyncOutput } from "../lib/types";
import { listDocSources, getDocSourceDir } from "../lib/store";

export async function sync(args: SyncArgs): Promise<void> {
  const { source } = args;

  if (source) {
    // Sync specific source
    const sources = await listDocSources();
    if (!sources.includes(source)) {
      console.error(`Unknown source: ${source}`);
      console.error(`Available sources: ${sources.join(", ") || "none"}`);
      process.exit(1);
    }

    await syncSource(source);
  } else {
    // Sync all sources
    const sources = await listDocSources();

    if (sources.length === 0) {
      console.log("No documentation sources found.");
      console.log("Create a folder in docs/ with a sync-docs.ts file to get started.");
      return;
    }

    console.log(`Syncing ${sources.length} source(s)...\n`);

    for (const src of sources) {
      await syncSource(src);
      console.log();
    }

    console.log("Done!");
  }
}

async function syncSource(source: string): Promise<void> {
  console.log(`Syncing ${source}...`);

  const sourceDir = getDocSourceDir(source);
  const syncDocsPath = join(sourceDir, "sync-docs.ts");

  // Import the sync-docs.ts module
  let syncModule: { default: SyncDocsContract };
  try {
    syncModule = await import(syncDocsPath);
  } catch (e) {
    console.error(`  Error: Could not load sync-docs.ts for ${source}`);
    if (e instanceof Error) {
      console.error(`  ${e.message}`);
    }
    process.exit(1);
  }

  const contract = syncModule.default;

  if (!contract || typeof contract.sync !== "function") {
    console.error(`  Error: sync-docs.ts must export a default object with sync() method`);
    process.exit(1);
  }

  console.log(`  Source: ${contract.name}`);
  console.log(`  Topic prefix: ${contract.topicPrefix}`);

  // Run the sync
  let outputs: SyncOutput[];
  try {
    outputs = await contract.sync();
  } catch (e) {
    console.error(`  Error during sync:`);
    if (e instanceof Error) {
      console.error(`  ${e.message}`);
    }
    process.exit(1);
  }

  console.log(`  Generated ${outputs.length} document(s)`);

  // Write the outputs
  for (const output of outputs) {
    const filePath = join(sourceDir, output.path);
    const fileDir = join(filePath, "..");

    await mkdir(fileDir, { recursive: true });

    // Build the markdown file with frontmatter
    const frontmatterYaml = stringifyYaml(output.frontmatter);
    const content = `---\n${frontmatterYaml}---\n\n${output.content}`;

    await writeFile(filePath, content);
  }

  console.log(`  Written to ${sourceDir}`);
}
