/**
 * Requirements tracker types - YAML-based feature file system
 */

// Config file structure (.requirements/config.yml)
export interface Config {
  testRunner: string; // e.g., "bun test", "npm test", "vitest"
  testGlob: string; // e.g., "**/*.test.{ts,js}"
}

// Test link stored per requirement
export interface TestLink {
  file: string; // e.g., "src/auth.test.ts"
  identifier: string; // e.g., "validates login credentials"
  hash: string; // SHA-256 hash of test function body
}

// Per-test comment from AI assessment
export interface TestComment {
  file: string; // Test file path
  identifier: string; // Test name
  comment: string; // AI's comment on this test's suitability
}

// Suggested test from AI assessment
export interface SuggestedTest {
  description: string; // What the test should verify (Gherkin-style)
  rationale: string; // Why this test is needed
}

// AI assessment of test coverage sufficiency
export interface AIAssessment {
  sufficient: boolean; // Is test coverage sufficient?
  notes: string; // AI reasoning/notes
  assessedAt: string; // ISO timestamp
  testComments?: TestComment[]; // Per-test comments
  suggestedTests?: SuggestedTest[]; // Tests that should be written
}

// Clarification question about a requirement
export interface Question {
  question: string; // The question text
  answer?: string; // The answer (if answered)
  answeredAt?: string; // ISO timestamp when answered
}

// Source of a requirement - where it came from
export type SourceType = "doc" | "slack" | "email" | "meeting" | "ticket" | "manual";

export interface Source {
  type: SourceType; // Type of source
  description: string; // Brief description (e.g., "PRD v2.1", "Slack thread with @john")
  url?: string; // Link to source if available
  date?: string; // When the source was created/discussed
}

// Implementation status for a requirement
export type ImplementationStatus = "planned" | "done";

// Single requirement within a feature
export interface Requirement {
  gherkin: string; // Gherkin-format requirement (Given/When/Then)
  source: Source; // Where this requirement came from (REQUIRED)
  tests: TestLink[]; // Linked tests (0 or more)
  status: ImplementationStatus; // Implementation status: "planned" or "done"
  questions?: Question[]; // Clarification questions
  aiAssessment?: AIAssessment; // Optional AI assessment
}

// Parsed requirement from filesystem
export interface ParsedRequirement {
  path: string; // Relative path from .requirements/, e.g. "auth/REQ_login.yml"
  data: Requirement; // The requirement content
}

// Cache file structure
export interface TestCache {
  version: number;
  generatedAt: string; // ISO timestamp
  fileMtimes: Record<string, number>; // "path/to/file.test.ts" -> mtime in ms
  tests: Record<string, string>; // "file:identifier" -> hash
}

// Ignored test entry
export interface IgnoredTest {
  file: string;
  identifier: string;
  reason: string;
  ignoredAt: string; // ISO timestamp
}

// Ignored tests file structure
export interface IgnoredTestsFile {
  tests: IgnoredTest[];
}

// Verification status - computed at check time
// - unverified: Has tests, but no AI assessment yet
// - verified: AI assessed and tests unchanged since
// - stale: AI assessed but tests changed since (needs re-assessment)
// - n/a: No tests linked, nothing to verify
export type VerificationStatus = "unverified" | "verified" | "stale" | "n/a";

// Test extraction result
export interface ExtractedTest {
  file: string;
  identifier: string;
  body: string; // Full test function body for hashing
  hash: string; // SHA-256 hash
}

// Check command output structures
export interface RequirementCheckResult {
  id: string;
  testCount: number;
  verification: VerificationStatus;
  coverageSufficient: boolean | null; // null if no assessment
  unansweredQuestions: number;
  status: ImplementationStatus;
}

export interface RequirementGroupCheckResult {
  path: string; // Path prefix, e.g. "auth/" or "payments/"
  requirements: RequirementCheckResult[];
}

export interface CheckSummary {
  totalRequirements: number;
  // Implementation status
  planned: number; // Not yet implemented
  done: number; // Implemented
  // Coverage: does requirement have tests?
  untested: number; // No tests linked
  tested: number; // Has tests linked
  // Verification: has AI assessed and are tests unchanged?
  unverified: number; // Has tests, no AI assessment
  verified: number; // AI assessed, tests unchanged
  stale: number; // AI assessed, but tests changed since
  // Orphans
  orphanedTestCount: number;
  // Other
  unansweredQuestions: number;
}

export interface CheckResult {
  requirements: RequirementGroupCheckResult[];
  orphanedTests: ExtractedTest[];
  summary: CheckSummary;
}

// File paths and patterns
export const REQUIREMENTS_DIR = ".requirements";
export const CONFIG_FILE = "config.yml";
export const CACHE_FILE = "cache.json";
export const IGNORED_TESTS_FILE = "ignored-tests.yml";
export const REQUIREMENT_FILE_PATTERN = /^REQ_[^/]+\.yml$/; // Matches REQ_*.yml
