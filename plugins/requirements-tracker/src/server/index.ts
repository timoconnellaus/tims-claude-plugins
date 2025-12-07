import homepage from "../web/index.html";
import {
  loadRequirements,
  saveRequirements,
  loadArchive,
  saveArchive,
  createHistoryEntry,
} from "../lib/store";
import {
  detectGitHubRepo,
  checkGhCli,
  listIssues,
  syncIssueStates,
} from "../lib/github";
import type { SourceType, Priority, RequirementStatus } from "../lib/types";

const cwd = process.cwd();

const VALID_SOURCES: SourceType[] = ["doc", "ai", "slack", "jira", "manual"];
const VALID_PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
const VALID_STATUSES: RequirementStatus[] = ["draft", "approved", "implemented", "released"];

function parsePort(args: string[]): number {
  const portIndex = args.indexOf("--port");
  if (portIndex !== -1 && args[portIndex + 1]) {
    const port = parseInt(args[portIndex + 1], 10);
    if (!isNaN(port)) return port;
  }
  return 3000;
}

export function startServer(args: string[] = []) {
  const port = parsePort(args);

  const server = Bun.serve({
    port,
    development: true,
    routes: {
      "/": homepage,

      "/api/requirements": {
        GET: () => {
          const data = loadRequirements(cwd);
          return Response.json(data);
        },
      },

      "/api/requirements/:id": {
        GET: (req) => {
          const id = req.params.id;
          const data = loadRequirements(cwd);
          const requirement = data.requirements[id];

          if (!requirement) {
            return Response.json({ error: "Requirement not found" }, { status: 404 });
          }

          return Response.json({ id, ...requirement });
        },

        PATCH: async (req) => {
          const id = req.params.id;
          const body = await req.json() as {
            description?: string;
            source?: { type?: SourceType; reference?: string };
            priority?: Priority;
            status?: RequirementStatus;
            addTags?: string[];
            removeTags?: string[];
            githubIssueNumber?: number | null; // Issue number to link, null to unlink
            by?: string;
          };

          const data = loadRequirements(cwd);
          const requirement = data.requirements[id];

          if (!requirement) {
            return Response.json({ error: "Requirement not found" }, { status: 404 });
          }

          let modified = false;
          const changes: string[] = [];

          if (body.description && body.description !== requirement.description) {
            requirement.description = body.description;
            changes.push("description");
            modified = true;
          }

          if (body.source) {
            if (body.source.type && VALID_SOURCES.includes(body.source.type)) {
              requirement.source.type = body.source.type;
              modified = true;
            }
            if (body.source.reference !== undefined) {
              requirement.source.reference = body.source.reference;
              modified = true;
            }
            if (modified && !changes.includes("description")) {
              changes.push("source");
            }
          }

          // Priority change
          if (body.priority && VALID_PRIORITIES.includes(body.priority)) {
            if (requirement.priority !== body.priority) {
              const oldPriority = requirement.priority ?? "medium";
              requirement.priority = body.priority;
              requirement.history.push(
                createHistoryEntry("priority_changed", `${oldPriority} → ${body.priority}`, body.by)
              );
              modified = true;
            }
          }

          // Status change
          if (body.status && VALID_STATUSES.includes(body.status)) {
            if (requirement.status !== body.status) {
              const oldStatus = requirement.status ?? "draft";
              requirement.status = body.status;
              requirement.history.push(
                createHistoryEntry("status_changed", `${oldStatus} → ${body.status}`, body.by)
              );
              modified = true;
            }
          }

          // Tag changes
          if (body.addTags || body.removeTags) {
            const oldTags = requirement.tags ?? [];
            let newTags = [...oldTags];

            if (body.addTags) {
              for (const tag of body.addTags) {
                if (!newTags.includes(tag)) newTags.push(tag);
              }
            }
            if (body.removeTags) {
              newTags = newTags.filter(t => !body.removeTags!.includes(t));
            }

            if (JSON.stringify(oldTags.sort()) !== JSON.stringify([...newTags].sort())) {
              requirement.tags = newTags.length > 0 ? newTags : undefined;
              const changeDesc: string[] = [];
              if (body.addTags?.length) changeDesc.push(`added: ${body.addTags.join(", ")}`);
              if (body.removeTags?.length) changeDesc.push(`removed: ${body.removeTags.join(", ")}`);
              requirement.history.push(
                createHistoryEntry("tags_changed", changeDesc.join("; "), body.by)
              );
              modified = true;
            }
          }

          // GitHub issue linking by number
          if (body.githubIssueNumber !== undefined) {
            if (body.githubIssueNumber === null) {
              // Unlink
              if (requirement.githubIssue) {
                const oldNumber = requirement.githubIssue.number;
                requirement.githubIssue = undefined;
                requirement.history.push(
                  createHistoryEntry("github_unlinked", `#${oldNumber}`, body.by)
                );
                modified = true;
              }
            } else {
              // Link
              const oldNumber = requirement.githubIssue?.number;
              if (oldNumber !== body.githubIssueNumber) {
                requirement.githubIssue = { number: body.githubIssueNumber };
                requirement.history.push(
                  createHistoryEntry("github_linked", `#${body.githubIssueNumber}`, body.by)
                );
                modified = true;
              }
            }
          }

          if (modified && changes.length > 0) {
            requirement.history.push(
              createHistoryEntry("modified", `Updated ${changes.join(", ")} via web UI`, body.by)
            );
          }

          if (modified) {
            saveRequirements(data, cwd);
          }

          return Response.json({ id, ...requirement });
        },
      },

      "/api/archive": {
        GET: () => {
          const data = loadArchive(cwd);
          return Response.json(data);
        },
      },

      "/api/stats": {
        GET: () => {
          const data = loadRequirements(cwd);
          const archive = loadArchive(cwd);

          const requirements = Object.entries(data.requirements);
          const withTests = requirements.filter(([, r]) => r.tests.length > 0);
          const verified = requirements.filter(([, r]) => r.lastVerified);

          return Response.json({
            total: requirements.length,
            withTests: withTests.length,
            withoutTests: requirements.length - withTests.length,
            verified: verified.length,
            archived: Object.keys(archive.requirements).length,
          });
        },
      },

      "/api/requirements/:id/archive": {
        POST: async (req) => {
          const id = req.params.id;
          const body = await req.json().catch(() => ({})) as { reason?: string; by?: string };

          const data = loadRequirements(cwd);
          const archive = loadArchive(cwd);

          if (!data.requirements[id]) {
            return Response.json({ error: "Requirement not found" }, { status: 404 });
          }

          const requirement = data.requirements[id];
          requirement.history.push(
            createHistoryEntry("archived", body.reason, body.by)
          );

          archive.requirements[id] = requirement;
          delete data.requirements[id];

          saveRequirements(data, cwd);
          saveArchive(archive, cwd);

          return Response.json({ success: true, id });
        },
      },

      "/api/requirements/:id/restore": {
        POST: async (req) => {
          const id = req.params.id;
          const body = await req.json().catch(() => ({})) as { by?: string };

          const data = loadRequirements(cwd);
          const archive = loadArchive(cwd);

          if (!archive.requirements[id]) {
            return Response.json({ error: "Requirement not found in archive" }, { status: 404 });
          }

          if (data.requirements[id]) {
            return Response.json({ error: "Requirement ID already exists in active requirements" }, { status: 409 });
          }

          const requirement = archive.requirements[id];
          requirement.history.push(createHistoryEntry("restored", undefined, body.by));

          data.requirements[id] = requirement;
          delete archive.requirements[id];

          saveRequirements(data, cwd);
          saveArchive(archive, cwd);

          return Response.json({ success: true, id });
        },
      },

      "/api/coverage": {
        GET: () => {
          const data = loadRequirements(cwd);
          const archive = loadArchive(cwd);

          const requirements = Object.entries(data.requirements);

          // Critical/high without tests
          const criticalWithoutTests: string[] = [];
          const highWithoutTests: string[] = [];

          for (const [id, req] of requirements) {
            if (req.tests.length === 0) {
              const priority = req.priority ?? "medium";
              if (priority === "critical") criticalWithoutTests.push(id);
              else if (priority === "high") highWithoutTests.push(id);
            }
          }

          // Stale confirmations - check for any confirmed tests
          const staleConfirmations: { reqId: string; testSpec: string }[] = [];
          for (const [id, req] of requirements) {
            for (const test of req.tests) {
              if (test.confirmation) {
                // We mark as potentially stale if confirmation exists
                // Full hash checking would require file access
                staleConfirmations.push({
                  reqId: id,
                  testSpec: `${test.file}:${test.identifier}`,
                });
              }
            }
          }

          // Collect all unique tags
          const allTags = new Set<string>();
          for (const req of Object.values(data.requirements)) {
            req.tags?.forEach(t => allTags.add(t));
          }

          // Stats
          const withTests = requirements.filter(([, r]) => r.tests.length > 0).length;
          const verified = requirements.filter(([, r]) => r.lastVerified).length;

          // Group by priority
          const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };
          for (const [, req] of requirements) {
            const p = req.priority ?? "medium";
            byPriority[p]++;
          }

          // Group by status
          const byStatus = { draft: 0, approved: 0, implemented: 0, released: 0 };
          for (const [, req] of requirements) {
            const s = req.status ?? "draft";
            byStatus[s]++;
          }

          return Response.json({
            criticalWithoutTests,
            highWithoutTests,
            staleConfirmations,
            totalRequirements: requirements.length,
            withTests,
            withoutTests: requirements.length - withTests,
            verified,
            archived: Object.keys(archive.requirements).length,
            allTags: Array.from(allTags).sort(),
            byPriority,
            byStatus,
          });
        },
      },

      "/api/requirements/bulk": {
        PATCH: async (req) => {
          const body = await req.json() as {
            ids: string[];
            priority?: Priority;
            status?: RequirementStatus;
            addTags?: string[];
            by?: string;
          };

          if (!body.ids || body.ids.length === 0) {
            return Response.json({ error: "No IDs provided" }, { status: 400 });
          }

          const data = loadRequirements(cwd);
          let modifiedCount = 0;

          for (const id of body.ids) {
            const requirement = data.requirements[id];
            if (!requirement) continue;

            let modified = false;

            if (body.priority && VALID_PRIORITIES.includes(body.priority)) {
              if (requirement.priority !== body.priority) {
                const old = requirement.priority ?? "medium";
                requirement.priority = body.priority;
                requirement.history.push(
                  createHistoryEntry("priority_changed", `${old} → ${body.priority}`, body.by)
                );
                modified = true;
              }
            }

            if (body.status && VALID_STATUSES.includes(body.status)) {
              if (requirement.status !== body.status) {
                const old = requirement.status ?? "draft";
                requirement.status = body.status;
                requirement.history.push(
                  createHistoryEntry("status_changed", `${old} → ${body.status}`, body.by)
                );
                modified = true;
              }
            }

            if (body.addTags && body.addTags.length > 0) {
              const oldTags = requirement.tags ?? [];
              const newTags = [...oldTags];
              const added: string[] = [];
              for (const tag of body.addTags) {
                if (!newTags.includes(tag)) {
                  newTags.push(tag);
                  added.push(tag);
                }
              }
              if (added.length > 0) {
                requirement.tags = newTags;
                requirement.history.push(
                  createHistoryEntry("tags_changed", `added: ${added.join(", ")}`, body.by)
                );
                modified = true;
              }
            }

            if (modified) modifiedCount++;
          }

          if (modifiedCount > 0) {
            saveRequirements(data, cwd);
          }

          return Response.json({ success: true, modified: modifiedCount });
        },
      },

      "/api/requirements/bulk/archive": {
        POST: async (req) => {
          const body = await req.json() as { ids: string[]; reason?: string; by?: string };

          if (!body.ids || body.ids.length === 0) {
            return Response.json({ error: "No IDs provided" }, { status: 400 });
          }

          const data = loadRequirements(cwd);
          const archive = loadArchive(cwd);
          let archivedCount = 0;

          for (const id of body.ids) {
            if (!data.requirements[id]) continue;

            const requirement = data.requirements[id];
            requirement.history.push(
              createHistoryEntry("archived", body.reason ?? "Bulk archive", body.by)
            );
            archive.requirements[id] = requirement;
            delete data.requirements[id];
            archivedCount++;
          }

          if (archivedCount > 0) {
            saveRequirements(data, cwd);
            saveArchive(archive, cwd);
          }

          return Response.json({ success: true, archived: archivedCount });
        },
      },

      // GitHub integration endpoints
      "/api/github/status": {
        GET: async () => {
          const data = loadRequirements(cwd);
          const cliStatus = await checkGhCli();

          return Response.json({
            configured: !!data.config.github?.repo,
            repo: data.config.github?.repo ?? null,
            autoDetected: data.config.github?.autoDetected ?? false,
            cli: cliStatus,
          });
        },
      },

      "/api/github/detect": {
        POST: async () => {
          const detected = await detectGitHubRepo(cwd);
          if (!detected) {
            return Response.json(
              { error: "Could not detect GitHub repo from git remote" },
              { status: 404 }
            );
          }

          const data = loadRequirements(cwd);
          data.config.github = { repo: detected.full, autoDetected: true };
          saveRequirements(data, cwd);

          return Response.json({ repo: detected.full, autoDetected: true });
        },
      },

      "/api/github/repo": {
        PUT: async (req) => {
          const body = await req.json() as { repo: string };

          if (!body.repo || !body.repo.match(/^[^/]+\/[^/]+$/)) {
            return Response.json(
              { error: "Invalid repo format. Use owner/repo" },
              { status: 400 }
            );
          }

          const data = loadRequirements(cwd);
          data.config.github = { repo: body.repo, autoDetected: false };
          saveRequirements(data, cwd);

          return Response.json({ repo: body.repo });
        },
      },

      "/api/github/issues": {
        GET: async (req) => {
          const data = loadRequirements(cwd);
          if (!data.config.github?.repo) {
            return Response.json(
              { error: "GitHub repo not configured" },
              { status: 400 }
            );
          }

          const cliStatus = await checkGhCli();
          if (!cliStatus.authenticated) {
            return Response.json({ error: cliStatus.error }, { status: 401 });
          }

          const url = new URL(req.url);
          const state = (url.searchParams.get("state") ?? "open") as "open" | "closed" | "all";
          const search = url.searchParams.get("search") ?? undefined;
          const limit = parseInt(url.searchParams.get("limit") ?? "30", 10);

          try {
            const issues = await listIssues(data.config.github.repo, { state, search, limit });
            return Response.json({ issues, repo: data.config.github.repo });
          } catch (error) {
            return Response.json(
              { error: error instanceof Error ? error.message : "Failed to fetch issues" },
              { status: 500 }
            );
          }
        },
      },

      "/api/github/sync": {
        POST: async () => {
          const data = loadRequirements(cwd);
          if (!data.config.github?.repo) {
            return Response.json(
              { error: "GitHub repo not configured" },
              { status: 400 }
            );
          }

          const cliStatus = await checkGhCli();
          if (!cliStatus.authenticated) {
            return Response.json({ error: cliStatus.error }, { status: 401 });
          }

          // Collect all unique issue numbers from both active and archived
          const issueNumbers = new Set<number>();
          for (const req of Object.values(data.requirements)) {
            if (req.githubIssue?.number) {
              issueNumbers.add(req.githubIssue.number);
            }
          }

          if (issueNumbers.size === 0) {
            return Response.json({ synced: 0, total: 0 });
          }

          // Fetch states
          const states = await syncIssueStates(
            data.config.github.repo,
            Array.from(issueNumbers)
          );

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
          return Response.json({ synced, total: issueNumbers.size });
        },
      },
    },
  });

  console.log(`Requirements Tracker UI running at http://localhost:${server.port}`);
  return server;
}

// Run directly if executed as main
if (import.meta.main) {
  startServer(process.argv.slice(2));
}
