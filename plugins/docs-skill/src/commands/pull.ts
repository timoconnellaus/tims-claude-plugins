/**
 * pull command - Sync configured docs to .docs folder
 */

import { rm } from "fs/promises";
import { join } from "path";
import type { PullArgs } from "../lib/types";
import {
  loadConfig,
  saveConfig,
  docsDirExists,
  writeDocToUserDir,
  getDocsDir,
} from "../lib/store";
import { loadAllRepoDocs, listRepositories } from "../lib/repo-store";
import { getIncludedTopics } from "../lib/topic-matcher";

export interface PullResult {
  success: boolean;
  error?: string;
  writtenCount?: number;
  bySource?: Map<string, number>;
}

export async function pull(args: PullArgs): Promise<PullResult> {
  const { cwd, force } = args;

  // Check if initialized
  if (!(await docsDirExists(cwd))) {
    const error = "Not initialized. Run 'docs init' first.";
    console.error(error);
    return { success: false, error };
  }

  const config = await loadConfig(cwd);
  if (!config) {
    const error = "Failed to load config. Run 'docs init' to reinitialize.";
    console.error(error);
    return { success: false, error };
  }

  if (config.topics.length === 0) {
    console.log("No topic patterns configured.");
    console.log("Add patterns with: docs config --add \"<pattern>\"");
    return { success: true, writtenCount: 0 };
  }

  // Load all docs from registered repositories
  const allDocs = await loadAllRepoDocs();

  if (allDocs.size === 0) {
    const error = "No repositories registered. Add repositories first.";
    console.error(error);
    return { success: false, error };
  }

  // Get all topics
  const allTopics: string[] = [];
  for (const docs of allDocs.values()) {
    for (const doc of docs) {
      allTopics.push(doc.frontmatter.topic);
    }
  }

  // Filter to included topics
  const includedTopics = new Set(getIncludedTopics(allTopics, config.topics));

  if (includedTopics.size === 0) {
    console.log("No topics matched your patterns.");
    console.log("Run 'docs check' to see what your patterns select.");
    return { success: true, writtenCount: 0 };
  }

  console.log(`Syncing ${includedTopics.size} topic(s)...\n`);

  // Clean existing doc files (keep config.yml)
  const docsDir = getDocsDir(cwd);
  const repos = await listRepositories();
  for (const repo of repos) {
    // Use a safe folder name for the repo
    const folderName = repo.id.replace(/[/:]/g, "_");
    try {
      await rm(join(docsDir, folderName), { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  }

  // Write matching docs
  let writtenCount = 0;
  const bySource = new Map<string, number>();

  for (const [repoId, docs] of allDocs) {
    // Use a safe folder name for the repo
    const folderName = repoId.replace(/[/:]/g, "_");

    for (const doc of docs) {
      if (includedTopics.has(doc.frontmatter.topic)) {
        // Update path to include source prefix
        const docWithPath = {
          ...doc,
          path: join(folderName, doc.path),
        };
        await writeDocToUserDir(cwd, docWithPath);
        writtenCount++;

        // Track count by source
        const currentCount = bySource.get(repoId) ?? 0;
        bySource.set(repoId, currentCount + 1);
      }
    }
  }

  // Update lastSync
  config.lastSync = new Date().toISOString();
  await saveConfig(cwd, config);

  // Summary
  console.log("Sync complete!\n");
  console.log(`Written ${writtenCount} document(s) to ${docsDir}/`);

  for (const [source, count] of bySource) {
    console.log(`  ${source}: ${count} files`);
  }

  console.log();
  console.log("Docs are now available in your .docs/ folder.");

  return { success: true, writtenCount, bySource };
}
