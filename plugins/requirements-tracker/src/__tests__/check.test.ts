import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  createRequirementsDir,
  saveConfig,
  saveRequirement,
  saveIgnoredTests,
} from "../lib/store";
import { check } from "../commands/check";
import type { Requirement } from "../lib/types";

describe("Check Command", () => {
  let tempDir: string;
  let exitSpy: ReturnType<typeof spyOn>;
  let exitCode: number | undefined;
  let consoleOutput: string[];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-check-test-"));
    exitCode = undefined;
    consoleOutput = [];

    // Capture console output
    spyOn(console, "log").mockImplementation((...args) => {
      consoleOutput.push(args.join(" "));
    });

    spyOn(console, "error").mockImplementation((...args) => {
      consoleOutput.push(args.join(" "));
    });

    exitSpy = spyOn(process, "exit").mockImplementation((code) => {
      exitCode = code as number;
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  async function setupRequirements() {
    await createRequirementsDir(tempDir);
    await saveConfig(tempDir, { testRunner: "echo test", testGlob: "**/*.test.ts" });
  }

  it("handles empty requirements folder", async () => {
    await setupRequirements();

    await check({ cwd: tempDir });

    const output = consoleOutput.join("\n");
    expect(output).toContain("No requirement files found");
  });

  it("outputs JSON when --json flag is set", async () => {
    await setupRequirements();

    const requirement: Requirement = {
      gherkin: "Given a user\nWhen they act\nThen result occurs",
      mainSource: { type: "manual", description: "Test" },
      tests: [],
      status: "done",
    };
    await saveRequirement(tempDir, "auth/REQ_login.yml", requirement);

    await check({ cwd: tempDir, json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.summary).toBeDefined();
    expect(parsed.summary.totalRequirements).toBe(1);
    expect(parsed.requirements).toBeArray();
  });

  it("reports verification status: n/a", async () => {
    await setupRequirements();

    const requirement: Requirement = {
      gherkin: "Given a user\nWhen they act\nThen result occurs",
      mainSource: { type: "manual", description: "Test" },
      tests: [],
      status: "done",
    };
    await saveRequirement(tempDir, "auth/REQ_login.yml", requirement);

    await check({ cwd: tempDir, json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.requirements[0].requirements[0].verification).toBe("n/a");
  });

  it("reports verification status: unverified", async () => {
    await setupRequirements();

    const requirement: Requirement = {
      gherkin: "Given a user\nWhen they act\nThen result occurs",
      mainSource: { type: "manual", description: "Test" },
      tests: [{ file: "test.ts", identifier: "test", hash: "abc" }],
      status: "done",
    };
    await saveRequirement(tempDir, "auth/REQ_login.yml", requirement);

    await check({ cwd: tempDir, json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.summary.unverified).toBe(1);
    expect(parsed.requirements[0].requirements[0].verification).toBe("unverified");
  });

  it("reports verification status: verified", async () => {
    await setupRequirements();

    // Create actual test file that matches the hash (must match glob pattern)
    const testContent = `
      it("test", () => {
        expect(true).toBe(true);
      });
    `;
    await writeFile(join(tempDir, "verified.test.ts"), testContent);

    // Extract the test to get the real hash
    const { extractAllTests } = await import("../lib/test-parser");
    const tests = await extractAllTests(tempDir, "**/*.test.ts");
    const testHash = tests.find(t => t.identifier === "test")?.hash || "abc";

    const requirement: Requirement = {
      gherkin: "Given a user\nWhen they act\nThen result occurs",
      mainSource: { type: "manual", description: "Test" },
      tests: [{ file: "verified.test.ts", identifier: "test", hash: testHash }],
      status: "done",
      aiAssessment: {
        sufficient: true,
        notes: "Good",
        assessedAt: new Date().toISOString(),
      },
    };
    await saveRequirement(tempDir, "auth/REQ_login.yml", requirement);

    await check({ cwd: tempDir, json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.summary.verified).toBe(1);
    expect(parsed.requirements[0].requirements[0].verification).toBe("verified");
    expect(parsed.requirements[0].requirements[0].coverageSufficient).toBe(true);
  });

  it("reports verification status: stale (detects and clears assessment)", async () => {
    await setupRequirements();

    // Create test file with content that will generate a different hash (must match glob pattern)
    await writeFile(
      join(tempDir, "stale.test.ts"),
      `
      it("test", () => {
        expect(true).toBe(true);
      });
    `
    );

    const requirement: Requirement = {
      gherkin: "Given a user\nWhen they act\nThen result occurs",
      mainSource: { type: "manual", description: "Test" },
      tests: [{ file: "stale.test.ts", identifier: "test", hash: "oldhash123" }],
      status: "done",
      aiAssessment: {
        sufficient: true,
        notes: "Good",
        assessedAt: new Date().toISOString(),
      },
    };
    await saveRequirement(tempDir, "auth/REQ_login.yml", requirement);

    await check({ cwd: tempDir, json: true, noCache: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    // When hash is stale, check command updates it and clears assessment
    // So it becomes unverified instead of stale after the update
    expect(parsed.summary.unverified).toBe(1);
    expect(parsed.requirements[0].requirements[0].verification).toBe("unverified");

    // Verify the hash was actually updated in the file
    const { loadRequirement } = await import("../lib/store");
    const updated = await loadRequirement(tempDir, "auth/REQ_login.yml");
    expect(updated?.data.tests[0].hash).not.toBe("oldhash123");
    expect(updated?.data.aiAssessment).toBeUndefined(); // Assessment cleared
  });

  it("reports coverage: untested vs tested requirements", async () => {
    await setupRequirements();

    const untested: Requirement = {
      gherkin: "Given a user\nWhen they act\nThen result occurs",
      mainSource: { type: "manual", description: "Test" },
      tests: [],
      status: "done",
    };
    await saveRequirement(tempDir, "auth/REQ_untested.yml", untested);

    const tested: Requirement = {
      gherkin: "Given a password\nWhen submitted\nThen validated",
      mainSource: { type: "manual", description: "Test" },
      tests: [{ file: "test.ts", identifier: "test", hash: "abc" }],
      status: "done",
    };
    await saveRequirement(tempDir, "auth/REQ_tested.yml", tested);

    await check({ cwd: tempDir, json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.summary.untested).toBe(1);
    expect(parsed.summary.tested).toBe(1);
  });

  it("filters by path: check specific folder", async () => {
    await setupRequirements();

    const authReq: Requirement = {
      gherkin: "Given a user\nWhen they act\nThen result occurs",
      mainSource: { type: "manual", description: "Test" },
      tests: [],
      status: "done",
    };
    await saveRequirement(tempDir, "auth/REQ_login.yml", authReq);

    const paymentsReq: Requirement = {
      gherkin: "Given a payment\nWhen processed\nThen confirmed",
      mainSource: { type: "manual", description: "Test" },
      tests: [],
      status: "done",
    };
    await saveRequirement(tempDir, "payments/REQ_checkout.yml", paymentsReq);

    await check({ cwd: tempDir, path: "auth/", json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.summary.totalRequirements).toBe(1);
    expect(parsed.requirements[0].path).toBe("auth/");
  });

  it("filters by path: check specific file", async () => {
    await setupRequirements();

    const req1: Requirement = {
      gherkin: "Given a user\nWhen they act\nThen result occurs",
      mainSource: { type: "manual", description: "Test" },
      tests: [],
      status: "done",
    };
    await saveRequirement(tempDir, "auth/REQ_login.yml", req1);

    const req2: Requirement = {
      gherkin: "Given a password\nWhen submitted\nThen validated",
      mainSource: { type: "manual", description: "Test" },
      tests: [],
      status: "done",
    };
    await saveRequirement(tempDir, "auth/REQ_password.yml", req2);

    await check({ cwd: tempDir, path: "auth/REQ_login.yml", json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.summary.totalRequirements).toBe(1);
    expect(parsed.requirements[0].requirements[0].id).toBe("auth/REQ_login.yml");
  });

  it("detects orphaned tests", async () => {
    await setupRequirements();

    const requirement: Requirement = {
      gherkin: "Given a user\nWhen they act\nThen result occurs",
      mainSource: { type: "manual", description: "Test" },
      tests: [],
      status: "done",
    };
    await saveRequirement(tempDir, "auth/REQ_login.yml", requirement);

    // Create a test file that's not linked to any requirement
    await writeFile(
      join(tempDir, "orphan.test.ts"),
      `
      it("orphan test", () => {
        expect(true).toBe(true);
      });
    `
    );

    await check({ cwd: tempDir, json: true, noCache: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.summary.orphanedTestCount).toBe(1);
    expect(parsed.orphanedTests.length).toBe(1);
    expect(parsed.orphanedTests[0].identifier).toBe("orphan test");
  });

  it("excludes ignored tests from orphans", async () => {
    await setupRequirements();

    const requirement: Requirement = {
      gherkin: "Given a user\nWhen they act\nThen result occurs",
      mainSource: { type: "manual", description: "Test" },
      tests: [],
      status: "done",
    };
    await saveRequirement(tempDir, "auth/REQ_login.yml", requirement);

    // Create a test file
    await writeFile(
      join(tempDir, "ignored.test.ts"),
      `
      it("ignored test", () => {
        expect(true).toBe(true);
      });
    `
    );

    // Add to ignored list
    await saveIgnoredTests(tempDir, {
      tests: [
        {
          file: "ignored.test.ts",
          identifier: "ignored test",
          reason: "Test reason",
          ignoredAt: new Date().toISOString(),
        },
      ],
    });

    await check({ cwd: tempDir, json: true, noCache: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.summary.orphanedTestCount).toBe(0);
  });

  it("noCache flag forces re-extraction", async () => {
    await setupRequirements();

    const requirement: Requirement = {
      gherkin: "Given a user\nWhen they act\nThen result occurs",
      mainSource: { type: "manual", description: "Test" },
      tests: [],
      status: "done",
    };
    await saveRequirement(tempDir, "auth/REQ_login.yml", requirement);

    // First call - should extract tests
    await check({ cwd: tempDir, noCache: true });
    const firstOutput = consoleOutput.join("\n");
    expect(firstOutput).toContain("Extracted");

    // Reset output
    consoleOutput = [];

    // Second call with cache - should use cached
    await check({ cwd: tempDir });
    const secondOutput = consoleOutput.join("\n");
    expect(secondOutput).toContain("Using cached test data");

    // Reset output
    consoleOutput = [];

    // Third call with noCache - should extract again
    await check({ cwd: tempDir, noCache: true });
    const thirdOutput = consoleOutput.join("\n");
    expect(thirdOutput).toContain("Extracted");
  });

  it("updates stale hashes (when no assessment exists)", async () => {
    await setupRequirements();

    // Create test file (must match glob pattern)
    await writeFile(
      join(tempDir, "update.test.ts"),
      `
      it("test", () => {
        expect(true).toBe(true);
      });
    `
    );

    const requirement: Requirement = {
      gherkin: "Given a user\nWhen they act\nThen result occurs",
      mainSource: { type: "manual", description: "Test" },
      tests: [{ file: "update.test.ts", identifier: "test", hash: "oldhash" }],
      status: "done",
      // No aiAssessment
    };
    await saveRequirement(tempDir, "auth/REQ_login.yml", requirement);

    await check({ cwd: tempDir, json: true, noCache: true });

    // Read requirement again to verify hash was updated
    const { loadRequirement } = await import("../lib/store");
    const updated = await loadRequirement(tempDir, "auth/REQ_login.yml");

    expect(updated?.data.tests[0].hash).not.toBe("oldhash");
    expect(updated?.data.tests[0].hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("errors when not initialized", async () => {
    try {
      await check({ cwd: tempDir });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("counts unanswered questions", async () => {
    await setupRequirements();

    const requirement: Requirement = {
      gherkin: "Given a user\nWhen they act\nThen result occurs",
      mainSource: { type: "manual", description: "Test" },
      tests: [],
      status: "done",
      questions: [
        { question: "How many retries?" },
        { question: "What timeout?", answer: "30 seconds", answeredAt: "2024-01-01" },
        { question: "Rate limit?" },
      ],
    };
    await saveRequirement(tempDir, "auth/REQ_login.yml", requirement);

    await check({ cwd: tempDir, json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.summary.unansweredQuestions).toBe(2);
    expect(parsed.requirements[0].requirements[0].unansweredQuestions).toBe(2);
  });
});
