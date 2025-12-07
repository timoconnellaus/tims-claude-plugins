import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  createTestDir,
  runCli,
  readJsonFile,
  writeJsonFile,
  createRequirementsFile,
  createRequirement,
  createTestLink,
  createArchiveFile,
  type TestContext,
} from "../setup";
import type { RequirementsFile, ArchiveFile } from "../../src/lib/types";

describe("list command", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("fails without init", async () => {
    const result = await runCli(["list"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("requirements.json not found");
  });

  test("shows empty message with no requirements", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["list"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("No requirements found");
  });

  test("lists requirements with ID and description", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "User can login"], ctx.dir);
    await runCli(["add", "User can logout"], ctx.dir);

    const result = await runCli(["list"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("REQ-001");
    expect(result.stdout).toContain("User can login");
    expect(result.stdout).toContain("REQ-002");
    expect(result.stdout).toContain("User can logout");
  });

  test("shows untested indicator for requirements without tests", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const result = await runCli(["list"], ctx.dir);

    expect(result.stdout).toContain("○");
  });

  test("shows tests linked indicator for requirements with tests", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/sample.test.ts:test case"], ctx.dir);

    const result = await runCli(["list"], ctx.dir);

    expect(result.stdout).toContain("◐");
  });

  test("shows verified indicator for requirements with lastVerified", async () => {
    await runCli(["init"], ctx.dir);

    const data = createRequirementsFile({
      requirements: {
        "REQ-001": createRequirement({
          description: "Verified requirement",
          tests: [createTestLink()],
          lastVerified: new Date().toISOString(),
        }),
      },
    });
    await writeJsonFile(ctx.dir, "requirements.json", data);

    const result = await runCli(["list"], ctx.dir);

    expect(result.stdout).toContain("●");
  });

  test("shows source info", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--source", "jira", "--ref", "PROJ-123"], ctx.dir);

    const result = await runCli(["list"], ctx.dir);

    expect(result.stdout).toContain("[jira: PROJ-123]");
  });

  test("shows source type only when no reference", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--source", "doc"], ctx.dir);

    const result = await runCli(["list"], ctx.dir);

    expect(result.stdout).toContain("[doc]");
  });

  test("shows test count", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/a.test.ts:test a"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/b.test.ts:test b"], ctx.dir);

    const result = await runCli(["list"], ctx.dir);

    expect(result.stdout).toContain("Tests: 2 linked");
  });

  test("shows linked test details", async () => {
    await runCli(["init", "--runner", "unit:bun test:**/*.test.ts"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);
    await runCli(["link", "REQ-001", "tests/sample.test.ts:login works"], ctx.dir);

    const result = await runCli(["list"], ctx.dir);

    expect(result.stdout).toContain("tests/sample.test.ts:login works");
    expect(result.stdout).toContain("(unit)");
  });

  test("--status untested filters correctly", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Untested requirement"], ctx.dir);
    await runCli(["add", "Has tests"], ctx.dir);
    await runCli(["link", "REQ-002", "tests/a.test.ts:test a"], ctx.dir);

    // Create lastVerified for REQ-002 to make it "passing"
    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    data.requirements["REQ-002"].lastVerified = new Date().toISOString();
    await writeJsonFile(ctx.dir, "requirements.json", data);

    const result = await runCli(["list", "--status", "untested"], ctx.dir);

    expect(result.stdout).toContain("REQ-001");
    expect(result.stdout).not.toContain("REQ-002");
  });

  test("--status passing filters correctly", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Untested requirement"], ctx.dir);
    await runCli(["add", "Passing requirement"], ctx.dir);
    await runCli(["link", "REQ-002", "tests/a.test.ts:test a"], ctx.dir);

    const data = await readJsonFile<RequirementsFile>(ctx.dir, "requirements.json");
    data.requirements["REQ-002"].lastVerified = new Date().toISOString();
    await writeJsonFile(ctx.dir, "requirements.json", data);

    const result = await runCli(["list", "--status", "passing"], ctx.dir);

    expect(result.stdout).toContain("REQ-002");
    expect(result.stdout).not.toContain("REQ-001");
  });

  test("--status all shows all requirements", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "First requirement"], ctx.dir);
    await runCli(["add", "Second requirement"], ctx.dir);

    const result = await runCli(["list", "--status", "all"], ctx.dir);

    expect(result.stdout).toContain("REQ-001");
    expect(result.stdout).toContain("REQ-002");
  });

  test("--archived shows archive file contents", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Requirement to archive"], ctx.dir);
    await runCli(["archive", "REQ-001"], ctx.dir);

    const result = await runCli(["list", "--archived"], ctx.dir);

    expect(result.stdout).toContain("Archived Requirements:");
    expect(result.stdout).toContain("REQ-001");
    expect(result.stdout).toContain("Requirement to archive");
  });

  test("--archived shows empty message when no archived requirements", async () => {
    await runCli(["init"], ctx.dir);

    const result = await runCli(["list", "--archived"], ctx.dir);

    expect(result.stdout).toContain("No archived requirements");
  });

  test("--json outputs valid JSON", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const result = await runCli(["list", "--json"], ctx.dir);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed["REQ-001"]).toBeDefined();
    expect(parsed["REQ-001"].description).toBe("Test requirement");
  });

  test("--json outputs empty object when no requirements", async () => {
    await runCli(["init"], ctx.dir);

    const result = await runCli(["list", "--json"], ctx.dir);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toEqual({});
  });

  test("--json with --archived outputs archived requirements", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Archived requirement"], ctx.dir);
    await runCli(["archive", "REQ-001"], ctx.dir);

    const result = await runCli(["list", "--archived", "--json"], ctx.dir);

    const parsed = JSON.parse(result.stdout);
    expect(parsed["REQ-001"]).toBeDefined();
  });

  test("shows legend", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement"], ctx.dir);

    const result = await runCli(["list"], ctx.dir);

    expect(result.stdout).toContain("Legend:");
    expect(result.stdout).toContain("untested");
    expect(result.stdout).toContain("verified passing");
  });

  test("--help shows usage", async () => {
    const result = await runCli(["list", "--help"], ctx.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE:");
    expect(result.stdout).toContain("--status");
    expect(result.stdout).toContain("--archived");
    expect(result.stdout).toContain("--json");
  });

  test("invalid --status shows error", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["list", "--status", "invalid"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid");
  });

  // Tag filtering tests
  test("--tag filters by single tag (OR logic)", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Auth feature", "--tag", "auth"], ctx.dir);
    await runCli(["add", "API feature", "--tag", "api"], ctx.dir);
    await runCli(["add", "No tags"], ctx.dir);

    const result = await runCli(["list", "--tag", "auth"], ctx.dir);

    expect(result.stdout).toContain("REQ-001");
    expect(result.stdout).toContain("Auth feature");
    expect(result.stdout).not.toContain("REQ-002");
    expect(result.stdout).not.toContain("REQ-003");
  });

  test("--tag with multiple tags uses OR logic", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Auth feature", "--tag", "auth"], ctx.dir);
    await runCli(["add", "API feature", "--tag", "api"], ctx.dir);
    await runCli(["add", "No tags"], ctx.dir);

    const result = await runCli(["list", "--tag", "auth", "--tag", "api"], ctx.dir);

    expect(result.stdout).toContain("REQ-001");
    expect(result.stdout).toContain("REQ-002");
    expect(result.stdout).not.toContain("REQ-003");
  });

  test("--all-tags uses AND logic", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Auth only", "--tag", "auth"], ctx.dir);
    await runCli(["add", "Auth and security", "--tag", "auth", "--tag", "security"], ctx.dir);

    const result = await runCli(["list", "--tag", "auth", "--tag", "security", "--all-tags"], ctx.dir);

    expect(result.stdout).not.toContain("REQ-001");
    expect(result.stdout).toContain("REQ-002");
  });

  // Priority filtering tests
  test("--priority filters by priority", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Critical bug", "--priority", "critical"], ctx.dir);
    await runCli(["add", "Normal feature", "--priority", "medium"], ctx.dir);

    const result = await runCli(["list", "--priority", "critical"], ctx.dir);

    expect(result.stdout).toContain("REQ-001");
    expect(result.stdout).not.toContain("REQ-002");
  });

  test("--priority invalid value shows error", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["list", "--priority", "urgent"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid priority");
  });

  // Requirement status filtering tests
  test("--req-status filters by requirement status", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Draft req", "--status", "draft"], ctx.dir);
    await runCli(["add", "Approved req", "--status", "approved"], ctx.dir);

    const result = await runCli(["list", "--req-status", "approved"], ctx.dir);

    expect(result.stdout).not.toContain("REQ-001");
    expect(result.stdout).toContain("REQ-002");
  });

  test("--req-status invalid value shows error", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["list", "--req-status", "pending"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid requirement status");
  });

  // Source filtering tests
  test("--source filters by source type", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "From docs", "--source", "doc"], ctx.dir);
    await runCli(["add", "From jira", "--source", "jira"], ctx.dir);

    const result = await runCli(["list", "--source", "doc"], ctx.dir);

    expect(result.stdout).toContain("REQ-001");
    expect(result.stdout).not.toContain("REQ-002");
  });

  test("--source invalid value shows error", async () => {
    await runCli(["init"], ctx.dir);
    const result = await runCli(["list", "--source", "email"], ctx.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid source type");
  });

  // Text search tests
  test("--search filters by description text", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "User can login with email"], ctx.dir);
    await runCli(["add", "User can logout"], ctx.dir);

    const result = await runCli(["list", "--search", "login"], ctx.dir);

    expect(result.stdout).toContain("REQ-001");
    expect(result.stdout).not.toContain("REQ-002");
  });

  test("--search is case insensitive", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "User can LOGIN with email"], ctx.dir);

    const result = await runCli(["list", "--search", "login"], ctx.dir);

    expect(result.stdout).toContain("REQ-001");
  });

  // Combined filters
  test("combines multiple filters", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Critical auth", "--tag", "auth", "--priority", "critical"], ctx.dir);
    await runCli(["add", "Medium auth", "--tag", "auth", "--priority", "medium"], ctx.dir);
    await runCli(["add", "Critical api", "--tag", "api", "--priority", "critical"], ctx.dir);

    const result = await runCli(["list", "--tag", "auth", "--priority", "critical"], ctx.dir);

    expect(result.stdout).toContain("REQ-001");
    expect(result.stdout).not.toContain("REQ-002");
    expect(result.stdout).not.toContain("REQ-003");
  });

  // Output format tests
  test("shows priority in output", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--priority", "high"], ctx.dir);

    const result = await runCli(["list"], ctx.dir);

    expect(result.stdout).toContain("Priority: HIGH");
  });

  test("shows status in output", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--status", "approved"], ctx.dir);

    const result = await runCli(["list"], ctx.dir);

    expect(result.stdout).toContain("Status: approved");
  });

  test("shows tags in output", async () => {
    await runCli(["init"], ctx.dir);
    await runCli(["add", "Test requirement", "--tag", "auth", "--tag", "security"], ctx.dir);

    const result = await runCli(["list"], ctx.dir);

    expect(result.stdout).toContain("Tags: [auth, security]");
  });

  test("--json includes new fields", async () => {
    await runCli(["init"], ctx.dir);
    await runCli([
      "add", "Test requirement",
      "--tag", "auth",
      "--priority", "high",
      "--status", "approved",
    ], ctx.dir);

    const result = await runCli(["list", "--json"], ctx.dir);
    const parsed = JSON.parse(result.stdout);

    expect(parsed["REQ-001"].tags).toEqual(["auth"]);
    expect(parsed["REQ-001"].priority).toBe("high");
    expect(parsed["REQ-001"].status).toBe("approved");
  });
});
