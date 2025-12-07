import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  createTestDir,
  runCli,
  readJsonFile,
  type TestContext,
} from "../setup";
import type { RequirementsFile } from "../../src/lib/types";

describe("tag command", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("fails without init", async () => {
    const result = await runCli(["tag", "REQ-001", "--add", "auth"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("requirements.json not found");
  });

  test("fails with nonexistent requirement", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["tag", "REQ-001", "--add", "auth"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("REQ-001 not found");
  });

  test("fails without id", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["tag", "--add", "auth"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Requirement ID is required");
  });

  test("fails without --add, --remove, or --clear", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    const result = await runCli(["tag", "REQ-001"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--add, --remove, or --clear is required");
  });

  test("--add adds a tag", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    const result = await runCli(["tag", "REQ-001", "--add", "auth"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[auth]");

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tags).toEqual(["auth"]);
  });

  test("--add can be repeated", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["tag", "REQ-001", "--add", "auth", "--add", "security"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tags).toEqual(["auth", "security"]);
  });

  test("--add does not duplicate existing tags", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--tag", "auth"], ctx.dir);
    await runCli(["tag", "REQ-001", "--add", "auth", "--add", "security"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tags).toEqual(["auth", "security"]);
  });

  test("--remove removes a tag", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--tag", "auth", "--tag", "security"], ctx.dir);
    await runCli(["tag", "REQ-001", "--remove", "auth"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tags).toEqual(["security"]);
  });

  test("--remove with nonexistent tag is no-op", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--tag", "auth"], ctx.dir);
    const result = await runCli(["tag", "REQ-001", "--remove", "security"], ctx.dir);

    expect(result.exitCode).toBe(0);
    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tags).toEqual(["auth"]);
  });

  test("--clear removes all tags", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--tag", "auth", "--tag", "security"], ctx.dir);
    const result = await runCli(["tag", "REQ-001", "--clear"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("(none)");

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tags).toBeUndefined();
  });

  test("creates history entry for tag changes", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["tag", "REQ-001", "--add", "auth", "--by", "Alice"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    const history = data.requirements["REQ-001"].history;
    expect(history).toHaveLength(2);
    expect(history[1].action).toBe("tags_changed");
    expect(history[1].by).toBe("Alice");
    expect(history[1].note).toContain("added: auth");
  });

  test("--help shows usage", async () => {
    const result = await runCli(["tag", "--help"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE:");
    expect(result.stdout).toContain("--add");
    expect(result.stdout).toContain("--remove");
    expect(result.stdout).toContain("--clear");
  });

  test("combine --add and --remove", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--tag", "old"], ctx.dir);
    await runCli(["tag", "REQ-001", "--add", "new", "--remove", "old"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tags).toEqual(["new"]);
  });
});
