/**
 * config command - View or modify topic patterns
 */

import type { ConfigArgs } from "../lib/types";
import { loadConfig, saveConfig, docsDirExists } from "../lib/store";
import { isValidPattern, formatPatterns } from "../lib/topic-matcher";

export async function config(args: ConfigArgs): Promise<void> {
  const { cwd, add, remove } = args;

  // Check if initialized
  if (!(await docsDirExists(cwd))) {
    console.error("Not initialized. Run 'docs init' first.");
    process.exit(1);
  }

  const cfg = await loadConfig(cwd);
  if (!cfg) {
    console.error("Failed to load config. Run 'docs init' to reinitialize.");
    process.exit(1);
  }

  // Handle --add
  if (add) {
    // Validate pattern
    if (!isValidPattern(add)) {
      console.error(`Invalid pattern: "${add}"`);
      console.error("Patterns must be lowercase with /, *, and - characters only.");
      console.error('Use ! prefix to exclude (e.g., "!nextjs/legacy/*")');
      process.exit(1);
    }

    // Check for duplicate
    if (cfg.topics.includes(add)) {
      console.log(`Pattern already exists: "${add}"`);
      return;
    }

    cfg.topics.push(add);
    await saveConfig(cwd, cfg);
    console.log(`Added pattern: "${add}"`);
    console.log();
    console.log("Current patterns:");
    console.log(formatPatterns(cfg.topics));
    return;
  }

  // Handle --remove
  if (remove) {
    const index = cfg.topics.indexOf(remove);
    if (index === -1) {
      console.error(`Pattern not found: "${remove}"`);
      console.log();
      console.log("Current patterns:");
      console.log(formatPatterns(cfg.topics));
      process.exit(1);
    }

    cfg.topics.splice(index, 1);
    await saveConfig(cwd, cfg);
    console.log(`Removed pattern: "${remove}"`);
    console.log();
    console.log("Current patterns:");
    console.log(formatPatterns(cfg.topics));
    return;
  }

  // Show current config
  console.log("docs-skill configuration\n");
  console.log("Topic patterns:");
  if (cfg.topics.length === 0) {
    console.log("  (none configured)");
    console.log();
    console.log("Add patterns with: docs config --add \"<pattern>\"");
    console.log("Examples:");
    console.log('  docs config --add "nextjs/**"        # Include all Next.js docs');
    console.log('  docs config --add "!nextjs/legacy/*" # Exclude legacy docs');
  } else {
    console.log(formatPatterns(cfg.topics));
  }

  if (cfg.lastSync) {
    console.log();
    console.log(`Last sync: ${cfg.lastSync}`);
  }
}
