/**
 * Integration tests for import-results command
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile, copyFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createRequirementsDir, saveConfig, getRequirementsDir } from "../lib/store";
import { importResults } from "../commands/import-results";
import { loadTestResults } from "../lib/result-store";
import { TEST_RESULTS_FILE } from "../lib/types";

const fixturesDir = join(import.meta.dir, "fixtures");

describe("Import Results Command", () => {
  let tempDir: string;
  let exitSpy: ReturnType<typeof spyOn>;
  let exitCode: number | undefined;
  let consoleOutput: string[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "req-import-test-"));
    exitCode = undefined;
    consoleOutput = [];

    exitSpy = spyOn(process, "exit").mockImplementation((code) => {
      exitCode = code as number;
      throw new Error(`process.exit(${code})`);
    });

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
  }

  it("imports JUnit XML results", async () => {
    await setupRequirements();
    await copyFile(
      join(fixturesDir, "junit-results.xml"),
      join(tempDir, "junit.xml")
    );

    await importResults({
      cwd: tempDir,
      file: "junit.xml",
    });

    const results = await loadTestResults(tempDir);
    expect(results).not.toBeNull();
    expect(results!.format).toBe("junit-xml");
    expect(results!.results).toHaveLength(5);
    expect(results!.summary.passed).toBe(3);
    expect(results!.summary.failed).toBe(2);
  });

  it("rejects non-XML files", async () => {
    await setupRequirements();
    await writeFile(join(tempDir, "results.json"), '{"testResults":[]}');

    await expect(
      importResults({
        cwd: tempDir,
        file: "results.json",
      })
    ).rejects.toThrow("process.exit(1)");

    expect(exitCode).toBe(1);
    expect(consoleOutput.join("\n")).toContain("not valid JUnit XML");
  });

  it("errors on missing file", async () => {
    await setupRequirements();

    await expect(
      importResults({
        cwd: tempDir,
        file: "nonexistent.xml",
      })
    ).rejects.toThrow("process.exit(1)");

    expect(exitCode).toBe(1);
    expect(consoleOutput.join("\n")).toContain("File not found");
  });

  it("errors when not initialized", async () => {
    // Don't call setupRequirements - no .requirements/ folder
    await writeFile(join(tempDir, "test.xml"), "<testsuites/>");

    await expect(
      importResults({
        cwd: tempDir,
        file: "test.xml",
      })
    ).rejects.toThrow("process.exit(1)");

    expect(exitCode).toBe(1);
    expect(consoleOutput.join("\n")).toContain("Not initialized");
  });

  it("overwrites previous results", async () => {
    await setupRequirements();

    // First import
    await copyFile(
      join(fixturesDir, "junit-results.xml"),
      join(tempDir, "first.xml")
    );
    await importResults({ cwd: tempDir, file: "first.xml" });

    const firstImport = await loadTestResults(tempDir);
    const firstTimestamp = firstImport!.importedAt;

    // Wait a tiny bit to ensure different timestamp (file mtime)
    await new Promise((r) => setTimeout(r, 100));

    // Second import with different file
    await writeFile(
      join(tempDir, "second.xml"),
      `<?xml version="1.0"?>
<testsuites>
  <testsuite name="test" tests="2">
    <testcase name="test1" classname="file.ts"/>
    <testcase name="test2" classname="file.ts"/>
  </testsuite>
</testsuites>`
    );
    await importResults({ cwd: tempDir, file: "second.xml" });

    const secondImport = await loadTestResults(tempDir);
    expect(secondImport!.importedAt).not.toBe(firstTimestamp);
    expect(secondImport!.results).toHaveLength(2);
  });

  it("prints summary on success", async () => {
    await setupRequirements();
    await copyFile(
      join(fixturesDir, "junit-results.xml"),
      join(tempDir, "results.xml")
    );

    await importResults({
      cwd: tempDir,
      file: "results.xml",
    });

    const output = consoleOutput.join("\n");
    expect(output).toContain("Imported 5 test results");
    expect(output).toContain("Passed: 3");
    expect(output).toContain("Failed: 2");
  });

  it("copies file to .requirements/test-results.xml", async () => {
    await setupRequirements();
    await copyFile(
      join(fixturesDir, "junit-results.xml"),
      join(tempDir, "test.xml")
    );

    await importResults({ cwd: tempDir, file: "test.xml" });

    // Verify the XML file was copied
    const destPath = join(getRequirementsDir(tempDir), TEST_RESULTS_FILE);
    const content = await readFile(destPath, "utf-8");
    expect(content).toContain("<?xml");
    expect(content).toContain("<testsuites");
  });
});
