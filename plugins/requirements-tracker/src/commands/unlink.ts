/**
 * Unlink a test from an issue (works in both local and Linear mode)
 */

import {
  loadConfig,
  loadCache,
  saveCache,
  getApiKey,
  isLocalMode,
} from "../lib/store";
import {
  findTestLinkComment,
  updateComment,
  deleteComment,
  generateTestLinkComment,
} from "../lib/linear";

export async function unlink(args: {
  cwd: string;
  issueIdentifier: string;  // e.g., "ENG-123" or "REQ-001"
  testSpec: string;         // e.g., "src/auth.test.ts:login flow"
}): Promise<void> {
  const { cwd, issueIdentifier, testSpec } = args;

  // Parse test spec
  const colonIndex = testSpec.indexOf(":");
  if (colonIndex === -1) {
    console.error("Invalid test spec. Use format: file:identifier");
    process.exit(1);
  }

  const file = testSpec.slice(0, colonIndex);
  const identifier = testSpec.slice(colonIndex + 1);

  // Load config and cache
  const config = await loadConfig(cwd);
  if (!config) {
    console.error("Not initialized. Run 'req init' first.");
    process.exit(1);
  }

  const cache = await loadCache(cwd);
  if (!cache) {
    const hint = isLocalMode(config) ? "Run 'req add' to create requirements." : "Run 'req sync' first.";
    console.error(`No cache found. ${hint}`);
    process.exit(1);
  }

  // Find issue in cache
  const issue = cache.issues.find(
    (i) => i.identifier.toLowerCase() === issueIdentifier.toLowerCase()
  );
  if (!issue) {
    const hint = isLocalMode(config) ? "Run 'req list' to see available requirements." : "Run 'req sync' to refresh from Linear.";
    console.error(`Issue ${issueIdentifier} not found. ${hint}`);
    process.exit(1);
  }

  // LOCAL MODE: Just update the cache
  if (isLocalMode(config)) {
    const issueLinks = cache.testLinks.find((l) => l.issueId === issue.id);
    if (!issueLinks || issueLinks.tests.length === 0) {
      console.log("No test links found for this issue.");
      return;
    }

    const testIndex = issueLinks.tests.findIndex(
      (t) => t.file === file && t.identifier === identifier
    );

    if (testIndex === -1) {
      console.log("Test is not linked to this issue.");
      return;
    }

    // Remove the test
    issueLinks.tests.splice(testIndex, 1);

    // Remove entry if no tests left
    if (issueLinks.tests.length === 0) {
      cache.testLinks = cache.testLinks.filter((l) => l.issueId !== issue.id);
    }

    await saveCache(cwd, cache);

    console.log(`Unlinked: ${file}:${identifier}`);
    console.log(`Issue now has ${issueLinks.tests.length} test(s) linked.`);
    return;
  }

  // LINEAR MODE: Update Linear comment and cache
  const apiKey = getApiKey(config);
  if (!apiKey) {
    console.error("No API key found. Set LINEAR_API_KEY or run 'req init'.");
    process.exit(1);
  }

  // Find existing test link comment
  console.log(`Unlinking test from ${issue.identifier}...`);
  const existing = await findTestLinkComment(apiKey, issue.id);

  if (!existing) {
    console.log("No test links found for this issue.");
    return;
  }

  // Find the test to remove
  const testIndex = existing.tests.findIndex(
    (t) => t.file === file && t.identifier === identifier
  );

  if (testIndex === -1) {
    console.log("Test is not linked to this issue.");
    return;
  }

  // Remove the test
  const updatedTests = existing.tests.filter((_, i) => i !== testIndex);

  if (updatedTests.length === 0) {
    // Delete the comment entirely
    await deleteComment(apiKey, existing.commentId);

    // Update cache
    cache.testLinks = cache.testLinks.filter((l) => l.issueId !== issue.id);
  } else {
    // Update the comment
    const body = generateTestLinkComment(updatedTests);
    await updateComment(apiKey, existing.commentId, body);

    // Update cache
    const cacheEntry = cache.testLinks.find((l) => l.issueId === issue.id);
    if (cacheEntry) {
      cacheEntry.tests = updatedTests;
    }
  }

  await saveCache(cwd, cache);

  console.log(`Unlinked: ${file}:${identifier}`);
  console.log(`Issue now has ${updatedTests.length} test(s) linked.`);
}
