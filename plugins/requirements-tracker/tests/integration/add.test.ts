import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  createTestDir,
  runCli,
  readJsonFile,
  type TestContext,
} from "../setup";
import type { RequirementsFile } from "../../src/lib/types";

describe("add command", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("fails without init", async () => {
    const result = await runCli(["add", "Test requirement"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("requirements.json not found");
  });

  test("adds requirement with auto-generated ID REQ-001", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["add", "Test requirement"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Created REQ-001");
  });

  test("generates sequential IDs", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "First requirement"], ctx.dir);
    await runCli(["add", "Second requirement"], ctx.dir);
    const result = await runCli(["add", "Third requirement"], ctx.dir);

    expect(result.stdout).toContain("Created REQ-003");

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(Object.keys(data.requirements)).toEqual(["REQ-001", "REQ-002", "REQ-003"]);
  });

  test("stores description correctly", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "User can login with email"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].description).toBe("User can login with email");
  });

  test("default source is manual", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].source.type).toBe("manual");
  });

  test("--source sets source type to doc", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--source", "doc"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].source.type).toBe("doc");
  });

  test("--source sets source type to jira", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--source", "jira"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].source.type).toBe("jira");
  });

  test("--source sets source type to slack", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--source", "slack"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].source.type).toBe("slack");
  });

  test("--source sets source type to ai", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--source", "ai"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].source.type).toBe("ai");
  });

  test("--source rejects invalid type", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["add", "Test requirement", "--source", "invalid"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid source type");
  });

  test("--ref stores reference", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--ref", "specs/api.md#L42"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].source.reference).toBe("specs/api.md#L42");
  });

  test("--by records author in history", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--by", "Alice"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].history[0].by).toBe("Alice");
  });

  test("creates history entry with action=created", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].history).toHaveLength(1);
    expect(data.requirements["REQ-001"].history[0].action).toBe("created");
  });

  test("history entry has timestamp", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    const timestamp = data.requirements["REQ-001"].history[0].timestamp;
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test("source has capturedAt timestamp", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    const capturedAt = data.requirements["REQ-001"].source.capturedAt;
    expect(capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test("starts with empty tests array", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests).toEqual([]);
  });

  test("outputs created ID and description", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["add", "User can login"], ctx.dir);

    expect(result.stdout).toContain("Created REQ-001: User can login");
  });

  test("fails without description", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["add"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Description is required");
  });

  test("--help shows usage", async () => {
    const result = await runCli(["add", "--help"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE:");
    expect(result.stdout).toContain("--source");
    expect(result.stdout).toContain("--ref");
    expect(result.stdout).toContain("--by");
  });

  test("combines --source, --ref, and --by", async () => {
    await runCli(["init"], ctx.dir);
    await runCli([
      "add", "Fix login bug",
      "--source", "jira",
      "--ref", "PROJ-123",
      "--by", "Bob",
    ], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    const req = data.requirements["REQ-001"];
    expect(req.source.type).toBe("jira");
    expect(req.source.reference).toBe("PROJ-123");
    expect(req.history[0].by).toBe("Bob");
  });

  // Tag tests
  test("--tag adds a single tag", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--tag", "auth"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tags).toEqual(["auth"]);
  });

  test("--tag can be repeated for multiple tags", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--tag", "auth", "--tag", "security"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tags).toEqual(["auth", "security"]);
  });

  test("no tags results in undefined tags field", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tags).toBeUndefined();
  });

  // Priority tests
  test("--priority sets priority", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--priority", "critical"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].priority).toBe("critical");
  });

  test("default priority is medium", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].priority).toBe("medium");
  });

  test("--priority rejects invalid value", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["add", "Test requirement", "--priority", "urgent"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid priority");
  });

  // Status tests
  test("--status sets status", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--status", "approved"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].status).toBe("approved");
  });

  test("default status is draft", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].status).toBe("draft");
  });

  test("--status rejects invalid value", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["add", "Test requirement", "--status", "pending"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid status");
  });

  // Combined test
  test("combines tags, priority, and status", async () => {
    await runCli(["init"], ctx.dir);
    await runCli([
      "add", "OAuth integration",
      "--tag", "auth",
      "--tag", "security",
      "--priority", "high",
      "--status", "approved",
    ], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    const req = data.requirements["REQ-001"];
    expect(req.tags).toEqual(["auth", "security"]);
    expect(req.priority).toBe("high");
    expect(req.status).toBe("approved");
  });

  test("output includes non-default metadata", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli([
      "add", "Test",
      "--tag", "api",
      "--priority", "critical",
      "--status", "implemented",
    ], ctx.dir);

    expect(result.stdout).toContain("priority: critical");
    expect(result.stdout).toContain("status: implemented");
    expect(result.stdout).toContain("tags: [api]");
  });
});
