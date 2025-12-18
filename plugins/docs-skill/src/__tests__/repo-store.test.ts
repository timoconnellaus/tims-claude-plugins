import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { tmpdir, homedir } from "os";
import {
  getGlobalConfigDir,
  getRepositoriesPath,
  createDefaultRepositoriesFile,
  normalizeRepoPath,
  getRepoType,
  loadDocsFromRepo,
  getRepoDocsDir,
} from "../lib/repo-store";
import type { Repository } from "../lib/types";
import { GLOBAL_CONFIG_DIR, REPOSITORIES_FILE } from "../lib/types";

describe("repo-store", () => {
  describe("getGlobalConfigDir", () => {
    it("returns path in home directory", () => {
      const result = getGlobalConfigDir();
      expect(result).toBe(join(homedir(), GLOBAL_CONFIG_DIR));
    });
  });

  describe("getRepositoriesPath", () => {
    it("returns path to repositories.yml", () => {
      const result = getRepositoriesPath();
      expect(result).toBe(join(homedir(), GLOBAL_CONFIG_DIR, REPOSITORIES_FILE));
    });
  });

  describe("createDefaultRepositoriesFile", () => {
    it("returns version 1", () => {
      const config = createDefaultRepositoriesFile();
      expect(config.version).toBe(1);
    });

    it("returns empty repositories array", () => {
      const config = createDefaultRepositoriesFile();
      expect(config.repositories).toEqual([]);
    });
  });

  describe("normalizeRepoPath", () => {
    it("normalizes GitHub HTTPS URL", () => {
      const result = normalizeRepoPath("https://github.com/owner/repo");
      expect(result).toBe("github:owner/repo");
    });

    it("normalizes GitHub SSH URL", () => {
      const result = normalizeRepoPath("git@github.com:owner/repo.git");
      expect(result).toBe("github:owner/repo");
    });

    it("normalizes GitHub URL with .git suffix", () => {
      const result = normalizeRepoPath("https://github.com/owner/repo.git");
      expect(result).toBe("github:owner/repo");
    });

    it("resolves relative paths to absolute", () => {
      const result = normalizeRepoPath("./relative/path");
      expect(result).toBe(resolve("./relative/path"));
    });

    it("normalizes absolute paths", () => {
      const result = normalizeRepoPath("/absolute/path");
      expect(result).toBe("/absolute/path");
    });

    it("handles paths with trailing slashes", () => {
      const result = normalizeRepoPath("/path/to/repo/");
      // normalize removes trailing slash
      expect(result).toBe("/path/to/repo");
    });
  });

  describe("getRepoType", () => {
    it("returns github for GitHub HTTPS URLs", () => {
      expect(getRepoType("https://github.com/owner/repo")).toBe("github");
    });

    it("returns github for GitHub SSH URLs", () => {
      expect(getRepoType("git@github.com:owner/repo")).toBe("github");
    });

    it("returns github for normalized github: IDs", () => {
      expect(getRepoType("github:owner/repo")).toBe("github");
    });

    it("returns local for absolute filesystem paths", () => {
      expect(getRepoType("/path/to/repo")).toBe("local");
    });

    it("returns local for relative filesystem paths", () => {
      expect(getRepoType("./relative/path")).toBe("local");
    });
  });

  describe("getRepoDocsDir", () => {
    it("returns docs/ subdirectory for local repo by default", () => {
      const repo: Repository = {
        id: "/path/to/repo",
        type: "local",
        path: "/path/to/repo",
        addedAt: new Date().toISOString(),
      };

      const result = getRepoDocsDir(repo);
      expect(result).toBe("/path/to/repo/docs");
    });

    it("uses custom docsPath if provided", () => {
      const repo: Repository = {
        id: "/path/to/repo",
        type: "local",
        path: "/path/to/repo",
        addedAt: new Date().toISOString(),
        docsPath: "content",
      };

      const result = getRepoDocsDir(repo);
      expect(result).toBe("/path/to/repo/content");
    });

    it("returns cached path for github repos", () => {
      const repo: Repository = {
        id: "github:owner/repo",
        type: "github",
        path: "https://github.com/owner/repo",
        addedAt: new Date().toISOString(),
      };

      const result = getRepoDocsDir(repo);
      expect(result).toContain(GLOBAL_CONFIG_DIR);
      expect(result).toContain("cache");
      expect(result).toContain("github");
    });
  });

  describe("loadDocsFromRepo", () => {
    let tempRepoDir: string;

    beforeEach(async () => {
      tempRepoDir = await mkdtemp(join(tmpdir(), "test-repo-"));
      const docsDir = join(tempRepoDir, "docs");
      await mkdir(docsDir, { recursive: true });

      // Create a sample doc with valid frontmatter
      await writeFile(
        join(docsDir, "example.md"),
        `---
topic: example/topic
title: Example Document
description: An example document for testing
---

# Example

This is example content.
`
      );
    });

    afterEach(async () => {
      await rm(tempRepoDir, { recursive: true, force: true });
    });

    it("loads docs from local repository", async () => {
      const repo: Repository = {
        id: tempRepoDir,
        type: "local",
        path: tempRepoDir,
        addedAt: new Date().toISOString(),
      };

      const docs = await loadDocsFromRepo(repo);
      expect(docs).toHaveLength(1);
      expect(docs[0].frontmatter.topic).toBe("example/topic");
      expect(docs[0].frontmatter.title).toBe("Example Document");
    });

    it("respects custom docsPath", async () => {
      // Create custom docs folder
      const customDir = join(tempRepoDir, "content");
      await mkdir(customDir, { recursive: true });
      await writeFile(
        join(customDir, "custom.md"),
        `---
topic: custom/topic
title: Custom Document
---

Custom content.
`
      );

      const repo: Repository = {
        id: tempRepoDir,
        type: "local",
        path: tempRepoDir,
        addedAt: new Date().toISOString(),
        docsPath: "content",
      };

      const docs = await loadDocsFromRepo(repo);
      expect(docs).toHaveLength(1);
      expect(docs[0].frontmatter.topic).toBe("custom/topic");
    });

    it("loads multiple docs from subdirectories", async () => {
      const docsDir = join(tempRepoDir, "docs");
      const subDir = join(docsDir, "nested");
      await mkdir(subDir, { recursive: true });

      await writeFile(
        join(subDir, "nested-doc.md"),
        `---
topic: nested/doc
title: Nested Document
---

Nested content.
`
      );

      const repo: Repository = {
        id: tempRepoDir,
        type: "local",
        path: tempRepoDir,
        addedAt: new Date().toISOString(),
      };

      const docs = await loadDocsFromRepo(repo);
      expect(docs).toHaveLength(2);

      const topics = docs.map((d) => d.frontmatter.topic);
      expect(topics).toContain("example/topic");
      expect(topics).toContain("nested/doc");
    });

    it("skips files with invalid frontmatter", async () => {
      const docsDir = join(tempRepoDir, "docs");
      await writeFile(join(docsDir, "invalid.md"), "No frontmatter here");

      const repo: Repository = {
        id: tempRepoDir,
        type: "local",
        path: tempRepoDir,
        addedAt: new Date().toISOString(),
      };

      const docs = await loadDocsFromRepo(repo);
      // Should only contain the valid doc, not the invalid one
      expect(docs).toHaveLength(1);
      expect(docs[0].frontmatter.topic).toBe("example/topic");
    });

    it("returns empty array for github repos (not yet implemented)", async () => {
      const repo: Repository = {
        id: "github:owner/repo",
        type: "github",
        path: "https://github.com/owner/repo",
        addedAt: new Date().toISOString(),
      };

      const docs = await loadDocsFromRepo(repo);
      expect(docs).toEqual([]);
    });

    it("returns empty array if docs directory does not exist", async () => {
      const emptyRepoDir = await mkdtemp(join(tmpdir(), "empty-repo-"));

      const repo: Repository = {
        id: emptyRepoDir,
        type: "local",
        path: emptyRepoDir,
        addedAt: new Date().toISOString(),
      };

      const docs = await loadDocsFromRepo(repo);
      expect(docs).toEqual([]);

      await rm(emptyRepoDir, { recursive: true, force: true });
    });
  });
});
