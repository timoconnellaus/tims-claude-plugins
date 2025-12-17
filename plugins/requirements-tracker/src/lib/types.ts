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
  hasIssue: boolean; // True if this test has a problem (bugs, wrong assertions, etc.)
}

// Suggested test from AI assessment
export interface SuggestedTest {
  description: string; // What the test should verify (Gherkin-style)
  rationale: string; // Why this test is needed
}

// Verification criterion result
export type CriterionResult = "pass" | "fail" | "na"; // na = not applicable

// Individual criterion assessment
export interface CriterionAssessment {
  result: CriterionResult;
  note?: string; // Optional explanation for this criterion
}

// All 8 verification criteria
export interface VerificationCriteria {
  noBugsInTestCode: CriterionAssessment; // 1. No bugs in test code
  sufficientCoverage: CriterionAssessment; // 2. Tests sufficiently cover the requirement
  meaningfulAssertions: CriterionAssessment; // 3. Assertions are meaningful
  correctTestSubject: CriterionAssessment; // 4. Tests verify the correct subject
  happyPathCovered: CriterionAssessment; // 5. Happy path covered
  edgeCasesAddressed: CriterionAssessment; // 6. Edge cases addressed
  errorScenariosHandled: CriterionAssessment; // 7. Error scenarios covered
  wouldFailIfBroke: CriterionAssessment; // 8. Tests would fail if feature broke
}

// Criteria key names for iteration
export const CRITERIA_KEYS: (keyof VerificationCriteria)[] = [
  "noBugsInTestCode",
  "sufficientCoverage",
  "meaningfulAssertions",
  "correctTestSubject",
  "happyPathCovered",
  "edgeCasesAddressed",
  "errorScenariosHandled",
  "wouldFailIfBroke",
];

// Human-readable labels for criteria
export const CRITERIA_LABELS: Record<keyof VerificationCriteria, string> = {
  noBugsInTestCode: "No bugs in test code",
  sufficientCoverage: "Tests sufficiently cover the requirement",
  meaningfulAssertions: "Assertions are meaningful",
  correctTestSubject: "Tests verify the correct subject",
  happyPathCovered: "Happy path covered",
  edgeCasesAddressed: "Edge cases addressed",
  errorScenariosHandled: "Error scenarios covered",
  wouldFailIfBroke: "Tests would fail if feature broke",
};

// AI assessment of test coverage sufficiency
export interface AIAssessment {
  sufficient: boolean; // Derived: true if all criteria pass or are n/a
  notes: string; // AI reasoning/notes (summary)
  assessedAt: string; // ISO timestamp
  criteria?: VerificationCriteria; // Explicit criteria assessments (optional for backward compat)
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

// Priority level for a requirement
export type Priority = "critical" | "high" | "medium" | "low";

// Dependency on another requirement
export interface Dependency {
  path: string; // Path to dependent requirement, e.g., "auth/REQ_login.yml"
  blocking?: boolean; // If true (default), blocks implementation. False = soft/informational
}

// Non-functional requirement categories
export type NFRCategory =
  | "performance"
  | "security"
  | "accessibility"
  | "reliability"
  | "scalability"
  | "other";

// Non-functional requirement
export interface NFR {
  category: NFRCategory; // Type of NFR
  description: string; // What the NFR requires
  threshold?: string; // Measurable threshold, e.g., "< 200ms p95", "WCAG 2.1 AA"
  verified?: boolean; // Has this NFR been verified?
}

// Additional scenario beyond the primary gherkin
export interface Scenario {
  name: string; // Short identifier, e.g., "invalid_password", "rate_limited"
  gherkin: string; // Full Given/When/Then scenario
  tags?: string[]; // e.g., ["edge-case", "error-handling", "security"]
}

// Single requirement within a feature
export interface Requirement {
  gherkin: string; // Gherkin-format requirement (Given/When/Then)
  source: Source; // Where this requirement came from (REQUIRED)
  tests: TestLink[]; // Linked tests (0 or more)
  status: ImplementationStatus; // Implementation status: "planned" or "done"
  questions?: Question[]; // Clarification questions
  aiAssessment?: AIAssessment; // Optional AI assessment
  // Extended fields
  priority?: Priority; // Importance level
  dependencies?: Dependency[]; // Requirements that must be completed first
  nfrs?: NFR[]; // Non-functional requirements
  scenarios?: Scenario[]; // Additional scenarios/edge cases
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

// Dependency issue detected during check
export interface DependencyIssue {
  requirement: string; // Path of the requirement with the issue
  blockedBy: string[]; // Paths of blocking dependencies that are not "done"
}

// Check command output structures
export interface RequirementCheckResult {
  id: string;
  testCount: number;
  verification: VerificationStatus;
  coverageSufficient: boolean | null; // null if no assessment
  unansweredQuestions: number;
  status: ImplementationStatus;
  priority?: Priority; // Priority level if set
  dependencyIssues?: string[]; // Paths of blocking deps that aren't done
  unverifiedNFRCount: number; // Number of NFRs without verified=true
}

export interface RequirementGroupCheckResult {
  path: string; // Path prefix, e.g. "auth/" or "payments/"
  requirements: RequirementCheckResult[];
}

// Priority breakdown for summary
export interface PriorityBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
  unset: number; // Requirements without priority
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
  // Extended metrics
  byPriority: PriorityBreakdown; // Priority breakdown (all requirements)
  blockedRequirements: number; // Requirements with unmet blocking dependencies
  unverifiedNFRs: number; // Total NFRs without verified=true
}

export interface CheckResult {
  requirements: RequirementGroupCheckResult[];
  orphanedTests: ExtractedTest[];
  dependencyIssues: DependencyIssue[]; // Requirements blocked by unmet dependencies
  summary: CheckSummary;
}

// File paths and patterns
export const REQUIREMENTS_DIR = ".requirements";
export const CONFIG_FILE = "config.yml";
export const CACHE_FILE = "cache.json";
export const IGNORED_TESTS_FILE = "ignored-tests.yml";
export const REQUIREMENT_FILE_PATTERN = /^REQ_[^/]+\.yml$/; // Matches REQ_*.yml
