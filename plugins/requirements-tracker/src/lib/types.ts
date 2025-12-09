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

// AI assessment of test coverage sufficiency
export interface AIAssessment {
  sufficient: boolean; // Is test coverage sufficient?
  notes: string; // AI reasoning/notes
  assessedAt: string; // ISO timestamp
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

// Single requirement within a feature
export interface Requirement {
  gherkin: string; // Gherkin-format requirement (Given/When/Then)
  source: Source; // Where this requirement came from (REQUIRED)
  tests: TestLink[]; // Linked tests (0 or more)
  questions?: Question[]; // Clarification questions
  aiAssessment?: AIAssessment; // Optional AI assessment
}

// Feature file structure (FEAT_001_name.yml)
export interface FeatureFile {
  name: string; // Feature name
  description: string; // Feature description
  requirements: Record<string, Requirement>; // Key is ID like "1", "2.1"
}

// Parsed feature from filesystem
export interface ParsedFeature {
  filename: string; // e.g., "FEAT_001_user-auth.yml"
  number: number; // e.g., 1
  userPart: string; // e.g., "user-auth"
  filePath: string; // Full path
  data: FeatureFile; // Parsed YAML content
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
}

export interface FeatureCheckResult {
  feature: string;
  requirements: RequirementCheckResult[];
}

export interface CheckSummary {
  totalFeatures: number;
  totalRequirements: number;
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
  features: FeatureCheckResult[];
  orphanedTests: ExtractedTest[];
  summary: CheckSummary;
}

// File paths and patterns
export const REQUIREMENTS_DIR = ".requirements";
export const CONFIG_FILE = "config.yml";
export const FEATURE_FILE_PATTERN = /^FEAT_(\d+)_(.+)\.yml$/;
