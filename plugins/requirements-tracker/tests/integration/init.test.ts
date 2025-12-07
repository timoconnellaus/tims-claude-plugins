import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  createTestDir,
  runCli,
  readJsonFile,
  fileExists,
  initRequirementsFile,
  type TestContext,
} from "../setup";
import type { RequirementsFile } from "../../src/lib/types";

describe("init command", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("creates requirements.json in empty directory", async () => {
    const result = await runCli(["init"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("requirements.json created");
    expect(await fileExists(ctx.dir, "requirements.json")).toBe(true);
  });

  test("creates file with version 1.0", async () => {
    await runCli(["init"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");

    expect(data.version).toBe("1.0");
  });

  test("creates file with empty config and requirements", async () => {
    await runCli(["init"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");

    expect(data.config).toEqual({ testRunners: [] });
    expect(data.requirements).toEqual({});
  });

  test("does not overwrite existing file without --force", async () => {
    // First init
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    // Second init without force
    const result = await runCli(["init"], ctx.dir);

    expect(result.stdout).toContain("already exists");

    // Verify data preserved
    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(Object.keys(data.requirements)).toHaveLength(1);
  });

  test("--force preserves requirements but can update config", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    await runCli(["init", "--force", "--runner", "unit:bun test:**/*.test.ts"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(Object.keys(data.requirements)).toHaveLength(1);
    expect(data.config.testRunners).toHaveLength(1);
    expect(data.config.testRunners[0].name).toBe("unit");
  });

  test("--force without runners preserves existing runners", async () => {
    await runCli(["init", "--runner", "unit:bun test:**/*.test.ts"], ctx.dir);

    await runCli(["init", "--force"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.config.testRunners).toHaveLength(1);
    expect(data.config.testRunners[0].name).toBe("unit");
  });

  test("--runner parses spec correctly", async () => {
    await runCli(["init", "--runner", "unit:bun test:**/*.test.ts"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.config.testRunners[0]).toEqual({
      name: "unit",
      command: "bun test",
      pattern: "**/*.test.ts",
    });
  });

  test("--runner handles command with colons", async () => {
    await runCli(["init", "--runner", "e2e:bunx playwright test:tests/**/*.spec.ts"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.config.testRunners[0]).toEqual({
      name: "e2e",
      command: "bunx playwright test",
      pattern: "tests/**/*.spec.ts",
    });
  });

  test("multiple --runner flags add multiple runners", async () => {
    await runCli([
      "init",
      "--runner", "unit:bun test:**/*.test.ts",
      "--runner", "e2e:bunx playwright test:**/*.spec.ts",
    ], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.config.testRunners).toHaveLength(2);
    expect(data.config.testRunners[0].name).toBe("unit");
    expect(data.config.testRunners[1].name).toBe("e2e");
  });

  test("--help shows usage", async () => {
    const result = await runCli(["init", "--help"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE:");
    expect(result.stdout).toContain("--force");
    expect(result.stdout).toContain("--runner");
  });

  test("-h shows usage", async () => {
    const result = await runCli(["init", "-h"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE:");
  });

  test("invalid runner spec shows error", async () => {
    const result = await runCli(["init", "--runner", "invalid"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid runner spec");
  });
});
