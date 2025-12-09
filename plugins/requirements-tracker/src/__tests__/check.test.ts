import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { stringify as stringifyYaml } from "yaml";
import {
  createRequirementsDir,
  saveConfig,
  getRequirementsDir,
} from "../lib/store";
import { check } from "../commands/check";
import type { FeatureFile } from "../lib/types";

describe("Check Command", () => {
  let tempDir: string;
  let exitSpy: ReturnType<typeof spyOn>;
  let exitCode: number | undefined;
  let consoleOutput: string[];
  let originalLog: typeof console.log;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-check-test-"));
    exitCode = undefined;
    consoleOutput = [];
    originalLog = console.log;

    // Capture console output
    console.log = (...args) => {
      consoleOutput.push(args.join(" "));
    };

    exitSpy = spyOn(process, "exit").mockImplementation((code) => {
      exitCode = code as number;
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(async () => {
    console.log = originalLog;
    exitSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  async function setupRequirements(features?: FeatureFile[]) {
    await createRequirementsDir(tempDir);
    await saveConfig(tempDir, { testRunner: "echo test", testGlob: "**/*.test.ts" });

    if (features) {
      for (let i = 0; i < features.length; i++) {
        await writeFile(
          join(getRequirementsDir(tempDir), `FEAT_00${i + 1}_feature${i + 1}.yml`),
          stringifyYaml(features[i])
        );
      }
    }
  }

  it("handles empty requirements folder", async () => {
    await setupRequirements();

    await check({ cwd: tempDir });

    const output = consoleOutput.join("\n");
    expect(output).toContain("No feature files found");
  });

  it("outputs JSON when --json flag is set", async () => {
    await setupRequirements([
      {
        name: "Auth",
        description: "Test",
        requirements: {
          "1": { gherkin: "Given a user", source: { type: "manual", description: "Test" }, tests: [] },
        },
      },
    ]);

    await check({ cwd: tempDir, json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.summary).toBeDefined();
    expect(parsed.summary.totalFeatures).toBe(1);
    expect(parsed.summary.totalRequirements).toBe(1);
    expect(parsed.features).toBeArray();
  });

  it("reports untested requirements", async () => {
    await setupRequirements([
      {
        name: "Auth",
        description: "Test",
        requirements: {
          "1": { gherkin: "Given a user", source: { type: "manual", description: "Test" }, tests: [] },
          "2": { gherkin: "Given a password", source: { type: "manual", description: "Test" }, tests: [] },
        },
      },
    ]);

    await check({ cwd: tempDir, json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.summary.untested).toBe(2);
    expect(parsed.summary.tested).toBe(0);
  });

  it("reports tested requirements", async () => {
    await setupRequirements([
      {
        name: "Auth",
        description: "Test",
        requirements: {
          "1": {
            gherkin: "Given a user",
            source: { type: "manual", description: "Test" },
            tests: [{ file: "test.ts", identifier: "test", hash: "abc" }],
          },
        },
      },
    ]);

    await check({ cwd: tempDir, json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.summary.tested).toBe(1);
    expect(parsed.summary.untested).toBe(0);
  });

  it("marks requirements without assessment as unverified (not stale)", async () => {
    await setupRequirements([
      {
        name: "Auth",
        description: "Test",
        requirements: {
          "1": {
            gherkin: "Given a user",
            source: { type: "manual", description: "Test" },
            tests: [{ file: "test.ts", identifier: "test", hash: "abc" }],
            // No aiAssessment
          },
        },
      },
    ]);

    await check({ cwd: tempDir, json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    // Should be unverified, not stale
    expect(parsed.summary.unverified).toBe(1);
    expect(parsed.summary.stale).toBe(0);
    expect(parsed.features[0].requirements[0].verification).toBe("unverified");
  });

  it("marks assessed requirements as verified", async () => {
    await setupRequirements([
      {
        name: "Auth",
        description: "Test",
        requirements: {
          "1": {
            gherkin: "Given a user",
            source: { type: "manual", description: "Test" },
            tests: [{ file: "test.ts", identifier: "test", hash: "abc" }],
            aiAssessment: {
              sufficient: true,
              notes: "Good",
              assessedAt: new Date().toISOString(),
            },
          },
        },
      },
    ]);

    await check({ cwd: tempDir, json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.summary.verified).toBe(1);
    expect(parsed.summary.stale).toBe(0);
    expect(parsed.features[0].requirements[0].verification).toBe("verified");
    expect(parsed.features[0].requirements[0].coverageSufficient).toBe(true);
  });

  it("reports coverage sufficiency from assessment", async () => {
    await setupRequirements([
      {
        name: "Auth",
        description: "Test",
        requirements: {
          "1": {
            gherkin: "Given a user",
            source: { type: "manual", description: "Test" },
            tests: [{ file: "test.ts", identifier: "test", hash: "abc" }],
            aiAssessment: {
              sufficient: true,
              notes: "Good",
              assessedAt: new Date().toISOString(),
            },
          },
          "2": {
            gherkin: "Given a password",
            source: { type: "manual", description: "Test" },
            tests: [{ file: "test.ts", identifier: "test2", hash: "def" }],
            aiAssessment: {
              sufficient: false,
              notes: "Needs more",
              assessedAt: new Date().toISOString(),
            },
          },
        },
      },
    ]);

    await check({ cwd: tempDir, json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.features[0].requirements[0].coverageSufficient).toBe(true);
    expect(parsed.features[0].requirements[1].coverageSufficient).toBe(false);
  });

  it("finds orphaned tests", async () => {
    await setupRequirements([
      {
        name: "Auth",
        description: "Test",
        requirements: {
          "1": { gherkin: "Given a user", source: { type: "manual", description: "Test" }, tests: [] },
        },
      },
    ]);

    // Create a test file that's not linked to any requirement
    await writeFile(
      join(tempDir, "orphan.test.ts"),
      `
      it("orphan test", () => {
        expect(true).toBe(true);
      });
    `
    );

    await check({ cwd: tempDir, json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.summary.orphanedTestCount).toBe(1);
    expect(parsed.orphanedTests.length).toBe(1);
    expect(parsed.orphanedTests[0].identifier).toBe("orphan test");
  });

  it("requires initialization", async () => {
    try {
      await check({ cwd: tempDir });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("counts unanswered questions", async () => {
    await setupRequirements([
      {
        name: "Auth",
        description: "Test",
        requirements: {
          "1": {
            gherkin: "Given a user",
            source: { type: "manual", description: "Test" },
            tests: [],
            questions: [
              { question: "How many retries?" },
              { question: "What timeout?", answer: "30 seconds", answeredAt: "2024-01-01" },
              { question: "Rate limit?" },
            ],
          },
          "2": {
            gherkin: "Given a password",
            source: { type: "manual", description: "Test" },
            tests: [],
            questions: [
              { question: "Min length?" },
            ],
          },
        },
      },
    ]);

    await check({ cwd: tempDir, json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.summary.unansweredQuestions).toBe(3); // 2 in req 1, 1 in req 2
    expect(parsed.features[0].requirements[0].unansweredQuestions).toBe(2);
    expect(parsed.features[0].requirements[1].unansweredQuestions).toBe(1);
  });

  it("marks requirements with no tests as n/a verification", async () => {
    await setupRequirements([
      {
        name: "Auth",
        description: "Test",
        requirements: {
          "1": {
            gherkin: "Given a user",
            source: { type: "manual", description: "Test" },
            tests: [],
          },
        },
      },
    ]);

    await check({ cwd: tempDir, json: true });

    const output = consoleOutput.join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.features[0].requirements[0].verification).toBe("n/a");
  });
});
