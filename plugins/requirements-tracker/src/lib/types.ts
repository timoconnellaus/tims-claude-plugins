/**
 * Requirements tracker types - supports Linear and local modes
 */

// Mode of operation
export type RequirementsMode = "local" | "linear";

// Common issue interface (shared fields)
export interface Issue {
  id: string;
  identifier: string;   // e.g., "ENG-123" or "REQ-001"
  title: string;
  description?: string;
  state: {
    name: string;
    type: string;
  };
  priority: number;     // 0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low
  labels: string[];
  // Optional fields (present in Linear mode)
  assignee?: string;
  url?: string;
}

// Linear issue (extends base with required url and updatedAt)
export interface LinearIssue extends Issue {
  url: string;         // Required in Linear mode
  updatedAt: string;
}

// Local issue (extends base with local-specific fields)
export interface LocalIssue extends Issue {
  createdAt: string;
  updatedAt: string;
}

// Test link stored in Linear comments or locally
export interface TestLink {
  file: string;         // e.g., "src/auth.test.ts"
  identifier: string;   // e.g., "validates login credentials"
  linkedAt: string;     // ISO timestamp
  linkedBy?: string;    // Who linked it
}

// Parsed from Linear comment
export interface IssueTestLinks {
  issueId: string;
  identifier: string;   // e.g., "ENG-123"
  tests: TestLink[];
  commentId?: string;   // Linear comment ID (for updates)
}

// Local cache structure (supports both modes)
export interface LocalCache {
  mode: RequirementsMode;
  lastSync: string;     // ISO timestamp
  issues: Issue[];      // LinearIssue[] or LocalIssue[]
  testLinks: IssueTestLinks[];
  // Linear mode only
  teamId?: string;
  teamKey?: string;
}

// Config stored in project root
export interface RequirementsConfig {
  mode: RequirementsMode;

  // Local mode settings
  prefix?: string;        // e.g., "REQ" for REQ-001
  nextId?: number;        // Next ID to assign

  // Linear mode settings
  linearApiKey?: string;  // Can also be in env: LINEAR_API_KEY
  teamId?: string;
  teamKey?: string;
  projectId?: string;     // Optional: filter to specific project
  filters?: {
    states?: string[];    // Only sync issues in these states
    labels?: string[];    // Only sync issues with these labels
  };
}

// Priority mapping
export const PRIORITY_LABELS: Record<number, string> = {
  0: "No priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

// State type mapping
export const STATE_TYPES = {
  backlog: "backlog",
  unstarted: "unstarted",
  started: "started",
  completed: "completed",
  canceled: "canceled",
} as const;

export type StateType = keyof typeof STATE_TYPES;

// Comment markers for test links
export const TEST_LINK_COMMENT_MARKER = "<!-- req-tests:";
export const TEST_LINK_COMMENT_END = " -->";

// File paths
export const CONFIG_FILE = ".requirements.json";
export const CACHE_FILE = ".requirements-cache.json";
