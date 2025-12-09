import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import {
  createRequirementsDir,
  saveConfig,
  getRequirementsDir,
} from "../lib/store";
import { link } from "../commands/link";
import type { FeatureFile } from "../lib/types";

describe("Link Command", () => {
  let tempDir: string;
  let exitSpy: ReturnType<typeof spyOn>;
  let exitCode: number | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-link-test-"));
    exitCode = undefined;

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
          gherkin: "Given a user\nWhen they login\nThen they are authenticated",
          source: { type: "manual", description: "Test" },
          tests: [],
        },
        "2": {
          gherkin: "Given invalid password",
          source: { type: "manual", description: "Test" },
          tests: [
            { file: "existing.test.ts", identifier: "existing test", hash: "abc" },
          ],
        },
      },
    };

    await writeFile(
      join(getRequirementsDir(tempDir), "FEAT_001_auth.yml"),
      stringifyYaml(feature)
    );

    // Create a test file
    await writeFile(
      join(tempDir, "auth.test.ts"),
      `
      it("validates login", () => {
        expect(true).toBe(true);
      });

      it("handles error", () => {
        expect(false).toBe(false);
      });
    `
    );
  }

  it("links test to requirement", async () => {
    await setupRequirements();

    await link({
      cwd: tempDir,
      featureName: "auth",
      reqId: "1",
      testSpec: "auth.test.ts:validates login",
    });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "FEAT_001_auth.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as FeatureFile;

    expect(data.requirements["1"].tests.length).toBe(1);
    expect(data.requirements["1"].tests[0].file).toBe("auth.test.ts");
    expect(data.requirements["1"].tests[0].identifier).toBe("validates login");
    expect(data.requirements["1"].tests[0].hash.length).toBe(64);
  });

  it("computes and stores hash", async () => {
    await setupRequirements();

    await link({
      cwd: tempDir,
      featureName: "auth",
      reqId: "1",
      testSpec: "auth.test.ts:validates login",
    });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "FEAT_001_auth.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as FeatureFile;

    expect(data.requirements["1"].tests[0].hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("clears aiAssessment when linking", async () => {
    await setupRequirements();

    // Add existing assessment
    const featurePath = join(getRequirementsDir(tempDir), "FEAT_001_auth.yml");
    const content = await readFile(featurePath, "utf-8");
    const data = parseYaml(content) as FeatureFile;
    data.requirements["1"].aiAssessment = {
      sufficient: true,
      notes: "Old assessment",
      assessedAt: "2024-01-01T00:00:00Z",
    };
    await writeFile(featurePath, stringifyYaml(data));

    await link({
      cwd: tempDir,
      featureName: "auth",
      reqId: "1",
      testSpec: "auth.test.ts:validates login",
    });

    const updated = parseYaml(await readFile(featurePath, "utf-8")) as FeatureFile;
    expect(updated.requirements["1"].aiAssessment).toBeUndefined();
  });

  it("rejects invalid test spec format", async () => {
    await setupRequirements();

    try {
      await link({
        cwd: tempDir,
        featureName: "auth",
        reqId: "1",
        testSpec: "no-colon-here",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("rejects non-existent feature", async () => {
    await setupRequirements();

    try {
      await link({
        cwd: tempDir,
        featureName: "nonexistent",
        reqId: "1",
        testSpec: "auth.test.ts:validates login",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("rejects non-existent requirement", async () => {
    await setupRequirements();

    try {
      await link({
        cwd: tempDir,
        featureName: "auth",
        reqId: "999",
        testSpec: "auth.test.ts:validates login",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("rejects non-existent test", async () => {
    await setupRequirements();

    try {
      await link({
        cwd: tempDir,
        featureName: "auth",
        reqId: "1",
        testSpec: "auth.test.ts:nonexistent test",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("prevents duplicate links", async () => {
    await setupRequirements();

    // First link
    await link({
      cwd: tempDir,
      featureName: "auth",
      reqId: "1",
      testSpec: "auth.test.ts:validates login",
    });

    // Second link (same test) - should not add duplicate
    await link({
      cwd: tempDir,
      featureName: "auth",
      reqId: "1",
      testSpec: "auth.test.ts:validates login",
    });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "FEAT_001_auth.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as FeatureFile;

    expect(data.requirements["1"].tests.length).toBe(1);
  });

  it("requires initialization", async () => {
    try {
      await link({
        cwd: tempDir,
        featureName: "auth",
        reqId: "1",
        testSpec: "auth.test.ts:validates login",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });
});
