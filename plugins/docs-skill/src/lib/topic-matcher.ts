/**
 * Gitignore-style topic pattern matching
 *
 * Pattern syntax:
 * - "nextjs/**" matches all topics under nextjs/
 * - "nextjs/*" matches direct children only
 * - "!nextjs/legacy/*" excludes topics matching the pattern
 * - "nextjs/routing" matches exact topic
 * - Order matters: later patterns override earlier ones
 */

import { minimatch } from "minimatch";
import type { TopicPattern, TopicMatch } from "./types";

/**
 * Check if a pattern is a negation (exclusion) pattern
 */
export function isNegationPattern(pattern: TopicPattern): boolean {
  return pattern.startsWith("!");
}

/**
 * Get the actual pattern without negation prefix
 */
export function getActualPattern(pattern: TopicPattern): string {
  return isNegationPattern(pattern) ? pattern.slice(1) : pattern;
}

/**
 * Check if a topic matches a single pattern (ignoring negation)
 */
export function matchesPattern(topic: string, pattern: string): boolean {
  // Handle exact match
  if (!pattern.includes("*")) {
    return topic === pattern || topic.startsWith(pattern + "/");
  }

  // Use minimatch for glob patterns
  return minimatch(topic, pattern, {
    dot: true,
    matchBase: false,
  });
}

/**
 * Match a single topic against a list of patterns
 * Returns the match result with the pattern that determined inclusion/exclusion
 */
export function matchTopic(
  topic: string,
  patterns: TopicPattern[]
): TopicMatch {
  let included = false;
  let matchedPattern: string | undefined;

  for (const pattern of patterns) {
    const isNegation = isNegationPattern(pattern);
    const actualPattern = getActualPattern(pattern);

    if (matchesPattern(topic, actualPattern)) {
      included = !isNegation;
      matchedPattern = pattern;
    }
  }

  return { topic, included, matchedPattern };
}

/**
 * Match multiple topics against patterns
 */
export function matchTopics(
  topics: string[],
  patterns: TopicPattern[]
): TopicMatch[] {
  return topics.map((topic) => matchTopic(topic, patterns));
}

/**
 * Get all topics that should be included based on patterns
 */
export function getIncludedTopics(
  topics: string[],
  patterns: TopicPattern[]
): string[] {
  return matchTopics(topics, patterns)
    .filter((m) => m.included)
    .map((m) => m.topic);
}

/**
 * Get all topics that are excluded based on patterns
 */
export function getExcludedTopics(
  topics: string[],
  patterns: TopicPattern[]
): string[] {
  return matchTopics(topics, patterns)
    .filter((m) => !m.included)
    .map((m) => m.topic);
}

/**
 * Validate a pattern syntax
 */
export function isValidPattern(pattern: TopicPattern): boolean {
  const actual = getActualPattern(pattern);

  // Must not be empty
  if (!actual) return false;

  // Must not have consecutive **
  if (actual.includes("***")) return false;

  // Must not start or end with /
  if (actual.startsWith("/") || actual.endsWith("/")) return false;

  // Must only contain valid characters
  if (!/^[a-z0-9*/-]+$/.test(actual)) return false;

  return true;
}

/**
 * Group topics by their top-level prefix (source)
 */
export function groupTopicsBySource(
  topics: string[]
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const topic of topics) {
    const source = topic.split("/")[0];
    const existing = groups.get(source) ?? [];
    existing.push(topic);
    groups.set(source, existing);
  }

  return groups;
}

/**
 * Get the source (top-level prefix) from a topic
 */
export function getSourceFromTopic(topic: string): string {
  return topic.split("/")[0];
}

/**
 * Format a list of patterns for display
 */
export function formatPatterns(patterns: TopicPattern[]): string {
  if (patterns.length === 0) {
    return "No patterns configured";
  }

  const lines: string[] = [];
  for (const pattern of patterns) {
    const prefix = isNegationPattern(pattern) ? "EXCLUDE" : "INCLUDE";
    lines.push(`  ${prefix}: ${pattern}`);
  }

  return lines.join("\n");
}

/**
 * Explain why a topic was included or excluded
 */
export function explainMatch(match: TopicMatch): string {
  if (!match.matchedPattern) {
    return `${match.topic}: excluded (no matching pattern)`;
  }

  const action = match.included ? "included" : "excluded";
  return `${match.topic}: ${action} by pattern "${match.matchedPattern}"`;
}
