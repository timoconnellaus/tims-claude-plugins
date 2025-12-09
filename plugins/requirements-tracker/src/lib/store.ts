/**
 * Storage layer for YAML-based requirements
 */

import { readFile, writeFile, readdir, mkdir, access } from "fs/promises";
import { join } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  Config,
  FeatureFile,
  ParsedFeature,
  Requirement,
  REQUIREMENTS_DIR,
  CONFIG_FILE,
  FEATURE_FILE_PATTERN,
} from "./types";

// === Directory/Path Helpers ===

export function getRequirementsDir(cwd: string): string {
  return join(cwd, REQUIREMENTS_DIR);
}

export function getConfigPath(cwd: string): string {
  return join(getRequirementsDir(cwd), CONFIG_FILE);
}

export async function requirementsDirExists(cwd: string): Promise<boolean> {
  try {
    await access(getRequirementsDir(cwd));
    return true;
  } catch {
    return false;
  }
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

export async function createRequirementsDir(cwd: string): Promise<void> {
  await mkdir(getRequirementsDir(cwd), { recursive: true });
}

// === Feature File Operations ===

export async function listFeatureFiles(cwd: string): Promise<string[]> {
  const dir = getRequirementsDir(cwd);
  try {
    const files = await readdir(dir);
    return files.filter((f) => FEATURE_FILE_PATTERN.test(f)).sort();
  } catch {
    return [];
  }
}

export async function loadFeature(
  cwd: string,
  filename: string
): Promise<ParsedFeature | null> {
  const match = filename.match(FEATURE_FILE_PATTERN);
  if (!match) return null;

  const filePath = join(getRequirementsDir(cwd), filename);
  try {
    const content = await readFile(filePath, "utf-8");
    const data = parseYaml(content) as FeatureFile;

    // Ensure requirements is initialized
    if (!data.requirements) {
      data.requirements = {};
    }

    // Ensure each requirement has tests array
    for (const req of Object.values(data.requirements)) {
      if (!req.tests) {
        req.tests = [];
      }
    }

    return {
      filename,
      number: parseInt(match[1], 10),
      userPart: match[2],
      filePath,
      data,
    };
  } catch {
    return null;
  }
}

export async function loadAllFeatures(cwd: string): Promise<ParsedFeature[]> {
  const files = await listFeatureFiles(cwd);
  const features: ParsedFeature[] = [];
  for (const file of files) {
    const feature = await loadFeature(cwd, file);
    if (feature) features.push(feature);
  }
  return features;
}

export async function saveFeature(
  cwd: string,
  feature: ParsedFeature
): Promise<void> {
  const filePath = join(getRequirementsDir(cwd), feature.filename);
  await writeFile(filePath, stringifyYaml(feature.data));
}

export function getNextFeatureNumber(features: ParsedFeature[]): number {
  if (features.length === 0) return 1;
  const max = Math.max(...features.map((f) => f.number));
  return max + 1;
}

export function findFeatureByName(
  features: ParsedFeature[],
  name: string
): ParsedFeature | undefined {
  // Match by filename (e.g., "FEAT_001_user-auth") or user part (e.g., "user-auth")
  // Also match by just the number (e.g., "FEAT_001" or "001" or "1")
  const normalized = name.toLowerCase();

  // Try exact filename match first
  const exactMatch = features.find(
    (f) => f.filename.toLowerCase() === normalized + ".yml" ||
           f.filename.toLowerCase() === normalized
  );
  if (exactMatch) return exactMatch;

  // Try user part match
  const userPartMatch = features.find(
    (f) => f.userPart.toLowerCase() === normalized
  );
  if (userPartMatch) return userPartMatch;

  // Try partial match (filename contains the search term)
  const partialMatch = features.find((f) =>
    f.filename.toLowerCase().includes(normalized)
  );
  if (partialMatch) return partialMatch;

  // Try number-only match
  const numMatch = normalized.match(/^(?:feat_?)?(\d+)$/i);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    return features.find((f) => f.number === num);
  }

  return undefined;
}

export function findRequirement(
  features: ParsedFeature[],
  featureName: string,
  reqId: string
): { feature: ParsedFeature; requirement: Requirement; id: string } | null {
  const feature = findFeatureByName(features, featureName);
  if (!feature) return null;

  const requirement = feature.data.requirements[reqId];
  if (!requirement) return null;

  return { feature, requirement, id: reqId };
}
