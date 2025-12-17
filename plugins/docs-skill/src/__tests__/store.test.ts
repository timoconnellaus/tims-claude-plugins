import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  getDocsDir,
  getConfigPath,
  docsDirExists,
  createDocsDir,
  loadConfig,
  saveConfig,
  createDefaultConfig,
  writeDocToUserDir,
  loadUserDocs,
} from "../lib/store";
import type { UserConfig, ParsedDoc } from "../lib/types";
import { DOCS_DIR, CONFIG_FILE } from "../lib/types";

describe("store", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "docs-skill-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("getDocsDir", () => {
    it("returns path to .docs directory", () => {
      const result = getDocsDir("/some/path");
      expect(result).toBe(`/some/path/${DOCS_DIR}`);
    });
  });

  describe("getConfigPath", () => {
    it("returns path to config.yml", () => {
      const result = getConfigPath("/some/path");
      expect(result).toBe(`/some/path/${DOCS_DIR}/${CONFIG_FILE}`);
    });
  });

  describe("docsDirExists", () => {
    it("returns false when .docs does not exist", async () => {
      const exists = await docsDirExists(tempDir);
      expect(exists).toBe(false);
    });

    it("returns true when .docs exists", async () => {
      await mkdir(join(tempDir, DOCS_DIR));
      const exists = await docsDirExists(tempDir);
      expect(exists).toBe(true);
    });
  });

  describe("createDocsDir", () => {
    it("creates .docs directory", async () => {
      await createDocsDir(tempDir);
      const exists = await docsDirExists(tempDir);
      expect(exists).toBe(true);
    });

    it("does not error if directory already exists", async () => {
      await createDocsDir(tempDir);
      await createDocsDir(tempDir); // Should not throw
      const exists = await docsDirExists(tempDir);
      expect(exists).toBe(true);
    });
  });

  describe("createDefaultConfig", () => {
    it("returns config with version 1", () => {
      const config = createDefaultConfig();
      expect(config.version).toBe(1);
    });

    it("returns config with empty topics array", () => {
      const config = createDefaultConfig();
      expect(config.topics).toEqual([]);
    });

    it("does not include lastSync by default", () => {
      const config = createDefaultConfig();
      expect(config.lastSync).toBeUndefined();
    });
  });

  describe("saveConfig and loadConfig", () => {
    it("saves and loads config", async () => {
      const config: UserConfig = {
        version: 1,
        topics: ["nextjs/**", "!nextjs/legacy/*"],
        lastSync: "2024-01-15T10:00:00Z",
      };

      await saveConfig(tempDir, config);
      const loaded = await loadConfig(tempDir);

      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe(1);
      expect(loaded?.topics).toEqual(["nextjs/**", "!nextjs/legacy/*"]);
      expect(loaded?.lastSync).toBe("2024-01-15T10:00:00Z");
    });

    it("creates .docs directory when saving", async () => {
      const config = createDefaultConfig();
      await saveConfig(tempDir, config);

      const exists = await docsDirExists(tempDir);
      expect(exists).toBe(true);
    });

    it("returns null when config does not exist", async () => {
      const config = await loadConfig(tempDir);
      expect(config).toBeNull();
    });

    it("ensures topics is an array when loading", async () => {
      // Write config with missing topics
      const docsDir = join(tempDir, DOCS_DIR);
      await mkdir(docsDir, { recursive: true });
      await writeFile(
        join(docsDir, CONFIG_FILE),
        "version: 1\n"
      );

      const config = await loadConfig(tempDir);
      expect(config?.topics).toEqual([]);
    });

    it("throws on unsupported config version", async () => {
      const docsDir = join(tempDir, DOCS_DIR);
      await mkdir(docsDir, { recursive: true });
      await writeFile(
        join(docsDir, CONFIG_FILE),
        "version: 999\ntopics: []\n"
      );

      const config = await loadConfig(tempDir);
      expect(config).toBeNull(); // Should return null due to error
    });
  });

  describe("writeDocToUserDir", () => {
    it("writes doc file with frontmatter", async () => {
      const doc: ParsedDoc = {
        path: "nextjs/routing.md",
        frontmatter: {
          topic: "nextjs/routing",
          title: "Routing",
        },
        content: "# Routing\n\nContent here",
        lineCount: 3,
      };

      await writeDocToUserDir(tempDir, doc);

      const filePath = join(tempDir, DOCS_DIR, "nextjs/routing.md");
      const content = await readFile(filePath, "utf-8");

      expect(content).toContain("---");
      expect(content).toContain("topic: nextjs/routing");
      expect(content).toContain("title: Routing");
      expect(content).toContain("# Routing");
    });

    it("creates nested directories", async () => {
      const doc: ParsedDoc = {
        path: "deep/nested/path/doc.md",
        frontmatter: {
          topic: "deep/nested/topic",
          title: "Deep Doc",
        },
        content: "Content",
        lineCount: 1,
      };

      await writeDocToUserDir(tempDir, doc);

      const filePath = join(tempDir, DOCS_DIR, "deep/nested/path/doc.md");
      const content = await readFile(filePath, "utf-8");

      expect(content).toContain("Deep Doc");
    });
  });

  describe("loadUserDocs", () => {
    it("returns empty array when no docs exist", async () => {
      await createDocsDir(tempDir);
      const docs = await loadUserDocs(tempDir);
      expect(docs).toEqual([]);
    });

    it("loads docs from .docs directory", async () => {
      // Write a doc
      const doc: ParsedDoc = {
        path: "test/doc.md",
        frontmatter: {
          topic: "test/doc",
          title: "Test Doc",
        },
        content: "Test content",
        lineCount: 1,
      };
      await writeDocToUserDir(tempDir, doc);

      const docs = await loadUserDocs(tempDir);

      expect(docs).toHaveLength(1);
      expect(docs[0].frontmatter.topic).toBe("test/doc");
      expect(docs[0].frontmatter.title).toBe("Test Doc");
    });

    it("loads multiple docs from nested directories", async () => {
      const docs: ParsedDoc[] = [
        {
          path: "a/doc1.md",
          frontmatter: { topic: "a/doc1", title: "Doc 1" },
          content: "Content 1",
          lineCount: 1,
        },
        {
          path: "b/doc2.md",
          frontmatter: { topic: "b/doc2", title: "Doc 2" },
          content: "Content 2",
          lineCount: 1,
        },
        {
          path: "b/c/doc3.md",
          frontmatter: { topic: "b/c/doc3", title: "Doc 3" },
          content: "Content 3",
          lineCount: 1,
        },
      ];

      for (const doc of docs) {
        await writeDocToUserDir(tempDir, doc);
      }

      const loaded = await loadUserDocs(tempDir);

      expect(loaded).toHaveLength(3);
    });

    it("skips invalid markdown files", async () => {
      // Write a valid doc
      const validDoc: ParsedDoc = {
        path: "valid.md",
        frontmatter: { topic: "valid", title: "Valid" },
        content: "Content",
        lineCount: 1,
      };
      await writeDocToUserDir(tempDir, validDoc);

      // Write an invalid doc (no frontmatter)
      const docsDir = join(tempDir, DOCS_DIR);
      await writeFile(
        join(docsDir, "invalid.md"),
        "# No frontmatter here"
      );

      const docs = await loadUserDocs(tempDir);

      expect(docs).toHaveLength(1);
      expect(docs[0].frontmatter.topic).toBe("valid");
    });
  });
});
