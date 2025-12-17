/**
 * Markdown splitting library for breaking large docs into smaller files
 */

import type { DocSection } from "./types";

export interface SplitOptions {
  /** Maximum heading level to split on (default: 2 = ## headings) */
  maxLevel?: number;
  /** Minimum lines per section before splitting (default: 50) */
  minLines?: number;
  /** Include parent heading context in child sections */
  includeContext?: boolean;
}

const HEADING_REGEX = /^(#{1,6})\s+(.+)$/;

/**
 * Split markdown content by headings
 *
 * @example
 * const sections = splitByHeadings(content, { maxLevel: 2 });
 * // Returns sections split at ## headings
 */
export function splitByHeadings(
  content: string,
  options?: SplitOptions
): DocSection[] {
  const { maxLevel = 2 } = options ?? {};
  const sections: DocSection[] = [];
  const lines = content.split("\n");

  let currentSection: DocSection | null = null;
  let currentContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(HEADING_REGEX);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];

      if (level <= maxLevel) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join("\n").trim();
          currentSection.endLine = i;
          if (currentSection.content || currentSection.heading) {
            sections.push(currentSection);
          }
        }

        // Start new section
        currentSection = {
          heading: line,
          level,
          content: "",
          startLine: i + 1,
          endLine: i + 1,
        };
        currentContent = [];
        continue;
      }
    }

    currentContent.push(line);
  }

  // Push final section
  if (currentSection) {
    currentSection.content = currentContent.join("\n").trim();
    currentSection.endLine = lines.length;
    if (currentSection.content || currentSection.heading) {
      sections.push(currentSection);
    }
  } else if (currentContent.length > 0) {
    // Content before any heading
    sections.push({
      heading: "",
      level: 0,
      content: currentContent.join("\n").trim(),
      startLine: 1,
      endLine: lines.length,
    });
  }

  return sections;
}

/**
 * Merge small consecutive sections together
 */
export function mergeSections(
  sections: DocSection[],
  minLines: number
): DocSection[] {
  if (sections.length === 0) return [];

  const merged: DocSection[] = [];
  let current = { ...sections[0] };

  for (let i = 1; i < sections.length; i++) {
    const next = sections[i];
    const currentLines = current.content.split("\n").length;

    if (currentLines < minLines && current.level >= next.level) {
      // Merge: append next section's content to current
      current.content =
        current.content +
        "\n\n" +
        next.heading +
        "\n" +
        next.content;
      current.endLine = next.endLine;
    } else {
      // Push current and start new
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Split a large section into multiple parts at paragraph boundaries
 */
export function splitLargeSection(
  section: DocSection,
  maxLines: number
): DocSection[] {
  const lines = section.content.split("\n");

  if (lines.length <= maxLines) {
    return [section];
  }

  const parts: DocSection[] = [];
  let currentLines: string[] = [];
  let partStartLine = section.startLine;
  let partNumber = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentLines.push(line);

    // Check if we should split at a paragraph boundary
    const isEmptyLine = line.trim() === "";
    const isNearLimit = currentLines.length >= maxLines - 10;
    const isAtLimit = currentLines.length >= maxLines;

    if ((isEmptyLine && isNearLimit) || isAtLimit) {
      // Split here
      parts.push({
        heading:
          partNumber === 1
            ? section.heading
            : `${section.heading} (Part ${partNumber})`,
        level: section.level,
        content: currentLines.join("\n").trim(),
        startLine: partStartLine,
        endLine: section.startLine + i,
      });

      currentLines = [];
      partStartLine = section.startLine + i + 1;
      partNumber++;
    }
  }

  // Push remaining content
  if (currentLines.length > 0) {
    parts.push({
      heading:
        partNumber === 1
          ? section.heading
          : `${section.heading} (Part ${partNumber})`,
      level: section.level,
      content: currentLines.join("\n").trim(),
      startLine: partStartLine,
      endLine: section.endLine,
    });
  }

  return parts;
}

/**
 * Extract the heading text without the # prefix
 */
export function extractHeadingText(heading: string): string {
  const match = heading.match(HEADING_REGEX);
  return match ? match[2].trim() : heading.trim();
}

/**
 * Convert a heading to a URL-safe slug
 */
export function headingToSlug(heading: string): string {
  const text = extractHeadingText(heading);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Build a table of contents from sections
 */
export function buildTableOfContents(sections: DocSection[]): string {
  const lines: string[] = [];

  for (const section of sections) {
    if (section.heading) {
      const indent = "  ".repeat(section.level - 1);
      const text = extractHeadingText(section.heading);
      const slug = headingToSlug(section.heading);
      lines.push(`${indent}- [${text}](#${slug})`);
    }
  }

  return lines.join("\n");
}

/**
 * Get line count of content (excluding empty lines at start/end)
 */
export function getContentLineCount(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) return 0;
  return trimmed.split("\n").length;
}
