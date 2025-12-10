/**
 * Storage layer for folder-based requirements system
 */

import { readFile, writeFile, mkdir, access } from "fs/promises";
import { join, dirname, relative } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { glob } from "glob";
import {
  Config,
  ParsedRequirement,
  Requirement,
  TestCache,
  IgnoredTestsFile,
  REQUIREMENTS_DIR,
  CONFIG_FILE,
  CACHE_FILE,
  IGNORED_TESTS_FILE,
  REQUIREMENT_FILE_PATTERN,
} from "./types";

// === Path Helpers ===

export function getRequirementsDir(cwd: string): string {
  return join(cwd, REQUIREMENTS_DIR);
}

export function getConfigPath(cwd: string): string {
  return join(getRequirementsDir(cwd), CONFIG_FILE);
}

export function getCachePath(cwd: string): string {
  return join(getRequirementsDir(cwd), CACHE_FILE);
}

export function getIgnoredTestsPath(cwd: string): string {
  return join(getRequirementsDir(cwd), IGNORED_TESTS_FILE);
}

// === Directory Operations ===

export async function requirementsDirExists(cwd: string): Promise<boolean> {
  try {
    await access(getRequirementsDir(cwd));
    return true;
  } catch {
    return false;
  }
}

export async function createRequirementsDir(cwd: string): Promise<void> {
  await mkdir(getRequirementsDir(cwd), { recursive: true });
}

// === Config Operations ===

export async function loadConfig(cwd: string): Promise<Config | null> {
  try {
    const content = await readFile(getConfigPath(cwd), "utf-8");
    return parseYaml(content) as Config;
  } catch {
    return null;
  }
}

export async function saveConfig(cwd: string, config: Config): Promise<void> {
  await writeFile(getConfigPath(cwd), stringifyYaml(config));
}

// === Cache Operations ===

export async function loadCache(cwd: string): Promise<TestCache | null> {
  try {
    const content = await readFile(getCachePath(cwd), "utf-8");
    return JSON.parse(content) as TestCache;
  } catch {
    return null;
  }
}

export async function saveCache(cwd: string, cache: TestCache): Promise<void> {
  await writeFile(getCachePath(cwd), JSON.stringify(cache, null, 2));
}

// === Ignored Tests Operations ===

export async function loadIgnoredTests(cwd: string): Promise<IgnoredTestsFile> {
  try {
    const content = await readFile(getIgnoredTestsPath(cwd), "utf-8");
    const data = parseYaml(content) as IgnoredTestsFile;
    return data || { tests: [] };
  } catch {
    return { tests: [] };
  }
}

export async function saveIgnoredTests(
  cwd: string,
  data: IgnoredTestsFile
): Promise<void> {
  await writeFile(getIgnoredTestsPath(cwd), stringifyYaml(data));
}

// === Requirement Operations ===

export function isValidRequirementPath(path: string): boolean {
  // Extract just the filename from the path
  const parts = path.split("/");
  const filename = parts[parts.length - 1];
  return REQUIREMENT_FILE_PATTERN.test(filename);
}

export async function requirementExists(
  cwd: string,
  reqPath: string
): Promise<boolean> {
  try {
    const fullPath = join(getRequirementsDir(cwd), reqPath);
    await access(fullPath);
    return true;
  } catch {
    return false;
  }
}

export class RequirementValidationError extends Error {
  constructor(
    public reqPath: string,
    message: string
  ) {
    super(`${reqPath}: ${message}`);
    this.name = "RequirementValidationError";
  }
}

export async function loadRequirement(
  cwd: string,
  reqPath: string
): Promise<ParsedRequirement | null> {
  if (!isValidRequirementPath(reqPath)) {
    return null;
  }

  const fullPath = join(getRequirementsDir(cwd), reqPath);
  try {
    const content = await readFile(fullPath, "utf-8");
    const data = parseYaml(content) as Requirement;

    // Ensure tests array exists
    if (!data.tests) {
      data.tests = [];
    }

    // Validate required status field
    if (!data.status || (data.status !== "planned" && data.status !== "done")) {
      throw new RequirementValidationError(
        reqPath,
        'Missing or invalid "status" field. Must be "planned" or "done".'
      );
    }

    return {
      path: reqPath,
      data,
    };
  } catch (error) {
    if (error instanceof RequirementValidationError) {
      throw error;
    }
    return null;
  }
}

export async function saveRequirement(
  cwd: string,
  reqPath: string,
  data: Requirement
): Promise<void> {
  if (!isValidRequirementPath(reqPath)) {
    throw new Error(`Invalid requirement path: ${reqPath}`);
  }

  const fullPath = join(getRequirementsDir(cwd), reqPath);

  // Ensure parent directory exists
  const parentDir = dirname(fullPath);
  await mkdir(parentDir, { recursive: true });

  await writeFile(fullPath, stringifyYaml(data));
}

export interface LoadRequirementsResult {
  requirements: ParsedRequirement[];
  errors: RequirementValidationError[];
}

export async function loadAllRequirements(
  cwd: string
): Promise<LoadRequirementsResult> {
  const reqDir = getRequirementsDir(cwd);

  // Use glob to find all REQ_*.yml files recursively
  const pattern = join(reqDir, "**", "REQ_*.yml");
  const files = await glob(pattern, { nodir: true });

  const requirements: ParsedRequirement[] = [];
  const errors: RequirementValidationError[] = [];

  for (const file of files) {
    // Get relative path from requirements dir
    const reqPath = relative(reqDir, file);
    try {
      const req = await loadRequirement(cwd, reqPath);
      if (req) {
        requirements.push(req);
      }
    } catch (error) {
      if (error instanceof RequirementValidationError) {
        errors.push(error);
      } else {
        throw error;
      }
    }
  }

  // Sort by path for consistent ordering
  return {
    requirements: requirements.sort((a, b) => a.path.localeCompare(b.path)),
    errors,
  };
}

export async function loadRequirementsInPath(
  cwd: string,
  pathFilter: string
): Promise<LoadRequirementsResult> {
  const result = await loadAllRequirements(cwd);

  // Filter requirements by path prefix
  // pathFilter can be:
  // - "auth/" to match all in auth folder
  // - "auth/REQ_login.yml" to match exact file
  // - "auth/session/" to match nested folder
  return {
    requirements: result.requirements.filter((req) =>
      req.path.startsWith(pathFilter)
    ),
    errors: result.errors.filter((err) => err.reqPath.startsWith(pathFilter)),
  };
}
