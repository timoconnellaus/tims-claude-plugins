/**
 * Store for global repositories config (~/.docs-skill/repositories.yml)
 */

import { readFile, writeFile, mkdir, access } from "fs/promises";
import { join, resolve, normalize, relative } from "path";
import { homedir } from "os";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { glob } from "glob";
import type { Repository, RepositoriesFile, RepositoryType, ParsedDoc } from "./types";
import { GLOBAL_CONFIG_DIR, REPOSITORIES_FILE } from "./types";
import { parseFrontmatter } from "./frontmatter";

// ============================================
// PATH HELPERS
// ============================================

export function getGlobalConfigDir(): string {
  return join(homedir(), GLOBAL_CONFIG_DIR);
}

export function getRepositoriesPath(): string {
  return join(getGlobalConfigDir(), REPOSITORIES_FILE);
}

// ============================================
// REPOSITORY FILE OPERATIONS
// ============================================

export async function globalConfigDirExists(): Promise<boolean> {
  try {
    await access(getGlobalConfigDir());
    return true;
  } catch {
    return false;
  }
}

export async function createGlobalConfigDir(): Promise<void> {
  await mkdir(getGlobalConfigDir(), { recursive: true });
}

export async function loadRepositories(): Promise<RepositoriesFile> {
  try {
    const content = await readFile(getRepositoriesPath(), "utf-8");
    const config = parseYaml(content) as RepositoriesFile;

    // Validate version
    if (config.version !== 1) {
      throw new Error(`Unsupported repositories version: ${config.version}`);
    }

    // Ensure repositories is an array
    if (!Array.isArray(config.repositories)) {
      config.repositories = [];
    }

    return config;
  } catch {
    return createDefaultRepositoriesFile();
  }
}

export async function saveRepositories(config: RepositoriesFile): Promise<void> {
  await createGlobalConfigDir();
  await writeFile(getRepositoriesPath(), stringifyYaml(config));
}

export function createDefaultRepositoriesFile(): RepositoriesFile {
  return {
    version: 1,
    repositories: [],
  };
}

// ============================================
// REPOSITORY MANAGEMENT
// ============================================

/**
 * Normalize a path for use as repository ID
 */
export function normalizeRepoPath(inputPath: string): string {
  // GitHub URL normalization
  if (inputPath.includes("github.com")) {
    // Extract owner/repo from various GitHub URL formats
    const match = inputPath.match(/github\.com[/:]([^/]+\/[^/.]+)/);
    if (match) {
      return `github:${match[1].replace(/\.git$/, "")}`;
    }
  }

  // Local path normalization
  return normalize(resolve(inputPath));
}

/**
 * Determine repository type from path
 */
export function getRepoType(path: string): RepositoryType {
  if (path.includes("github.com") || path.startsWith("github:")) {
    return "github";
  }
  return "local";
}

/**
 * Check if a repository path exists and is valid
 * @param path - The path to validate
 * @param cwd - Base directory for resolving relative paths (defaults to process.cwd())
 */
export async function validateRepoPath(
  path: string,
  cwd?: string
): Promise<{ valid: boolean; error?: string; resolved?: string }> {
  const type = getRepoType(path);

  if (type === "github") {
    // For GitHub repos, just validate the URL format for now
    if (!path.match(/github\.com[/:]([^/]+\/[^/.]+)/)) {
      return { valid: false, error: "Invalid GitHub repository URL" };
    }
    return { valid: true };
  }

  // For local paths, resolve relative to cwd and check existence
  const resolved = cwd ? resolve(cwd, path) : resolve(path);
  try {
    await access(resolved);
    return { valid: true, resolved };
  } catch {
    return { valid: false, error: `Path does not exist: ${resolved}` };
  }
}

/**
 * Add a repository to the global config
 * @param path - The path to the repository (local or GitHub URL)
 * @param docsPath - Optional subdirectory containing docs
 * @param cwd - Base directory for resolving relative paths (defaults to process.cwd())
 */
export async function addRepository(
  path: string,
  docsPath?: string,
  cwd?: string
): Promise<{ success: boolean; error?: string; repository?: Repository }> {
  // Validate path
  const validation = await validateRepoPath(path, cwd);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Use the resolved path from validation for local repos
  const resolvedPath = validation.resolved || path;
  const config = await loadRepositories();
  const id = normalizeRepoPath(resolvedPath);

  // Check for duplicates
  if (config.repositories.some((r) => r.id === id)) {
    return { success: false, error: `Repository already registered: ${id}` };
  }

  const repository: Repository = {
    id,
    type: getRepoType(path),
    path: getRepoType(path) === "local" ? resolvedPath : path,
    addedAt: new Date().toISOString(),
    docsPath,
  };

  config.repositories.push(repository);
  await saveRepositories(config);

  return { success: true, repository };
}

/**
 * Remove a repository from the global config
 */
export async function removeRepository(
  path: string
): Promise<{ success: boolean; error?: string }> {
  const config = await loadRepositories();
  const id = normalizeRepoPath(path);

  const index = config.repositories.findIndex((r) => r.id === id);
  if (index === -1) {
    return { success: false, error: `Repository not found: ${id}` };
  }

  config.repositories.splice(index, 1);
  await saveRepositories(config);

  return { success: true };
}

/**
 * List all registered repositories
 */
export async function listRepositories(): Promise<Repository[]> {
  const config = await loadRepositories();
  return config.repositories;
}

// ============================================
// REPOSITORY DOCS LOADING
// ============================================

/**
 * Get the docs directory for a repository
 */
export function getRepoDocsDir(repo: Repository): string {
  const docsPath = repo.docsPath || "docs";

  if (repo.type === "github") {
    // GitHub repos would need to be cloned first
    // For now, return a cached path
    return join(getGlobalConfigDir(), "cache", repo.id.replace(":", "/"), docsPath);
  }

  return join(repo.path, docsPath);
}

/**
 * Load docs from a single repository
 */
export async function loadDocsFromRepo(repo: Repository): Promise<ParsedDoc[]> {
  if (repo.type === "github") {
    // GitHub repos not yet implemented - skip for now
    return [];
  }

  const docsDir = getRepoDocsDir(repo);
  const pattern = join(docsDir, "**", "*.md");

  try {
    const files = await glob(pattern, { nodir: true });
    const docs: ParsedDoc[] = [];

    for (const file of files) {
      try {
        const content = await readFile(file, "utf-8");
        const relPath = relative(docsDir, file);
        const result = parseFrontmatter(content, relPath);

        if (result.success) {
          docs.push({
            path: relPath,
            frontmatter: result.frontmatter,
            content: result.content,
            lineCount: result.lineCount,
          });
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return docs;
  } catch {
    return [];
  }
}

/**
 * Load docs from all registered repositories
 */
export async function loadAllRepoDocs(): Promise<Map<string, ParsedDoc[]>> {
  const repos = await listRepositories();
  const allDocs = new Map<string, ParsedDoc[]>();

  for (const repo of repos) {
    const docs = await loadDocsFromRepo(repo);
    if (docs.length > 0) {
      allDocs.set(repo.id, docs);
    }
  }

  return allDocs;
}
