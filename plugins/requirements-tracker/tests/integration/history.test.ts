import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  createTestDir,
  runCli,
  type TestContext,
} from "../setup";

describe("history command", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("fails without init", async () => {
    const result = await runCli(["history", "REQ-001"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("requirements.json not found");
  });

  test("fails for unknown ID", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["history", "REQ-999"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("REQ-999 not found");
  });

  test("shows history from active requirements", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--by", "Alice"], ctx.dir);

    const result = await runCli(["history", "REQ-001"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("History for REQ-001");
    expect(result.stdout).toContain("Test requirement");
    expect(result.stdout).toContain("created");
    expect(result.stdout).toContain("Alice");
  });

  test("shows history from archived requirements", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Archived requirement"], ctx.dir);
    await runCli(["archive", "REQ-001", "--reason", "Deprecated"], ctx.dir);

    const result = await runCli(["history", "REQ-001"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("History for REQ-001 (archived)");
    expect(result.stdout).toContain("Archived requirement");
    expect(result.stdout).toContain("created");
    expect(result.stdout).toContain("archived");
    expect(result.stdout).toContain("Deprecated");
  });

  test("indicates when requirement is archived", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["archive", "REQ-001"], ctx.dir);

    const result = await runCli(["history", "REQ-001"], ctx.dir);

    expect(result.stdout).toContain("(archived)");
  });

  test("shows all history entries in order", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test"], ctx.dir);
    await runCli(["unlink", "REQ-001", "tests/a.test.ts:test"], ctx.dir);

    const result = await runCli(["history", "REQ-001"], ctx.dir);

    expect(result.stdout).toContain("created");
    // Should have multiple modified entries
    const modifiedCount = (result.stdout.match(/modified/g) || []).length;
    expect(modifiedCount).toBeGreaterThanOrEqual(2);
  });

  test("shows by field when present", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--by", "Bob"], ctx.dir);

    const result = await runCli(["history", "REQ-001"], ctx.dir);

    expect(result.stdout).toContain("by Bob");
  });

  test("shows note field when present", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/auth.test.ts:login test"], ctx.dir);

    const result = await runCli(["history", "REQ-001"], ctx.dir);

    expect(result.stdout).toContain("Linked test: tests/auth.test.ts:login test");
  });

  test("--json outputs structured history", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--by", "Alice"], ctx.dir);

    const result = await runCli(["history", "REQ-001", "--json"], ctx.dir);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.id).toBe("REQ-001");
    expect(parsed.description).toBe("Test requirement");
    expect(parsed.archived).toBe(false);
    expect(parsed.history).toHaveLength(1);
    expect(parsed.history[0].action).toBe("created");
    expect(parsed.history[0].by).toBe("Alice");
  });

  test("--json shows archived flag for archived requirements", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["archive", "REQ-001"], ctx.dir);

    const result = await runCli(["history", "REQ-001", "--json"], ctx.dir);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.archived).toBe(true);
  });

  test("--json includes full history with all entries", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test", "--by", "Carol"], ctx.dir);
    await runCli(["archive", "REQ-001", "--reason", "Done"], ctx.dir);
    await runCli(["restore", "REQ-001"], ctx.dir);

    const result = await runCli(["history", "REQ-001", "--json"], ctx.dir);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.history).toHaveLength(4);
    expect(parsed.history[0].action).toBe("created");
    expect(parsed.history[1].action).toBe("modified");
    expect(parsed.history[1].by).toBe("Carol");
    expect(parsed.history[2].action).toBe("archived");
    expect(parsed.history[2].note).toBe("Done");
    expect(parsed.history[3].action).toBe("restored");
  });

  test("fails without ID", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["history"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Requirement ID is required");
  });

  test("--help shows usage", async () => {
    const result = await runCli(["history", "--help"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE:");
    expect(result.stdout).toContain("--json");
  });

  test("shows description in output", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "User can login with email"], ctx.dir);

    const result = await runCli(["history", "REQ-001"], ctx.dir);

    expect(result.stdout).toContain('"User can login with email"');
  });

  test("history entries have timestamps", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const result = await runCli(["history", "REQ-001", "--json"], ctx.dir);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.history[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
