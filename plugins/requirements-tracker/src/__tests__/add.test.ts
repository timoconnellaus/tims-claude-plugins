import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parse as parseYaml } from "yaml";
import {
  createRequirementsDir,
  saveConfig,
  getRequirementsDir,
  requirementExists,
} from "../lib/store";
import { add } from "../commands/add";
import type { Requirement, SourceType } from "../lib/types";

describe("Add Command", () => {
  let tempDir: string;
  let exitSpy: ReturnType<typeof spyOn>;
  let exitCode: number | undefined;
  let consoleOutput: string[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-add-test-"));
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
  }

  it("creates requirement file with all fields", async () => {
    await setupRequirements();

    await add({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      gherkin: "Given a user\nWhen they login\nThen they are authenticated",
      sourceType: "manual",
      sourceDesc: "User story from PM",
      sourceUrl: "https://example.com/story",
      sourceDate: "2024-01-01",
    });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "auth/REQ_login.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as Requirement;

    expect(data.gherkin).toBe("Given a user\nWhen they login\nThen they are authenticated");
    expect(data.mainSource.type).toBe("manual");
    expect(data.mainSource.description).toBe("User story from PM");
    expect(data.mainSource.url).toBe("https://example.com/story");
    expect(data.mainSource.date).toBe("2024-01-01");
    expect(data.tests).toEqual([]);
  });

  it("creates parent directories", async () => {
    await setupRequirements();

    await add({
      cwd: tempDir,
      path: "auth/session/REQ_timeout.yml",
      gherkin: "Given a user session\nWhen timeout expires\nThen user is logged out",
      sourceType: "manual",
      sourceDesc: "Test",
    });

    const exists = await requirementExists(tempDir, "auth/session/REQ_timeout.yml");
    expect(exists).toBe(true);
  });

  it("validates path format (must be REQ_*.yml)", async () => {
    await setupRequirements();

    try {
      await add({
        cwd: tempDir,
        path: "auth/invalid.yml",
        gherkin: "Given a user\nWhen they login\nThen they are authenticated",
        sourceType: "manual",
        sourceDesc: "Test",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("validates gherkin contains Given/When/Then", async () => {
    await setupRequirements();

    try {
      await add({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        gherkin: "This is not valid gherkin",
        sourceType: "manual",
        sourceDesc: "Test",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("validates source type", async () => {
    await setupRequirements();

    try {
      await add({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        gherkin: "Given a user\nWhen they login\nThen they are authenticated",
        sourceType: "invalid-type",
        sourceDesc: "Test",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("errors if file exists (without --force)", async () => {
    await setupRequirements();

    // Create first requirement
    await add({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      gherkin: "Given a user\nWhen they login\nThen they are authenticated",
      sourceType: "manual",
      sourceDesc: "First version",
    });

    // Try to create again without --force
    try {
      await add({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        gherkin: "Given a different user\nWhen they login\nThen they are authenticated",
        sourceType: "manual",
        sourceDesc: "Second version",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("overwrites with --force flag", async () => {
    await setupRequirements();

    // Create first requirement
    await add({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      gherkin: "Given a user\nWhen they login\nThen they are authenticated",
      sourceType: "manual",
      sourceDesc: "First version",
    });

    // Overwrite with --force
    await add({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      gherkin: "Given a different user\nWhen they login\nThen they are authenticated",
      sourceType: "doc",
      sourceDesc: "Second version",
      force: true,
    });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "auth/REQ_login.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as Requirement;

    expect(data.gherkin).toBe("Given a different user\nWhen they login\nThen they are authenticated");
    expect(data.mainSource.type).toBe("doc");
    expect(data.mainSource.description).toBe("Second version");
  });

  it("errors when not initialized", async () => {
    try {
      await add({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        gherkin: "Given a user\nWhen they login\nThen they are authenticated",
        sourceType: "manual",
        sourceDesc: "Test",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("accepts all valid source types", async () => {
    await setupRequirements();

    const validTypes: SourceType[] = ["doc", "slack", "email", "meeting", "ticket", "manual"];

    for (const sourceType of validTypes) {
      await add({
        cwd: tempDir,
        path: `auth/REQ_${sourceType}.yml`,
        gherkin: "Given a user\nWhen they login\nThen they are authenticated",
        sourceType,
        sourceDesc: `Test ${sourceType}`,
      });

      const content = await readFile(
        join(getRequirementsDir(tempDir), `auth/REQ_${sourceType}.yml`),
        "utf-8"
      );
      const data = parseYaml(content) as Requirement;

      expect(data.mainSource.type).toBe(sourceType);
    }
  });

  it("creates requirement without optional fields", async () => {
    await setupRequirements();

    await add({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      gherkin: "Given a user\nWhen they login\nThen they are authenticated",
      sourceType: "manual",
      sourceDesc: "Test",
    });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "auth/REQ_login.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as Requirement;

    expect(data.mainSource.url).toBeUndefined();
    expect(data.mainSource.date).toBeUndefined();
  });
});
