import { loadRequirements, saveRequirements } from "../lib/store";
import {
  detectGitHubRepo,
  checkGhCli,
  listIssues,
  syncIssueStates,
} from "../lib/github";

const HELP = `
Manage GitHub integration.

USAGE:
  bun req github <subcommand> [options]

SUBCOMMANDS:
  status              Show GitHub configuration status
  detect              Auto-detect repo from git remote
  set <owner/repo>    Manually set the GitHub repo
  issues [options]    List issues from the configured repo
  sync                Sync issue states for all linked issues

OPTIONS FOR 'issues':
  --state <state>     Filter by state: open, closed, all (default: open)
  --search <query>    Search issues
  --limit <n>         Max issues to show (default: 30)

EXAMPLES:
  bun req github status
  bun req github detect
  bun req github set myorg/myrepo
  bun req github issues --state open
  bun req github sync
`.trim();

export async function github(args: string[], cwd?: string): Promise<void> {
  const subcommand = args[0];

  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    console.log(HELP);
    return;
  }

  switch (subcommand) {
    case "status":
      await statusCommand(cwd);
      break;
    case "detect":
      await detectCommand(cwd);
      break;
    case "set":
      await setCommand(args.slice(1), cwd);
      break;
    case "issues":
      await issuesCommand(args.slice(1), cwd);
      break;
    case "sync":
      await syncCommand(cwd);
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      console.log(`Run 'bun req github help' for usage.`);
      process.exit(1);
  }
}

async function statusCommand(cwd?: string): Promise<void> {
  const data = loadRequirements(cwd);
  const cliStatus = await checkGhCli();

  console.log("GitHub Integration Status");
  console.log("========================");
  console.log();

  // Repository config
  if (data.config.github?.repo) {
    console.log(`Repository: ${data.config.github.repo}`);
    console.log(`Auto-detected: ${data.config.github.autoDetected ? "yes" : "no"}`);
  } else {
    console.log("Repository: Not configured");
    console.log("  Run 'bun req github detect' to auto-detect from git remote");
    console.log("  Or 'bun req github set owner/repo' to set manually");
  }

  console.log();

  // CLI status
  console.log(`gh CLI installed: ${cliStatus.available ? "yes" : "no"}`);
  if (cliStatus.available) {
    console.log(`gh CLI authenticated: ${cliStatus.authenticated ? "yes" : "no"}`);
    if (!cliStatus.authenticated) {
      console.log(`  ${cliStatus.error}`);
    }
  } else {
    console.log(`  ${cliStatus.error}`);
  }

  console.log();

  // Linked issues summary
  const linkedIssues = new Set<number>();
  for (const req of Object.values(data.requirements)) {
    if (req.githubIssue?.number) {
      linkedIssues.add(req.githubIssue.number);
    }
  }
  console.log(`Linked issues: ${linkedIssues.size}`);
}

async function detectCommand(cwd?: string): Promise<void> {
  const detected = await detectGitHubRepo(cwd);

  if (!detected) {
    console.error("Could not detect GitHub repo from git remote.");
    console.error("Make sure this is a git repository with a GitHub remote.");
    process.exit(1);
  }

  const data = loadRequirements(cwd);
  data.config.github = { repo: detected.full, autoDetected: true };
  saveRequirements(data, cwd);

  console.log(`Detected and saved GitHub repo: ${detected.full}`);
}

async function setCommand(args: string[], cwd?: string): Promise<void> {
  const repo = args[0];

  if (!repo) {
    console.error("Usage: bun req github set <owner/repo>");
    process.exit(1);
  }

  if (!repo.match(/^[^/]+\/[^/]+$/)) {
    console.error("Invalid repo format. Use owner/repo (e.g., myorg/myrepo)");
    process.exit(1);
  }

  const data = loadRequirements(cwd);
  data.config.github = { repo, autoDetected: false };
  saveRequirements(data, cwd);

  console.log(`GitHub repo set to: ${repo}`);
}

async function issuesCommand(args: string[], cwd?: string): Promise<void> {
  const data = loadRequirements(cwd);

  if (!data.config.github?.repo) {
    console.error("GitHub repo not configured.");
    console.error("Run 'bun req github detect' or 'bun req github set owner/repo' first.");
    process.exit(1);
  }

  const cliStatus = await checkGhCli();
  if (!cliStatus.authenticated) {
    console.error(cliStatus.error);
    process.exit(1);
  }

  // Parse options
  let state: "open" | "closed" | "all" = "open";
  let search: string | undefined;
  let limit = 30;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--state" && args[i + 1]) {
      state = args[++i] as "open" | "closed" | "all";
    } else if (args[i] === "--search" && args[i + 1]) {
      search = args[++i];
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[++i], 10);
    }
  }

  console.log(`Fetching ${state} issues from ${data.config.github.repo}...`);
  console.log();

  try {
    const issues = await listIssues(data.config.github.repo, { state, search, limit });

    if (issues.length === 0) {
      console.log("No issues found.");
      return;
    }

    for (const issue of issues) {
      const labels = issue.labels.length > 0 ? ` [${issue.labels.join(", ")}]` : "";
      console.log(`#${issue.number} (${issue.state}) ${issue.title}${labels}`);
    }

    console.log();
    console.log(`Showing ${issues.length} issues.`);
  } catch (error) {
    console.error(`Failed to fetch issues: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function syncCommand(cwd?: string): Promise<void> {
  const data = loadRequirements(cwd);

  if (!data.config.github?.repo) {
    console.error("GitHub repo not configured.");
    console.error("Run 'bun req github detect' or 'bun req github set owner/repo' first.");
    process.exit(1);
  }

  const cliStatus = await checkGhCli();
  if (!cliStatus.authenticated) {
    console.error(cliStatus.error);
    process.exit(1);
  }

  // Collect all unique issue numbers
  const issueNumbers = new Set<number>();
  for (const req of Object.values(data.requirements)) {
    if (req.githubIssue?.number) {
      issueNumbers.add(req.githubIssue.number);
    }
  }

  if (issueNumbers.size === 0) {
    console.log("No linked issues to sync.");
    return;
  }

  console.log(`Syncing ${issueNumbers.size} linked issues...`);

  const states = await syncIssueStates(data.config.github.repo, Array.from(issueNumbers));

  // Update requirements with cached state
  let synced = 0;
  const now = new Date().toISOString();
  for (const req of Object.values(data.requirements)) {
    if (req.githubIssue?.number && states.has(req.githubIssue.number)) {
      const { state, title } = states.get(req.githubIssue.number)!;
      req.githubIssue.state = state;
      req.githubIssue.title = title;
      req.githubIssue.lastSynced = now;
      synced++;
    }
  }

  saveRequirements(data, cwd);

  console.log(`Synced ${synced} issues.`);

  // Show summary of states
  const openCount = Array.from(states.values()).filter(s => s.state === "open").length;
  const closedCount = Array.from(states.values()).filter(s => s.state === "closed").length;
  console.log(`  Open: ${openCount}, Closed: ${closedCount}`);
}
