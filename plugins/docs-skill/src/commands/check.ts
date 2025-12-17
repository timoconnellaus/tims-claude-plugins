/**
 * check command - Validate config against available docs
 */

import type { CheckArgs } from "../lib/types";
import { loadConfig, docsDirExists, getAllTopics } from "../lib/store";
import {
  matchTopics,
  getIncludedTopics,
  isNegationPattern,
  getActualPattern,
  matchesPattern,
  groupTopicsBySource,
} from "../lib/topic-matcher";

export async function check(args: CheckArgs): Promise<void> {
  const { cwd } = args;

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

  // Get all available topics
  const allTopics = await getAllTopics();

  if (allTopics.length === 0) {
    console.log("No documentation available in the plugin.");
    console.log("Run 'docs sync' to build docs from sources.");
    return;
  }

  console.log("Checking config against available docs...\n");

  // Check each pattern
  let hasIssues = false;

  for (const pattern of config.topics) {
    const isNegation = isNegationPattern(pattern);
    const actual = getActualPattern(pattern);

    // Find topics that match this pattern
    const matchingTopics = allTopics.filter((t) => matchesPattern(t, actual));

    if (matchingTopics.length === 0) {
      console.log(`WARNING: Pattern "${pattern}" matches no topics`);
      hasIssues = true;
    } else {
      const action = isNegation ? "excludes" : "includes";
      console.log(`Pattern "${pattern}" ${action} ${matchingTopics.length} topic(s)`);
    }
  }

  console.log();

  // Show final selection
  const included = getIncludedTopics(allTopics, config.topics);
  const bySource = groupTopicsBySource(included);

  console.log(`Selected ${included.length} of ${allTopics.length} available topics:\n`);

  for (const [source, topics] of bySource) {
    console.log(`${source}/ (${topics.length} topics)`);
    // Show first few topics
    const preview = topics.slice(0, 5);
    for (const topic of preview) {
      console.log(`  - ${topic}`);
    }
    if (topics.length > 5) {
      console.log(`  ... and ${topics.length - 5} more`);
    }
  }

  if (included.length === 0) {
    console.log("No topics selected. Check your patterns.");
    hasIssues = true;
  }

  if (hasIssues) {
    console.log();
    console.log("Some patterns may need adjustment.");
  } else {
    console.log();
    console.log("Config looks good! Run 'docs pull' to sync docs.");
  }
}
