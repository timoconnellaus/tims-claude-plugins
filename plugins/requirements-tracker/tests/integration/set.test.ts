import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  createTestDir,
  runCli,
  readJsonFile,
  type TestContext,
} from "../setup";
import type { RequirementsFile } from "../../src/lib/types";

describe("set command", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("fails without init", async () => {
    const result = await runCli(["set", "REQ-001", "--priority", "high"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("requirements.json not found");
  });

  test("fails with nonexistent requirement", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["set", "REQ-001", "--priority", "high"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("REQ-001 not found");
  });

  test("fails without id", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["set", "--priority", "high"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Requirement ID is required");
  });

  test("fails without --priority or --status", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    const result = await runCli(["set", "REQ-001"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--priority or --status is required");
  });

  test("--priority sets priority", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    const result = await runCli(["set", "REQ-001", "--priority", "critical"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("priority: critical");

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].priority).toBe("critical");
  });

  test("--priority rejects invalid value", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    const result = await runCli(["set", "REQ-001", "--priority", "urgent"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid priority");
  });

  test("--status sets status", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    const result = await runCli(["set", "REQ-001", "--status", "approved"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("status: approved");

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].status).toBe("approved");
  });

  test("--status rejects invalid value", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    const result = await runCli(["set", "REQ-001", "--status", "pending"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid status");
  });

  test("combines --priority and --status", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    const result = await runCli([
      "set", "REQ-001",
      "--priority", "high",
      "--status", "implemented",
    ], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("priority: high");
    expect(result.stdout).toContain("status: implemented");

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].priority).toBe("high");
    expect(data.requirements["REQ-001"].status).toBe("implemented");
  });

  test("creates history entry for priority change", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["set", "REQ-001", "--priority", "critical", "--by", "Alice"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    const history = data.requirements["REQ-001"].history;
    expect(history).toHaveLength(2);
    expect(history[1].action).toBe("priority_changed");
    expect(history[1].by).toBe("Alice");
    expect(history[1].note).toContain("medium -> critical");
  });

  test("creates history entry for status change", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["set", "REQ-001", "--status", "approved", "--by", "Bob"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    const history = data.requirements["REQ-001"].history;
    expect(history).toHaveLength(2);
    expect(history[1].action).toBe("status_changed");
    expect(history[1].by).toBe("Bob");
    expect(history[1].note).toContain("draft -> approved");
  });

  test("creates separate history entries for both changes", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["set", "REQ-001", "--priority", "high", "--status", "approved"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    const history = data.requirements["REQ-001"].history;
    expect(history).toHaveLength(3);
    expect(history[1].action).toBe("priority_changed");
    expect(history[2].action).toBe("status_changed");
  });

  test("no change when setting same value", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--priority", "high"], ctx.dir);
    const result = await runCli(["set", "REQ-001", "--priority", "high"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("no changes");

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].history).toHaveLength(1);
  });

  test("--help shows usage", async () => {
    const result = await runCli(["set", "--help"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE:");
    expect(result.stdout).toContain("--priority");
    expect(result.stdout).toContain("--status");
  });
});
