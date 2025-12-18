import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import {
  loadConfig,
  loadAllRequirements,
  loadIgnoredTests,
  getRequirementsDir,
} from "../../../../lib/store";
import { getTestsWithCache } from "../../../../lib/cache";
import { loadTestResults, getTestLinkResult } from "../../../../lib/result-store";
import { skipCacheOnNextFetch, setSkipCache, getProjectCwd } from "../../api/sse";
import type {
  CheckResult,
  VerificationStatus,
  TestLink,
  ParsedRequirement,
  ImplementationStatus,
  Priority,
  TestResultStatus,
} from "../../../../lib/types";

function getVerificationStatus(
  tests: TestLink[],
  currentHashes: Map<string, string>,
  hasAssessment: boolean
): VerificationStatus {
  if (tests.length === 0) return "n/a";
  if (!hasAssessment) return "unverified";
  for (const test of tests) {
    const key = `${test.file}:${test.identifier}`;
    const currentHash = currentHashes.get(key);
    if (currentHash && currentHash !== test.hash) return "stale";
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
  setSkipCache(false);
  const { tests: allExtractedTests } = await getTestsWithCache(cwd, config.testGlob, noCache);

  const testHashMap = new Map<string, string>();
  for (const test of allExtractedTests) {
    testHashMap.set(`${test.file}:${test.identifier}`, test.hash);
  }

  const testRunResults = await loadTestResults(cwd);
  const testResults = testRunResults?.results || [];
  const lastRunAt = testRunResults?.importedAt;

  const reqStatusMap = new Map<string, ImplementationStatus>();
  for (const req of requirements) {
    reqStatusMap.set(req.path, req.data.status);
  }

  const result: CheckResult = {
    requirements: [],
    orphanedTests: [],
    dependencyIssues: [],
    gherkinIssues: [],
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
      byPriority: { critical: 0, high: 0, medium: 0, low: 0, unset: 0 },
      blockedRequirements: 0,
      unverifiedNFRs: 0,
      gherkinFormatIssues: 0,
    },
  };

  const groupedReqs = new Map<string, ParsedRequirement[]>();
  for (const req of requirements) {
    const lastSlash = req.path.lastIndexOf("/");
    const folderPath = lastSlash >= 0 ? req.path.slice(0, lastSlash + 1) : "";
    if (!groupedReqs.has(folderPath)) groupedReqs.set(folderPath, []);
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
        tests: Array<TestLink & { isStale: boolean; lastResult?: TestResultStatus; lastRunAt?: string }>;
        aiAssessment: ParsedRequirement["data"]["aiAssessment"];
        questions: ParsedRequirement["data"]["questions"];
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

      const reqStatus = req.data.status;
      if (reqStatus === "planned") {
        result.summary.planned++;
      } else {
        result.summary.done++;
      }

      const verification = getVerificationStatus(req.data.tests, testHashMap, !!req.data.aiAssessment);

      if (reqStatus === "done") {
        if (req.data.tests.length === 0) {
          result.summary.untested++;
        } else {
          result.summary.tested++;
        }
        switch (verification) {
          case "unverified": result.summary.unverified++; break;
          case "verified": result.summary.verified++; break;
          case "stale": result.summary.stale++; break;
        }
      }

      const unanswered = (req.data.questions || []).filter((q) => !q.answer).length;
      result.summary.unansweredQuestions += unanswered;

      const priority = req.data.priority;
      if (priority) result.summary.byPriority[priority]++;
      else result.summary.byPriority.unset++;

      const depIssues: string[] = [];
      if (req.data.dependencies) {
        for (const dep of req.data.dependencies) {
          const blocking = dep.blocking !== false;
          if (blocking) {
            const depStatus = reqStatusMap.get(dep.path);
            if (!depStatus || depStatus !== "done") depIssues.push(dep.path);
          }
        }
      }
      if (depIssues.length > 0) {
        result.summary.blockedRequirements++;
        result.dependencyIssues.push({ requirement: req.path, blockedBy: depIssues });
      }

      const nfrs = req.data.nfrs || [];
      const unverifiedNFRCount = nfrs.filter((nfr) => !nfr.verified).length;
      result.summary.unverifiedNFRs += unverifiedNFRCount;

      const testsWithStaleFlag = req.data.tests.map((test) => {
        const key = `${test.file}:${test.identifier}`;
        const currentHash = testHashMap.get(key);
        const isStale = currentHash !== undefined && currentHash !== test.hash;
        const lastResult = getTestLinkResult(test, testResults);
        return { ...test, isStale, lastResult, lastRunAt };
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

export const Route = createFileRoute("/api/requirements")({
  server: {
    handlers: {
      GET: async () => {
        const cwd = getProjectCwd();
        const data = await getRequirementsData(cwd);
        return json(data);
      },
    },
  },
});
