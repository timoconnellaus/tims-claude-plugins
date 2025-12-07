import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import {
  createTestDir,
  runCli,
  readJsonFile,
  type TestContext,
} from "../setup";
import type { RequirementsFile, ArchiveFile } from "../../src/lib/types";

describe("end-to-end workflows", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("complete requirement lifecycle", async () => {
    // 1. Initialize with a test runner
    let result = await runCli(["init", "--runner", "unit:bun test:**/*.test.ts"], ctx.dir);
    expect(result.exitCode).toBe(0);

    // 2. Add a requirement with full metadata
    result = await runCli([
      "add", "User can log in with email and password",
      "--source", "jira",
      "--ref", "PROJ-123",
      "--by", "Alice",
    ], ctx.dir);
    expect(result.stdout).toContain("Created REQ-001");

    // 3. Link a test to the requirement
    result = await runCli(["link", "REQ-001", "tests/auth.test.ts:login test", "--by", "Bob"], ctx.dir);
    expect(result.stdout).toContain("Linked");

    // 4. Verify the requirement is listed with test
    result = await runCli(["list"], ctx.dir);
    expect(result.stdout).toContain("REQ-001");
    expect(result.stdout).toContain("User can log in");
    expect(result.stdout).toContain("Tests: 1 linked");

    // 5. Check shows the requirement has coverage
    result = await runCli(["check"], ctx.dir);
    expect(result.stdout).toContain("All requirements have tests linked");
    expect(result.stdout).toContain("With tests: 1");

    // 6. Archive the requirement with reason
    result = await runCli(["archive", "REQ-001", "--reason", "Feature moved to SSO", "--by", "Carol"], ctx.dir);
    expect(result.stdout).toContain("Archived REQ-001: Feature moved to SSO");

    // 7. Verify it's in the archive
    result = await runCli(["list", "--archived"], ctx.dir);
    expect(result.stdout).toContain("Archived Requirements:");
    expect(result.stdout).toContain("REQ-001");

    // 8. Verify it's not in active requirements
    result = await runCli(["list"], ctx.dir);
    expect(result.stdout).toContain("No requirements found");

    // 9. Check history shows full lifecycle
    result = await runCli(["history", "REQ-001", "--json"], ctx.dir);
    const history = JSON.parse(result.stdout);
    expect(history.archived).toBe(true);
    expect(history.history.length).toBe(3);
    expect(history.history[0].action).toBe("created");
    expect(history.history[0].by).toBe("Alice");
    expect(history.history[1].action).toBe("modified");
    expect(history.history[1].by).toBe("Bob");
    expect(history.history[2].action).toBe("archived");
    expect(history.history[2].note).toBe("Feature moved to SSO");
    expect(history.history[2].by).toBe("Carol");

    // 10. Restore the requirement
    result = await runCli(["restore", "REQ-001"], ctx.dir);
    expect(result.stdout).toContain("Restored REQ-001");

    // 11. Verify it's back in active requirements with all data intact
    result = await runCli(["list", "--json"], ctx.dir);
    const requirements = JSON.parse(result.stdout);
    expect(requirements["REQ-001"]).toBeDefined();
    expect(requirements["REQ-001"].description).toBe("User can log in with email and password");
    expect(requirements["REQ-001"].source.type).toBe("jira");
    expect(requirements["REQ-001"].source.reference).toBe("PROJ-123");
    expect(requirements["REQ-001"].tests).toHaveLength(1);
  });

  test("multiple requirements coverage workflow", async () => {
    await runCli(["init"], ctx.dir);

    // Add multiple requirements
    await runCli(["add", "Requirement A - User authentication"], ctx.dir);
    await runCli(["add", "Requirement B - User profile"], ctx.dir);
    await runCli(["add", "Requirement C - User settings"], ctx.dir);
    await runCli(["add", "Requirement D - Admin dashboard"], ctx.dir);

    // Link tests to only some requirements
    await runCli(["link", "REQ-001", "tests/auth.test.ts:auth test"], ctx.dir);
    await runCli(["link", "REQ-003", "tests/settings.test.ts:settings test"], ctx.dir);

    // Check coverage - "requirementsWithoutTests" shows those without ANY test links
    let result = await runCli(["check", "--json"], ctx.dir);
    const checkResult = JSON.parse(result.stdout);
    expect(checkResult.requirementsWithoutTests).toContain("REQ-002");
    expect(checkResult.requirementsWithoutTests).toContain("REQ-004");
    expect(checkResult.requirementsWithoutTests).not.toContain("REQ-001");
    expect(checkResult.requirementsWithoutTests).not.toContain("REQ-003");

    // Note: --status untested returns requirements where lastVerified is not set
    // This includes requirements WITH tests but not yet verified via check --run
    // So all 4 requirements are "untested" until check --run passes
    result = await runCli(["list", "--status", "untested", "--json"], ctx.dir);
    const untested = JSON.parse(result.stdout);
    expect(Object.keys(untested)).toHaveLength(4);

    // Summary shows test coverage (linked tests), not verification status
    result = await runCli(["check"], ctx.dir);
    expect(result.stdout).toContain("Total requirements: 4");
    expect(result.stdout).toContain("With tests: 2");
    expect(result.stdout).toContain("Without tests: 2");
  });

  test("test verification workflow with passing tests", async () => {
    // Create a test file that will pass
    await mkdir(join(ctx.dir, "tests"), { recursive: true });
    await writeFile(
      join(ctx.dir, "tests", "sample.test.ts"),
      `import { test, expect } from "bun:test";
test("login works", () => { expect(1 + 1).toBe(2); });
test("logout works", () => { expect(true).toBe(true); });`
    );

    // Initialize with test runner
    await runCli(["init", "--runner", "unit:bun test:**/*.test.ts"], ctx.dir);

    // Add requirements
    await runCli(["add", "Login functionality"], ctx.dir);
    await runCli(["add", "Logout functionality"], ctx.dir);

    // Link tests
    await runCli(["link", "REQ-001", "tests/sample.test.ts:login works"], ctx.dir);
    await runCli(["link", "REQ-002", "tests/sample.test.ts:logout works"], ctx.dir);

    // Verify no lastVerified yet
    let data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].lastVerified).toBeUndefined();
    expect(data.requirements["REQ-002"].lastVerified).toBeUndefined();

    // Run check --run
    const result = await runCli(["check", "--run"], ctx.dir);
    expect(result.stdout).toContain("Running unit: bun test");
    expect(result.stdout).toContain("Passing: 2");

    // Verify lastVerified is now set
    data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].lastVerified).toBeDefined();
    expect(data.requirements["REQ-002"].lastVerified).toBeDefined();

    // List should show verified status
    const listResult = await runCli(["list"], ctx.dir);
    expect(listResult.stdout).toContain("●");
  });

  test("orphan test detection workflow", async () => {
    // Create test files with multiple tests
    await mkdir(join(ctx.dir, "tests"), { recursive: true });
    await writeFile(
      join(ctx.dir, "tests", "sample.test.ts"),
      `import { test, expect } from "bun:test";
test("linked test", () => { expect(true).toBe(true); });
test("orphan test 1", () => { expect(true).toBe(true); });
test("orphan test 2", () => { expect(true).toBe(true); });`
    );

    // Initialize with test runner
    await runCli(["init", "--runner", "unit:bun test:**/*.test.ts"], ctx.dir);

    // Add a requirement and link only one test
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/sample.test.ts:linked test"], ctx.dir);

    // Check for orphans
    const result = await runCli(["check", "--orphans", "--json"], ctx.dir);
    const checkResult = JSON.parse(result.stdout);

    // Should find the two orphan tests
    expect(checkResult.testsWithoutRequirements.length).toBe(2);
    const orphanIdentifiers = checkResult.testsWithoutRequirements.map(
      (t: { identifier: string }) => t.identifier
    );
    expect(orphanIdentifiers).toContain("orphan test 1");
    expect(orphanIdentifiers).toContain("orphan test 2");
  });

  test("ID generation after archiving", async () => {
    await runCli(["init"], ctx.dir);

    // Add requirements
    await runCli(["add", "Req 1"], ctx.dir);
    await runCli(["add", "Req 2"], ctx.dir);
    await runCli(["add", "Req 3"], ctx.dir);

    // Archive REQ-002
    await runCli(["archive", "REQ-002"], ctx.dir);

    // Add another requirement - should be REQ-004, not REQ-002
    const result = await runCli(["add", "Req 4"], ctx.dir);
    expect(result.stdout).toContain("Created REQ-004");

    // Verify the IDs
    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(Object.keys(data.requirements).sort()).toEqual(["REQ-001", "REQ-003", "REQ-004"]);
  });

  test("multiple test runners workflow", async () => {
    await runCli([
      "init",
      "--runner", "unit:bun test:**/*.test.ts",
      "--runner", "e2e:playwright test:**/*.spec.ts",
    ], ctx.dir);

    await runCli(["add", "Unit testable requirement"], ctx.dir);
    await runCli(["add", "E2E testable requirement"], ctx.dir);

    await runCli(["link", "REQ-001", "tests/unit.test.ts:unit test", "--runner", "unit"], ctx.dir);
    await runCli(["link", "REQ-002", "tests/e2e.spec.ts:e2e test", "--runner", "e2e"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests[0].runner).toBe("unit");
    expect(data.requirements["REQ-002"].tests[0].runner).toBe("e2e");

    // List shows runner info
    const result = await runCli(["list"], ctx.dir);
    expect(result.stdout).toContain("(unit)");
    expect(result.stdout).toContain("(e2e)");
  });

  test("link and unlink multiple tests", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Feature with many tests"], ctx.dir);

    // Link multiple tests
    await runCli(["link", "REQ-001", "tests/a.test.ts:test a"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/b.test.ts:test b"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/c.test.ts:test c"], ctx.dir);

    let data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests).toHaveLength(3);

    // Unlink one
    await runCli(["unlink", "REQ-001", "tests/b.test.ts:test b"], ctx.dir);

    data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    expect(data.requirements["REQ-001"].tests).toHaveLength(2);
    const files = data.requirements["REQ-001"].tests.map((t) => t.file);
    expect(files).toContain("tests/a.test.ts");
    expect(files).toContain("tests/c.test.ts");
    expect(files).not.toContain("tests/b.test.ts");
  });

  test("json output can be piped between commands", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--source", "doc", "--ref", "specs.md"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test"], ctx.dir);

    // Get JSON list
    const listResult = await runCli(["list", "--json"], ctx.dir);
    const listData = JSON.parse(listResult.stdout);
    expect(Object.keys(listData)).toHaveLength(1);

    // Get JSON check
    const checkResult = await runCli(["check", "--json"], ctx.dir);
    const checkData = JSON.parse(checkResult.stdout);
    expect(checkData.requirementsWithoutTests).toHaveLength(0);

    // Get JSON history
    const historyResult = await runCli(["history", "REQ-001", "--json"], ctx.dir);
    const historyData = JSON.parse(historyResult.stdout);
    expect(historyData.id).toBe("REQ-001");
    expect(historyData.history).toHaveLength(2);
  });

  test("help command works", async () => {
    const result = await runCli(["--help"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("requirements-tracker");
    expect(result.stdout).toContain("COMMANDS:");
    expect(result.stdout).toContain("init");
    expect(result.stdout).toContain("add");
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("link");
    expect(result.stdout).toContain("unlink");
    expect(result.stdout).toContain("check");
    expect(result.stdout).toContain("archive");
    expect(result.stdout).toContain("restore");
    expect(result.stdout).toContain("history");
  });

  test("unknown command shows error and help", async () => {
    const result = await runCli(["unknown-command"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown command: unknown-command");
  });
});
