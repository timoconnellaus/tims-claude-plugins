import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import { readFile } from "fs/promises";
import {
  createRequirementsDir,
  saveConfig,
  getRequirementsDir,
} from "../lib/store";
import { assess } from "../commands/assess";
import type { FeatureFile } from "../lib/types";

describe("Assess Command", () => {
  let tempDir: string;
  let exitSpy: ReturnType<typeof spyOn>;
  let exitCode: number | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-assess-test-"));
    exitCode = undefined;

    // Mock process.exit
    exitSpy = spyOn(process, "exit").mockImplementation((code) => {
      exitCode = code as number;
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  async function setupRequirements() {
    await createRequirementsDir(tempDir);
    await saveConfig(tempDir, { testRunner: "bun test", testGlob: "**/*.test.ts" });

    const feature: FeatureFile = {
      name: "Auth",
      description: "Test auth",
      requirements: {
        "1": {
          gherkin: "Given a user",
          source: { type: "manual", description: "Test" },
          tests: [{ file: "test.ts", identifier: "test", hash: "abc" }],
        },
        "2": {
          gherkin: "Given invalid password",
          source: { type: "manual", description: "Test" },
          tests: [],
        },
      },
    };

    await writeFile(
      join(getRequirementsDir(tempDir), "FEAT_001_auth.yml"),
      stringifyYaml(feature)
    );
  }

  it("updates assessment on requirement", async () => {
    await setupRequirements();

    await assess({
      cwd: tempDir,
      featureName: "auth",
      reqId: "1",
      result: JSON.stringify({ sufficient: true, notes: "Good test coverage" }),
    });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "FEAT_001_auth.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as FeatureFile;

    expect(data.requirements["1"].aiAssessment).toBeDefined();
    expect(data.requirements["1"].aiAssessment?.sufficient).toBe(true);
    expect(data.requirements["1"].aiAssessment?.notes).toBe("Good test coverage");
    expect(data.requirements["1"].aiAssessment?.assessedAt).toBeDefined();
  });

  it("stores false assessment", async () => {
    await setupRequirements();

    await assess({
      cwd: tempDir,
      featureName: "auth",
      reqId: "2",
      result: JSON.stringify({ sufficient: false, notes: "No tests linked" }),
    });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "FEAT_001_auth.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as FeatureFile;

    expect(data.requirements["2"].aiAssessment?.sufficient).toBe(false);
    expect(data.requirements["2"].aiAssessment?.notes).toBe("No tests linked");
  });

  it("rejects invalid JSON format", async () => {
    await setupRequirements();

    try {
      await assess({
        cwd: tempDir,
        featureName: "auth",
        reqId: "1",
        result: "not valid json",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("rejects missing sufficient field", async () => {
    await setupRequirements();

    try {
      await assess({
        cwd: tempDir,
        featureName: "auth",
        reqId: "1",
        result: JSON.stringify({ notes: "missing sufficient" }),
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("rejects missing notes field", async () => {
    await setupRequirements();

    try {
      await assess({
        cwd: tempDir,
        featureName: "auth",
        reqId: "1",
        result: JSON.stringify({ sufficient: true }),
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("rejects non-existent feature", async () => {
    await setupRequirements();

    try {
      await assess({
        cwd: tempDir,
        featureName: "nonexistent",
        reqId: "1",
        result: JSON.stringify({ sufficient: true, notes: "test" }),
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("rejects non-existent requirement", async () => {
    await setupRequirements();

    try {
      await assess({
        cwd: tempDir,
        featureName: "auth",
        reqId: "999",
        result: JSON.stringify({ sufficient: true, notes: "test" }),
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("requires initialization", async () => {
    try {
      await assess({
        cwd: tempDir,
        featureName: "auth",
        reqId: "1",
        result: JSON.stringify({ sufficient: true, notes: "test" }),
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });
});
