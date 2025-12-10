import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parse as parseYaml } from "yaml";
import {
  createRequirementsDir,
  saveConfig,
  getRequirementsDir,
  saveRequirement,
} from "../lib/store";
import { status } from "../commands/status";
import type { Requirement } from "../lib/types";

describe("Status Command", () => {
  let tempDir: string;
  let exitSpy: ReturnType<typeof spyOn>;
  let exitCode: number | undefined;
  let consoleOutput: string[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-status-test-"));
    exitCode = undefined;
    consoleOutput = [];

    exitSpy = spyOn(process, "exit").mockImplementation((code) => {
      exitCode = code as number;
      throw new Error(`process.exit(${code})`);
    });

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
      gherkin: "Given a user\nWhen they login\nThen authenticated",
      source: { type: "manual", description: "Test" },
      tests: [],
      status: "planned",
    };
    await saveRequirement(tempDir, "auth/REQ_login.yml", requirement);
  }

  it("shows planned status", async () => {
    await setupRequirements();
    await status({ cwd: tempDir, path: "auth/REQ_login.yml" });
    expect(consoleOutput.some((l) => l.includes("planned"))).toBe(true);
  });

  it("sets status to done", async () => {
    await setupRequirements();
    await status({ cwd: tempDir, path: "auth/REQ_login.yml", done: true });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "auth/REQ_login.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as Requirement;
    expect(data.status).toBe("done");
  });

  it("sets status back to planned", async () => {
    await setupRequirements();
    // First set to done
    await status({ cwd: tempDir, path: "auth/REQ_login.yml", done: true });
    consoleOutput = [];
    // Then set back to planned
    await status({ cwd: tempDir, path: "auth/REQ_login.yml", planned: true });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "auth/REQ_login.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as Requirement;
    expect(data.status).toBe("planned");
  });

  it("warns when marking done without tests", async () => {
    await setupRequirements();
    await status({ cwd: tempDir, path: "auth/REQ_login.yml", done: true });
    expect(consoleOutput.some((l) => l.includes("Warning"))).toBe(true);
  });

  it("does not warn when marking done with tests", async () => {
    await createRequirementsDir(tempDir);
    await saveConfig(tempDir, { testRunner: "bun test", testGlob: "**/*.test.ts" });

    const requirement: Requirement = {
      gherkin: "Given a user\nWhen they login\nThen authenticated",
      source: { type: "manual", description: "Test" },
      tests: [{ file: "test.ts", identifier: "test", hash: "abc123" }],
      status: "planned",
    };
    await saveRequirement(tempDir, "auth/REQ_with_tests.yml", requirement);

    await status({ cwd: tempDir, path: "auth/REQ_with_tests.yml", done: true });
    expect(consoleOutput.some((l) => l.includes("Warning"))).toBe(false);
  });

  it("errors with both --done and --planned", async () => {
    await setupRequirements();
    try {
      await status({ cwd: tempDir, path: "auth/REQ_login.yml", done: true, planned: true });
    } catch (e) {
      // Expected
    }
    expect(exitCode).toBe(1);
  });

  it("errors on non-existent requirement", async () => {
    await setupRequirements();
    try {
      await status({ cwd: tempDir, path: "auth/REQ_nonexistent.yml", done: true });
    } catch (e) {
      // Expected
    }
    expect(exitCode).toBe(1);
  });

  it("errors when not initialized", async () => {
    try {
      await status({ cwd: tempDir, path: "auth/REQ_login.yml", done: true });
    } catch (e) {
      // Expected
    }
    expect(exitCode).toBe(1);
  });

  it("reports when already at desired status", async () => {
    await setupRequirements();
    await status({ cwd: tempDir, path: "auth/REQ_login.yml", planned: true });
    expect(consoleOutput.some((l) => l.includes("already planned"))).toBe(true);
  });
});
