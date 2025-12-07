export type SourceType = "doc" | "ai" | "slack" | "jira" | "manual";

export type Priority = "critical" | "high" | "medium" | "low";

export type RequirementStatus = "draft" | "approved" | "implemented" | "released";

export interface RequirementSource {
  type: SourceType;
  reference: string;
  capturedAt: string; // ISO 8601
}

export interface TestConfirmation {
  hash: string;          // Hash of test function body
  confirmedAt: string;   // ISO 8601
  confirmedBy?: string;  // Who confirmed
  note?: string;         // Confirmation note
}

export interface TestLink {
  runner: string;
  file: string;
  identifier: string;
  linkedAt: string; // ISO 8601
  confirmation?: TestConfirmation;
}

export type HistoryAction = "created" | "modified" | "archived" | "restored" | "status_changed" | "priority_changed" | "tags_changed" | "github_linked" | "github_unlinked";

export interface HistoryEntry {
  action: HistoryAction;
  timestamp: string; // ISO 8601
  by?: string;
  note?: string;
}

export interface GitHubIssue {
  number: number;              // Issue number only (repo is in config)
  state?: "open" | "closed";   // Cached state from last sync
  title?: string;              // Cached title from last sync
  lastSynced?: string;         // ISO 8601 timestamp of last sync
}

export interface Requirement {
  description: string;
  source: RequirementSource;
  tests: TestLink[];
  history: HistoryEntry[];
  lastVerified?: string; // ISO 8601
  tags?: string[];
  priority?: Priority;
  status?: RequirementStatus;
  githubIssue?: GitHubIssue;
}

export interface TestRunner {
  name: string;
  command: string;
  pattern: string;
}

export interface GitHubConfig {
  repo: string;              // owner/repo format
  autoDetected?: boolean;    // Whether repo was auto-detected from git remote
}

export interface RequirementsConfig {
  testRunners: TestRunner[];
  github?: GitHubConfig;
}

export interface RequirementsFile {
  version: string;
  config: RequirementsConfig;
  requirements: Record<string, Requirement>;
}

export interface ArchiveFile {
  version: string;
  requirements: Record<string, Requirement>;
}

// Helper type for check results
export interface CheckResult {
  requirementsWithoutTests: string[];
  testsWithoutRequirements: { runner: string; file: string; identifier: string }[];
  passingRequirements: string[];
  failingRequirements: string[];
  untestedRequirements: string[];
}
