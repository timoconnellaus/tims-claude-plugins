/**
 * docs-skill types - Documentation management for AI agents
 */

// ============================================
// CONSTANTS
// ============================================

export const DOCS_DIR = ".docs";
export const CONFIG_FILE = "config.yml";
export const MAX_LINES_PER_FILE = 1000;
export const FRONTMATTER_DELIMITER = "---";

// ============================================
// FRONTMATTER & DOCUMENT TYPES
// ============================================

/**
 * Required frontmatter for every markdown file in docs/
 */
export interface DocFrontmatter {
  /** Primary topic identifier, e.g., "nextjs/routing" */
  topic: string;
  /** Human-readable title */
  title: string;
  /** Brief description */
  description?: string;
  /** Documentation version (e.g., "15.0", "latest") */
  version?: string;
  /** ISO date when source was last fetched */
  lastUpdated?: string;
  /** Original URL of documentation */
  sourceUrl?: string;
  /** Additional searchable tags */
  tags?: string[];
}

/**
 * Parsed markdown document with frontmatter
 */
export interface ParsedDoc {
  /** Relative path from docs/, e.g., "nextjs/routing.md" */
  path: string;
  /** Parsed and validated frontmatter */
  frontmatter: DocFrontmatter;
  /** Markdown content (without frontmatter) */
  content: string;
  /** Line count (excluding frontmatter) */
  lineCount: number;
}

/**
 * Document section after splitting by headings
 */
export interface DocSection {
  /** The heading text (e.g., "## Getting Started") */
  heading: string;
  /** Heading level (1-6) */
  level: number;
  /** Content under this heading */
  content: string;
  /** Line number in original document */
  startLine: number;
  /** End line number */
  endLine: number;
}

// ============================================
// SYNC-DOCS CONTRACT
// ============================================

/**
 * Source definition for fetching documentation
 */
export interface DocSource {
  type: "github" | "url" | "npm";
  /** GitHub repo URL, docs URL, or npm package name */
  url: string;
  /** For GitHub: branch name (default: main) */
  branch?: string;
  /** For GitHub: specific paths to fetch */
  paths?: string[];
  /** For URL: CSS selector for content */
  selector?: string;
}

/**
 * Output from a sync operation for a single file
 */
export interface SyncOutput {
  /** Relative path for output file (e.g., "routing.md") */
  path: string;
  /** Frontmatter to write */
  frontmatter: DocFrontmatter;
  /** Markdown content */
  content: string;
}

/**
 * Contract interface that all sync-docs.ts files must implement
 */
export interface SyncDocsContract {
  /** Human-readable name for this doc source */
  name: string;

  /** Base topic prefix (e.g., "nextjs", "tanstack-start") */
  topicPrefix: string;

  /**
   * Deterministically build docs from sources.
   * MUST be idempotent - same input produces same output.
   * NO hardcoded content - everything fetched from sources.
   */
  sync(): Promise<SyncOutput[]>;

  /** List all available topics this source provides */
  listTopics(): Promise<string[]>;
}

// ============================================
// USER CONFIG (.docs/config.yml)
// ============================================

/**
 * Topic pattern for include/exclude (gitignore-style)
 * - Glob patterns include topics: "nextjs/**", "react/hooks/*"
 * - Patterns starting with ! exclude: "!nextjs/legacy/*"
 */
export type TopicPattern = string;

/**
 * User configuration stored in .docs/config.yml
 */
export interface UserConfig {
  /** Version of config schema */
  version: 1;

  /**
   * Topic patterns to sync (gitignore-style)
   * - Glob patterns include topics: "nextjs/**", "react/hooks/*"
   * - Patterns starting with ! exclude: "!nextjs/legacy/*"
   * - Order matters: later patterns override earlier ones
   */
  topics: TopicPattern[];

  /** Last sync timestamp */
  lastSync?: string;

  /** Plugin source URL (for fetching available docs) */
  source?: string;
}

/**
 * Topic match result after applying patterns
 */
export interface TopicMatch {
  topic: string;
  included: boolean;
  /** Which pattern caused include/exclude */
  matchedPattern?: string;
}

// ============================================
// VALIDATION
// ============================================

export type ValidationErrorType =
  | "missing_frontmatter"
  | "invalid_frontmatter"
  | "missing_topic"
  | "missing_title"
  | "line_limit_exceeded"
  | "invalid_topic_format";

/**
 * Validation error for a document
 */
export interface ValidationError {
  /** Document path */
  path: string;
  type: ValidationErrorType;
  message: string;
  /** Line number if applicable */
  line?: number;
}

/**
 * Validation result for a docs source
 */
export interface ValidationResult {
  /** e.g., "nextjs" */
  source: string;
  valid: boolean;
  errors: ValidationError[];
  docCount: number;
  topicCount: number;
}

// ============================================
// SEARCH
// ============================================

/**
 * Search result for available docs
 */
export interface DocSearchResult {
  topic: string;
  title: string;
  description?: string;
  /** e.g., "nextjs", "react" */
  source: string;
  path: string;
}

// ============================================
// CLI ARGS
// ============================================

export interface ValidateArgs {
  cwd: string;
  source?: string;
}

export interface SyncArgs {
  cwd: string;
  source?: string;
}

export interface InitArgs {
  cwd: string;
}

export interface SearchArgs {
  cwd: string;
  query: string;
}

export interface ConfigArgs {
  cwd: string;
  add?: string;
  remove?: string;
}

export interface CheckArgs {
  cwd: string;
}

export interface PullArgs {
  cwd: string;
  force?: boolean;
}
