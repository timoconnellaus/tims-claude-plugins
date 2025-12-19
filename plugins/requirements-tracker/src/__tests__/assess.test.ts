import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import {
  createRequirementsDir,
  saveConfig,
  getRequirementsDir,
  saveRequirement,
} from "../lib/store";
import { assess } from "../commands/assess";
import type { Requirement } from "../lib/types";

describe("Assess Command", () => {
  let tempDir: string;
  let exitSpy: ReturnType<typeof spyOn>;
  let exitCode: number | undefined;
  let consoleOutput: string[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-assess-test-"));
    exitCode = undefined;
    consoleOutput = [];

    // Mock process.exit
    exitSpy = spyOn(process, "exit").mockImplementation((code) => {
      exitCode = code as number;
      throw new Error(`process.exit(${code})`);
    });

    // Capture console output
    spyOn(console, "log").mockImplementation((...args) => {
      consoleOutput.push(args.join(" "));
    });
    spyOn(console, "error").mockImplementation((...args) => {
      consoleOutput.push(args.join(" "));
    });
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  async function setupRequirements() {
    await createRequirementsDir(tempDir);
    await saveConfig(tempDir, { testRunner: "bun test", testGlob: "**/*.test.ts" });

    const requirement1: Requirement = {
      gherkin: "Given a user\nWhen they act\nThen result occurs",
      mainSource: { type: "manual", description: "Test" },
      tests: [{ file: "test.ts", identifier: "test", hash: "abc" }],
      status: "done",
    };

    await saveRequirement(tempDir, "auth/REQ_login.yml", requirement1);

    const requirement2: Requirement = {
      gherkin: "Given invalid password\nWhen submitted\nThen error shown",
      mainSource: { type: "manual", description: "Test" },
      tests: [],
      status: "done",
    };

    await saveRequirement(tempDir, "auth/REQ_password.yml", requirement2);
  }

  // Helper to create valid criteria object
  function makePassingCriteria() {
    return {
      noBugsInTestCode: { result: "pass" },
      sufficientCoverage: { result: "pass" },
      meaningfulAssertions: { result: "pass" },
      correctTestSubject: { result: "pass" },
      happyPathCovered: { result: "pass" },
      edgeCasesAddressed: { result: "pass" },
      errorScenariosHandled: { result: "pass" },
      wouldFailIfBroke: { result: "pass" },
    };
  }

  function makeFailingCriteria() {
    return {
      noBugsInTestCode: { result: "pass" },
      sufficientCoverage: { result: "fail", note: "No tests" },
      meaningfulAssertions: { result: "na" },
      correctTestSubject: { result: "na" },
      happyPathCovered: { result: "fail" },
      edgeCasesAddressed: { result: "na" },
      errorScenariosHandled: { result: "na" },
      wouldFailIfBroke: { result: "na" },
    };
  }

  it("stores assessment with sufficient: true", async () => {
    await setupRequirements();

    await assess({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      resultJson: JSON.stringify({ criteria: makePassingCriteria(), notes: "Good test coverage" }),
    });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "auth/REQ_login.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as Requirement;

    expect(data.aiAssessment).toBeDefined();
    expect(data.aiAssessment?.sufficient).toBe(true);
    expect(data.aiAssessment?.notes).toBe("Good test coverage");
    expect(data.aiAssessment?.assessedAt).toBeDefined();
  });

  it("stores assessment with sufficient: false", async () => {
    await setupRequirements();

    await assess({
      cwd: tempDir,
      path: "auth/REQ_password.yml",
      resultJson: JSON.stringify({ criteria: makeFailingCriteria(), notes: "No tests linked" }),
    });

    const content = await readFile(
      join(getRequirementsDir(tempDir), "auth/REQ_password.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as Requirement;

    expect(data.aiAssessment?.sufficient).toBe(false);
    expect(data.aiAssessment?.notes).toBe("No tests linked");
  });

  it("sets assessedAt timestamp", async () => {
    await setupRequirements();

    const before = new Date();
    await assess({
      cwd: tempDir,
      path: "auth/REQ_login.yml",
      resultJson: JSON.stringify({ criteria: makePassingCriteria(), notes: "Test" }),
    });
    const after = new Date();

    const content = await readFile(
      join(getRequirementsDir(tempDir), "auth/REQ_login.yml"),
      "utf-8"
    );
    const data = parseYaml(content) as Requirement;

    const assessedAt = new Date(data.aiAssessment!.assessedAt);
    expect(assessedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(assessedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("errors on invalid JSON", async () => {
    await setupRequirements();

    try {
      await assess({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        resultJson: "not valid json",
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("errors on missing sufficient field", async () => {
    await setupRequirements();

    try {
      await assess({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        resultJson: JSON.stringify({ notes: "missing sufficient" }),
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("errors on missing notes field", async () => {
    await setupRequirements();

    try {
      await assess({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        resultJson: JSON.stringify({ sufficient: true }),
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("errors on requirement not found", async () => {
    await setupRequirements();

    try {
      await assess({
        cwd: tempDir,
        path: "auth/REQ_nonexistent.yml",
        resultJson: JSON.stringify({ sufficient: true, notes: "test" }),
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });

  it("errors when not initialized", async () => {
    try {
      await assess({
        cwd: tempDir,
        path: "auth/REQ_login.yml",
        resultJson: JSON.stringify({ sufficient: true, notes: "test" }),
      });
    } catch (e) {
      // Expected
    }

    expect(exitCode).toBe(1);
  });
});
