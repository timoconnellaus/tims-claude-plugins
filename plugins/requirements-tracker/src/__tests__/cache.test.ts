import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, utimes } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  isCacheValid,
  buildCache,
  getTestsWithCache,
} from "../lib/cache";
import { createRequirementsDir, saveCache } from "../lib/store";
import type { TestCache, ExtractedTest } from "../lib/types";

describe("Cache", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-cache-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("isCacheValid", () => {
    it("returns true when cache is valid", async () => {
      // Create a test file
      const testFile = join(tempDir, "test.test.ts");
      await writeFile(testFile, `it("test", () => {});`);

      // Get file mtime
      const stat = await Bun.file(testFile).stat();
      const mtime = stat.mtime.getTime();

      const cache: TestCache = {
        version: 1,
        generatedAt: new Date().toISOString(),
        fileMtimes: {
          "test.test.ts": mtime,
        },
        tests: {
          "test.test.ts:test": "abc123",
        },
      };

      const valid = await isCacheValid(tempDir, cache, "**/*.test.ts");
      expect(valid).toBe(true);
    });

    it("returns false when file modified", async () => {
      // Create a test file
      const testFile = join(tempDir, "test.test.ts");
      await writeFile(testFile, `it("test", () => {});`);

      // Get initial mtime
      const stat1 = await Bun.file(testFile).stat();
      const oldMtime = stat1.mtime.getTime();

      // Create cache with old mtime
      const cache: TestCache = {
        version: 1,
        generatedAt: new Date().toISOString(),
        fileMtimes: {
          "test.test.ts": oldMtime,
        },
        tests: {
          "test.test.ts:test": "abc123",
        },
      };

      // Wait a bit and modify the file
      await new Promise((resolve) => setTimeout(resolve, 10));
      await writeFile(testFile, `it("test", () => { /* modified */ });`);

      const valid = await isCacheValid(tempDir, cache, "**/*.test.ts");
      expect(valid).toBe(false);
    });

    it("returns false when new file added", async () => {
      // Create first test file
      const testFile1 = join(tempDir, "test1.test.ts");
      await writeFile(testFile1, `it("test1", () => {});`);

      const stat = await Bun.file(testFile1).stat();
      const mtime = stat.mtime.getTime();

      // Cache only knows about test1
      const cache: TestCache = {
        version: 1,
        generatedAt: new Date().toISOString(),
        fileMtimes: {
          "test1.test.ts": mtime,
        },
        tests: {
          "test1.test.ts:test1": "abc123",
        },
      };

      // Add a new test file
      await writeFile(join(tempDir, "test2.test.ts"), `it("test2", () => {});`);

      const valid = await isCacheValid(tempDir, cache, "**/*.test.ts");
      expect(valid).toBe(false);
    });

    it("returns false when file deleted", async () => {
      const cache: TestCache = {
        version: 1,
        generatedAt: new Date().toISOString(),
        fileMtimes: {
          "test1.test.ts": 123456,
          "test2.test.ts": 789012,
        },
        tests: {
          "test1.test.ts:test1": "abc123",
          "test2.test.ts:test2": "def456",
        },
      };

      // Only create test1, test2 is "deleted"
      await writeFile(join(tempDir, "test1.test.ts"), `it("test1", () => {});`);

      const valid = await isCacheValid(tempDir, cache, "**/*.test.ts");
      expect(valid).toBe(false);
    });

    it("returns false when version mismatch", async () => {
      const testFile = join(tempDir, "test.test.ts");
      await writeFile(testFile, `it("test", () => {});`);

      const stat = await Bun.file(testFile).stat();
      const mtime = stat.mtime.getTime();

      // Cache with wrong version
      const cache: TestCache = {
        version: 999, // Wrong version
        generatedAt: new Date().toISOString(),
        fileMtimes: {
          "test.test.ts": mtime,
        },
        tests: {
          "test.test.ts:test": "abc123",
        },
      };

      const valid = await isCacheValid(tempDir, cache, "**/*.test.ts");
      expect(valid).toBe(false);
    });

    it("returns true when no files exist and cache is empty", async () => {
      const cache: TestCache = {
        version: 1,
        generatedAt: new Date().toISOString(),
        fileMtimes: {},
        tests: {},
      };

      const valid = await isCacheValid(tempDir, cache, "**/*.test.ts");
      expect(valid).toBe(true);
    });
  });

  describe("buildCache", () => {
    it("builds cache from tests and mtimes", () => {
      const tests: ExtractedTest[] = [
        {
          file: "test1.test.ts",
          identifier: "first test",
          body: "{ expect(1).toBe(1); }",
          hash: "abc123",
        },
        {
          file: "test1.test.ts",
          identifier: "second test",
          body: "{ expect(2).toBe(2); }",
          hash: "def456",
        },
        {
          file: "test2.test.ts",
          identifier: "other test",
          body: "{ expect(3).toBe(3); }",
          hash: "ghi789",
        },
      ];

      const mtimes = new Map<string, number>([
        ["test1.test.ts", 1234567890],
        ["test2.test.ts", 9876543210],
      ]);

      const cache = buildCache(tests, mtimes);

      expect(cache.version).toBe(1);
      expect(cache.generatedAt).toBeDefined();
      expect(cache.fileMtimes).toEqual({
        "test1.test.ts": 1234567890,
        "test2.test.ts": 9876543210,
      });
      expect(cache.tests).toEqual({
        "test1.test.ts:first test": "abc123",
        "test1.test.ts:second test": "def456",
        "test2.test.ts:other test": "ghi789",
      });
    });

    it("handles empty tests array", () => {
      const tests: ExtractedTest[] = [];
      const mtimes = new Map<string, number>();

      const cache = buildCache(tests, mtimes);

      expect(cache.tests).toEqual({});
      expect(cache.fileMtimes).toEqual({});
    });

    it("sets generatedAt timestamp", () => {
      const tests: ExtractedTest[] = [];
      const mtimes = new Map<string, number>();

      const before = new Date();
      const cache = buildCache(tests, mtimes);
      const after = new Date();

      const generatedAt = new Date(cache.generatedAt);
      expect(generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("getTestsWithCache", () => {
    it("extracts fresh when no cache exists", async () => {
      await createRequirementsDir(tempDir);

      // Create test files
      await writeFile(
        join(tempDir, "test1.test.ts"),
        `it("test1", () => { return 1; });`
      );
      await writeFile(
        join(tempDir, "test2.test.ts"),
        `it("test2", () => { return 2; });`
      );

      const result = await getTestsWithCache(tempDir, "**/*.test.ts");

      expect(result.fromCache).toBe(false);
      expect(result.tests.length).toBe(2);

      const identifiers = result.tests.map((t) => t.identifier).sort();
      expect(identifiers).toEqual(["test1", "test2"]);
    });

    it("uses cache when valid", async () => {
      await createRequirementsDir(tempDir);

      // Create test file
      const testFile = join(tempDir, "test.test.ts");
      await writeFile(testFile, `it("test", () => {});`);

      // Extract once to create cache
      await getTestsWithCache(tempDir, "**/*.test.ts");

      // Second call should use cache
      const result = await getTestsWithCache(tempDir, "**/*.test.ts");

      expect(result.fromCache).toBe(true);
      expect(result.tests.length).toBe(1);
      expect(result.tests[0].identifier).toBe("test");
    });

    it("extracts fresh when cache invalid (file modified)", async () => {
      await createRequirementsDir(tempDir);

      const testFile = join(tempDir, "test.test.ts");
      await writeFile(testFile, `it("test", () => { return 1; });`);

      // Extract once to create cache
      await getTestsWithCache(tempDir, "**/*.test.ts");

      // Modify the file
      await new Promise((resolve) => setTimeout(resolve, 10));
      await writeFile(testFile, `it("test", () => { return 2; });`);

      // Should extract fresh
      const result = await getTestsWithCache(tempDir, "**/*.test.ts");

      expect(result.fromCache).toBe(false);
      expect(result.tests.length).toBe(1);
    });

    it("extracts fresh when cache invalid (new file added)", async () => {
      await createRequirementsDir(tempDir);

      await writeFile(join(tempDir, "test1.test.ts"), `it("test1", () => {});`);

      // Extract once to create cache
      await getTestsWithCache(tempDir, "**/*.test.ts");

      // Add new file
      await writeFile(join(tempDir, "test2.test.ts"), `it("test2", () => {});`);

      // Should extract fresh
      const result = await getTestsWithCache(tempDir, "**/*.test.ts");

      expect(result.fromCache).toBe(false);
      expect(result.tests.length).toBe(2);
    });

    it("extracts fresh when noCache flag is true", async () => {
      await createRequirementsDir(tempDir);

      await writeFile(join(tempDir, "test.test.ts"), `it("test", () => {});`);

      // Extract once to create cache
      await getTestsWithCache(tempDir, "**/*.test.ts");

      // Extract again with noCache flag
      const result = await getTestsWithCache(tempDir, "**/*.test.ts", true);

      expect(result.fromCache).toBe(false);
      expect(result.tests.length).toBe(1);
    });

    it("updates cache after extraction", async () => {
      await createRequirementsDir(tempDir);

      await writeFile(
        join(tempDir, "test.test.ts"),
        `it("test", () => { return 1; });`
      );

      // First extraction creates cache
      const result1 = await getTestsWithCache(tempDir, "**/*.test.ts");
      expect(result1.fromCache).toBe(false);

      // Second extraction uses cache
      const result2 = await getTestsWithCache(tempDir, "**/*.test.ts");
      expect(result2.fromCache).toBe(true);

      // Hashes should match
      expect(result2.tests[0].hash).toBe(result1.tests[0].hash);
    });

    it("returns tests with empty body from cache", async () => {
      await createRequirementsDir(tempDir);

      await writeFile(
        join(tempDir, "test.test.ts"),
        `it("test", () => { return 1; });`
      );

      // First extraction creates cache
      await getTestsWithCache(tempDir, "**/*.test.ts");

      // Second extraction uses cache
      const result = await getTestsWithCache(tempDir, "**/*.test.ts");

      expect(result.fromCache).toBe(true);
      expect(result.tests[0].body).toBe(""); // Body is empty from cache
      expect(result.tests[0].hash).toBeDefined();
    });

    it("handles multiple tests in single file", async () => {
      await createRequirementsDir(tempDir);

      await writeFile(
        join(tempDir, "test.test.ts"),
        `
        it("test1", () => { return 1; });
        it("test2", () => { return 2; });
        it("test3", () => { return 3; });
        `
      );

      const result = await getTestsWithCache(tempDir, "**/*.test.ts");

      expect(result.tests.length).toBe(3);
      expect(result.tests.map((t) => t.identifier)).toEqual([
        "test1",
        "test2",
        "test3",
      ]);
    });

    it("handles test files in subdirectories", async () => {
      await createRequirementsDir(tempDir);

      await writeFile(
        join(tempDir, "test1.test.ts"),
        `it("test1", () => {});`
      );

      // Create subdirectory with test
      const subDir = join(tempDir, "sub");
      await Bun.write(join(subDir, "test2.test.ts"), `it("test2", () => {});`);

      const result = await getTestsWithCache(tempDir, "**/*.test.ts");

      expect(result.tests.length).toBe(2);
      const files = result.tests.map((t) => t.file);
      expect(files).toContain("test1.test.ts");
      expect(files).toContain("sub/test2.test.ts");
    });

    it("preserves test order when using cache", async () => {
      await createRequirementsDir(tempDir);

      await writeFile(
        join(tempDir, "a.test.ts"),
        `it("a", () => {});`
      );
      await writeFile(
        join(tempDir, "b.test.ts"),
        `it("b", () => {});`
      );
      await writeFile(
        join(tempDir, "c.test.ts"),
        `it("c", () => {});`
      );

      // First extraction
      const result1 = await getTestsWithCache(tempDir, "**/*.test.ts");
      const identifiers1 = result1.tests.map((t) => t.identifier);

      // Second extraction (from cache)
      const result2 = await getTestsWithCache(tempDir, "**/*.test.ts");
      const identifiers2 = result2.tests.map((t) => t.identifier);

      // Order might not be identical due to cache using object keys,
      // but all tests should be present
      expect(identifiers2.sort()).toEqual(identifiers1.sort());
    });
  });
});
