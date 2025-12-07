import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import {
  createTestDir,
  runCli,
  readJsonFile,
  writeJsonFile,
  createRequirementsFile,
  createRequirement,
  createTestLink,
  createTestRunner,
  type TestContext,
} from "../setup";
import type { RequirementsFile } from "../../src/lib/types";

describe("check command", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("fails without init", async () => {
    const result = await runCli(["check"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("requirements.json not found");
  });

  test("shows summary with no requirements", async () => {
    await runCli(["init"], ctx.dir);

    const result = await runCli(["check"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Summary");
    expect(result.stdout).toContain("Total requirements: 0");
  });

  test("shows requirements without tests", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Untested requirement"], ctx.dir);

    const result = await runCli(["check"], ctx.dir);

    expect(result.stdout).toContain("Requirements without tests");
    expect(result.stdout).toContain("REQ-001");
    expect(result.stdout).toContain("Untested requirement");
  });

  test("shows all requirements have tests when coverage complete", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test"], ctx.dir);

    const result = await runCli(["check"], ctx.dir);

    expect(result.stdout).toContain("All requirements have tests linked");
  });

  test("--coverage shows only coverage info", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Untested requirement"], ctx.dir);

    const result = await runCli(["check", "--coverage"], ctx.dir);

    expect(result.stdout).toContain("Coverage");
    expect(result.stdout).toContain("REQ-001");
    expect(result.stdout).not.toContain("Summary");
  });

  test("--orphans finds unlinked tests", async () => {
    await runCli(["init", "--runner", "unit:bun test:**/*.test.ts"], ctx.dir);

    // Create a test file
    await mkdir(join(ctx.dir, "tests"), { recursive: true });
    await writeFile(
      join(ctx.dir, "tests", "sample.test.ts"),
      `import { test, expect } from "bun:test";
test("orphan test", () => { expect(true).toBe(true); });`
    );

    const result = await runCli(["check", "--orphans"], ctx.dir);

    expect(result.stdout).toContain("Orphan Tests");
    expect(result.stdout).toContain("sample.test.ts");
    expect(result.stdout).toContain("orphan test");
  });

  test("--orphans shows all tests linked when none orphaned", async () => {
    await runCli(["init", "--runner", "unit:bun test:**/*.test.ts"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    // Create a test file
    await mkdir(join(ctx.dir, "tests"), { recursive: true });
    await writeFile(
      join(ctx.dir, "tests", "sample.test.ts"),
      `import { test, expect } from "bun:test";
test("linked test", () => { expect(true).toBe(true); });`
    );

    // Link the test
    await runCli(["link", "REQ-001", "tests/sample.test.ts:linked test"], ctx.dir);

    const result = await runCli(["check", "--orphans"], ctx.dir);

    expect(result.stdout).toContain("All tests are linked to requirements");
  });

  test("--json outputs structured result", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const result = await runCli(["check", "--json"], ctx.dir);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.requirementsWithoutTests).toEqual(["REQ-001"]);
    expect(parsed.testsWithoutRequirements).toEqual([]);
    expect(parsed.passingRequirements).toEqual([]);
    expect(parsed.failingRequirements).toEqual([]);
    expect(parsed.untestedRequirements).toEqual(["REQ-001"]);
  });

  test("--json includes all result fields", async () => {
    await runCli(["init"], ctx.dir);

    const result = await runCli(["check", "--json"], ctx.dir);

    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty("requirementsWithoutTests");
    expect(parsed).toHaveProperty("testsWithoutRequirements");
    expect(parsed).toHaveProperty("passingRequirements");
    expect(parsed).toHaveProperty("failingRequirements");
    expect(parsed).toHaveProperty("untestedRequirements");
  });

  test("summary counts are accurate", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Req 1"], ctx.dir);
    await runCli(["add", "Req 2"], ctx.dir);
    await runCli(["add", "Req 3"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test"], ctx.dir);
    await runCli(["link", "REQ-002", "tests/b.test.ts:test"], ctx.dir);

    const result = await runCli(["check"], ctx.dir);

    expect(result.stdout).toContain("Total requirements: 3");
    expect(result.stdout).toContain("With tests: 2");
    expect(result.stdout).toContain("Without tests: 1");
  });

  test("--help shows usage", async () => {
    const result = await runCli(["check", "--help"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE:");
    expect(result.stdout).toContain("--coverage");
    expect(result.stdout).toContain("--orphans");
    expect(result.stdout).toContain("--run");
    expect(result.stdout).toContain("--json");
  });
});

describe("check --run command", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("runs configured test command", async () => {
    // Use 'true' command which always exits 0
    await writeJsonFile(ctx.dir, "requirements.json", createRequirementsFile({
      config: {
        testRunners: [{ name: "unit", command: "true", pattern: "**/*.test.ts" }],
      },
      requirements: {
        "REQ-001": createRequirement({
          description: "Test requirement",
          tests: [createTestLink({ runner: "unit" })],
        }),
      },
    }));

    const result = await runCli(["check", "--run"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Running unit: true");
    expect(result.stdout).toContain("Passing: 1");
  });

  test("updates lastVerified on success", async () => {
    await writeJsonFile(ctx.dir, "requirements.json", createRequirementsFile({
      config: {
        testRunners: [{ name: "unit", command: "true", pattern: "**/*.test.ts" }],
      },
      requirements: {
        "REQ-001": createRequirement({
          description: "Test requirement",
          tests: [createTestLink({ runner: "unit" })],
        }),
      },
    }));

    await runCli(["check", "--run"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].lastVerified).toBeDefined();
    expect(data.requirements["REQ-001"].lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("does not update lastVerified on failure", async () => {
    // Use 'false' command which always exits 1
    await writeJsonFile(ctx.dir, "requirements.json", createRequirementsFile({
      config: {
        testRunners: [{ name: "unit", command: "false", pattern: "**/*.test.ts" }],
      },
      requirements: {
        "REQ-001": createRequirement({
          description: "Test requirement",
          tests: [createTestLink({ runner: "unit" })],
        }),
      },
    }));

    await runCli(["check", "--run"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].lastVerified).toBeUndefined();
  });

  test("reports failing count", async () => {
    await writeJsonFile(ctx.dir, "requirements.json", createRequirementsFile({
      config: {
        testRunners: [{ name: "unit", command: "false", pattern: "**/*.test.ts" }],
      },
      requirements: {
        "REQ-001": createRequirement({
          description: "Failing requirement",
          tests: [createTestLink({ runner: "unit" })],
        }),
      },
    }));

    const result = await runCli(["check", "--run"], ctx.dir);

    expect(result.stdout).toContain("Failing: 1");
    expect(result.stdout).toContain("Failing requirements:");
    expect(result.stdout).toContain("REQ-001");
  });

  test("handles multiple requirements with same runner", async () => {
    await writeJsonFile(ctx.dir, "requirements.json", createRequirementsFile({
      config: {
        testRunners: [{ name: "unit", command: "true", pattern: "**/*.test.ts" }],
      },
      requirements: {
        "REQ-001": createRequirement({
          description: "Req 1",
          tests: [createTestLink({ runner: "unit" })],
        }),
        "REQ-002": createRequirement({
          description: "Req 2",
          tests: [createTestLink({ runner: "unit", file: "tests/b.test.ts" })],
        }),
      },
    }));

    const result = await runCli(["check", "--run"], ctx.dir);

    expect(result.stdout).toContain("Passing: 2");
  });

  test("skips requirements without matching runner", async () => {
    await writeJsonFile(ctx.dir, "requirements.json", createRequirementsFile({
      config: {
        testRunners: [{ name: "unit", command: "true", pattern: "**/*.test.ts" }],
      },
      requirements: {
        "REQ-001": createRequirement({
          description: "Has runner",
          tests: [createTestLink({ runner: "unit" })],
        }),
        "REQ-002": createRequirement({
          description: "No matching runner",
          tests: [createTestLink({ runner: "unknown" })],
        }),
      },
    }));

    const result = await runCli(["check", "--run"], ctx.dir);

    // Only REQ-001 should be processed
    expect(result.stdout).toContain("Passing: 1");
  });

  test("--run with --json outputs result", async () => {
    await writeJsonFile(ctx.dir, "requirements.json", createRequirementsFile({
      config: {
        testRunners: [{ name: "unit", command: "true", pattern: "**/*.test.ts" }],
      },
      requirements: {
        "REQ-001": createRequirement({
          description: "Test requirement",
          tests: [createTestLink({ runner: "unit" })],
        }),
      },
    }));

    const result = await runCli(["check", "--run", "--json"], ctx.dir);

    // The output includes "Running..." message followed by JSON
    // Extract just the JSON part
    const jsonStart = result.stdout.indexOf("{");
    const jsonPart = result.stdout.slice(jsonStart);
    const parsed = JSON.parse(jsonPart);
    expect(parsed.passingRequirements).toContain("REQ-001");
  });

  test("runs actual bun test with passing test file", async () => {
    await mkdir(join(ctx.dir, "tests"), { recursive: true });
    await writeFile(
      join(ctx.dir, "tests", "sample.test.ts"),
      `import { test, expect } from "bun:test";
test("passes", () => { expect(true).toBe(true); });`
    );

    await writeJsonFile(ctx.dir, "requirements.json", createRequirementsFile({
      config: {
        testRunners: [{ name: "unit", command: "bun test", pattern: "**/*.test.ts" }],
      },
      requirements: {
        "REQ-001": createRequirement({
          description: "Test requirement",
          tests: [createTestLink({
            runner: "unit",
            file: "tests/sample.test.ts",
            identifier: "passes",
          })],
        }),
      },
    }));

    const result = await runCli(["check", "--run"], ctx.dir);

    expect(result.stdout).toContain("Passing: 1");

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].lastVerified).toBeDefined();
  });

  test("runs actual bun test with failing test file", async () => {
    await mkdir(join(ctx.dir, "tests"), { recursive: true });
    await writeFile(
      join(ctx.dir, "tests", "sample.test.ts"),
      `import { test, expect } from "bun:test";
test("fails", () => { expect(true).toBe(false); });`
    );

    await writeJsonFile(ctx.dir, "requirements.json", createRequirementsFile({
      config: {
        testRunners: [{ name: "unit", command: "bun test", pattern: "**/*.test.ts" }],
      },
      requirements: {
        "REQ-001": createRequirement({
          description: "Test requirement",
          tests: [createTestLink({
            runner: "unit",
            file: "tests/sample.test.ts",
            identifier: "fails",
          })],
        }),
      },
    }));

    const result = await runCli(["check", "--run"], ctx.dir);

    expect(result.stdout).toContain("Failing: 1");

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].lastVerified).toBeUndefined();
  });
});
