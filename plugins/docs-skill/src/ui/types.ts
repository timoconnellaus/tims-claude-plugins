// Types for the UI components
export interface Repository {
  id: string;
  type: "local" | "github";
  path: string;
  addedAt: string;
  docsPath?: string;
}

export interface DocFrontmatter {
  topic: string;
  title: string;
  description?: string;
  version?: string;
  lastUpdated?: string;
  sourceUrl?: string;
  tags?: string[];
}

export interface ParsedDoc {
  path: string;
  frontmatter: DocFrontmatter;
  content: string;
  lineCount: number;
}

export interface DocTreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: DocTreeNode[];
  doc?: ParsedDoc;
}

export interface UserConfig {
  version: 1;
  topics: string[];
  lastSync?: string;
  source?: string;
}

export type ViewType = "repos" | "topics" | "synced";
