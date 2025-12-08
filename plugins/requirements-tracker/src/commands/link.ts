/**
 * Link a test to an issue (works in both local and Linear mode)
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
  createComment,
  updateComment,
  generateTestLinkComment,
} from "../lib/linear";
import type { TestLink } from "../lib/types";

export async function link(args: {
  cwd: string;
  issueIdentifier: string;  // e.g., "ENG-123" or "REQ-001"
  testSpec: string;         // e.g., "src/auth.test.ts:login flow"
  by?: string;
}): Promise<void> {
  const { cwd, issueIdentifier, testSpec, by } = args;

  // Parse test spec
  const colonIndex = testSpec.indexOf(":");
  if (colonIndex === -1) {
    console.error("Invalid test spec. Use format: file:identifier");
    console.error("Example: src/auth.test.ts:validates login");
    process.exit(1);
  }

  const file = testSpec.slice(0, colonIndex);
  const identifier = testSpec.slice(colonIndex + 1);

  if (!file || !identifier) {
    console.error("Invalid test spec. Both file and identifier are required.");
    process.exit(1);
  }

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

  // Create new test link
  const newLink: TestLink = {
    file,
    identifier,
    linkedAt: new Date().toISOString(),
    linkedBy: by,
  };

  // LOCAL MODE: Just update the cache
  if (isLocalMode(config)) {
    // Find or create test links entry
    let issueLinks = cache.testLinks.find((l) => l.issueId === issue.id);
    if (!issueLinks) {
      issueLinks = {
        issueId: issue.id,
        identifier: issue.identifier,
        tests: [],
      };
      cache.testLinks.push(issueLinks);
    }

    // Check for duplicate
    if (issueLinks.tests.some((t) => t.file === file && t.identifier === identifier)) {
      console.log("Test is already linked to this issue.");
      return;
    }

    // Add link
    issueLinks.tests.push(newLink);
    await saveCache(cwd, cache);

    console.log(`Linked: ${file}:${identifier}`);
    console.log(`Issue now has ${issueLinks.tests.length} test(s) linked.`);
    return;
  }

  // LINEAR MODE: Update Linear comment and cache
  const apiKey = getApiKey(config);
  if (!apiKey) {
    console.error("No API key found. Set LINEAR_API_KEY or run 'req init'.");
    process.exit(1);
  }

  // Check for existing test link comment
  console.log(`Linking test to ${issue.identifier}...`);
  const existing = await findTestLinkComment(apiKey, issue.id);

  let tests: TestLink[];
  let commentId: string;

  if (existing) {
    // Check if already linked
    const alreadyLinked = existing.tests.some(
      (t) => t.file === file && t.identifier === identifier
    );
    if (alreadyLinked) {
      console.log("Test is already linked to this issue.");
      return;
    }

    // Add to existing tests
    tests = [...existing.tests, newLink];
    const body = generateTestLinkComment(tests);
    await updateComment(apiKey, existing.commentId, body);
    commentId = existing.commentId;
  } else {
    // Create new comment
    tests = [newLink];
    const body = generateTestLinkComment(tests);
    commentId = await createComment(apiKey, issue.id, body);
  }

  // Update local cache
  const existingLinks = cache.testLinks.find((l) => l.issueId === issue.id);
  if (existingLinks) {
    existingLinks.tests = tests;
    existingLinks.commentId = commentId;
  } else {
    cache.testLinks.push({
      issueId: issue.id,
      identifier: issue.identifier,
      tests,
      commentId,
    });
  }
  await saveCache(cwd, cache);

  console.log(`Linked: ${file}:${identifier}`);
  console.log(`Issue now has ${tests.length} test(s) linked.`);
}
