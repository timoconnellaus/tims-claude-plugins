/**
 * Caching system for test extraction
 */

import { stat } from "fs/promises";
import { glob } from "glob";
import { join } from "path";
import { loadCache, saveCache } from "./store";
import { extractAllTests } from "./test-parser";
import { ExtractedTest, TestCache } from "./types";

const CACHE_VERSION = 1;

/**
 * Get modification times for all test files matching the glob.
 */
async function getTestFileMtimes(
  cwd: string,
  testGlob: string
): Promise<Map<string, number>> {
  const testFiles = await glob(testGlob, {
    cwd,
    absolute: true,
    ignore: ["**/node_modules/**"],
  });

  const mtimes = new Map<string, number>();

  for (const file of testFiles) {
    try {
      const stats = await stat(file);
      // Get relative path from cwd
      const relativePath = file.startsWith(cwd)
        ? file.slice(cwd.length + 1)
        : file;
      mtimes.set(relativePath, stats.mtimeMs);
    } catch {
      // Skip files that can't be stat'd
    }
  }

  return mtimes;
}

/**
 * Check if cache is valid by comparing file mtimes.
 * Cache is invalid if:
 * - Any test file has been modified since cache generation
 * - Any new test files exist that aren't in the cache
 * - Cache version doesn't match
 */
export async function isCacheValid(
  cwd: string,
  cache: TestCache,
  testGlob: string
): Promise<boolean> {
  // Check version
  if (cache.version !== CACHE_VERSION) {
    return false;
  }

  // Get current file mtimes
  const currentMtimes = await getTestFileMtimes(cwd, testGlob);

  // Check if any new files exist
  for (const file of Array.from(currentMtimes.keys())) {
    if (!(file in cache.fileMtimes)) {
      return false; // New file detected
    }
  }

  // Check if any existing files have been modified
  for (const [file, cachedMtime] of Object.entries(cache.fileMtimes)) {
    const currentMtime = currentMtimes.get(file);
    if (currentMtime === undefined) {
      return false; // File was deleted
    }
    if (currentMtime !== cachedMtime) {
      return false; // File was modified
    }
  }

  return true;
}

/**
 * Build a cache from extracted tests.
 */
export function buildCache(
  tests: ExtractedTest[],
  fileMtimes: Map<string, number>
): TestCache {
  const testMap: Record<string, string> = {};

  for (const test of tests) {
    const key = `${test.file}:${test.identifier}`;
    testMap[key] = test.hash;
  }

  const fileMtimesRecord: Record<string, number> = {};
  const entries = Array.from(fileMtimes.entries());
  for (const [file, mtime] of entries) {
    fileMtimesRecord[file] = mtime;
  }

  return {
    version: CACHE_VERSION,
    generatedAt: new Date().toISOString(),
    fileMtimes: fileMtimesRecord,
    tests: testMap,
  };
}

/**
 * Convert cache back to ExtractedTest objects.
 * Note: body is empty since cache only stores hashes.
 * This is fine for check.ts which only needs file, identifier, and hash.
 */
function cacheToTests(cache: TestCache): ExtractedTest[] {
  return Object.entries(cache.tests).map(([key, hash]) => {
    const colonIndex = key.indexOf(":");
    if (colonIndex === -1) {
      throw new Error(`Invalid cache key format: ${key}`);
    }
    const file = key.slice(0, colonIndex);
    const identifier = key.slice(colonIndex + 1);
    return { file, identifier, body: "", hash };
  });
}

/**
 * Get tests, using cache if valid, otherwise extracting fresh.
 * Updates cache after extraction.
 *
 * @param noCache - If true, always extract fresh (ignore cache)
 * @returns Object with tests array and whether cache was used
 */
export async function getTestsWithCache(
  cwd: string,
  testGlob: string,
  noCache?: boolean
): Promise<{ tests: ExtractedTest[]; fromCache: boolean }> {
  // If noCache flag is set, skip cache and extract fresh
  if (noCache) {
    const tests = await extractAllTests(cwd, testGlob);
    const fileMtimes = await getTestFileMtimes(cwd, testGlob);
    const cache = buildCache(tests, fileMtimes);
    await saveCache(cwd, cache);
    return { tests, fromCache: false };
  }

  // Try to load existing cache
  const existingCache = await loadCache(cwd);

  // If cache exists and is valid, use it
  if (existingCache && (await isCacheValid(cwd, existingCache, testGlob))) {
    const tests = cacheToTests(existingCache);
    return { tests, fromCache: true };
  }

  // Cache invalid or doesn't exist - extract fresh
  const tests = await extractAllTests(cwd, testGlob);
  const fileMtimes = await getTestFileMtimes(cwd, testGlob);
  const cache = buildCache(tests, fileMtimes);
  await saveCache(cwd, cache);
  return { tests, fromCache: false };
}
