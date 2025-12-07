import { $ } from "bun";

export interface GitHubRepo {
  owner: string;
  name: string;
  full: string; // "owner/name" format
}

export interface GitHubIssueData {
  number: number;
  title: string;
  state: "open" | "closed";
  labels: string[];
  url: string;
}

export interface GhCliStatus {
  available: boolean;
  authenticated: boolean;
  error?: string;
}

/**
 * Detect GitHub repo from git remote origin.
 * Supports both HTTPS and SSH URL formats.
 */
export async function detectGitHubRepo(cwd?: string): Promise<GitHubRepo | null> {
  try {
    const result = cwd
      ? await $`git -C ${cwd} remote get-url origin`.text()
      : await $`git remote get-url origin`.text();
    const url = result.trim();

    // Match HTTPS: https://github.com/owner/repo.git or https://github.com/owner/repo
    const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/]+?)(\.git)?$/);
    if (httpsMatch) {
      return {
        owner: httpsMatch[1],
        name: httpsMatch[2],
        full: `${httpsMatch[1]}/${httpsMatch[2]}`,
      };
    }

    // Match SSH: git@github.com:owner/repo.git
    const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/]+?)(\.git)?$/);
    if (sshMatch) {
      return {
        owner: sshMatch[1],
        name: sshMatch[2],
        full: `${sshMatch[1]}/${sshMatch[2]}`,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if gh CLI is available and authenticated.
 */
export async function checkGhCli(): Promise<GhCliStatus> {
  try {
    await $`gh --version`.quiet();
  } catch {
    return { available: false, authenticated: false, error: "gh CLI not installed" };
  }

  try {
    await $`gh auth status`.quiet();
    return { available: true, authenticated: true };
  } catch {
    return { available: true, authenticated: false, error: "gh CLI not authenticated. Run 'gh auth login'" };
  }
}

/**
 * List issues from a GitHub repo.
 */
export async function listIssues(
  repo: string,
  options: {
    state?: "open" | "closed" | "all";
    limit?: number;
    search?: string;
  } = {}
): Promise<GitHubIssueData[]> {
  const { state = "open", limit = 30, search } = options;

  const args = [
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    state,
    "--limit",
    String(limit),
    "--json",
    "number,title,state,labels,url",
  ];

  if (search) {
    args.push("--search", search);
  }

  try {
    const result = await $`gh ${args}`.json();
    // Transform labels from objects to strings
    return (result as Array<{ number: number; title: string; state: string; labels: Array<{ name: string }>; url: string }>).map((issue) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state as "open" | "closed",
      labels: issue.labels.map((l) => l.name),
      url: issue.url,
    }));
  } catch (error) {
    throw new Error(`Failed to list issues: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get a single issue by number.
 */
export async function getIssue(repo: string, number: number): Promise<GitHubIssueData | null> {
  try {
    const result = await $`gh issue view ${number} --repo ${repo} --json number,title,state,labels,url`.json();
    const issue = result as { number: number; title: string; state: string; labels: Array<{ name: string }>; url: string };
    return {
      number: issue.number,
      title: issue.title,
      state: issue.state as "open" | "closed",
      labels: issue.labels.map((l) => l.name),
      url: issue.url,
    };
  } catch {
    return null;
  }
}

/**
 * Sync issue states for multiple issue numbers.
 * Returns a map of issue number to { state, title }.
 */
export async function syncIssueStates(
  repo: string,
  issueNumbers: number[]
): Promise<Map<number, { state: "open" | "closed"; title: string }>> {
  const results = new Map<number, { state: "open" | "closed"; title: string }>();

  // gh CLI doesn't support batch queries, so we fetch individually
  // Could optimize with GraphQL API in future
  for (const num of issueNumbers) {
    const issue = await getIssue(repo, num);
    if (issue) {
      results.set(num, { state: issue.state, title: issue.title });
    }
  }

  return results;
}
