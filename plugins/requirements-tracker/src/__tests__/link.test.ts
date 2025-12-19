import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile, readFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import {
  createRequirementsDir,
  saveConfig,
  getRequirementsDir,
  saveRequirement,
} from "../lib/store";
import { link } from "../commands/link";
import type { Requirement } from "../lib/types";

describe("Link Command", () => {
  let tempDir: string;
  let exitSpy: ReturnType<typeof spyOn>;
  let exitCode: number | undefined;
  let consoleOutput: string[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-link-test-"));
    exitCode = undefined;
    consoleOutput = [];

    exitSpy = spyOn(process, "exit").mockImplementation((code) => {
      exitCode = code as number;
      throw new Error(`process.exit(${code})`);
    });

    // Capture console output
    spyOn(console, "log").mockImplementation((...args) => {
      consoleOutput.push(args.join(" "));
    });
    spyOn(console, "error").mockImplementation((...args) => {
      consoleOutput.push(args.join(" "));
    });
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  async function setupRequirements() {
    await createRequirementsDir(tempDir);
    await saveConfig(tempDir, { testRunner: "bun test", testGlob: "**/*.test.ts" });

    const requirement: Requirement = {
      gherkin: "Given a user\nWhen they login\nThen they are authenticated",
      mainSource: { type: "manual", description: "Test" },
      tests: [],
      status: "done",
    };

    await saveRequirement(tempDir, "auth/REQ_login.yml", requirement);

    // Create a requirement with existing test
    const requirement2: Requirement = {
      gherkin: "Given invalid password\nWhen submitted\nThen error shown",
      mainSource: { type: "manual", description: "Test" },
      tests: [
        { file: "existing.test.ts", identifier: "existing test", hash: "abc" },
      ],
      status: "done",
    };

    await saveRequirement(tempDir, "auth/REQ_password.yml", requirement2);

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

  it("links test to requirement successfully", async () => {
    await setupRequirements();

    await link({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      testSpec: "auth.test.ts:validates login",
    });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "auth/REQ_login.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as Requirement;

    expect(data.tests.length).toBe(1);
    expect(data.tests[0].file).toBe("auth.test.ts");
    expect(data.tests[0].identifier).toBe("validates login");
    expect(data.tests[0].hash.length).toBe(64);
  });

  it("computes and stores hash", async () => {
    await setupRequirements();

    await link({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      testSpec: "auth.test.ts:validates login",
    });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "auth/REQ_login.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as Requirement;

    expect(data.tests[0].hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("clears aiAssessment when test linked (no suggested tests)", async () => {
    await setupRequirements();

    // Add existing assessment without suggested tests
    const reqPath = join(getRequirementsDir(tempDir), "auth/REQ_login.yml");
    const content = await readFile(reqPath, "utf-8");
    const data = parseYaml(content) as Requirement;
    data.aiAssessment = {
      sufficient: true,
      notes: "Old assessment",
      assessedAt: "2024-01-01T00:00:00Z",
    };
    await writeFile(reqPath, stringifyYaml(data));

    await link({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      testSpec: "auth.test.ts:validates login",
    });

    const updated = parseYaml(await readFile(reqPath, "utf-8")) as Requirement;
    expect(updated.aiAssessment).toBeUndefined();
  });

  it("preserves suggestedTests when test linked", async () => {
    await setupRequirements();

    // Add existing assessment WITH suggested tests
    const reqPath = join(getRequirementsDir(tempDir), "auth/REQ_login.yml");
    const content = await readFile(reqPath, "utf-8");
    const data = parseYaml(content) as Requirement;
    data.aiAssessment = {
      sufficient: true,
      notes: "Old assessment",
      assessedAt: "2024-01-01T00:00:00Z",
      suggestedTests: [
        { description: "Test password validation", rationale: "Security" },
      ],
    };
    await writeFile(reqPath, stringifyYaml(data));

    await link({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      testSpec: "auth.test.ts:validates login",
    });

    const updated = parseYaml(await readFile(reqPath, "utf-8")) as Requirement;
    expect(updated.aiAssessment).toBeDefined();
    expect(updated.aiAssessment?.suggestedTests).toHaveLength(1);
    expect(updated.aiAssessment?.suggestedTests?.[0].description).toBe("Test password validation");
    expect(updated.aiAssessment?.sufficient).toBe(false);
    expect(updated.aiAssessment?.notes).toBe("Assessment invalidated - test coverage changed");
  });

  it("prevents duplicate links (idempotent)", async () => {
    await setupRequirements();

    // First link
    await link({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      testSpec: "auth.test.ts:validates login",
    });

    // Second link (same test) - should not add duplicate
    await link({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      testSpec: "auth.test.ts:validates login",
    });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "auth/REQ_login.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as Requirement;

    expect(data.tests.length).toBe(1);
  });

  it("errors when not initialized", async () => {
    try {
      await link({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        testSpec: "auth.test.ts:validates login",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("errors on invalid path format", async () => {
    await setupRequirements();

    try {
      await link({
        cwd: tempDir,
        path: "auth/invalid.yml",
        testSpec: "auth.test.ts:validates login",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("errors on requirement not found", async () => {
    await setupRequirements();

    try {
      await link({
        cwd: tempDir,
        path: "auth/REQ_nonexistent.yml",
        testSpec: "auth.test.ts:validates login",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("errors on test not found in codebase", async () => {
    await setupRequirements();

    try {
      await link({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        testSpec: "auth.test.ts:nonexistent test",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("errors on invalid test spec format", async () => {
    await setupRequirements();

    try {
      await link({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        testSpec: "no-colon-here",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });
});
