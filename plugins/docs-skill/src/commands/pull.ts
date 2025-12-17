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
  loadAllDocs,
  writeDocToUserDir,
  getDocsDir,
} from "../lib/store";
import { getIncludedTopics, groupTopicsBySource } from "../lib/topic-matcher";

export async function pull(args: PullArgs): Promise<void> {
  const { cwd, force } = args;

  // Check if initialized
  if (!(await docsDirExists(cwd))) {
    console.error("Not initialized. Run 'docs init' first.");
    process.exit(1);
  }

  const config = await loadConfig(cwd);
  if (!config) {
    console.error("Failed to load config. Run 'docs init' to reinitialize.");
    process.exit(1);
  }

  if (config.topics.length === 0) {
    console.log("No topic patterns configured.");
    console.log("Add patterns with: docs config --add \"<pattern>\"");
    return;
  }

  // Load all docs from the plugin
  const allDocs = await loadAllDocs();

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
    return;
  }

  console.log(`Syncing ${includedTopics.size} topic(s)...\n`);

  // Clean existing doc files (keep config.yml)
  const docsDir = getDocsDir(cwd);
  for (const [source] of allDocs) {
    try {
      await rm(join(docsDir, source), { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  }

  // Write matching docs
  let writtenCount = 0;
  const bySource = new Map<string, number>();

  for (const [source, docs] of allDocs) {
    for (const doc of docs) {
      if (includedTopics.has(doc.frontmatter.topic)) {
        // Update path to include source prefix
        const docWithPath = {
          ...doc,
          path: join(source, doc.path),
        };
        await writeDocToUserDir(cwd, docWithPath);
        writtenCount++;

        // Track count by source
        const currentCount = bySource.get(source) ?? 0;
        bySource.set(source, currentCount + 1);
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
    console.log(`  ${source}/: ${count} files`);
  }

  console.log();
  console.log("Docs are now available in your .docs/ folder.");
}
