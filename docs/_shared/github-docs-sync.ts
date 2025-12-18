/**
 * Shared GitHub documentation sync utilities
 * Used by all TanStack doc sync scripts
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { SyncDocsContract, SyncOutput, DocFrontmatter } from "../../plugins/docs-skill/src/lib/types";

const MAX_LINES = 1000;

/**
 * Load GitHub token from .env file
 */
function getGitHubToken(): string | undefined {
  // Try multiple possible locations for .env
  const possiblePaths = [
    join(import.meta.dir, "..", ".env"),
    join(process.cwd(), "docs", ".env"),
    join(process.cwd(), ".env"),
  ];

  for (const envPath of possiblePaths) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf-8");
      const match = content.match(/^GITHUB_TOKEN=(.+)$/m);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
  }
  return undefined;
}

const GITHUB_TOKEN = getGitHubToken();
if (GITHUB_TOKEN) {
  console.log("  Using GitHub token for API requests");
}

export interface GitHubDocsConfig {
  /** GitHub repo in format "owner/repo" */
  repo: string;
  /** Branch to fetch from (default: "main") */
  branch?: string;
  /** Path to docs folder in repo (default: "docs") */
  docsPath?: string;
  /** Human-readable name for this doc source */
  name: string;
  /** Topic prefix (e.g., "tanstack-router") */
  topicPrefix: string;
  /** Directories to skip (default: ["reference", "framework"]) */
  skipDirs?: string[];
  /** Version string (default: "latest") */
  version?: string;
}

interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
}

interface Section {
  heading: string;
  slug: string;
  content: string;
  lineCount: number;
}

interface SplitResult {
  isSplit: boolean;
  outputs: Array<{
    subPath: string;
    title: string;
    content: string;
    description?: string;
  }>;
}

/**
 * Get headers for GitHub API requests
 */
function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "docs-skill-sync",
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }
  return headers;
}

/**
 * Fetch directory contents from GitHub API
 */
async function fetchGitHubDirectory(repo: string, branch: string, path: string): Promise<GitHubFile[]> {
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
  const response = await fetch(url, {
    headers: getGitHubHeaders(),
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Recursively discover all markdown files in a directory
 */
async function discoverMarkdownFiles(
  repo: string,
  branch: string,
  path: string,
  skipDirs: string[]
): Promise<GitHubFile[]> {
  const entries = await fetchGitHubDirectory(repo, branch, path);
  const files: GitHubFile[] = [];

  for (const entry of entries) {
    if (entry.type === "dir") {
      if (skipDirs.includes(entry.name)) {
        continue;
      }
      const subFiles = await discoverMarkdownFiles(repo, branch, entry.path, skipDirs);
      files.push(...subFiles);
    } else if (entry.type === "file" && entry.name.endsWith(".md")) {
      files.push(entry);
    }
  }

  return files;
}

/**
 * Fetch raw content of a file from GitHub
 */
async function fetchRawContent(downloadUrl: string): Promise<string> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch content: ${response.status}`);
  }
  return response.text();
}

/**
 * Extract title from markdown content (first # heading)
 */
function extractTitle(content: string, filename: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    return match[1].trim();
  }
  return filename
    .replace(/\.md$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract description from content (first paragraph after title)
 */
function extractDescription(content: string): string | undefined {
  let cleanContent = content;
  if (content.startsWith("---")) {
    const endIndex = content.indexOf("---", 3);
    if (endIndex !== -1) {
      cleanContent = content.slice(endIndex + 3).trim();
    }
  }

  const lines = cleanContent.split("\n");
  let foundTitle = false;
  const paragraphLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!foundTitle && trimmed === "") continue;
    if (!foundTitle && trimmed.startsWith("# ")) {
      foundTitle = true;
      continue;
    }
    if (trimmed.startsWith("#") || trimmed.startsWith("```")) break;
    if (trimmed === "" && paragraphLines.length > 0) break;
    if (trimmed !== "") {
      paragraphLines.push(trimmed);
    }
  }

  const description = paragraphLines.join(" ").slice(0, 200);
  return description || undefined;
}

/**
 * Strip existing frontmatter from content
 */
function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) {
    return content;
  }
  const endIndex = content.indexOf("---", 3);
  if (endIndex === -1) {
    return content;
  }
  return content.slice(endIndex + 3).trim();
}

/**
 * Split content by h2 headings into sections
 */
function splitByH2(content: string): Section[] {
  const lines = content.split("\n");
  const sections: Section[] = [];
  let currentHeading = "";
  let currentSlug = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      if (currentLines.length > 0) {
        sections.push({
          heading: currentHeading,
          slug: currentSlug,
          content: currentLines.join("\n").trim(),
          lineCount: currentLines.length,
        });
      }
      currentHeading = h2Match[1].trim();
      currentSlug = currentHeading
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({
      heading: currentHeading,
      slug: currentSlug,
      content: currentLines.join("\n").trim(),
      lineCount: currentLines.length,
    });
  }

  return sections;
}

/**
 * Split large content into folder structure by h2 sections
 */
function splitLargeContent(content: string, baseTitle: string): SplitResult {
  const lineCount = content.split("\n").length;

  if (lineCount <= MAX_LINES) {
    return {
      isSplit: false,
      outputs: [{ subPath: "", title: baseTitle, content }],
    };
  }

  const sections = splitByH2(content);

  if (sections.length <= 1) {
    console.log(`    Warning: Cannot split ${baseTitle} (no h2 sections), keeping as-is`);
    return {
      isSplit: false,
      outputs: [{ subPath: "", title: baseTitle, content }],
    };
  }

  const hasIntro = sections[0].heading === "";
  const intro = hasIntro ? sections.shift()! : null;

  const outputs: SplitResult["outputs"] = [];

  const tocLines = sections.map((s) => `- [${s.heading}](./${s.slug}.md)`);
  const indexContent = intro
    ? `${intro.content}\n\n## Contents\n\n${tocLines.join("\n")}`
    : `# ${baseTitle}\n\n## Contents\n\n${tocLines.join("\n")}`;

  outputs.push({
    subPath: "index.md",
    title: baseTitle,
    content: indexContent,
    description: `Overview and table of contents for ${baseTitle}`,
  });

  for (const section of sections) {
    const sectionContent = section.content.replace(/^##\s+/, "# ");

    outputs.push({
      subPath: `${section.slug}.md`,
      title: `${baseTitle} - ${section.heading}`,
      content: sectionContent,
      description: `${section.heading} section of ${baseTitle}`,
    });
  }

  return { isSplit: true, outputs };
}

/**
 * Generate tags based on the file path
 */
function generateTags(topicPrefix: string, relativePath: string): string[] {
  const tags = [topicPrefix];
  const parts = relativePath.split("/");
  if (parts.length > 1) {
    const category = parts[0];
    if (!["index.md"].includes(category)) {
      tags.push(category);
    }
  }
  return tags;
}

/**
 * Create a SyncDocsContract from config
 */
export function createGitHubDocsContract(config: GitHubDocsConfig): SyncDocsContract {
  const {
    repo,
    branch = "main",
    docsPath = "docs",
    name,
    topicPrefix,
    skipDirs = ["reference", "framework"],
    version = "latest",
  } = config;

  return {
    name,
    topicPrefix,

    async sync(): Promise<SyncOutput[]> {
      console.log("  Discovering markdown files from GitHub...");
      const files = await discoverMarkdownFiles(repo, branch, docsPath, skipDirs);
      console.log(`  Found ${files.length} markdown files`);

      const outputs: SyncOutput[] = [];

      for (const file of files) {
        if (!file.download_url) continue;

        console.log(`  Fetching ${file.path}...`);
        const rawContent = await fetchRawContent(file.download_url);
        const content = stripFrontmatter(rawContent);
        const title = extractTitle(rawContent, file.name);
        const description = extractDescription(rawContent);

        // Convert path: "docs/guides/foo.md" -> "guides/foo.md"
        const relativePath = file.path.replace(new RegExp(`^${docsPath}/`), "");
        // Topic must be lowercase with only alphanumeric, hyphens, and slashes
        const baseTopic = `${topicPrefix}/${relativePath.replace(/\.md$/, "")}`
          .toLowerCase()
          .replace(/[^a-z0-9/-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/-$/g, "");
        const baseTags = generateTags(topicPrefix, relativePath);

        const splitResult = splitLargeContent(content, title);

        if (splitResult.isSplit) {
          console.log(`    Splitting into folder with ${splitResult.outputs.length} files`);

          const folderPath = relativePath.replace(/\.md$/, "");
          const folderTopic = baseTopic;

          for (const output of splitResult.outputs) {
            const filePath = `${folderPath}/${output.subPath}`;
            const fileTopicSuffix = output.subPath.replace(/\.md$/, "").toLowerCase();
            const fileTopic =
              output.subPath === "index.md"
                ? folderTopic
                : `${folderTopic}/${fileTopicSuffix}`;

            const frontmatter: DocFrontmatter = {
              topic: fileTopic,
              title: output.title,
              description: output.description || description,
              version,
              sourceUrl: `https://github.com/${repo}/blob/${branch}/${file.path}`,
              tags: baseTags,
            };

            outputs.push({
              path: filePath,
              frontmatter,
              content: output.content,
            });
          }
        } else {
          const frontmatter: DocFrontmatter = {
            topic: baseTopic,
            title,
            description,
            version,
            sourceUrl: `https://github.com/${repo}/blob/${branch}/${file.path}`,
            tags: baseTags,
          };

          outputs.push({
            path: relativePath,
            frontmatter,
            content,
          });
        }
      }

      return outputs;
    },

    async listTopics(): Promise<string[]> {
      const files = await discoverMarkdownFiles(repo, branch, docsPath, skipDirs);
      return files
        .map((f) => {
          const relativePath = f.path.replace(new RegExp(`^${docsPath}/`), "");
          return `${topicPrefix}/${relativePath.replace(/\.md$/, "")}`;
        })
        .sort();
    },
  };
}
