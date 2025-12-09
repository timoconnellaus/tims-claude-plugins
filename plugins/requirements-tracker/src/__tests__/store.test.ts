import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { stringify as stringifyYaml } from "yaml";
import {
  getRequirementsDir,
  getConfigPath,
  requirementsDirExists,
  loadConfig,
  saveConfig,
  createRequirementsDir,
  listFeatureFiles,
  loadFeature,
  loadAllFeatures,
  saveFeature,
  getNextFeatureNumber,
  findFeatureByName,
  findRequirement,
} from "../lib/store";
import type { Config, FeatureFile, ParsedFeature } from "../lib/types";

describe("Store", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("getRequirementsDir", () => {
    it("returns correct path", () => {
      expect(getRequirementsDir("/foo/bar")).toBe("/foo/bar/.requirements");
    });
  });

  describe("getConfigPath", () => {
    it("returns correct path", () => {
      expect(getConfigPath("/foo/bar")).toBe("/foo/bar/.requirements/config.yml");
    });
  });

  describe("requirementsDirExists", () => {
    it("returns false when dir does not exist", async () => {
      expect(await requirementsDirExists(tempDir)).toBe(false);
    });

    it("returns true when dir exists", async () => {
      await mkdir(join(tempDir, ".requirements"));
      expect(await requirementsDirExists(tempDir)).toBe(true);
    });
  });

  describe("loadConfig / saveConfig", () => {
    it("returns null when config does not exist", async () => {
      expect(await loadConfig(tempDir)).toBe(null);
    });

    it("saves and loads config correctly", async () => {
      await createRequirementsDir(tempDir);

      const config: Config = {
        testRunner: "bun test",
        testGlob: "**/*.test.ts",
      };

      await saveConfig(tempDir, config);
      const loaded = await loadConfig(tempDir);

      expect(loaded).toEqual(config);
    });
  });

  describe("createRequirementsDir", () => {
    it("creates directory", async () => {
      await createRequirementsDir(tempDir);
      expect(await requirementsDirExists(tempDir)).toBe(true);
    });
  });

  describe("listFeatureFiles", () => {
    it("returns empty array when no feature files", async () => {
      await createRequirementsDir(tempDir);
      expect(await listFeatureFiles(tempDir)).toEqual([]);
    });

    it("returns feature files sorted", async () => {
      await createRequirementsDir(tempDir);
      const dir = getRequirementsDir(tempDir);

      await writeFile(join(dir, "FEAT_002_payments.yml"), "name: Payments");
      await writeFile(join(dir, "FEAT_001_auth.yml"), "name: Auth");
      await writeFile(join(dir, "config.yml"), "testRunner: bun test");
      await writeFile(join(dir, "README.md"), "ignore me");

      const files = await listFeatureFiles(tempDir);
      expect(files).toEqual(["FEAT_001_auth.yml", "FEAT_002_payments.yml"]);
    });
  });

  describe("loadFeature", () => {
    it("returns null for invalid filename", async () => {
      expect(await loadFeature(tempDir, "invalid.yml")).toBe(null);
    });

    it("loads valid feature file", async () => {
      await createRequirementsDir(tempDir);
      const dir = getRequirementsDir(tempDir);

      const feature: FeatureFile = {
        name: "Auth",
        description: "Authentication",
        requirements: {
          "1": {
            gherkin: "Given a user",
            source: { type: "manual", description: "Test" },
            tests: [],
          },
        },
      };

      await writeFile(join(dir, "FEAT_001_auth.yml"), stringifyYaml(feature));

      const loaded = await loadFeature(tempDir, "FEAT_001_auth.yml");

      expect(loaded).not.toBe(null);
      expect(loaded?.filename).toBe("FEAT_001_auth.yml");
      expect(loaded?.number).toBe(1);
      expect(loaded?.userPart).toBe("auth");
      expect(loaded?.data.name).toBe("Auth");
    });

    it("initializes missing tests array", async () => {
      await createRequirementsDir(tempDir);
      const dir = getRequirementsDir(tempDir);

      // Write a feature without tests array
      await writeFile(
        join(dir, "FEAT_001_auth.yml"),
        `name: Auth
description: Test
requirements:
  "1":
    gherkin: Given a user
    source:
      type: manual
      description: Test
`
      );

      const loaded = await loadFeature(tempDir, "FEAT_001_auth.yml");
      expect(loaded?.data.requirements["1"].tests).toEqual([]);
    });
  });

  describe("loadAllFeatures", () => {
    it("loads all feature files", async () => {
      await createRequirementsDir(tempDir);
      const dir = getRequirementsDir(tempDir);

      await writeFile(
        join(dir, "FEAT_001_auth.yml"),
        stringifyYaml({ name: "Auth", description: "", requirements: {} })
      );
      await writeFile(
        join(dir, "FEAT_002_pay.yml"),
        stringifyYaml({ name: "Pay", description: "", requirements: {} })
      );

      const features = await loadAllFeatures(tempDir);
      expect(features.length).toBe(2);
      expect(features[0].data.name).toBe("Auth");
      expect(features[1].data.name).toBe("Pay");
    });
  });

  describe("saveFeature", () => {
    it("saves feature file", async () => {
      await createRequirementsDir(tempDir);

      const feature: ParsedFeature = {
        filename: "FEAT_001_auth.yml",
        number: 1,
        userPart: "auth",
        filePath: join(getRequirementsDir(tempDir), "FEAT_001_auth.yml"),
        data: {
          name: "Auth",
          description: "Test",
          requirements: {},
        },
      };

      await saveFeature(tempDir, feature);

      const content = await readFile(feature.filePath, "utf-8");
      expect(content).toContain("name: Auth");
    });
  });

  describe("getNextFeatureNumber", () => {
    it("returns 1 for empty list", () => {
      expect(getNextFeatureNumber([])).toBe(1);
    });

    it("returns max + 1", () => {
      const features: ParsedFeature[] = [
        { filename: "", number: 1, userPart: "", filePath: "", data: { name: "", description: "", requirements: {} } },
        { filename: "", number: 5, userPart: "", filePath: "", data: { name: "", description: "", requirements: {} } },
        { filename: "", number: 3, userPart: "", filePath: "", data: { name: "", description: "", requirements: {} } },
      ];
      expect(getNextFeatureNumber(features)).toBe(6);
    });
  });

  describe("findFeatureByName", () => {
    const features: ParsedFeature[] = [
      {
        filename: "FEAT_001_user-auth.yml",
        number: 1,
        userPart: "user-auth",
        filePath: "",
        data: { name: "Auth", description: "", requirements: {} },
      },
      {
        filename: "FEAT_002_payments.yml",
        number: 2,
        userPart: "payments",
        filePath: "",
        data: { name: "Payments", description: "", requirements: {} },
      },
    ];

    it("matches by user part", () => {
      const found = findFeatureByName(features, "user-auth");
      expect(found?.number).toBe(1);
    });

    it("matches by partial name", () => {
      const found = findFeatureByName(features, "auth");
      expect(found?.number).toBe(1);
    });

    it("matches by number", () => {
      const found = findFeatureByName(features, "2");
      expect(found?.number).toBe(2);
    });

    it("matches by FEAT_NNN format", () => {
      const found = findFeatureByName(features, "FEAT_001");
      expect(found?.number).toBe(1);
    });

    it("returns undefined when not found", () => {
      expect(findFeatureByName(features, "nonexistent")).toBeUndefined();
    });
  });

  describe("findRequirement", () => {
    const features: ParsedFeature[] = [
      {
        filename: "FEAT_001_auth.yml",
        number: 1,
        userPart: "auth",
        filePath: "",
        data: {
          name: "Auth",
          description: "",
          requirements: {
            "1": { gherkin: "Given a user", source: { type: "manual", description: "Test" }, tests: [] },
            "2": { gherkin: "Given invalid password", source: { type: "manual", description: "Test" }, tests: [] },
          },
        },
      },
    ];

    it("finds requirement by feature and id", () => {
      const result = findRequirement(features, "auth", "1");
      expect(result).not.toBe(null);
      expect(result?.id).toBe("1");
      expect(result?.requirement.gherkin).toBe("Given a user");
    });

    it("returns null for nonexistent feature", () => {
      expect(findRequirement(features, "nonexistent", "1")).toBe(null);
    });

    it("returns null for nonexistent requirement", () => {
      expect(findRequirement(features, "auth", "999")).toBe(null);
    });
  });
});
