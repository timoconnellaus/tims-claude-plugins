/**
 * Validation logic for documentation files
 */

import { readFile } from "fs/promises";
import { join, relative } from "path";
import { glob } from "glob";
import type { ValidationError, ValidationResult, ParsedDoc } from "./types";
import { MAX_LINES_PER_FILE } from "./types";
import { parseFrontmatter, isValidTopicFormat } from "./frontmatter";
import { getDocSourceDir, listDocSources } from "./store";

/**
 * Validate a single document
 */
export function validateDoc(doc: ParsedDoc): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Topic is required (should already be validated in parseFrontmatter)
  if (!doc.frontmatter.topic) {
    errors.push({
      path: doc.path,
      type: "missing_topic",
      message: 'Frontmatter must include "topic" field',
    });
  } else if (!isValidTopicFormat(doc.frontmatter.topic)) {
    errors.push({
      path: doc.path,
      type: "invalid_topic_format",
      message: `Invalid topic format "${doc.frontmatter.topic}". Must be lowercase with / separators (e.g., "nextjs/routing/basics")`,
    });
  }

  // 2. Title is required
  if (!doc.frontmatter.title) {
    errors.push({
      path: doc.path,
      type: "missing_title",
      message: 'Frontmatter must include "title" field',
    });
  }

  // 3. Line limit (excluding frontmatter)
  if (doc.lineCount > MAX_LINES_PER_FILE) {
    errors.push({
      path: doc.path,
      type: "line_limit_exceeded",
      message: `Document has ${doc.lineCount} lines, max is ${MAX_LINES_PER_FILE}`,
    });
  }

  return errors;
}

/**
 * Validate a raw markdown file content
 */
export function validateRawMarkdown(
  content: string,
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  const result = parseFrontmatter(content, path);

  if (!result.success) {
    errors.push({
      path,
      type: "missing_frontmatter",
      message: result.error,
      line: result.line,
    });
    return errors;
  }

  // Validate the parsed doc
  const doc: ParsedDoc = {
    path,
    frontmatter: result.frontmatter,
    content: result.content,
    lineCount: result.lineCount,
  };

  return validateDoc(doc);
}

/**
 * Validate all docs in a source directory
 */
export async function validateSource(source: string): Promise<ValidationResult> {
  const sourceDir = getDocSourceDir(source);
  const pattern = join(sourceDir, "**", "*.md");

  const files = await glob(pattern, { nodir: true });
  const errors: ValidationError[] = [];
  const topics = new Set<string>();
  let docCount = 0;

  for (const file of files) {
    try {
      const content = await readFile(file, "utf-8");
      const relPath = relative(sourceDir, file);
      const fileErrors = validateRawMarkdown(content, relPath);

      if (fileErrors.length > 0) {
        errors.push(...fileErrors);
      } else {
        // Only count valid docs and their topics
        docCount++;
        const result = parseFrontmatter(content, relPath);
        if (result.success) {
          topics.add(result.frontmatter.topic);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      errors.push({
        path: relative(sourceDir, file),
        type: "invalid_frontmatter",
        message: `Failed to read file: ${msg}`,
      });
    }
  }

  return {
    source,
    valid: errors.length === 0,
    errors,
    docCount,
    topicCount: topics.size,
  };
}

/**
 * Validate all doc sources
 */
export async function validateAllSources(): Promise<ValidationResult[]> {
  const sources = await listDocSources();
  const results: ValidationResult[] = [];

  for (const source of sources) {
    const result = await validateSource(source);
    results.push(result);
  }

  return results;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return "No errors found.";
  }

  const lines: string[] = [];
  lines.push(`Found ${errors.length} validation error(s):\n`);

  for (const error of errors) {
    const line = error.line ? `:${error.line}` : "";
    lines.push(`  ${error.path}${line}`);
    lines.push(`    ${error.type}: ${error.message}`);
  }

  return lines.join("\n");
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  const status = result.valid ? "VALID" : "INVALID";
  lines.push(`${result.source}: ${status}`);
  lines.push(`  Documents: ${result.docCount}`);
  lines.push(`  Topics: ${result.topicCount}`);

  if (!result.valid) {
    lines.push(`  Errors: ${result.errors.length}`);
    for (const error of result.errors) {
      const line = error.line ? `:${error.line}` : "";
      lines.push(`    - ${error.path}${line}: ${error.message}`);
    }
  }

  return lines.join("\n");
}
