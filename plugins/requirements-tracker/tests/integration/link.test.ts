import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  createTestDir,
  runCli,
  readJsonFile,
  type TestContext,
} from "../setup";
import type { RequirementsFile } from "../../src/lib/types";

describe("link command", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("fails without init", async () => {
    const result = await runCli(["link", "REQ-001", "tests/a.test.ts:test"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("requirements.json not found");
  });

  test("fails for unknown requirement ID", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["link", "REQ-999", "tests/a.test.ts:test"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("REQ-999 not found");
  });

  test("adds test link to requirement", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const result = await runCli(["link", "REQ-001", "tests/auth.test.ts:login test"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Linked tests/auth.test.ts:login test to REQ-001");

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests).toHaveLength(1);
    expect(data.requirements["REQ-001"].tests[0].file).toBe("tests/auth.test.ts");
    expect(data.requirements["REQ-001"].tests[0].identifier).toBe("login test");
  });

  test("parses file:identifier correctly", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "src/tests/example.spec.ts:handles edge case"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests[0].file).toBe("src/tests/example.spec.ts");
    expect(data.requirements["REQ-001"].tests[0].identifier).toBe("handles edge case");
  });

  test("splits at last colon to separate file from identifier", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    // The implementation uses lastIndexOf(":") to split, so colons in the file path are ok
    // but colons in the identifier would need the file to have no colons
    await runCli(["link", "REQ-001", "tests/a.test.ts:test works"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests[0].file).toBe("tests/a.test.ts");
    expect(data.requirements["REQ-001"].tests[0].identifier).toBe("test works");
  });

  test("uses first configured runner by default", async () => {
    await runCli(["init", "--runner", "unit:bun test:**/*.test.ts"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests[0].runner).toBe("unit");
  });

  test("uses 'default' runner when no runners configured", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests[0].runner).toBe("default");
  });

  test("--runner specifies runner", async () => {
    await runCli(["init", "--runner", "unit:bun test:**/*.test.ts", "--runner", "e2e:playwright test:**/*.spec.ts"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.spec.ts:test", "--runner", "e2e"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests[0].runner).toBe("e2e");
  });

  test("warns on unknown runner but still works", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const result = await runCli(["link", "REQ-001", "tests/a.test.ts:test", "--runner", "unknown"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("Warning: Runner 'unknown' not found");

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests[0].runner).toBe("unknown");
  });

  test("prevents duplicate links", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test"], ctx.dir);

    const result = await runCli(["link", "REQ-001", "tests/a.test.ts:test"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("already linked");

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests).toHaveLength(1);
  });

  test("adds history entry with modified action", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].history).toHaveLength(2);
    expect(data.requirements["REQ-001"].history[1].action).toBe("modified");
    expect(data.requirements["REQ-001"].history[1].note).toContain("Linked test");
  });

  test("--by records author in history", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test", "--by", "Alice"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].history[1].by).toBe("Alice");
  });

  test("test link has linkedAt timestamp", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests[0].linkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test("can link multiple tests to same requirement", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test a"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/b.test.ts:test b"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests).toHaveLength(2);
  });

  test("fails without test spec", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const result = await runCli(["link", "REQ-001"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Usage:");
  });

  test("fails with invalid test spec format", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const result = await runCli(["link", "REQ-001", "invalid-no-colon"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid test spec");
  });

  test("--help shows usage", async () => {
    const result = await runCli(["link", "--help"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE:");
    expect(result.stdout).toContain("--runner");
    expect(result.stdout).toContain("--by");
  });
});

describe("unlink command", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("fails without init", async () => {
    const result = await runCli(["unlink", "REQ-001", "tests/a.test.ts:test"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("requirements.json not found");
  });

  test("fails for unknown requirement ID", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["unlink", "REQ-999", "tests/a.test.ts:test"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("REQ-999 not found");
  });

  test("removes test link from requirement", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test"], ctx.dir);

    const result = await runCli(["unlink", "REQ-001", "tests/a.test.ts:test"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Unlinked tests/a.test.ts:test from REQ-001");

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests).toHaveLength(0);
  });

  test("handles non-existent link gracefully", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const result = await runCli(["unlink", "REQ-001", "tests/a.test.ts:nonexistent"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("not linked");
  });

  test("adds history entry with modified action", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test"], ctx.dir);
    await runCli(["unlink", "REQ-001", "tests/a.test.ts:test"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    const history = data.requirements["REQ-001"].history;
    expect(history[history.length - 1].action).toBe("modified");
    expect(history[history.length - 1].note).toContain("Unlinked test");
  });

  test("only removes the specified test", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test a"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/b.test.ts:test b"], ctx.dir);
    await runCli(["unlink", "REQ-001", "tests/a.test.ts:test a"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests).toHaveLength(1);
    expect(data.requirements["REQ-001"].tests[0].file).toBe("tests/b.test.ts");
  });

  test("fails without test spec", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const result = await runCli(["unlink", "REQ-001"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Usage:");
  });

  test("--help shows usage", async () => {
    const result = await runCli(["unlink", "--help"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE:");
  });
});
