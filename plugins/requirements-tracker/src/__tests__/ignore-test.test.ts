import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  createRequirementsDir,
  saveConfig,
  loadIgnoredTests,
} from "../lib/store";
import { ignoreTest } from "../commands/ignore-test";
import { unignoreTest } from "../commands/unignore-test";

describe("Ignore Test Commands", () => {
  let tempDir: string;
  let exitSpy: ReturnType<typeof spyOn>;
  let exitCode: number | undefined;
  let consoleOutput: string[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-ignore-test-"));
    exitCode = undefined;
    consoleOutput = [];

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

    // Create a test file (must match the glob pattern)
    await writeFile(
      join(tempDir, "helper.test.ts"),
      `
      it("helper test", () => {
        expect(true).toBe(true);
      });

      it("another helper test", () => {
        expect(false).toBe(false);
      });
    `
    );
  }

  describe("ignoreTest", () => {
    it("adds test to ignored list", async () => {
      await setupRequirements();

      await ignoreTest({
        cwd: tempDir,
        testSpec: "helper.test.ts:helper test",
        reason: "This is a utility test",
      });

      const ignoredTests = await loadIgnoredTests(tempDir);
      expect(ignoredTests.tests.length).toBe(1);
      expect(ignoredTests.tests[0].file).toBe("helper.test.ts");
      expect(ignoredTests.tests[0].identifier).toBe("helper test");
      expect(ignoredTests.tests[0].reason).toBe("This is a utility test");
      expect(ignoredTests.tests[0].ignoredAt).toBeDefined();
    });

    it("prevents duplicates", async () => {
      await setupRequirements();

      await ignoreTest({
        cwd: tempDir,
        testSpec: "helper.test.ts:helper test",
        reason: "First time",
      });

      await ignoreTest({
        cwd: tempDir,
        testSpec: "helper.test.ts:helper test",
        reason: "Second time",
      });

      const ignoredTests = await loadIgnoredTests(tempDir);
      expect(ignoredTests.tests.length).toBe(1);
    });

    it("errors on test not found in codebase", async () => {
      await setupRequirements();

      try {
        await ignoreTest({
          cwd: tempDir,
          testSpec: "helper.test.ts:nonexistent test",
          reason: "Test",
        });
      } catch (e) {
        // Expected
      }

      expect(exitCode).toBe(1);
    });

    it("errors on invalid test spec format", async () => {
      await setupRequirements();

      try {
        await ignoreTest({
          cwd: tempDir,
          testSpec: "no-colon-here",
          reason: "Test",
        });
      } catch (e) {
        // Expected
      }

      expect(exitCode).toBe(1);
    });

    it("errors when not initialized", async () => {
      try {
        await ignoreTest({
          cwd: tempDir,
          testSpec: "helper.test.ts:helper test",
          reason: "Test",
        });
      } catch (e) {
        // Expected
      }

      expect(exitCode).toBe(1);
    });

    it("adds multiple tests to ignored list", async () => {
      await setupRequirements();

      await ignoreTest({
        cwd: tempDir,
        testSpec: "helper.test.ts:helper test",
        reason: "Utility test 1",
      });

      await ignoreTest({
        cwd: tempDir,
        testSpec: "helper.test.ts:another helper test",
        reason: "Utility test 2",
      });

      const ignoredTests = await loadIgnoredTests(tempDir);
      expect(ignoredTests.tests.length).toBe(2);
    });
  });

  describe("unignoreTest", () => {
    it("removes test from ignored list", async () => {
      await setupRequirements();

      // Add test to ignored list
      await ignoreTest({
        cwd: tempDir,
        testSpec: "helper.test.ts:helper test",
        reason: "Test",
      });

      // Verify it was added
      let ignoredTests = await loadIgnoredTests(tempDir);
      expect(ignoredTests.tests.length).toBe(1);

      // Remove it
      await unignoreTest({
        cwd: tempDir,
        testSpec: "helper.test.ts:helper test",
      });

      // Verify it was removed
      ignoredTests = await loadIgnoredTests(tempDir);
      expect(ignoredTests.tests.length).toBe(0);
    });

    it("errors on test not in ignored list", async () => {
      await setupRequirements();

      try {
        await unignoreTest({
          cwd: tempDir,
          testSpec: "helper.test.ts:helper test",
        });
      } catch (e) {
        // Expected
      }

      expect(exitCode).toBe(1);
    });

    it("errors on invalid test spec format", async () => {
      await setupRequirements();

      try {
        await unignoreTest({
          cwd: tempDir,
          testSpec: "no-colon-here",
        });
      } catch (e) {
        // Expected
      }

      expect(exitCode).toBe(1);
    });

    it("errors when not initialized", async () => {
      try {
        await unignoreTest({
          cwd: tempDir,
          testSpec: "helper.test.ts:helper test",
        });
      } catch (e) {
        // Expected
      }

      expect(exitCode).toBe(1);
    });

    it("removes correct test when multiple are ignored", async () => {
      await setupRequirements();

      // Add two tests
      await ignoreTest({
        cwd: tempDir,
        testSpec: "helper.test.ts:helper test",
        reason: "Test 1",
      });

      await ignoreTest({
        cwd: tempDir,
        testSpec: "helper.test.ts:another helper test",
        reason: "Test 2",
      });

      // Remove first one
      await unignoreTest({
        cwd: tempDir,
        testSpec: "helper.test.ts:helper test",
      });

      // Verify only second one remains
      const ignoredTests = await loadIgnoredTests(tempDir);
      expect(ignoredTests.tests.length).toBe(1);
      expect(ignoredTests.tests[0].identifier).toBe("another helper test");
    });
  });
});
