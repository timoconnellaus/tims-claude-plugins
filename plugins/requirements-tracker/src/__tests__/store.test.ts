import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import {
  getRequirementsDir,
  getConfigPath,
  getCachePath,
  getIgnoredTestsPath,
  requirementsDirExists,
  createRequirementsDir,
  loadConfig,
  saveConfig,
  loadCache,
  saveCache,
  loadIgnoredTests,
  saveIgnoredTests,
  isValidRequirementPath,
  requirementExists,
  loadRequirement,
  saveRequirement,
  loadAllRequirements,
  loadRequirementsInPath,
} from "../lib/store";
import type {
  Config,
  Requirement,
  TestCache,
  IgnoredTestsFile,
} from "../lib/types";

describe("Store", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("path helpers", () => {
    it("returns correct requirements dir path", () => {
      expect(getRequirementsDir("/foo/bar")).toBe("/foo/bar/.requirements");
    });

    it("returns correct config path", () => {
      expect(getConfigPath("/foo/bar")).toBe("/foo/bar/.requirements/config.yml");
    });

    it("returns correct cache path", () => {
      expect(getCachePath("/foo/bar")).toBe("/foo/bar/.requirements/cache.json");
    });

    it("returns correct ignored tests path", () => {
      expect(getIgnoredTestsPath("/foo/bar")).toBe(
        "/foo/bar/.requirements/ignored-tests.yml"
      );
    });
  });

  describe("directory operations", () => {
    it("requirementsDirExists returns false when dir does not exist", async () => {
      expect(await requirementsDirExists(tempDir)).toBe(false);
    });

    it("requirementsDirExists returns true when dir exists", async () => {
      await mkdir(getRequirementsDir(tempDir));
      expect(await requirementsDirExists(tempDir)).toBe(true);
    });

    it("createRequirementsDir creates directory", async () => {
      await createRequirementsDir(tempDir);
      expect(await requirementsDirExists(tempDir)).toBe(true);
    });

    it("createRequirementsDir is idempotent", async () => {
      await createRequirementsDir(tempDir);
      await createRequirementsDir(tempDir); // Should not throw
      expect(await requirementsDirExists(tempDir)).toBe(true);
    });
  });

  describe("config operations", () => {
    it("loadConfig returns null when config does not exist", async () => {
      expect(await loadConfig(tempDir)).toBe(null);
    });

    it("saveConfig and loadConfig handle config correctly", async () => {
      await createRequirementsDir(tempDir);

      const config: Config = {
        testRunner: "bun test",
        testGlob: "**/*.test.ts",
      };

      await saveConfig(tempDir, config);
      const loaded = await loadConfig(tempDir);

      expect(loaded).toEqual(config);
    });

    it("saveConfig writes valid YAML", async () => {
      await createRequirementsDir(tempDir);

      const config: Config = {
        testRunner: "npm test",
        testGlob: "src/**/*.spec.js",
      };

      await saveConfig(tempDir, config);

      const content = await readFile(getConfigPath(tempDir), "utf-8");
      const parsed = parseYaml(content);
      expect(parsed).toEqual(config);
    });
  });

  describe("cache operations", () => {
    it("loadCache returns null when cache does not exist", async () => {
      expect(await loadCache(tempDir)).toBe(null);
    });

    it("saveCache and loadCache handle cache correctly", async () => {
      await createRequirementsDir(tempDir);

      const cache: TestCache = {
        version: 1,
        generatedAt: "2024-01-01T00:00:00.000Z",
        fileMtimes: {
          "test1.test.ts": 1234567890,
          "test2.test.ts": 9876543210,
        },
        tests: {
          "test1.test.ts:should work": "abc123",
          "test2.test.ts:handles errors": "def456",
        },
      };

      await saveCache(tempDir, cache);
      const loaded = await loadCache(tempDir);

      expect(loaded).toEqual(cache);
    });

    it("saveCache writes valid JSON", async () => {
      await createRequirementsDir(tempDir);

      const cache: TestCache = {
        version: 1,
        generatedAt: "2024-01-01T00:00:00.000Z",
        fileMtimes: {},
        tests: {},
      };

      await saveCache(tempDir, cache);

      const content = await readFile(getCachePath(tempDir), "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(cache);
    });

    it("saveCache formats JSON with 2-space indentation", async () => {
      await createRequirementsDir(tempDir);

      const cache: TestCache = {
        version: 1,
        generatedAt: "2024-01-01T00:00:00.000Z",
        fileMtimes: {},
        tests: {},
      };

      await saveCache(tempDir, cache);

      const content = await readFile(getCachePath(tempDir), "utf-8");
      expect(content).toContain("  \"version\": 1");
    });
  });

  describe("ignored tests operations", () => {
    it("loadIgnoredTests returns default empty list when file does not exist", async () => {
      const data = await loadIgnoredTests(tempDir);
      expect(data).toEqual({ tests: [] });
    });

    it("saveIgnoredTests and loadIgnoredTests handle data correctly", async () => {
      await createRequirementsDir(tempDir);

      const data: IgnoredTestsFile = {
        tests: [
          {
            file: "test1.test.ts",
            identifier: "flaky test",
            reason: "Too flaky",
            ignoredAt: "2024-01-01T00:00:00.000Z",
          },
          {
            file: "test2.test.ts",
            identifier: "slow test",
            reason: "Performance test",
            ignoredAt: "2024-01-02T00:00:00.000Z",
          },
        ],
      };

      await saveIgnoredTests(tempDir, data);
      const loaded = await loadIgnoredTests(tempDir);

      expect(loaded).toEqual(data);
    });

    it("saveIgnoredTests writes valid YAML", async () => {
      await createRequirementsDir(tempDir);

      const data: IgnoredTestsFile = {
        tests: [
          {
            file: "test.test.ts",
            identifier: "test",
            reason: "reason",
            ignoredAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      };

      await saveIgnoredTests(tempDir, data);

      const content = await readFile(getIgnoredTestsPath(tempDir), "utf-8");
      const parsed = parseYaml(content);
      expect(parsed).toEqual(data);
    });

    it("loadIgnoredTests handles null/empty YAML content", async () => {
      await createRequirementsDir(tempDir);
      await writeFile(getIgnoredTestsPath(tempDir), "");

      const data = await loadIgnoredTests(tempDir);
      expect(data).toEqual({ tests: [] });
    });
  });

  describe("requirement validation", () => {
    it("isValidRequirementPath accepts valid patterns", () => {
      expect(isValidRequirementPath("REQ_login.yml")).toBe(true);
      expect(isValidRequirementPath("REQ_user_auth.yml")).toBe(true);
      expect(isValidRequirementPath("REQ_123.yml")).toBe(true);
      expect(isValidRequirementPath("auth/REQ_login.yml")).toBe(true);
      expect(isValidRequirementPath("auth/session/REQ_timeout.yml")).toBe(true);
    });

    it("isValidRequirementPath rejects invalid patterns", () => {
      expect(isValidRequirementPath("req_login.yml")).toBe(false); // lowercase
      expect(isValidRequirementPath("REQ_login.yaml")).toBe(false); // wrong extension
      expect(isValidRequirementPath("REQ_.yml")).toBe(false); // empty name
      expect(isValidRequirementPath("FEATURE_login.yml")).toBe(false); // wrong prefix
      expect(isValidRequirementPath("REQ_login")).toBe(false); // no extension
      expect(isValidRequirementPath("config.yml")).toBe(false); // not a requirement
      expect(isValidRequirementPath("auth/REQ_/nested.yml")).toBe(false); // REQ_ in path but not filename
    });
  });

  describe("requirement CRUD operations", () => {
    it("requirementExists returns false when requirement does not exist", async () => {
      await createRequirementsDir(tempDir);
      expect(await requirementExists(tempDir, "REQ_login.yml")).toBe(false);
    });

    it("requirementExists returns true when requirement exists", async () => {
      await createRequirementsDir(tempDir);

      const requirement: Requirement = {
        gherkin: "Given a user",
        source: { type: "manual", description: "Test" },
        tests: [],
        status: "done",
      };

      await saveRequirement(tempDir, "REQ_login.yml", requirement);
      expect(await requirementExists(tempDir, "REQ_login.yml")).toBe(true);
    });

    it("loadRequirement returns null for invalid path", async () => {
      expect(await loadRequirement(tempDir, "invalid.yml")).toBe(null);
    });

    it("loadRequirement returns null for non-existent file", async () => {
      expect(await loadRequirement(tempDir, "REQ_nonexistent.yml")).toBe(null);
    });

    it("saveRequirement and loadRequirement handle requirement correctly", async () => {
      await createRequirementsDir(tempDir);

      const requirement: Requirement = {
        gherkin: "Given a user logs in with valid credentials",
        source: {
          type: "doc",
          description: "PRD v2.1",
          url: "https://example.com/prd",
          date: "2024-01-01",
        },
        tests: [
          {
            file: "auth.test.ts",
            identifier: "validates login",
            hash: "abc123",
          },
        ],
        status: "done",
        questions: [
          {
            question: "What about 2FA?",
            answer: "Out of scope",
            answeredAt: "2024-01-02T00:00:00.000Z",
          },
        ],
        aiAssessment: {
          sufficient: true,
          notes: "Good coverage",
          assessedAt: "2024-01-03T00:00:00.000Z",
        },
      };

      await saveRequirement(tempDir, "REQ_login.yml", requirement);
      const loaded = await loadRequirement(tempDir, "REQ_login.yml");

      expect(loaded).not.toBe(null);
      expect(loaded?.path).toBe("REQ_login.yml");
      expect(loaded?.data).toEqual(requirement);
    });

    it("loadRequirement initializes empty tests array if missing", async () => {
      await createRequirementsDir(tempDir);
      const reqDir = getRequirementsDir(tempDir);

      // Write a requirement without tests array but with required status
      await writeFile(
        join(reqDir, "REQ_test.yml"),
        stringifyYaml({
          gherkin: "Given a test",
          source: { type: "manual", description: "Test" },
          status: "planned",
        })
      );

      const loaded = await loadRequirement(tempDir, "REQ_test.yml");
      expect(loaded?.data.tests).toEqual([]);
    });

    it("loadRequirement throws validation error when status is missing", async () => {
      await createRequirementsDir(tempDir);
      const reqDir = getRequirementsDir(tempDir);

      // Write a requirement without status
      await writeFile(
        join(reqDir, "REQ_invalid.yml"),
        stringifyYaml({
          gherkin: "Given a test",
          source: { type: "manual", description: "Test" },
        })
      );

      await expect(loadRequirement(tempDir, "REQ_invalid.yml")).rejects.toThrow(
        'Missing or invalid "status" field'
      );
    });

    it("saveRequirement throws for invalid path", async () => {
      await createRequirementsDir(tempDir);

      const requirement: Requirement = {
        gherkin: "Given a user",
        source: { type: "manual", description: "Test" },
        tests: [],
        status: "done",
      };

      await expect(
        saveRequirement(tempDir, "invalid.yml", requirement)
      ).rejects.toThrow("Invalid requirement path");
    });

    it("saveRequirement writes valid YAML", async () => {
      await createRequirementsDir(tempDir);

      const requirement: Requirement = {
        gherkin: "Given a user",
        source: { type: "manual", description: "Test" },
        tests: [],
        status: "done",
      };

      await saveRequirement(tempDir, "REQ_test.yml", requirement);

      const content = await readFile(
        join(getRequirementsDir(tempDir), "REQ_test.yml"),
        "utf-8"
      );
      const parsed = parseYaml(content);
      expect(parsed).toEqual(requirement);
    });
  });

  describe("nested folder operations", () => {
    it("saveRequirement creates parent directories", async () => {
      await createRequirementsDir(tempDir);

      const requirement: Requirement = {
        gherkin: "Given a user",
        source: { type: "manual", description: "Test" },
        tests: [],
        status: "done",
      };

      await saveRequirement(tempDir, "auth/session/REQ_timeout.yml", requirement);

      const loaded = await loadRequirement(tempDir, "auth/session/REQ_timeout.yml");
      expect(loaded).not.toBe(null);
      expect(loaded?.path).toBe("auth/session/REQ_timeout.yml");
    });

    it("saveRequirement handles deeply nested paths", async () => {
      await createRequirementsDir(tempDir);

      const requirement: Requirement = {
        gherkin: "Given a user",
        source: { type: "manual", description: "Test" },
        tests: [],
        status: "done",
      };

      const path = "level1/level2/level3/REQ_deep.yml";
      await saveRequirement(tempDir, path, requirement);

      expect(await requirementExists(tempDir, path)).toBe(true);
    });
  });

  describe("loadAllRequirements", () => {
    it("returns empty result when no requirements exist", async () => {
      await createRequirementsDir(tempDir);
      const result = await loadAllRequirements(tempDir);
      expect(result.requirements).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("returns empty result when requirements dir does not exist", async () => {
      const result = await loadAllRequirements(tempDir);
      expect(result.requirements).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("finds all requirements in root", async () => {
      await createRequirementsDir(tempDir);

      const req1: Requirement = {
        gherkin: "Given req1",
        source: { type: "manual", description: "Test" },
        tests: [],
        status: "done",
      };

      const req2: Requirement = {
        gherkin: "Given req2",
        source: { type: "manual", description: "Test" },
        tests: [],
        status: "done",
      };

      await saveRequirement(tempDir, "REQ_login.yml", req1);
      await saveRequirement(tempDir, "REQ_logout.yml", req2);

      const result = await loadAllRequirements(tempDir);
      expect(result.requirements.length).toBe(2);
      expect(result.requirements[0].path).toBe("REQ_login.yml");
      expect(result.requirements[1].path).toBe("REQ_logout.yml");
    });

    it("finds requirements in nested folders", async () => {
      await createRequirementsDir(tempDir);

      const req: Requirement = {
        gherkin: "Given a requirement",
        source: { type: "manual", description: "Test" },
        tests: [],
        status: "done",
      };

      await saveRequirement(tempDir, "auth/REQ_login.yml", req);
      await saveRequirement(tempDir, "auth/session/REQ_timeout.yml", req);
      await saveRequirement(tempDir, "payments/REQ_checkout.yml", req);

      const result = await loadAllRequirements(tempDir);
      expect(result.requirements.length).toBe(3);

      const paths = result.requirements.map((r) => r.path).sort();
      expect(paths).toEqual([
        "auth/REQ_login.yml",
        "auth/session/REQ_timeout.yml",
        "payments/REQ_checkout.yml",
      ]);
    });

    it("ignores non-requirement files", async () => {
      await createRequirementsDir(tempDir);
      const reqDir = getRequirementsDir(tempDir);

      // Create valid requirement
      const req: Requirement = {
        gherkin: "Given a requirement",
        source: { type: "manual", description: "Test" },
        tests: [],
        status: "done",
      };
      await saveRequirement(tempDir, "REQ_valid.yml", req);

      // Create files that should be ignored
      await writeFile(join(reqDir, "config.yml"), "testRunner: bun");
      await writeFile(join(reqDir, "cache.json"), "{}");
      await writeFile(join(reqDir, "README.md"), "# Docs");
      await writeFile(join(reqDir, "not_req.yml"), "data: test");

      const result = await loadAllRequirements(tempDir);
      expect(result.requirements.length).toBe(1);
      expect(result.requirements[0].path).toBe("REQ_valid.yml");
    });

    it("returns requirements sorted by path", async () => {
      await createRequirementsDir(tempDir);

      const req: Requirement = {
        gherkin: "Given a requirement",
        source: { type: "manual", description: "Test" },
        tests: [],
        status: "done",
      };

      // Create in non-alphabetical order
      await saveRequirement(tempDir, "payments/REQ_checkout.yml", req);
      await saveRequirement(tempDir, "auth/REQ_login.yml", req);
      await saveRequirement(tempDir, "auth/session/REQ_timeout.yml", req);

      const result = await loadAllRequirements(tempDir);
      const paths = result.requirements.map((r) => r.path);

      expect(paths).toEqual([
        "auth/REQ_login.yml",
        "auth/session/REQ_timeout.yml",
        "payments/REQ_checkout.yml",
      ]);
    });

    it("collects validation errors without stopping", async () => {
      await createRequirementsDir(tempDir);
      const reqDir = getRequirementsDir(tempDir);

      // Create valid requirement
      const validReq: Requirement = {
        gherkin: "Given valid",
        source: { type: "manual", description: "Test" },
        tests: [],
        status: "done",
      };
      await saveRequirement(tempDir, "REQ_valid.yml", validReq);

      // Create invalid requirements (missing status)
      await writeFile(
        join(reqDir, "REQ_invalid1.yml"),
        stringifyYaml({
          gherkin: "Given invalid1",
          source: { type: "manual", description: "Test" },
        })
      );
      await writeFile(
        join(reqDir, "REQ_invalid2.yml"),
        stringifyYaml({
          gherkin: "Given invalid2",
          source: { type: "manual", description: "Test" },
        })
      );

      const result = await loadAllRequirements(tempDir);
      expect(result.requirements.length).toBe(1);
      expect(result.requirements[0].path).toBe("REQ_valid.yml");
      expect(result.errors.length).toBe(2);
    });
  });

  describe("loadRequirementsInPath", () => {
    beforeEach(async () => {
      await createRequirementsDir(tempDir);

      const req: Requirement = {
        gherkin: "Given a requirement",
        source: { type: "manual", description: "Test" },
        tests: [],
        status: "done",
      };

      // Create a tree of requirements
      await saveRequirement(tempDir, "REQ_root.yml", req);
      await saveRequirement(tempDir, "auth/REQ_login.yml", req);
      await saveRequirement(tempDir, "auth/REQ_logout.yml", req);
      await saveRequirement(tempDir, "auth/session/REQ_timeout.yml", req);
      await saveRequirement(tempDir, "auth/session/REQ_refresh.yml", req);
      await saveRequirement(tempDir, "payments/REQ_checkout.yml", req);
    });

    it("filters by folder prefix with trailing slash", async () => {
      const result = await loadRequirementsInPath(tempDir, "auth/");
      const paths = result.requirements.map((r) => r.path).sort();

      expect(paths).toEqual([
        "auth/REQ_login.yml",
        "auth/REQ_logout.yml",
        "auth/session/REQ_refresh.yml",
        "auth/session/REQ_timeout.yml",
      ]);
    });

    it("filters by nested folder", async () => {
      const result = await loadRequirementsInPath(tempDir, "auth/session/");
      const paths = result.requirements.map((r) => r.path).sort();

      expect(paths).toEqual([
        "auth/session/REQ_refresh.yml",
        "auth/session/REQ_timeout.yml",
      ]);
    });

    it("filters by exact file path", async () => {
      const result = await loadRequirementsInPath(
        tempDir,
        "auth/REQ_login.yml"
      );

      expect(result.requirements.length).toBe(1);
      expect(result.requirements[0].path).toBe("auth/REQ_login.yml");
    });

    it("returns empty result for non-matching path", async () => {
      const result = await loadRequirementsInPath(tempDir, "nonexistent/");
      expect(result.requirements).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("returns all requirements when pathFilter is empty string", async () => {
      const result = await loadRequirementsInPath(tempDir, "");
      expect(result.requirements.length).toBe(6);
    });

    it("handles partial path matches correctly", async () => {
      // "auth" without trailing slash should still match "auth/..."
      const result = await loadRequirementsInPath(tempDir, "auth");
      const paths = result.requirements.map((r) => r.path);

      // Should include all paths starting with "auth"
      expect(paths.length).toBeGreaterThan(0);
      paths.forEach((path: string) => {
        expect(path.startsWith("auth")).toBe(true);
      });
    });
  });
});
