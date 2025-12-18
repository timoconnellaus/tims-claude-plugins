import { watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../../../lib/store";
import { glob } from "glob";

// SSE clients for live reload - shared across routes
export const clients = new Set<ReadableStreamDefaultController>();

export function broadcastRefresh() {
  for (const controller of clients) {
    try {
      controller.enqueue(`data: refresh\n\n`);
    } catch {
      clients.delete(controller);
    }
  }
}

// Flag to skip cache when test files change
export let skipCacheOnNextFetch = false;
export function setSkipCache(value: boolean) {
  skipCacheOnNextFetch = value;
}

// Get user's project directory from environment variable set by ui.ts
export function getProjectCwd(): string {
  return process.env.REQ_PROJECT_CWD || process.cwd();
}

// File watching
let watchers: FSWatcher[] = [];
let watcherInitialized = false;

export async function initFileWatchers() {
  if (watcherInitialized) return;
  watcherInitialized = true;

  const cwd = getProjectCwd();
  const config = await loadConfig(cwd);
  if (!config) return;

  // Debounce to avoid multiple rapid refreshes
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const debouncedRefresh = (isTestFile: boolean) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (isTestFile) {
        setSkipCache(true);
      }
      broadcastRefresh();
    }, 100);
  };

  // Watch .requirements folder
  const reqDir = join(cwd, ".requirements");
  try {
    const reqWatcher = watch(reqDir, { recursive: true }, (event, filename) => {
      if (filename && (filename.endsWith(".yml") || filename.endsWith(".json"))) {
        debouncedRefresh(false);
      }
    });
    watchers.push(reqWatcher);
  } catch (err) {
    console.warn("Could not watch .requirements folder:", err);
  }

  // Watch test files based on testGlob
  if (config.testGlob) {
    try {
      const testFiles = await glob(config.testGlob, { cwd, absolute: true });
      const watchedDirs = new Set<string>();

      for (const file of testFiles) {
        // Watch parent directories to catch new files too
        const dir = file.substring(0, file.lastIndexOf("/"));
        if (!watchedDirs.has(dir)) {
          watchedDirs.add(dir);
          try {
            const testWatcher = watch(dir, (event, filename) => {
              if (filename && (filename.endsWith(".ts") || filename.endsWith(".tsx") || filename.endsWith(".js"))) {
                debouncedRefresh(true);
              }
            });
            watchers.push(testWatcher);
          } catch {
            // Directory might not exist or be inaccessible
          }
        }
      }
    } catch (err) {
      console.warn("Could not watch test files:", err);
    }
  }
}

export function cleanupWatchers() {
  for (const watcher of watchers) {
    watcher.close();
  }
  watchers = [];
  watcherInitialized = false;
}
