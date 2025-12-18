import { watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import {
  getGlobalConfigDir,
  getRepositoriesPath,
} from "../../../lib/repo-store";
import { docsDirExists, getDocsDir } from "../../../lib/store";

// SSE clients for live reload
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

// Get user's project directory from environment variable set by ui.ts
export function getProjectCwd(): string {
  return process.env.DOCS_PROJECT_CWD || process.cwd();
}

// File watching
let watchers: FSWatcher[] = [];
let watcherInitialized = false;

export async function initFileWatchers() {
  if (watcherInitialized) return;
  watcherInitialized = true;

  const cwd = getProjectCwd();

  // Debounce to avoid multiple rapid refreshes
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const debouncedRefresh = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      broadcastRefresh();
    }, 100);
  };

  // Watch global repositories file
  const globalConfigDir = getGlobalConfigDir();
  try {
    const globalWatcher = watch(globalConfigDir, { recursive: false }, (event, filename) => {
      if (filename === "repositories.yml") {
        debouncedRefresh();
      }
    });
    watchers.push(globalWatcher);
  } catch {
    console.warn("Warning: Could not watch global config directory");
  }

  // Watch project .docs directory
  const docsDir = getDocsDir(cwd);
  try {
    if (await docsDirExists(cwd)) {
      const docsWatcher = watch(docsDir, { recursive: true }, () => {
        debouncedRefresh();
      });
      watchers.push(docsWatcher);
    }
  } catch {
    console.warn("Warning: Could not watch .docs directory");
  }
}

export function cleanupWatchers() {
  for (const watcher of watchers) {
    watcher.close();
  }
  watchers = [];
  watcherInitialized = false;
}
