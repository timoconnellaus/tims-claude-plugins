/**
 * List issues from local cache
 */

import { loadCache, isCacheStale } from "../lib/store";
import { PRIORITY_LABELS, LinearIssue } from "../lib/types";

export async function list(args: {
  cwd: string;
  priority?: string;        // "urgent" | "high" | "medium" | "low"
  state?: string;           // State name filter
  label?: string;           // Label filter
  coverage?: "with" | "without" | "all";
  search?: string;          // Search in title/identifier
  json?: boolean;
}): Promise<void> {
  const { cwd, priority, state, label, coverage = "all", search, json } = args;

  // Load cache
  const cache = await loadCache(cwd);
  if (!cache) {
    console.error("No cache found. Run 'req sync' first.");
    process.exit(1);
  }

  // Warn if stale
  if (isCacheStale(cache)) {
    console.error("Cache is stale. Consider running 'req sync'.\n");
  }

  const { issues, testLinks } = cache;

  // Build set of issues with tests
  const issuesWithTests = new Set(testLinks.map((l) => l.issueId));

  // Filter issues
  let filtered = [...issues];

  // Priority filter
  if (priority) {
    const priorityMap: Record<string, number> = {
      urgent: 1,
      high: 2,
      medium: 3,
      low: 4,
      none: 0,
    };
    const targetPriority = priorityMap[priority.toLowerCase()];
    if (targetPriority !== undefined) {
      filtered = filtered.filter((i) => i.priority === targetPriority);
    }
  }

  // State filter
  if (state) {
    filtered = filtered.filter(
      (i) => i.state.name.toLowerCase() === state.toLowerCase()
    );
  }

  // Label filter
  if (label) {
    filtered = filtered.filter((i) =>
      i.labels.some((l) => l.toLowerCase() === label.toLowerCase())
    );
  }

  // Coverage filter
  if (coverage === "with") {
    filtered = filtered.filter((i) => issuesWithTests.has(i.id));
  } else if (coverage === "without") {
    filtered = filtered.filter((i) => !issuesWithTests.has(i.id));
  }

  // Search filter
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.identifier.toLowerCase().includes(searchLower) ||
        i.title.toLowerCase().includes(searchLower)
    );
  }

  // Sort by priority then identifier
  filtered.sort((a, b) => {
    const aPri = a.priority === 0 ? 5 : a.priority;
    const bPri = b.priority === 0 ? 5 : b.priority;
    if (aPri !== bPri) return aPri - bPri;
    return a.identifier.localeCompare(b.identifier);
  });

  // Output
  if (json) {
    const result = filtered.map((i) => ({
      identifier: i.identifier,
      title: i.title,
      priority: i.priority,
      priorityLabel: PRIORITY_LABELS[i.priority],
      state: i.state.name,
      stateType: i.state.type,
      labels: i.labels,
      assignee: i.assignee,
      hasTests: issuesWithTests.has(i.id),
      testCount: testLinks.find((l) => l.issueId === i.id)?.tests.length ?? 0,
      url: i.url,
    }));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Human-readable output
  if (filtered.length === 0) {
    console.log("No issues found matching filters.");
    return;
  }

  console.log(`\n${filtered.length} issue(s) (synced: ${new Date(cache.lastSync).toLocaleString()})\n`);

  for (const issue of filtered) {
    const hasTests = issuesWithTests.has(issue.id);
    const testCount = testLinks.find((l) => l.issueId === issue.id)?.tests.length ?? 0;
    const testIndicator = hasTests ? `● ${testCount}` : "○";
    const pri = PRIORITY_LABELS[issue.priority]?.slice(0, 1) || "-";

    console.log(`${testIndicator} ${issue.identifier} [${pri}] ${issue.title}`);
    console.log(`    ${issue.state.name}${issue.assignee ? ` • ${issue.assignee}` : ""}`);
    if (issue.labels.length > 0) {
      console.log(`    ${issue.labels.join(", ")}`);
    }
    console.log();
  }

  // Legend
  console.log("---");
  console.log("● = has tests, ○ = no tests");
  console.log("Priority: U=Urgent, H=High, M=Medium, L=Low, -=None");
}
