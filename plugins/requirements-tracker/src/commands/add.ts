/**
 * Add a new local requirement (local mode only)
 */

import {
  loadConfig,
  loadCache,
  saveConfig,
  saveCache,
  generateLocalId,
  isLocalMode,
} from "../lib/store";
import type { LocalIssue } from "../lib/types";

export async function add(args: {
  cwd: string;
  title: string;
  description?: string;
  priority?: number;
  labels?: string[];
}): Promise<void> {
  const { cwd, title, description, priority = 0, labels = [] } = args;

  const config = await loadConfig(cwd);
  if (!config) {
    console.error("Not initialized. Run 'req init' first.");
    process.exit(1);
  }

  if (!isLocalMode(config)) {
    console.error("'add' command is only available in local mode.");
    console.error("In Linear mode, create issues in Linear and run 'req sync'.");
    process.exit(1);
  }

  // Load or create cache
  let cache = await loadCache(cwd);
  if (!cache) {
    cache = {
      mode: "local",
      lastSync: new Date().toISOString(),
      issues: [],
      testLinks: [],
    };
  }

  // Generate ID
  const { id, identifier } = generateLocalId(config);

  // Create issue
  const now = new Date().toISOString();
  const issue: LocalIssue = {
    id,
    identifier,
    title,
    description,
    state: { name: "Todo", type: "unstarted" },
    priority,
    labels,
    createdAt: now,
    updatedAt: now,
  };

  // Add to cache
  (cache.issues as LocalIssue[]).push(issue);
  cache.lastSync = now;
  await saveCache(cwd, cache);

  // Increment next ID
  config.nextId = (config.nextId || 1) + 1;
  await saveConfig(cwd, config);

  console.log(`Created: ${identifier} - ${title}`);
}
