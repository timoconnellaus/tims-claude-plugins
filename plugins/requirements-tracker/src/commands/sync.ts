/**
 * Sync issues from Linear to local cache (Linear mode only)
 */

import {
  loadConfig,
  loadCache,
  saveCache,
  getApiKey,
  isLocalMode,
} from "../lib/store";
import { getIssues, getAllTestLinks } from "../lib/linear";
import type { LocalCache } from "../lib/types";

export async function sync(args: {
  cwd: string;
  quiet?: boolean;
}): Promise<void> {
  const { cwd, quiet } = args;

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    console.error("Not initialized. Run 'req init' first.");
    process.exit(1);
  }

  // Local mode doesn't need sync
  if (isLocalMode(config)) {
    if (!quiet) {
      console.log("Local mode - no sync needed.");
      console.log("Requirements are stored locally. Use 'req add' to create new requirements.");
    }
    return;
  }

  // Get API key
  const apiKey = getApiKey(config);
  if (!apiKey) {
    console.error("No API key found. Set LINEAR_API_KEY or run 'req init'.");
    process.exit(1);
  }

  if (!config.teamId || !config.teamKey) {
    console.error("Invalid config: missing teamId or teamKey. Run 'req init --force' to reconfigure.");
    process.exit(1);
  }

  if (!quiet) {
    console.log(`Syncing issues from Linear (${config.teamKey})...`);
  }

  // Fetch issues
  const issues = await getIssues(apiKey, config.teamId, {
    projectId: config.projectId,
    states: config.filters?.states,
    labels: config.filters?.labels,
  });

  if (!quiet) {
    console.log(`Fetched ${issues.length} issues.`);
  }

  // Load existing cache to preserve test links that might not be in Linear yet
  const existingCache = await loadCache(cwd);
  const existingTestLinks = existingCache?.testLinks ?? [];

  // Fetch test links from Linear comments
  if (!quiet) {
    console.log("Fetching test links from comments...");
  }
  const testLinks = await getAllTestLinks(apiKey, issues);

  // Merge: keep local test links for issues that exist, add new ones from Linear
  const issueIds = new Set(issues.map((i) => i.id));
  const mergedTestLinks = [
    ...testLinks,
    // Keep local links for issues that still exist but weren't found in Linear comments
    ...existingTestLinks.filter(
      (local) =>
        issueIds.has(local.issueId) &&
        !testLinks.some((remote) => remote.issueId === local.issueId)
    ),
  ];

  // Create cache
  const cache: LocalCache = {
    mode: "linear",
    teamId: config.teamId,
    teamKey: config.teamKey,
    lastSync: new Date().toISOString(),
    issues,
    testLinks: mergedTestLinks,
  };

  await saveCache(cwd, cache);

  if (!quiet) {
    const withTests = mergedTestLinks.length;
    console.log(`\nSync complete:`);
    console.log(`  Issues: ${issues.length}`);
    console.log(`  With test links: ${withTests}`);
    console.log(`  Without test links: ${issues.length - withTests}`);
  }
}
