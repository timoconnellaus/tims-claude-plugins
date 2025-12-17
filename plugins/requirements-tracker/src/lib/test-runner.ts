/**
 * Test runner - executes tests and captures results
 */

import { spawn } from "bun";
import { join } from "node:path";
import { loadConfig } from "./store";
import { junitXml } from "./result-parsers";
import { REQUIREMENTS_DIR, TEST_RESULTS_FILE } from "./types";
import type { TestResult, TestRunSummary } from "./types";

export interface RunTestOptions {
  cwd: string;
  file?: string; // Optional file path filter
  identifier?: string; // Optional test name filter (uses --test-name-pattern)
}

export interface TestRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  results: TestResult[];
  summary: TestRunSummary;
}

/**
 * Build the test command with appropriate flags
 */
function buildCommand(
  testRunner: string,
  options: { file?: string; identifier?: string; junitOutfile?: string }
): string[] {
  // Parse the base test runner command
  const parts = testRunner.split(/\s+/);

  // Add JUnit reporter for structured output (Bun requires outfile)
  if (options.junitOutfile) {
    parts.push("--reporter=junit", "--reporter-outfile", options.junitOutfile);
  }

  // Add file filter if specified
  if (options.file) {
    parts.push(options.file);
  }

  // Add name filter if specified (Bun uses --test-name-pattern or -t)
  if (options.identifier) {
    parts.push("--test-name-pattern", options.identifier);
  }

  return parts;
}

/**
 * Run tests and return results
 *
 * @param options - Test run configuration
 * @param streamOutput - If true, streams output to console in real-time
 */
export async function runTests(
  options: RunTestOptions,
  streamOutput = false
): Promise<TestRunResult> {
  const { cwd, file, identifier } = options;

  // Load config to get test runner
  const config = await loadConfig(cwd);
  if (!config) {
    throw new Error("Not initialized. Run 'req init' first.");
  }

  // Write JUnit output directly to .requirements/test-results.xml
  // This file is watched by the server and can be committed to git
  const junitOutfile = join(cwd, REQUIREMENTS_DIR, TEST_RESULTS_FILE);

  // Build command
  const command = buildCommand(config.testRunner, { file, identifier, junitOutfile });

  // Execute test runner
  const proc = spawn({
    cmd: command,
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  // Collect output
  let stdout = "";
  let stderr = "";

  // Read stdout
  const stdoutReader = proc.stdout.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await stdoutReader.read();
    if (done) break;
    const text = decoder.decode(value);
    stdout += text;
    if (streamOutput) {
      process.stdout.write(text);
    }
  }

  // Read stderr
  const stderrReader = proc.stderr.getReader();
  while (true) {
    const { done, value } = await stderrReader.read();
    if (done) break;
    const text = decoder.decode(value);
    stderr += text;
    if (streamOutput) {
      process.stderr.write(text);
    }
  }

  // Wait for process to exit
  const exitCode = await proc.exited;

  // Parse JUnit XML output from file for return value
  let results: TestResult[] = [];
  let summary: TestRunSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  // Try to read and parse JUnit XML from the output file
  try {
    const junitFile = Bun.file(junitOutfile);
    if (await junitFile.exists()) {
      const junitContent = await junitFile.text();
      if (junitXml.canParse(junitContent)) {
        const parsed = junitXml.parse(junitContent);
        results = parsed.results;
        summary = parsed.summary;
      }
    }
  } catch {
    // If we can't read the file, fall back to exit code based result
  }

  // If no JUnit output, create a minimal result based on exit code
  if (results.length === 0 && exitCode !== 0) {
    summary = { total: 1, passed: 0, failed: 1, skipped: 0 };
  }

  return {
    exitCode,
    stdout,
    stderr,
    results,
    summary,
  };
}

/**
 * Run multiple tests (e.g., all tests for a requirement)
 * Runs them in sequence to avoid output interleaving
 */
export async function runMultipleTests(
  cwd: string,
  tests: Array<{ file: string; identifier: string }>,
  streamOutput = false
): Promise<TestRunResult> {
  // If no tests, return empty result
  if (tests.length === 0) {
    return {
      exitCode: 0,
      stdout: "",
      stderr: "",
      results: [],
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
    };
  }

  // Get unique files
  const uniqueFiles = [...new Set(tests.map((t) => t.file))];

  // If all tests are in one file, run with file filter only (faster)
  // Otherwise run all tests and let the results be filtered by the caller
  if (uniqueFiles.length === 1) {
    // All tests in same file - run just that file
    return runTests(
      {
        cwd,
        file: uniqueFiles[0],
      },
      streamOutput
    );
  }

  // Multiple files - run all tests
  // The results will include all tests but the UI will show only linked ones
  return runTests({ cwd }, streamOutput);
}
