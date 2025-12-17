/**
 * Bun web server for requirements tracker UI
 */

import { watch, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { glob } from "glob";

// Docs directory path (src/docs relative to src/ui)
const docsDir = join(dirname(import.meta.dir), "docs");

// Available documentation pages
const DOC_PAGES = [
  { slug: "index", title: "Overview" },
  { slug: "usage-guide", title: "Usage Guide" },
  { slug: "cli-reference", title: "CLI Reference" },
  { slug: "architecture", title: "Architecture" },
  { slug: "how-it-works", title: "How It Works" },
];
import homepage from "./index.html";

// Load .env from the plugin directory (not cwd)
// Use sync methods since this runs at module load time
const pluginDir = dirname(dirname(dirname(import.meta.dir)));
const envPath = join(pluginDir, ".env");
try {
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex);
          const value = trimmed.slice(eqIndex + 1);
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
    console.log("Loaded .env from:", envPath);
  } else {
    console.warn("No .env file found at:", envPath);
  }
} catch (e) {
  console.error("Error loading .env:", e);
}
import {
  loadConfig,
  loadAllRequirements,
  loadIgnoredTests,
  getRequirementsDir,
} from "../lib/store";
import { getTestsWithCache } from "../lib/cache";
import type {
  CheckResult,
  VerificationStatus,
  TestLink,
  ParsedRequirement,
  ImplementationStatus,
  CheckSummary,
  Priority,
  DependencyIssue,
} from "../lib/types";
import { createClaudeChatHandler } from "./handler";

// Note: chatHandler is created in startServer() with the correct cwd and plugin path

// SSE clients for live reload
const clients = new Set<ReadableStreamDefaultController>();

// Flag to skip cache when test files change
let skipCacheOnNextFetch = false;

function getVerificationStatus(
  tests: TestLink[],
  currentHashes: Map<string, string>,
  hasAssessment: boolean
): VerificationStatus {
  if (tests.length === 0) {
    return "n/a";
  }
  if (!hasAssessment) {
    return "unverified";
  }
  for (const test of tests) {
    const key = `${test.file}:${test.identifier}`;
    const currentHash = currentHashes.get(key);
    if (currentHash && currentHash !== test.hash) {
      return "stale";
    }
  }
  return "verified";
}

async function getRequirementsData(cwd: string): Promise<CheckResult | { error: string }> {
  const config = await loadConfig(cwd);
  if (!config) {
    return { error: "Not initialized. Run 'req init' first." };
  }

  const loadResult = await loadAllRequirements(cwd);

  if (loadResult.errors.length > 0) {
    return { error: loadResult.errors.map((e) => e.message).join("\n") };
  }

  const requirements = loadResult.requirements;

  const ignoredTestsFile = await loadIgnoredTests(cwd);
  const ignoredTestKeys = new Set(
    ignoredTestsFile.tests.map((t) => `${t.file}:${t.identifier}`)
  );

  const noCache = skipCacheOnNextFetch;
  skipCacheOnNextFetch = false; // Reset after use
  const { tests: allExtractedTests } = await getTestsWithCache(cwd, config.testGlob, noCache);

  const testHashMap = new Map<string, string>();
  for (const test of allExtractedTests) {
    testHashMap.set(`${test.file}:${test.identifier}`, test.hash);
  }

  // Build a map of requirement paths to their status for dependency checking
  const reqStatusMap = new Map<string, ImplementationStatus>();
  for (const req of requirements) {
    reqStatusMap.set(req.path, req.data.status);
  }

  const result: CheckResult = {
    requirements: [],
    orphanedTests: [],
    dependencyIssues: [],
    summary: {
      totalRequirements: 0,
      planned: 0,
      done: 0,
      untested: 0,
      tested: 0,
      unverified: 0,
      verified: 0,
      stale: 0,
      orphanedTestCount: 0,
      unansweredQuestions: 0,
      byPriority: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        unset: 0,
      },
      blockedRequirements: 0,
      unverifiedNFRs: 0,
    },
  };

  const groupedReqs = new Map<string, ParsedRequirement[]>();
  for (const req of requirements) {
    const lastSlash = req.path.lastIndexOf("/");
    const folderPath = lastSlash >= 0 ? req.path.slice(0, lastSlash + 1) : "";
    if (!groupedReqs.has(folderPath)) {
      groupedReqs.set(folderPath, []);
    }
    groupedReqs.get(folderPath)!.push(req);
  }

  const linkedTestKeys = new Set<string>();

  for (const [folderPath, groupReqs] of Array.from(groupedReqs.entries()).sort()) {
    const groupResult = {
      path: folderPath || "(root)",
      requirements: [] as {
        id: string;
        testCount: number;
        verification: VerificationStatus;
        coverageSufficient: boolean | null;
        unansweredQuestions: number;
        status: ImplementationStatus;
        priority?: Priority;
        dependencyIssues?: string[];
        unverifiedNFRCount: number;
        gherkin: string;
        source: ParsedRequirement["data"]["source"];
        tests: Array<TestLink & { isStale: boolean }>;
        aiAssessment: ParsedRequirement["data"]["aiAssessment"];
        questions: ParsedRequirement["data"]["questions"];
        // Extended fields for UI display
        dependencies: ParsedRequirement["data"]["dependencies"];
        nfrs: ParsedRequirement["data"]["nfrs"];
        scenarios: ParsedRequirement["data"]["scenarios"];
      }[],
    };

    for (const req of groupReqs) {
      result.summary.totalRequirements++;

      for (const test of req.data.tests) {
        linkedTestKeys.add(`${test.file}:${test.identifier}`);
      }

      const reqStatus: ImplementationStatus = req.data.status;
      if (reqStatus === "planned") {
        result.summary.planned++;
      } else {
        result.summary.done++;
      }

      const verification = getVerificationStatus(
        req.data.tests,
        testHashMap,
        !!req.data.aiAssessment
      );

      if (reqStatus === "done") {
        if (req.data.tests.length === 0) {
          result.summary.untested++;
        } else {
          result.summary.tested++;
        }

        switch (verification) {
          case "unverified":
            result.summary.unverified++;
            break;
          case "verified":
            result.summary.verified++;
            break;
          case "stale":
            result.summary.stale++;
            break;
        }
      }

      const unanswered = (req.data.questions || []).filter((q) => !q.answer).length;
      result.summary.unansweredQuestions += unanswered;

      // Track priority breakdown
      const priority = req.data.priority;
      if (priority) {
        result.summary.byPriority[priority]++;
      } else {
        result.summary.byPriority.unset++;
      }

      // Check for dependency issues (blocking deps that aren't "done")
      const depIssues: string[] = [];
      if (req.data.dependencies) {
        for (const dep of req.data.dependencies) {
          const blocking = dep.blocking !== false; // default to true
          if (blocking) {
            const depStatus = reqStatusMap.get(dep.path);
            // Issue if dependency doesn't exist or isn't "done"
            if (!depStatus || depStatus !== "done") {
              depIssues.push(dep.path);
            }
          }
        }
      }
      if (depIssues.length > 0) {
        result.summary.blockedRequirements++;
        result.dependencyIssues.push({
          requirement: req.path,
          blockedBy: depIssues,
        });
      }

      // Count unverified NFRs
      const nfrs = req.data.nfrs || [];
      const unverifiedNFRCount = nfrs.filter((nfr) => !nfr.verified).length;
      result.summary.unverifiedNFRs += unverifiedNFRCount;

      // Add isStale flag to each test
      const testsWithStaleFlag = req.data.tests.map((test) => {
        const key = `${test.file}:${test.identifier}`;
        const currentHash = testHashMap.get(key);
        const isStale = currentHash !== undefined && currentHash !== test.hash;
        return { ...test, isStale };
      });

      groupResult.requirements.push({
        id: req.path,
        testCount: req.data.tests.length,
        verification,
        coverageSufficient: req.data.aiAssessment?.sufficient ?? null,
        unansweredQuestions: unanswered,
        status: reqStatus,
        priority,
        dependencyIssues: depIssues.length > 0 ? depIssues : undefined,
        unverifiedNFRCount,
        gherkin: req.data.gherkin,
        source: req.data.source,
        tests: testsWithStaleFlag,
        aiAssessment: req.data.aiAssessment,
        questions: req.data.questions,
        // Extended fields for UI display
        dependencies: req.data.dependencies,
        nfrs: req.data.nfrs,
        scenarios: req.data.scenarios,
      });
    }

    result.requirements.push(groupResult);
  }

  for (const test of allExtractedTests) {
    const key = `${test.file}:${test.identifier}`;
    if (!linkedTestKeys.has(key) && !ignoredTestKeys.has(key)) {
      result.orphanedTests.push(test);
    }
  }
  result.summary.orphanedTestCount = result.orphanedTests.length;

  return result;
}

function broadcastRefresh() {
  for (const controller of clients) {
    try {
      controller.enqueue(`data: refresh\n\n`);
    } catch {
      clients.delete(controller);
    }
  }
}

export async function startServer(args: { cwd: string; port: number }) {
  const { cwd, port } = args;

  // Create chat handler with the requirements-tracker plugin loaded
  const chatHandler = createClaudeChatHandler({
    defaultModel: 'opus',
    requireToolApproval: false,
    cwd,
    plugins: [
      { type: 'local', path: pluginDir },
    ],
    // Load all settings sources: user (~/.claude), project (.claude), and local (.claude/settings.local.json)
    // This also loads CLAUDE.md files when 'project' is included
    settingSources: ['user', 'project', 'local'],
    // Use Claude Code's system prompt with custom additions for requirements tracking
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: `
You are assisting with requirements tracking and verification. You have access to the 'req' CLI tool for managing requirements.

## CLI Commands

\`\`\`
req init [options]                                    Create .requirements/ folder
    --test-runner <cmd>  Test runner command (default: bun test)
    --test-glob <glob>   Test file glob (default: **/*.test.{ts,js})
    --force              Overwrite existing config

req add <path> --gherkin "..." --source-type <type> --source-desc "..."
    Create a new requirement in Gherkin format (Given/When/Then)
    --priority <level>   Priority: critical, high, medium, low
    --depends-on <path>  Dependency path (repeatable)
    --force              Overwrite if exists

req link <path> <file:identifier>                     Link a test to a requirement
req unlink <path> <file:identifier>                   Remove a test link

req status <path> [--done | --planned]                Get or set implementation status

req check [path] [--json] [--no-cache]                Check test coverage status
    Reports: untested, unverified, stale, verified, and orphaned tests

req assess <path> --result '<json>'                   Update AI assessment for a requirement
    Criteria (all required): noBugsInTestCode, sufficientCoverage, meaningfulAssertions,
    correctTestSubject, happyPathCovered, edgeCasesAddressed, errorScenariosHandled,
    wouldFailIfBroke
    Each criterion: { "result": "pass"|"fail"|"na", "note": "optional" }

req move <source> <dest>                              Move requirement to new path
    Updates dependencies in other requirements that reference the moved file

req rename <path> <new-name>                          Rename a requirement file
    REQ_ prefix and .yml extension added if missing

req ignore-test <file:identifier> --reason "..."      Mark test as intentionally unlinked
req unignore-test <file:identifier>                   Remove test from ignored list

req ui [--port <number>]                              Start web UI (default: port 3000)
req docs [--port <number>]                            Open documentation in browser
\`\`\`

## Global Options
- \`--cwd <path>\` - Run in specified directory (default: current directory)
- \`--help, -h\` - Show help for any command

## Examples
\`\`\`bash
req add auth/REQ_login.yml --gherkin "Given user enters valid credentials When they submit Then they are logged in" --source-type doc --source-desc "PRD v2.1"
req link auth/REQ_login.yml src/auth.test.ts:validates login
req check --json
req assess auth/REQ_login.yml --result '{"criteria": {"noBugsInTestCode": {"result": "pass"}, ...}, "notes": "..."}'
\`\`\`

When verifying requirements, analyze the linked tests to determine if they adequately cover the requirement's Gherkin scenarios.
`,
    },
    // Auto-approve req commands and file reading tools
    canUseTool: async (toolName, input) => {
      // Always allow read-only tools needed for verification
      if (['Read', 'Glob', 'Grep'].includes(toolName)) {
        return { behavior: 'allow', updatedInput: input };
      }
      // Allow Bash commands that are `req` CLI commands
      if (toolName === 'Bash') {
        const command = (input as { command?: string }).command || '';
        if (command.trim().startsWith('req ')) {
          return { behavior: 'allow', updatedInput: input };
        }
      }
      // Default: allow all other tools
      return { behavior: 'allow', updatedInput: input };
    },
    // Enable sandbox for secure command execution
    sandbox: {
      enabled: true,
      autoAllowBashIfSandboxed: true,
    },
  });

  // Watch for file changes in .requirements directory
  const reqDir = getRequirementsDir(cwd);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  try {
    watch(reqDir, { recursive: true }, () => {
      // Debounce to avoid multiple rapid refreshes
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        broadcastRefresh();
      }, 100);
    });
  } catch {
    console.warn("Warning: Could not watch .requirements directory for changes");
  }

  // Also watch test files for staleness detection
  const config = await loadConfig(cwd);
  if (config) {
    try {
      const testFiles = await glob(config.testGlob, { cwd });
      const testDirs = new Set(testFiles.map((f) => dirname(f)));

      for (const dir of testDirs) {
        const fullDir = join(cwd, dir);
        watch(fullDir, { recursive: false }, (event, filename) => {
          // Only react to test file changes
          if (filename && /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filename)) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              skipCacheOnNextFetch = true;
              broadcastRefresh();
            }, 100);
          }
        });
      }
      console.log(`Watching ${testDirs.size} test directories for changes...`);
    } catch {
      console.warn("Warning: Could not watch test directories for changes");
    }
  }

  const server = Bun.serve({
    port,
    development: true,
    idleTimeout: 0,
    routes: {
      "/": homepage,

      "/api/requirements": {
        async GET() {
          const data = await getRequirementsData(cwd);
          return Response.json(data);
        },
      },

      "/api/events": {
        GET() {
          const stream = new ReadableStream({
            start(controller) {
              clients.add(controller);
              controller.enqueue(`data: connected\n\n`);
            },
            cancel() {
              // Client disconnected - will be cleaned up on next broadcast
            },
          });
          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        },
      },

      "/api/chat": {
        async POST(req) {
          return chatHandler(req);
        },
      },

      "/api/docs": {
        GET() {
          return Response.json({ pages: DOC_PAGES });
        },
      },
    },

    async fetch(req) {
      const url = new URL(req.url);

      // Handle /api/docs/:slug routes
      if (url.pathname.startsWith("/api/docs/")) {
        const slug = url.pathname.slice("/api/docs/".length);
        const validSlugs = DOC_PAGES.map((p) => p.slug);

        if (!validSlugs.includes(slug)) {
          return Response.json({ error: "Doc page not found" }, { status: 404 });
        }

        const filePath = join(docsDir, `${slug}.md`);
        if (!existsSync(filePath)) {
          return Response.json({ error: "Doc file not found" }, { status: 404 });
        }

        try {
          const content = readFileSync(filePath, "utf-8");
          return Response.json({ slug, content });
        } catch (e) {
          return Response.json({ error: "Failed to read doc file" }, { status: 500 });
        }
      }

      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`Requirements Tracker UI running at http://localhost:${port}`);
  console.log(`Watching ${reqDir} for changes...`);
  console.log("Press Ctrl+C to stop");

  return server;
}
