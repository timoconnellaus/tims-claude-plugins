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
  Priority,
  NFRCategory,
  Source,
  Scenario,
} from "./types";

// Valid values for validation
const VALID_PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
const VALID_NFR_CATEGORIES: NFRCategory[] = [
  "performance",
  "security",
  "accessibility",
  "reliability",
  "scalability",
  "other",
];

// === Migration Helpers ===

/**
 * Migrate old requirement format (source at requirement level) to new format
 * (mainSource for main gherkin, source on each scenario).
 * Returns true if migration was performed.
 */
function migrateRequirementSource(data: Record<string, unknown>): boolean {
  // Check if migration needed: has source but no mainSource
  if (data.source && !data.mainSource) {
    const oldSource = data.source as Source;

    // Migrate main gherkin source
    data.mainSource = oldSource;

    // Migrate scenarios if they exist - copy source to each scenario without one
    if (Array.isArray(data.scenarios)) {
      data.scenarios = (data.scenarios as Scenario[]).map((scenario) => ({
        ...scenario,
        source: scenario.source ?? oldSource,
      }));
    }

    // Remove old source field
    delete data.source;

    return true;
  }
  return false;
}

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

    // Migrate old format (source at requirement level) to new format (mainSource)
    migrateRequirementSource(data as unknown as Record<string, unknown>);

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

    // Validate required gherkin field
    if (!data.gherkin || typeof data.gherkin !== "string") {
      throw new RequirementValidationError(
        reqPath,
        'Missing required "gherkin" field. Every requirement must have a primary Gherkin scenario (the "scenarios" array is for ADDITIONAL scenarios only).'
      );
    }
    const mainGherkinLower = data.gherkin.toLowerCase();
    if (
      !mainGherkinLower.includes("given") ||
      !mainGherkinLower.includes("when") ||
      !mainGherkinLower.includes("then")
    ) {
      throw new RequirementValidationError(
        reqPath,
        'The "gherkin" field must include Given/When/Then keywords.'
      );
    }

    // Validate required mainSource field
    if (!data.mainSource || typeof data.mainSource !== "object") {
      throw new RequirementValidationError(
        reqPath,
        'Missing required "mainSource" field. Every requirement must have a source for its main gherkin.'
      );
    }
    if (!data.mainSource.type || !data.mainSource.description) {
      throw new RequirementValidationError(
        reqPath,
        '"mainSource" must have "type" and "description" fields.'
      );
    }

    // Validate priority if present
    if (data.priority !== undefined && !VALID_PRIORITIES.includes(data.priority)) {
      throw new RequirementValidationError(
        reqPath,
        `Invalid priority "${data.priority}". Must be one of: ${VALID_PRIORITIES.join(", ")}`
      );
    }

    // Validate dependencies if present
    if (data.dependencies) {
      if (!Array.isArray(data.dependencies)) {
        throw new RequirementValidationError(
          reqPath,
          '"dependencies" must be an array'
        );
      }
      for (let i = 0; i < data.dependencies.length; i++) {
        const dep = data.dependencies[i];
        if (!dep.path || typeof dep.path !== "string") {
          throw new RequirementValidationError(
            reqPath,
            `dependencies[${i}]: must have a "path" string field`
          );
        }
        if (dep.blocking !== undefined && typeof dep.blocking !== "boolean") {
          throw new RequirementValidationError(
            reqPath,
            `dependencies[${i}]: "blocking" must be a boolean`
          );
        }
      }
    }

    // Validate NFRs if present
    if (data.nfrs) {
      if (!Array.isArray(data.nfrs)) {
        throw new RequirementValidationError(
          reqPath,
          '"nfrs" must be an array'
        );
      }
      for (let i = 0; i < data.nfrs.length; i++) {
        const nfr = data.nfrs[i];
        if (!nfr.category || !VALID_NFR_CATEGORIES.includes(nfr.category)) {
          throw new RequirementValidationError(
            reqPath,
            `nfrs[${i}]: invalid category "${nfr.category}". Must be one of: ${VALID_NFR_CATEGORIES.join(", ")}`
          );
        }
        if (!nfr.description || typeof nfr.description !== "string") {
          throw new RequirementValidationError(
            reqPath,
            `nfrs[${i}]: must have a "description" string field`
          );
        }
      }
    }

    // Validate scenarios if present
    if (data.scenarios) {
      if (!Array.isArray(data.scenarios)) {
        throw new RequirementValidationError(
          reqPath,
          '"scenarios" must be an array'
        );
      }
      for (let i = 0; i < data.scenarios.length; i++) {
        const scenario = data.scenarios[i];
        if (!scenario.name || typeof scenario.name !== "string") {
          throw new RequirementValidationError(
            reqPath,
            `scenarios[${i}]: must have a "name" string field`
          );
        }
        if (!scenario.gherkin || typeof scenario.gherkin !== "string") {
          throw new RequirementValidationError(
            reqPath,
            `scenarios[${i}]: must have a "gherkin" string field`
          );
        }
        // Validate gherkin format
        const gherkinLower = scenario.gherkin.toLowerCase();
        if (
          !gherkinLower.includes("given") ||
          !gherkinLower.includes("when") ||
          !gherkinLower.includes("then")
        ) {
          throw new RequirementValidationError(
            reqPath,
            `scenarios[${i}] "${scenario.name}": gherkin must include Given/When/Then keywords`
          );
        }
        // Validate optional suggested flag
        if (
          scenario.suggested !== undefined &&
          typeof scenario.suggested !== "boolean"
        ) {
          throw new RequirementValidationError(
            reqPath,
            `scenarios[${i}] "${scenario.name}": "suggested" must be a boolean if provided`
          );
        }
      }
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

  // Remove deprecated source field before saving (ensure new format)
  const cleanData = { ...data };
  delete (cleanData as Record<string, unknown>).source;

  await writeFile(fullPath, stringifyYaml(cleanData));
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
