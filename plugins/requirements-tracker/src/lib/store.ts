/**
 * Local storage for config and cache
 */

import { readFile, writeFile, access } from "fs/promises";
import { join } from "path";
import {
  RequirementsConfig,
  LocalCache,
  CONFIG_FILE,
  CACHE_FILE,
} from "./types";

/**
 * Get the config file path
 */
export function getConfigPath(cwd: string): string {
  return join(cwd, CONFIG_FILE);
}

/**
 * Get the cache file path
 */
export function getCachePath(cwd: string): string {
  return join(cwd, CACHE_FILE);
}

/**
 * Check if config exists
 */
export async function configExists(cwd: string): Promise<boolean> {
  try {
    await access(getConfigPath(cwd));
    return true;
  } catch {
    return false;
  }
}

/**
 * Load config from disk
 */
export async function loadConfig(cwd: string): Promise<RequirementsConfig | null> {
  try {
    const content = await readFile(getConfigPath(cwd), "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save config to disk
 */
export async function saveConfig(
  cwd: string,
  config: RequirementsConfig
): Promise<void> {
  await writeFile(getConfigPath(cwd), JSON.stringify(config, null, 2) + "\n");
}

/**
 * Load cache from disk
 */
export async function loadCache(cwd: string): Promise<LocalCache | null> {
  try {
    const content = await readFile(getCachePath(cwd), "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save cache to disk
 */
export async function saveCache(cwd: string, cache: LocalCache): Promise<void> {
  await writeFile(getCachePath(cwd), JSON.stringify(cache, null, 2) + "\n");
}

/**
 * Get API key from config or environment
 */
export function getApiKey(config: RequirementsConfig | null): string | null {
  // Environment variable takes precedence
  if (process.env.LINEAR_API_KEY) {
    return process.env.LINEAR_API_KEY;
  }
  return config?.linearApiKey ?? null;
}

/**
 * Check if cache is stale (older than maxAge minutes)
 */
export function isCacheStale(cache: LocalCache | null, maxAgeMinutes = 5): boolean {
  if (!cache) return true;

  const lastSync = new Date(cache.lastSync);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSync.getTime()) / 1000 / 60;

  return diffMinutes > maxAgeMinutes;
}

/**
 * Check if config is in local mode
 */
export function isLocalMode(config: RequirementsConfig | null): boolean {
  return config?.mode === "local";
}

/**
 * Generate next local issue ID
 */
export function generateLocalId(config: RequirementsConfig): { id: string; identifier: string } {
  const prefix = config.prefix || "REQ";
  const num = config.nextId || 1;
  return {
    id: crypto.randomUUID(),
    identifier: `${prefix}-${String(num).padStart(3, "0")}`,
  };
}
