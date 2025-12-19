/**
 * Ink TUI documentation sync script
 *
 * Syncs documentation from:
 * 1. Core Ink library (vadimdemedes/ink)
 * 2. All ecosystem packages listed in "Useful Components" and "Useful Hooks" sections
 */

import type {
  SyncDocsContract,
  SyncOutput,
  DocFrontmatter,
} from "../../plugins/docs-skill/src/lib/types";

const REPO = "vadimdemedes/ink";
const BRANCH = "master";
const VERSION = "5.x";

// ============================================
// GitHub API Helpers
// ============================================

function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "docs-skill-sync",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchRawContent(
  repo: string,
  branch: string,
  path: string
): Promise<string> {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

// ============================================
// Ecosystem Package Discovery
// ============================================

interface EcosystemPackage {
  name: string;
  repo: string;
  branch: string;
  path: string; // For monorepos
  description: string;
  category: "component" | "hook";
}

/**
 * Parse ecosystem packages from the Ink readme's "Useful Components" and "Useful Hooks" tables
 */
function parseEcosystemPackages(readme: string): EcosystemPackage[] {
  const packages: EcosystemPackage[] = [];

  // Find both sections
  const componentMatch = readme.match(
    /## Useful Components\s*\n([\s\S]*?)(?=\n## |$)/
  );
  const hookMatch = readme.match(
    /## Useful Hooks\s*\n([\s\S]*?)(?=\n## |$)/
  );

  const parseTable = (
    content: string,
    category: "component" | "hook"
  ): void => {
    // Match markdown links in table rows: [package-name](github-url)
    const linkRegex =
      /\[([^\]]+)\]\((https?:\/\/github\.com\/([^)]+))\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const [, name, url, repoPath] = match;

      // Skip non-package links (like badge images, author profiles)
      if (!name.startsWith("ink-") && !name.includes("ink")) continue;
      if (url.includes("/issues") || url.includes("/pulls")) continue;

      // Parse repo path - handle monorepos
      let repo: string;
      let branch = "master";
      let path = "";

      if (repoPath.includes("/tree/")) {
        // Monorepo: owner/repo/tree/branch/packages/name
        const parts = repoPath.split("/tree/");
        repo = parts[0];
        const rest = parts[1].split("/");
        branch = rest[0];
        path = rest.slice(1).join("/");
      } else {
        // Regular repo: owner/repo
        repo = repoPath.replace(/\/$/, "");
      }

      // Extract description from table row (text after the link)
      const rowMatch = content.match(
        new RegExp(
          `\\[${name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\][^|]*\\|([^|\\n]+)`
        )
      );
      const description = rowMatch
        ? rowMatch[1].trim().replace(/^\s*[-–—]\s*/, "")
        : "";

      packages.push({
        name,
        repo,
        branch,
        path,
        description,
        category,
      });
    }
  };

  if (componentMatch) {
    parseTable(componentMatch[1], "component");
  }
  if (hookMatch) {
    parseTable(hookMatch[1], "hook");
  }

  // Sort alphabetically for deterministic output
  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================
// Core Ink Readme Parsing
// ============================================

interface Section {
  heading: string;
  level: number;
  slug: string;
  content: string;
}

/**
 * Parse readme into sections by headings
 */
function parseIntoSections(content: string): Section[] {
  const lines = content.split("\n");
  const sections: Section[] = [];
  let currentHeading = "";
  let currentLevel = 0;
  let currentSlug = "";
  let currentLines: string[] = [];
  let inFrontmatter = false;

  for (const line of lines) {
    // Skip frontmatter
    if (line.trim() === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      // Save previous section
      if (currentLines.length > 0 || currentHeading) {
        sections.push({
          heading: currentHeading,
          level: currentLevel,
          slug: currentSlug,
          content: currentLines.join("\n").trim(),
        });
      }

      currentHeading = headingMatch[2].trim();
      currentLevel = headingMatch[1].length;
      currentSlug = currentHeading
        .toLowerCase()
        .replace(/<([^>]+)>/g, "$1") // Remove angle brackets
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  // Don't forget the last section
  if (currentLines.length > 0) {
    sections.push({
      heading: currentHeading,
      level: currentLevel,
      slug: currentSlug,
      content: currentLines.join("\n").trim(),
    });
  }

  return sections;
}

/**
 * Map Ink readme sections to output files
 */
function mapSectionsToOutputs(sections: Section[]): SyncOutput[] {
  const outputs: SyncOutput[] = [];

  // Section mappings: heading patterns -> output path
  // Note: Headings have backticks in the readme, e.g., `<Text>`
  const mappings: Array<{
    pattern: RegExp;
    path: string;
    titleOverride?: string;
  }> = [
    // Getting Started
    { pattern: /^install$/i, path: "getting-started.md" },
    { pattern: /^usage$/i, path: "getting-started.md" },

    // Components (with backticks in readme: `<Text>`)
    { pattern: /^`?<text>`?$/i, path: "components/text.md", titleOverride: "Text Component" },
    { pattern: /^`?<box>`?$/i, path: "components/box.md", titleOverride: "Box Component" },
    { pattern: /^`?<newline>`?$/i, path: "components/newline.md", titleOverride: "Newline Component" },
    { pattern: /^`?<spacer>`?$/i, path: "components/spacer.md", titleOverride: "Spacer Component" },
    { pattern: /^`?<static>`?$/i, path: "components/static.md", titleOverride: "Static Component" },
    { pattern: /^`?<transform>`?$/i, path: "components/transform.md", titleOverride: "Transform Component" },

    // Box sub-sections (h4 under Box, combine into box.md)
    { pattern: /^dimensions$/i, path: "components/box.md" },
    { pattern: /^padding$/i, path: "components/box.md" },
    { pattern: /^margin$/i, path: "components/box.md" },
    { pattern: /^gap$/i, path: "components/box.md" },
    { pattern: /^flex$/i, path: "components/box.md" },
    { pattern: /^visibility$/i, path: "components/box.md" },
    { pattern: /^borders$/i, path: "components/box.md" },
    { pattern: /^background$/i, path: "components/box.md" },

    // Hooks
    { pattern: /^useinput/i, path: "hooks/use-input.md", titleOverride: "useInput Hook" },
    { pattern: /^usestdin/i, path: "hooks/use-stdin.md", titleOverride: "useStdin Hook" },
    { pattern: /^usestdout/i, path: "hooks/use-stdout.md", titleOverride: "useStdout Hook" },
    { pattern: /^usestderr/i, path: "hooks/use-stderr.md", titleOverride: "useStderr Hook" },
    { pattern: /^useapp/i, path: "hooks/use-app.md", titleOverride: "useApp Hook" },
    { pattern: /^usefocus\s*\(/i, path: "hooks/use-focus.md", titleOverride: "useFocus Hook" },
    { pattern: /^usefocusmanager/i, path: "hooks/use-focus-manager.md", titleOverride: "useFocusManager Hook" },

    // API
    { pattern: /^render\s*\(/i, path: "api/render.md", titleOverride: "render() API" },
    { pattern: /^instance$/i, path: "api/render.md" },
    { pattern: /^measureelement/i, path: "api/measure-element.md", titleOverride: "measureElement() API" },

    // Accessibility
    { pattern: /^screen reader support$/i, path: "accessibility.md", titleOverride: "Accessibility" },
    { pattern: /^general principles$/i, path: "accessibility.md" },
    { pattern: /^aria-label$/i, path: "accessibility.md" },
    { pattern: /^aria-hidden$/i, path: "accessibility.md" },
    { pattern: /^aria-role$/i, path: "accessibility.md" },
    { pattern: /^aria-state$/i, path: "accessibility.md" },

    // Other
    { pattern: /^testing$/i, path: "testing.md" },
  ];

  // Group content by output file
  const fileContents: Map<string, { title: string; sections: Section[] }> =
    new Map();

  for (const section of sections) {
    for (const mapping of mappings) {
      if (mapping.pattern.test(section.heading)) {
        const existing = fileContents.get(mapping.path);
        const title = mapping.titleOverride || section.heading;
        if (existing) {
          existing.sections.push(section);
        } else {
          fileContents.set(mapping.path, { title, sections: [section] });
        }
        break;
      }
    }
  }

  // Generate outputs
  for (const [path, { title, sections: secs }] of fileContents) {
    const topic = `ink/${path.replace(/\.md$/, "")}`;
    const content = secs.map((s) => s.content).join("\n\n");

    // Extract description from first paragraph
    const descMatch = content.match(/^#[^\n]+\n+([^\n#]+)/);
    const description = descMatch
      ? descMatch[1].trim().slice(0, 200)
      : undefined;

    const frontmatter: DocFrontmatter = {
      topic,
      title,
      description,
      version: VERSION,
      sourceUrl: `https://github.com/${REPO}`,
      tags: ["ink", path.split("/")[0].replace(/\.md$/, "")].filter(Boolean),
    };

    outputs.push({ path, frontmatter, content });
  }

  return outputs;
}

// ============================================
// Ecosystem Package Docs
// ============================================

async function fetchPackageDocs(pkg: EcosystemPackage): Promise<SyncOutput | null> {
  try {
    // Try different readme locations
    const readmePaths = pkg.path
      ? [`${pkg.path}/readme.md`, `${pkg.path}/README.md`]
      : ["readme.md", "README.md"];

    let content: string | null = null;
    for (const readmePath of readmePaths) {
      try {
        content = await fetchRawContent(pkg.repo, pkg.branch, readmePath);
        break;
      } catch {
        // Try next path
      }
    }

    if (!content) {
      console.log(`  Warning: No readme found for ${pkg.name}`);
      return null;
    }

    // Strip frontmatter if present
    if (content.startsWith("---")) {
      const endIndex = content.indexOf("---", 3);
      if (endIndex !== -1) {
        content = content.slice(endIndex + 3).trim();
      }
    }

    // Extract title - clean up badges and extra formatting
    const titleMatch = content.match(/^#\s+(.+)$/m);
    let title = pkg.name;
    if (titleMatch) {
      // Remove badge images like ![test](...) and clean up
      title = titleMatch[1]
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // Remove badges
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // Convert links to text
        .trim() || pkg.name;
    }

    // Extract description - clean up blockquotes and formatting
    const lines = content.split("\n");
    let description = pkg.description;
    if (!description) {
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip title, badges, and empty lines
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("![")) {
          continue;
        }
        // Clean up blockquotes and links
        description = trimmed
          .replace(/^>\s*/, "") // Remove blockquote prefix
          .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // Convert links to text
          .slice(0, 200);
        break;
      }
    }

    const topic = `ink/community/${pkg.name}`;
    const frontmatter: DocFrontmatter = {
      topic,
      title,
      description,
      version: "latest",
      sourceUrl: `https://github.com/${pkg.repo}`,
      tags: ["ink", "community", pkg.category],
    };

    return {
      path: `community/${pkg.name}.md`,
      frontmatter,
      content,
    };
  } catch (error) {
    console.log(`  Error fetching ${pkg.name}: ${error}`);
    return null;
  }
}

// ============================================
// Main Contract
// ============================================

export default {
  name: "Ink",
  topicPrefix: "ink",

  async sync(): Promise<SyncOutput[]> {
    console.log("  Fetching Ink readme...");
    const readme = await fetchRawContent(REPO, BRANCH, "readme.md");

    console.log("  Parsing core documentation...");
    const sections = parseIntoSections(readme);
    const coreOutputs = mapSectionsToOutputs(sections);
    console.log(`  Generated ${coreOutputs.length} core doc files`);

    console.log("  Discovering ecosystem packages...");
    const packages = parseEcosystemPackages(readme);
    console.log(`  Found ${packages.length} ecosystem packages`);

    console.log("  Fetching ecosystem package docs...");
    const ecosystemOutputs: SyncOutput[] = [];
    for (const pkg of packages) {
      console.log(`    Fetching ${pkg.name}...`);
      const output = await fetchPackageDocs(pkg);
      if (output) {
        ecosystemOutputs.push(output);
      }
    }
    console.log(`  Generated ${ecosystemOutputs.length} ecosystem doc files`);

    return [...coreOutputs, ...ecosystemOutputs];
  },

  async listTopics(): Promise<string[]> {
    const readme = await fetchRawContent(REPO, BRANCH, "readme.md");

    // Core topics
    const sections = parseIntoSections(readme);
    const coreOutputs = mapSectionsToOutputs(sections);
    const coreTopics = coreOutputs.map((o) => o.frontmatter.topic);

    // Ecosystem topics
    const packages = parseEcosystemPackages(readme);
    const ecosystemTopics = packages.map((p) => `ink/community/${p.name}`);

    return [...coreTopics, ...ecosystemTopics].sort();
  },
} satisfies SyncDocsContract;
