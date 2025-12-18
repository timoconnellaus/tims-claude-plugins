/**
 * Store for user .docs config I/O
 */

import { readFile, writeFile, mkdir, access, readdir } from "fs/promises";
import { join, relative } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { glob } from "glob";
import type { UserConfig, ParsedDoc } from "./types";
import { DOCS_DIR, CONFIG_FILE } from "./types";
import { parseFrontmatter } from "./frontmatter";

// ============================================
// PATH HELPERS
// ============================================

export function getDocsDir(cwd: string): string {
  return join(cwd, DOCS_DIR);
}

export function getConfigPath(cwd: string): string {
  return join(getDocsDir(cwd), CONFIG_FILE);
}

// ============================================
// CONFIG OPERATIONS
// ============================================

export async function docsDirExists(cwd: string): Promise<boolean> {
  try {
    await access(getDocsDir(cwd));
    return true;
  } catch {
    return false;
  }
}

export async function createDocsDir(cwd: string): Promise<void> {
  await mkdir(getDocsDir(cwd), { recursive: true });
}

export async function loadConfig(cwd: string): Promise<UserConfig | null> {
  try {
    const content = await readFile(getConfigPath(cwd), "utf-8");
    const config = parseYaml(content) as UserConfig;

    // Validate version
    if (config.version !== 1) {
      throw new Error(`Unsupported config version: ${config.version}`);
    }

    // Ensure topics is an array
    if (!Array.isArray(config.topics)) {
      config.topics = [];
    }

    return config;
  } catch {
    return null;
  }
}

export async function saveConfig(cwd: string, config: UserConfig): Promise<void> {
  await createDocsDir(cwd);
  await writeFile(getConfigPath(cwd), stringifyYaml(config));
}

export function createDefaultConfig(): UserConfig {
  return {
    version: 1,
    topics: [],
  };
}

// ============================================
// PLUGIN DOCS OPERATIONS (for reading from plugin's docs/ folder)
// ============================================

/**
 * Get the path to the docs directory (repo root docs/)
 */
export function getPluginDocsDir(): string {
  // Get the directory containing this file, then go up to repo root
  const libDir = import.meta.dir;
  return join(libDir, "..", "..", "..", "..", "docs");
}

/**
 * List all doc sources available in the plugin
 */
export async function listDocSources(): Promise<string[]> {
  const docsDir = getPluginDocsDir();

  try {
    const entries = await readdir(docsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * Get the path to a specific doc source's directory
 */
export function getDocSourceDir(source: string): string {
  return join(getPluginDocsDir(), source);
}

/**
 * Load all markdown docs from a source directory
 */
export async function loadDocsFromSource(source: string): Promise<ParsedDoc[]> {
  const sourceDir = getDocSourceDir(source);
  const pattern = join(sourceDir, "**", "*.md");

  const files = await glob(pattern, { nodir: true });
  const docs: ParsedDoc[] = [];

  for (const file of files) {
    try {
      const content = await readFile(file, "utf-8");
      const relPath = relative(sourceDir, file);
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
}

/**
 * Load all docs from all sources
 */
export async function loadAllDocs(): Promise<Map<string, ParsedDoc[]>> {
  const sources = await listDocSources();
  const allDocs = new Map<string, ParsedDoc[]>();

  for (const source of sources) {
    const docs = await loadDocsFromSource(source);
    allDocs.set(source, docs);
  }

  return allDocs;
}

/**
 * Get all topics from all sources
 */
export async function getAllTopics(): Promise<string[]> {
  const allDocs = await loadAllDocs();
  const topics: string[] = [];

  for (const docs of allDocs.values()) {
    for (const doc of docs) {
      topics.push(doc.frontmatter.topic);
    }
  }

  return topics.sort();
}

// ============================================
// USER DOCS OPERATIONS (for writing to user's .docs folder)
// ============================================

/**
 * Write a doc file to the user's .docs folder
 */
export async function writeDocToUserDir(
  cwd: string,
  doc: ParsedDoc
): Promise<void> {
  const docsDir = getDocsDir(cwd);
  const filePath = join(docsDir, doc.path);
  const fileDir = join(filePath, "..");

  await mkdir(fileDir, { recursive: true });

  // Reconstruct the markdown file with frontmatter
  const frontmatterYaml = stringifyYaml(doc.frontmatter);
  const content = `---\n${frontmatterYaml}---\n\n${doc.content}`;

  await writeFile(filePath, content);
}

/**
 * Load docs from the user's .docs folder
 */
export async function loadUserDocs(cwd: string): Promise<ParsedDoc[]> {
  const docsDir = getDocsDir(cwd);
  const pattern = join(docsDir, "**", "*.md");

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
}
