/**
 * Frontmatter parsing and validation for markdown files
 */

import { parse as parseYaml } from "yaml";
import type { DocFrontmatter, ParsedDoc } from "./types";
import { FRONTMATTER_DELIMITER } from "./types";

export interface ParseResult {
  success: true;
  frontmatter: DocFrontmatter;
  content: string;
  lineCount: number;
}

export interface ParseError {
  success: false;
  error: string;
  line?: number;
}

/**
 * Parse a markdown file with YAML frontmatter
 */
export function parseFrontmatter(
  raw: string,
  path: string
): ParseResult | ParseError {
  const lines = raw.split("\n");

  // Check for frontmatter delimiter at start
  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
    return {
      success: false,
      error: "Document must start with YAML frontmatter (---)",
      line: 1,
    };
  }

  // Find closing delimiter
  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === FRONTMATTER_DELIMITER) {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    return {
      success: false,
      error: "Frontmatter is not closed with ---",
      line: 1,
    };
  }

  // Extract frontmatter YAML
  const frontmatterYaml = lines.slice(1, closingIndex).join("\n");

  // Parse YAML
  let frontmatter: Record<string, unknown>;
  try {
    frontmatter = parseYaml(frontmatterYaml) as Record<string, unknown>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return {
      success: false,
      error: `Invalid YAML in frontmatter: ${msg}`,
      line: 2,
    };
  }

  if (!frontmatter || typeof frontmatter !== "object") {
    return {
      success: false,
      error: "Frontmatter must be a YAML object",
      line: 2,
    };
  }

  // Validate required fields
  if (!frontmatter.topic || typeof frontmatter.topic !== "string") {
    return {
      success: false,
      error: 'Frontmatter must include "topic" field as a string',
    };
  }

  if (!frontmatter.title || typeof frontmatter.title !== "string") {
    return {
      success: false,
      error: 'Frontmatter must include "title" field as a string',
    };
  }

  // Validate topic format (lowercase, alphanumeric, hyphens, slashes)
  if (!isValidTopicFormat(frontmatter.topic)) {
    return {
      success: false,
      error: `Invalid topic format "${frontmatter.topic}". Must be lowercase with / separators (e.g., "nextjs/routing/basics")`,
    };
  }

  // Validate optional fields
  if (
    frontmatter.description !== undefined &&
    typeof frontmatter.description !== "string"
  ) {
    return {
      success: false,
      error: '"description" must be a string',
    };
  }

  if (
    frontmatter.version !== undefined &&
    typeof frontmatter.version !== "string"
  ) {
    return {
      success: false,
      error: '"version" must be a string',
    };
  }

  if (
    frontmatter.lastUpdated !== undefined &&
    typeof frontmatter.lastUpdated !== "string"
  ) {
    return {
      success: false,
      error: '"lastUpdated" must be an ISO date string',
    };
  }

  if (
    frontmatter.sourceUrl !== undefined &&
    typeof frontmatter.sourceUrl !== "string"
  ) {
    return {
      success: false,
      error: '"sourceUrl" must be a string',
    };
  }

  if (frontmatter.tags !== undefined) {
    if (!Array.isArray(frontmatter.tags)) {
      return {
        success: false,
        error: '"tags" must be an array of strings',
      };
    }
    for (const tag of frontmatter.tags) {
      if (typeof tag !== "string") {
        return {
          success: false,
          error: '"tags" must contain only strings',
        };
      }
    }
  }

  // Extract content (everything after frontmatter)
  const content = lines.slice(closingIndex + 1).join("\n").trim();
  const contentLineCount = content ? content.split("\n").length : 0;

  return {
    success: true,
    frontmatter: frontmatter as unknown as DocFrontmatter,
    content,
    lineCount: contentLineCount,
  };
}

/**
 * Validate topic format: lowercase with / separators
 */
export function isValidTopicFormat(topic: string): boolean {
  // lowercase, alphanumeric, hyphens, forward slashes
  // Must not start or end with /
  // Must not have consecutive //
  return /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(topic);
}

/**
 * Generate frontmatter string from DocFrontmatter object
 */
export function generateFrontmatter(frontmatter: DocFrontmatter): string {
  const lines: string[] = [FRONTMATTER_DELIMITER];

  lines.push(`topic: ${frontmatter.topic}`);
  lines.push(`title: "${escapeYamlString(frontmatter.title)}"`);

  if (frontmatter.description) {
    lines.push(`description: "${escapeYamlString(frontmatter.description)}"`);
  }

  if (frontmatter.version) {
    lines.push(`version: "${frontmatter.version}"`);
  }

  if (frontmatter.lastUpdated) {
    lines.push(`lastUpdated: "${frontmatter.lastUpdated}"`);
  }

  if (frontmatter.sourceUrl) {
    lines.push(`sourceUrl: "${frontmatter.sourceUrl}"`);
  }

  if (frontmatter.tags && frontmatter.tags.length > 0) {
    lines.push("tags:");
    for (const tag of frontmatter.tags) {
      lines.push(`  - ${tag}`);
    }
  }

  lines.push(FRONTMATTER_DELIMITER);

  return lines.join("\n");
}

/**
 * Escape special characters in YAML strings
 */
function escapeYamlString(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Parse a markdown file and return a ParsedDoc
 */
export function parseMarkdownFile(raw: string, path: string): ParsedDoc | null {
  const result = parseFrontmatter(raw, path);
  if (!result.success) {
    return null;
  }

  return {
    path,
    frontmatter: result.frontmatter,
    content: result.content,
    lineCount: result.lineCount,
  };
}
