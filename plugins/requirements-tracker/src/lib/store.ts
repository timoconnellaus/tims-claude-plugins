import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type {
  RequirementsFile,
  ArchiveFile,
  Requirement,
  HistoryEntry,
  GitHubIssue,
} from "./types";

// Old GitHubIssue format for migration
interface LegacyGitHubIssue {
  url: string;
  number: number;
  repo?: string;
}

const REQUIREMENTS_FILE = "requirements.json";
const ARCHIVE_FILE = "requirements.archive.json";
const VERSION = "1.0";

function getFilePath(filename: string, cwd: string = process.cwd()): string {
  return join(cwd, filename);
}

function createEmptyRequirementsFile(): RequirementsFile {
  return {
    version: VERSION,
    config: {
      testRunners: [],
    },
    requirements: {},
  };
}

function createEmptyArchiveFile(): ArchiveFile {
  return {
    version: VERSION,
    requirements: {},
  };
}

/**
 * Migrate old URL-based GitHubIssue format to number-only format.
 * Also extracts repo to config if not already set.
 */
function migrateGitHubIssues(data: RequirementsFile): RequirementsFile {
  let modified = false;
  let extractedRepo: string | undefined;

  for (const req of Object.values(data.requirements)) {
    if (req.githubIssue && "url" in req.githubIssue) {
      const legacy = req.githubIssue as unknown as LegacyGitHubIssue;

      // Extract repo from legacy format if available and config doesn't have it
      if (legacy.repo && !extractedRepo && !data.config.github?.repo) {
        extractedRepo = legacy.repo;
      }

      // Convert to new format
      const newIssue: GitHubIssue = { number: legacy.number };
      req.githubIssue = newIssue;
      modified = true;
    }
  }

  // Set extracted repo in config if found
  if (extractedRepo && !data.config.github?.repo) {
    data.config.github = { repo: extractedRepo, autoDetected: false };
    modified = true;
  }

  return data;
}

export function loadRequirements(cwd?: string): RequirementsFile {
  const filePath = getFilePath(REQUIREMENTS_FILE, cwd);

  if (!existsSync(filePath)) {
    return createEmptyRequirementsFile();
  }

  const content = readFileSync(filePath, "utf-8");
  let data = JSON.parse(content) as RequirementsFile;

  // Run migrations
  data = migrateGitHubIssues(data);

  return data;
}

export function saveRequirements(data: RequirementsFile, cwd?: string): void {
  const filePath = getFilePath(REQUIREMENTS_FILE, cwd);
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

export function loadArchive(cwd?: string): ArchiveFile {
  const filePath = getFilePath(ARCHIVE_FILE, cwd);

  if (!existsSync(filePath)) {
    return createEmptyArchiveFile();
  }

  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as ArchiveFile;
}

export function saveArchive(data: ArchiveFile, cwd?: string): void {
  const filePath = getFilePath(ARCHIVE_FILE, cwd);
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

export function generateId(requirements: Record<string, Requirement>): string {
  const existingIds = Object.keys(requirements);
  const numbers = existingIds
    .map((id) => {
      const match = id.match(/^REQ-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);

  const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
  const nextNum = maxNum + 1;
  return `REQ-${String(nextNum).padStart(3, "0")}`;
}

export function createHistoryEntry(
  action: HistoryEntry["action"],
  note?: string,
  by?: string
): HistoryEntry {
  return {
    action,
    timestamp: new Date().toISOString(),
    ...(by && { by }),
    ...(note && { note }),
  };
}

export function requirementsFileExists(cwd?: string): boolean {
  return existsSync(getFilePath(REQUIREMENTS_FILE, cwd));
}

export function initRequirementsFile(cwd?: string): void {
  const data = createEmptyRequirementsFile();
  saveRequirements(data, cwd);
}
