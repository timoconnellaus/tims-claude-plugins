import { mkdtemp, rm, readFile, writeFile, access } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type {
  RequirementsFile,
  ArchiveFile,
  Requirement,
  HistoryEntry,
  TestLink,
  RequirementSource,
  TestRunner,
} from "../src/lib/types";

export interface TestContext {
  dir: string;
  cleanup: () => Promise<void>;
}

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Create an isolated temp directory for testing
 */
export async function createTestDir(): Promise<TestContext> {
  const dir = await mkdtemp(join(tmpdir(), "req-test-"));
  return {
    dir,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

/**
 * Run the CLI as a subprocess with the given arguments and working directory
 */
export async function runCli(args: string[], cwd: string): Promise<CliResult> {
  const cliPath = join(import.meta.dir, "..", "src", "cli.ts");
  const proc = Bun.spawn(["bun", cliPath, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

/**
 * Read and parse a JSON file from the test directory
 */
export async function readJsonFile<T>(dir: string, filename: string): Promise<T> {
  const content = await readFile(join(dir, filename), "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Write a JSON file to the test directory
 */
export async function writeJsonFile(
  dir: string,
  filename: string,
  data: unknown
): Promise<void> {
  await writeFile(join(dir, filename), JSON.stringify(data, null, 2) + "\n");
}

/**
 * Check if a file exists in the test directory
 */
export async function fileExists(dir: string, filename: string): Promise<boolean> {
  try {
    await access(join(dir, filename));
    return true;
  } catch {
    return false;
  }
}

/**
 * Create an empty requirements file structure
 */
export function createRequirementsFile(
  overrides: Partial<RequirementsFile> = {}
): RequirementsFile {
  return {
    version: "1.0",
    config: { testRunners: [] },
    requirements: {},
    ...overrides,
  };
}

/**
 * Create a test runner configuration
 */
export function createTestRunner(overrides: Partial<TestRunner> = {}): TestRunner {
  return {
    name: "unit",
    command: "bun test",
    pattern: "**/*.test.ts",
    ...overrides,
  };
}

/**
 * Create a requirement source
 */
export function createSource(overrides: Partial<RequirementSource> = {}): RequirementSource {
  return {
    type: "manual",
    reference: "",
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a history entry
 */
export function createHistoryEntry(
  overrides: Partial<HistoryEntry> = {}
): HistoryEntry {
  return {
    action: "created",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a test link
 */
export function createTestLink(overrides: Partial<TestLink> = {}): TestLink {
  return {
    runner: "unit",
    file: "tests/example.test.ts",
    identifier: "test case",
    linkedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a requirement with defaults
 */
export function createRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    description: "Test requirement",
    source: createSource(),
    tests: [],
    history: [createHistoryEntry()],
    ...overrides,
  };
}

/**
 * Create an empty archive file structure
 */
export function createArchiveFile(overrides: Partial<ArchiveFile> = {}): ArchiveFile {
  return {
    version: "1.0",
    requirements: {},
    ...overrides,
  };
}

/**
 * Initialize a requirements.json file in the test directory
 */
export async function initRequirementsFile(
  dir: string,
  overrides: Partial<RequirementsFile> = {}
): Promise<void> {
  await writeJsonFile(dir, "requirements.json", createRequirementsFile(overrides));
}

/**
 * Initialize a requirements.archive.json file in the test directory
 */
export async function initArchiveFile(
  dir: string,
  overrides: Partial<ArchiveFile> = {}
): Promise<void> {
  await writeJsonFile(dir, "requirements.archive.json", createArchiveFile(overrides));
}
