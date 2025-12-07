import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  createTestDir,
  runCli,
  readJsonFile,
  writeJsonFile,
  fileExists,
  createRequirementsFile,
  createRequirement,
  createArchiveFile,
  type TestContext,
} from "../setup";
import type { RequirementsFile, ArchiveFile } from "../../src/lib/types";

describe("archive command", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("fails without init", async () => {
    const result = await runCli(["archive", "REQ-001"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("requirements.json not found");
  });

  test("fails for unknown ID", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["archive", "REQ-999"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("REQ-999 not found");
  });

  test("moves requirement to archive file", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const result = await runCli(["archive", "REQ-001"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Archived REQ-001");

    const archive = await readJsonFile<ArchiveFile>(ctx.dir, "requirements.archive.json");
    expect(archive.requirements["REQ-001"]).toBeDefined();
    expect(archive.requirements["REQ-001"].description).toBe("Test requirement");
  });

  test("removes requirement from requirements.json", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["archive", "REQ-001"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"]).toBeUndefined();
  });

  test("creates archive file if missing", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    expect(await fileExists(ctx.dir, "requirements.archive.json")).toBe(false);

    await runCli(["archive", "REQ-001"], ctx.dir);

    expect(await fileExists(ctx.dir, "requirements.archive.json")).toBe(true);
  });

  test("--reason stores reason in history", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["archive", "REQ-001", "--reason", "Feature deprecated"], ctx.dir);

    const archive = await readJsonFile<ArchiveFile>(ctx.dir, "requirements.archive.json");
    const history = archive.requirements["REQ-001"].history;
    expect(history[history.length - 1].action).toBe("archived");
    expect(history[history.length - 1].note).toBe("Feature deprecated");
  });

  test("--reason is included in output", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const result = await runCli(["archive", "REQ-001", "--reason", "No longer needed"], ctx.dir);

    expect(result.stdout).toContain("Archived REQ-001: No longer needed");
  });

  test("--by records author in history", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["archive", "REQ-001", "--by", "Alice"], ctx.dir);

    const archive = await readJsonFile<ArchiveFile>(ctx.dir, "requirements.archive.json");
    const history = archive.requirements["REQ-001"].history;
    expect(history[history.length - 1].by).toBe("Alice");
  });

  test("adds archived history entry", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["archive", "REQ-001"], ctx.dir);

    const archive = await readJsonFile<ArchiveFile>(ctx.dir, "requirements.archive.json");
    const history = archive.requirements["REQ-001"].history;
    expect(history[history.length - 1].action).toBe("archived");
  });

  test("preserves requirement data when archiving", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--source", "jira", "--ref", "PROJ-123"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test"], ctx.dir);
    await runCli(["archive", "REQ-001"], ctx.dir);

    const archive = await readJsonFile<ArchiveFile>(ctx.dir, "requirements.archive.json");
    const req = archive.requirements["REQ-001"];
    expect(req.source.type).toBe("jira");
    expect(req.source.reference).toBe("PROJ-123");
    expect(req.tests).toHaveLength(1);
  });

  test("fails without ID", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["archive"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Requirement ID is required");
  });

  test("--help shows usage", async () => {
    const result = await runCli(["archive", "--help"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE:");
    expect(result.stdout).toContain("--reason");
    expect(result.stdout).toContain("--by");
  });
});

describe("restore command", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("fails without init", async () => {
    const result = await runCli(["restore", "REQ-001"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("requirements.json not found");
  });

  test("fails for unknown ID in archive", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["restore", "REQ-999"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("REQ-999 not found in archive");
  });

  test("moves requirement back to requirements.json", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["archive", "REQ-001"], ctx.dir);

    const result = await runCli(["restore", "REQ-001"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Restored REQ-001");

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"]).toBeDefined();
    expect(data.requirements["REQ-001"].description).toBe("Test requirement");
  });

  test("removes requirement from archive", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["archive", "REQ-001"], ctx.dir);
    await runCli(["restore", "REQ-001"], ctx.dir);

    const archive = await readJsonFile<ArchiveFile>(ctx.dir, "requirements.archive.json");
    expect(archive.requirements["REQ-001"]).toBeUndefined();
  });

  test("fails if ID already exists in active requirements", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "First requirement"], ctx.dir);
    await runCli(["archive", "REQ-001"], ctx.dir);
    await runCli(["add", "Second requirement"], ctx.dir);

    // Manually add REQ-001 back to archive
    const archive = await readJsonFile<ArchiveFile>(ctx.dir, "requirements.archive.json");
    archive.requirements["REQ-002"] = createRequirement({ description: "Archived 2" });
    await writeJsonFile(ctx.dir, "requirements.archive.json", archive);

    // Manually update requirements to have REQ-002
    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    data.requirements["REQ-002"] = createRequirement({ description: "Active 2" });
    await writeJsonFile(ctx.dir, "requirements.json", data);

    const result = await runCli(["restore", "REQ-002"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("already exists in active requirements");
  });

  test("adds restored history entry", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["archive", "REQ-001"], ctx.dir);
    await runCli(["restore", "REQ-001"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    const history = data.requirements["REQ-001"].history;
    expect(history[history.length - 1].action).toBe("restored");
  });

  test("preserves full history through archive and restore", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--by", "Alice"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test"], ctx.dir);
    await runCli(["archive", "REQ-001", "--reason", "Pausing"], ctx.dir);
    await runCli(["restore", "REQ-001"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    const history = data.requirements["REQ-001"].history;

    expect(history.length).toBe(4);
    expect(history[0].action).toBe("created");
    expect(history[1].action).toBe("modified");
    expect(history[2].action).toBe("archived");
    expect(history[3].action).toBe("restored");
  });

  test("fails without ID", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["restore"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Requirement ID is required");
  });

  test("--help shows usage", async () => {
    const result = await runCli(["restore", "--help"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE:");
  });
});
