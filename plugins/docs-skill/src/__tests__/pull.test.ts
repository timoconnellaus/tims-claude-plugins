import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  saveConfig,
  createDocsDir,
  loadUserDocs,
  writeDocToUserDir,
} from "../lib/store";
import { getIncludedTopics } from "../lib/topic-matcher";
import type { UserConfig, ParsedDoc } from "../lib/types";

/**
 * Integration test for the docs pull command flow.
 *
 * These tests verify that the pull command correctly:
 * 1. Reads topic patterns from config
 * 2. Filters docs using getIncludedTopics
 * 3. Writes only matching docs to the .docs folder
 *
 * We test this by simulating the core pull logic:
 * - Load config with topic patterns
 * - Get all available docs (mocked as test data)
 * - Filter using getIncludedTopics
 * - Write matching docs using writeDocToUserDir
 * - Verify with loadUserDocs
 */
describe("pull command integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "docs-skill-pull-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Simulates the core pull command logic for testing.
   * This mirrors what pull.ts does but with injectable docs.
   */
  async function simulatePull(
    cwd: string,
    config: UserConfig,
    allDocs: Map<string, ParsedDoc[]>
  ): Promise<void> {
    // Get all topics from docs
    const allTopics: string[] = [];
    for (const docs of allDocs.values()) {
      for (const doc of docs) {
        allTopics.push(doc.frontmatter.topic);
      }
    }

    // Filter to included topics (this is the key logic we're testing)
    const includedTopics = new Set(getIncludedTopics(allTopics, config.topics));

    // Write matching docs
    for (const [source, docs] of allDocs) {
      for (const doc of docs) {
        if (includedTopics.has(doc.frontmatter.topic)) {
          // Update path to include source prefix (as pull.ts does)
          const docWithPath = {
            ...doc,
            path: join(source, doc.path),
          };
          await writeDocToUserDir(cwd, docWithPath);
        }
      }
    }

    // Update lastSync
    config.lastSync = new Date().toISOString();
    await saveConfig(cwd, config);
  }

  it("only syncs docs matching configured topic patterns", async () => {
    // Setup: create .docs with config containing topic patterns
    await createDocsDir(tempDir);
    const config: UserConfig = {
      version: 1,
      topics: ["nextjs/**"],
    };
    await saveConfig(tempDir, config);

    // Simulate available docs from multiple sources
    const allDocs = new Map<string, ParsedDoc[]>([
      [
        "nextjs",
        [
          {
            path: "routing.md",
            frontmatter: { topic: "nextjs/routing", title: "Routing" },
            content: "# Routing\nNext.js routing content",
            lineCount: 2,
          },
          {
            path: "api/routes.md",
            frontmatter: { topic: "nextjs/api/routes", title: "API Routes" },
            content: "# API Routes\nAPI routes content",
            lineCount: 2,
          },
        ],
      ],
      [
        "react",
        [
          {
            path: "hooks.md",
            frontmatter: { topic: "react/hooks", title: "Hooks" },
            content: "# Hooks\nReact hooks content",
            lineCount: 2,
          },
        ],
      ],
    ]);

    // Run the pull simulation
    await simulatePull(tempDir, config, allDocs);

    // Verify only nextjs docs were written
    const syncedDocs = await loadUserDocs(tempDir);
    const syncedTopics = syncedDocs.map((d) => d.frontmatter.topic);

    // Should include nextjs docs
    expect(syncedTopics).toContain("nextjs/routing");
    expect(syncedTopics).toContain("nextjs/api/routes");

    // Should NOT include react docs
    expect(syncedTopics).not.toContain("react/hooks");

    // Verify exact count
    expect(syncedDocs).toHaveLength(2);
  });

  it("respects exclusion patterns when syncing docs", async () => {
    // Setup: create .docs with config containing inclusion and exclusion patterns
    await createDocsDir(tempDir);
    const config: UserConfig = {
      version: 1,
      topics: ["nextjs/**", "!nextjs/legacy/*"],
    };
    await saveConfig(tempDir, config);

    // Simulate available docs including some that should be excluded
    const allDocs = new Map<string, ParsedDoc[]>([
      [
        "nextjs",
        [
          {
            path: "routing.md",
            frontmatter: { topic: "nextjs/routing", title: "Routing" },
            content: "# Routing\nNext.js routing content",
            lineCount: 2,
          },
          {
            path: "legacy/old-api.md",
            frontmatter: { topic: "nextjs/legacy/old-api", title: "Old API" },
            content: "# Old API\nLegacy content",
            lineCount: 2,
          },
          {
            path: "api/routes.md",
            frontmatter: { topic: "nextjs/api/routes", title: "API Routes" },
            content: "# API Routes\nAPI routes content",
            lineCount: 2,
          },
        ],
      ],
    ]);

    // Run the pull simulation
    await simulatePull(tempDir, config, allDocs);

    // Verify docs were filtered correctly
    const syncedDocs = await loadUserDocs(tempDir);
    const syncedTopics = syncedDocs.map((d) => d.frontmatter.topic);

    // Should include non-legacy nextjs docs
    expect(syncedTopics).toContain("nextjs/routing");
    expect(syncedTopics).toContain("nextjs/api/routes");

    // Should NOT include legacy docs (excluded by pattern)
    expect(syncedTopics).not.toContain("nextjs/legacy/old-api");

    // Verify exact count
    expect(syncedDocs).toHaveLength(2);
  });
});
