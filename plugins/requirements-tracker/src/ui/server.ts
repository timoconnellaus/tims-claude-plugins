/**
 * Bun web server for requirements tracker UI
 */

import { watch, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { glob } from "glob";
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

  const result: CheckResult = {
    requirements: [],
    orphanedTests: [],
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
        gherkin: string;
        source: ParsedRequirement["data"]["source"];
        tests: Array<TestLink & { isStale: boolean }>;
        aiAssessment: ParsedRequirement["data"]["aiAssessment"];
        questions: ParsedRequirement["data"]["questions"];
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
        gherkin: req.data.gherkin,
        source: req.data.source,
        tests: testsWithStaleFlag,
        aiAssessment: req.data.aiAssessment,
        questions: req.data.questions,
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
        POST: async (req: Request) => {
          return chatHandler(req);
        },
      },
    },

    fetch(req) {
      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`Requirements Tracker UI running at http://localhost:${port}`);
  console.log(`Watching ${reqDir} for changes...`);
  console.log("Press Ctrl+C to stop");

  return server;
}
