import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parse as parseYaml } from "yaml";
import {
  createRequirementsDir,
  saveConfig,
  saveRequirement,
  getRequirementsDir,
} from "../lib/store";
import { unlink } from "../commands/unlink";
import type { Requirement } from "../lib/types";

describe("Unlink Command", () => {
  let tempDir: string;
  let exitSpy: ReturnType<typeof spyOn>;
  let exitCode: number | undefined;
  let consoleOutput: string[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-unlink-test-"));
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
      tests: [
        { file: "auth.test.ts", identifier: "validates login", hash: "abc123" },
        { file: "auth.test.ts", identifier: "handles error", hash: "def456" },
      ],
      status: "done",
    };

    await saveRequirement(tempDir, "auth/REQ_login.yml", requirement);
  }

  it("removes test link from requirement", async () => {
    await setupRequirements();

    await unlink({
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
    expect(data.tests[0].identifier).toBe("handles error");
  });

  it("clears aiAssessment when test unlinked", async () => {
    await setupRequirements();

    // Add assessment
    const reqPath = join(getRequirementsDir(tempDir), "auth/REQ_login.yml");
    const content = await readFile(reqPath, "utf-8");
    const data = parseYaml(content) as Requirement;
    data.aiAssessment = {
      sufficient: true,
      notes: "Good coverage",
      assessedAt: new Date().toISOString(),
    };
    await saveRequirement(tempDir, "auth/REQ_login.yml", data);

    await unlink({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      testSpec: "auth.test.ts:validates login",
    });

    const updated = parseYaml(await readFile(reqPath, "utf-8")) as Requirement;
    expect(updated.aiAssessment).toBeUndefined();
  });

  it("errors on requirement not found", async () => {
    await setupRequirements();

    try {
      await unlink({
        cwd: tempDir,
        path: "auth/REQ_nonexistent.yml",
        testSpec: "auth.test.ts:validates login",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("errors on test not linked", async () => {
    await setupRequirements();

    try {
      await unlink({
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
      await unlink({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        testSpec: "no-colon-here",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("errors when not initialized", async () => {
    try {
      await unlink({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        testSpec: "auth.test.ts:validates login",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("removes last test link successfully", async () => {
    await setupRequirements();

    // Remove first test
    await unlink({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      testSpec: "auth.test.ts:validates login",
    });

    // Remove second test
    await unlink({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      testSpec: "auth.test.ts:handles error",
    });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "auth/REQ_login.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as Requirement;

    expect(data.tests.length).toBe(0);
  });
});
