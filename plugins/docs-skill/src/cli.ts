#!/usr/bin/env bun

/**
 * docs-skill CLI - Documentation management for AI agents
 */

import { validate } from "./commands/validate";
import { sync } from "./commands/sync";
import { init } from "./commands/init";
import { search } from "./commands/search";
import { config } from "./commands/config";
import { check } from "./commands/check";
import { pull } from "./commands/pull";
import { repo } from "./commands/repo";
import { list } from "./commands/list";
import { show } from "./commands/show";
import { injectClaude } from "./commands/inject-claude";

const HELP = `
docs - Documentation management for AI agents

USAGE:
  docs <command> [options]

MAINTAINER COMMANDS:
  validate [source]             Validate docs in a source folder
  sync [source]                 Build docs from sources (runs sync-docs.ts)

USER COMMANDS:
  init                          Create .docs/ folder with config
  search <query>                Search available docs and topics
  config [--add | --remove]     View or modify topic patterns
  check                         Validate config against available docs
  pull [--force]                Sync configured docs to .docs/ folder
  list [path]                   Browse synced docs progressively
  show <topic>                  Display full content of a doc
  inject-claude                 Update CLAUDE.md with synced docs info
  ui [--port <number>]          Start web UI for managing docs

REPOSITORY COMMANDS:
  repo add <path>               Register a docs repository
  repo list                     List registered repositories
  repo remove <path>            Remove a repository

GLOBAL OPTIONS:
  --cwd <path>  Run in specified directory (default: current directory)
  --help, -h    Show this help message

EXAMPLES:
  # Maintainer: validate and sync docs
  docs validate nextjs
  docs sync nextjs
  docs sync                    # Sync all sources

  # User: setup and configure
  docs init
  docs search "routing"
  docs config --add "nextjs/**"
  docs config --add "!nextjs/legacy/*"
  docs config --remove "react/**"
  docs check
  docs pull

  # Browse synced docs
  docs list                    # Show all categories
  docs list nextjs             # Drill into nextjs
  docs show nextjs/routing     # View a specific doc
  docs inject-claude           # Update CLAUDE.md

  docs ui                      # Start web UI on port 3000

  # Repository management
  docs repo add ~/projects/my-docs
  docs repo list
  docs repo remove ~/projects/my-docs

Run 'docs <command> --help' for more information on a command.
`.trim();

const VALIDATE_HELP = `
docs validate - Validate documentation files

USAGE:
  docs validate [source]

ARGUMENTS:
  [source]  Optional source name to validate (e.g., "nextjs")
            If not provided, validates all sources

EXAMPLES:
  docs validate           # Validate all sources
  docs validate nextjs    # Validate only nextjs docs
`.trim();

const SYNC_HELP = `
docs sync - Build docs from external sources

USAGE:
  docs sync [source]

ARGUMENTS:
  [source]  Optional source name to sync (e.g., "nextjs")
            If not provided, syncs all sources

DESCRIPTION:
  Runs the sync-docs.ts file for each source to fetch and build
  documentation from external sources (GitHub, docs sites, etc.)

EXAMPLES:
  docs sync           # Sync all sources
  docs sync nextjs    # Sync only nextjs docs
`.trim();

const INIT_HELP = `
docs init - Initialize .docs folder

USAGE:
  docs init

DESCRIPTION:
  Creates a .docs/ folder in the current directory with a config.yml
  file. Use this to start configuring which docs to sync.

EXAMPLES:
  docs init
`.trim();

const SEARCH_HELP = `
docs search - Search available documentation

USAGE:
  docs search <query>

ARGUMENTS:
  <query>  Search term to find in topic names, titles, and descriptions

EXAMPLES:
  docs search routing
  docs search "data fetching"
`.trim();

const CONFIG_HELP = `
docs config - View or modify topic patterns

USAGE:
  docs config [--add <pattern>] [--remove <pattern>]

OPTIONS:
  --add <pattern>     Add a topic pattern to include/exclude
  --remove <pattern>  Remove a topic pattern

PATTERN SYNTAX:
  "nextjs/**"         Include all topics under nextjs/
  "nextjs/*"          Include only direct children
  "!nextjs/legacy/*"  Exclude topics matching pattern (! prefix)

  Order matters: later patterns override earlier ones

EXAMPLES:
  docs config                          # Show current config
  docs config --add "nextjs/**"        # Include all Next.js docs
  docs config --add "!nextjs/legacy/*" # Exclude legacy docs
  docs config --remove "react/**"      # Remove a pattern
`.trim();

const CHECK_HELP = `
docs check - Validate config against available docs

USAGE:
  docs check

DESCRIPTION:
  Checks that your topic patterns in config.yml match available
  documentation. Reports any patterns that don't match anything.

EXAMPLES:
  docs check
`.trim();

const PULL_HELP = `
docs pull - Sync configured docs to .docs folder

USAGE:
  docs pull [--force]

OPTIONS:
  --force  Overwrite existing files without prompting

DESCRIPTION:
  Copies documentation files matching your topic patterns from
  the plugin's docs to your .docs/ folder.

EXAMPLES:
  docs pull          # Sync matching docs
  docs pull --force  # Overwrite existing files
`.trim();

const REPO_HELP = `
docs repo - Manage documentation repositories

USAGE:
  docs repo add <path>          Register a new repository
  docs repo list                List all registered repositories
  docs repo remove <path>       Remove a repository

ARGUMENTS:
  <path>  Local filesystem path or GitHub repository URL
          Examples: /path/to/repo, ./relative/path, https://github.com/owner/repo

OPTIONS:
  --docs-path <dir>  Subdirectory containing docs (default: "docs/")

EXAMPLES:
  docs repo add ~/projects/my-framework
  docs repo add https://github.com/owner/docs-repo
  docs repo add ./local-docs --docs-path content/
  docs repo list
  docs repo remove ~/projects/my-framework
`.trim();

const UI_HELP = `
docs ui - Start web UI for managing docs

USAGE:
  docs ui [--port <number>]

OPTIONS:
  --port <number>  Port number (default: 3000)

DESCRIPTION:
  Starts a web-based UI for managing documentation repositories,
  selecting topics to include, and viewing synced docs.

EXAMPLES:
  docs ui            # Start on port 3000
  docs ui --port 8080
`.trim();

const LIST_HELP = `
docs list - Browse synced documentation progressively

USAGE:
  docs list [path]

ARGUMENTS:
  [path]  Optional path to drill into (e.g., "nextjs", "nextjs/routing")
          If not provided, shows top-level categories

DESCRIPTION:
  Progressively explore synced documentation. Start with no arguments
  to see categories, then drill down by specifying paths.

EXAMPLES:
  docs list                    # Show all categories
  docs list nextjs             # Show contents of nextjs/
  docs list nextjs/api         # Show contents of nextjs/api/
`.trim();

const SHOW_HELP = `
docs show - Display full content of a documentation topic

USAGE:
  docs show <topic>

ARGUMENTS:
  <topic>  The topic to display (e.g., "nextjs/routing")

DESCRIPTION:
  Shows the full content of a synced documentation file,
  including metadata and markdown content.

EXAMPLES:
  docs show nextjs/routing
  docs show tanstack-db/getting-started
`.trim();

const INJECT_CLAUDE_HELP = `
docs inject-claude - Update CLAUDE.md with synced docs info

USAGE:
  docs inject-claude

DESCRIPTION:
  Injects or updates a section in CLAUDE.md that lists synced
  documentation libraries and usage instructions. The section
  is wrapped in <docs-skill-synced> tags for future updates.

EXAMPLES:
  docs inject-claude
`.trim();

function parseArgs(args: string[]): Record<string, string | boolean | string[]> {
  const result: Record<string, string | boolean | string[]> = {};
  const positional: string[] = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];

      if (!next || next.startsWith("--") || next.startsWith("-")) {
        result[key] = true;
        i++;
      } else {
        result[key] = next;
        i += 2;
      }
    } else if (arg.startsWith("-")) {
      result[arg.slice(1)] = true;
      i++;
    } else {
      positional.push(arg);
      i++;
    }
  }

  result._pos = positional;
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);
  const positional = parsed._pos as string[];

  // Extract --cwd if provided
  let cwd = process.cwd();
  if (typeof parsed.cwd === "string") {
    cwd = parsed.cwd;
  }

  // Show help
  if (parsed.help || parsed.h || positional.length === 0) {
    console.log(HELP);
    process.exit(0);
  }

  const command = positional[0];
  const commandArgs = positional.slice(1);

  try {
    switch (command) {
      case "validate": {
        if (parsed.help || parsed.h) {
          console.log(VALIDATE_HELP);
          process.exit(0);
        }
        await validate({ cwd, source: commandArgs[0] });
        break;
      }

      case "sync": {
        if (parsed.help || parsed.h) {
          console.log(SYNC_HELP);
          process.exit(0);
        }
        await sync({ cwd, source: commandArgs[0] });
        break;
      }

      case "init": {
        if (parsed.help || parsed.h) {
          console.log(INIT_HELP);
          process.exit(0);
        }
        await init({ cwd });
        break;
      }

      case "search": {
        if (parsed.help || parsed.h) {
          console.log(SEARCH_HELP);
          process.exit(0);
        }
        const query = commandArgs.join(" ");
        if (!query) {
          console.error("Error: search query is required");
          console.log(SEARCH_HELP);
          process.exit(1);
        }
        await search({ cwd, query });
        break;
      }

      case "config": {
        if (parsed.help || parsed.h) {
          console.log(CONFIG_HELP);
          process.exit(0);
        }
        await config({
          cwd,
          add: typeof parsed.add === "string" ? parsed.add : undefined,
          remove: typeof parsed.remove === "string" ? parsed.remove : undefined,
        });
        break;
      }

      case "check": {
        if (parsed.help || parsed.h) {
          console.log(CHECK_HELP);
          process.exit(0);
        }
        await check({ cwd });
        break;
      }

      case "pull": {
        if (parsed.help || parsed.h) {
          console.log(PULL_HELP);
          process.exit(0);
        }
        await pull({ cwd, force: Boolean(parsed.force) });
        break;
      }

      case "list": {
        if (parsed.help || parsed.h) {
          console.log(LIST_HELP);
          process.exit(0);
        }
        await list({ cwd, path: commandArgs[0] });
        break;
      }

      case "show": {
        if (parsed.help || parsed.h) {
          console.log(SHOW_HELP);
          process.exit(0);
        }
        const topic = commandArgs.join("/");
        if (!topic) {
          console.error("Error: topic is required");
          console.log(SHOW_HELP);
          process.exit(1);
        }
        await show({ cwd, topic });
        break;
      }

      case "inject-claude": {
        if (parsed.help || parsed.h) {
          console.log(INJECT_CLAUDE_HELP);
          process.exit(0);
        }
        await injectClaude({ cwd });
        break;
      }

      case "repo": {
        if (parsed.help || parsed.h) {
          console.log(REPO_HELP);
          process.exit(0);
        }
        const subcommand = commandArgs[0] as "add" | "list" | "remove";
        if (!subcommand || !["add", "list", "remove"].includes(subcommand)) {
          console.error("Usage: docs repo <add|list|remove> [path]");
          process.exit(1);
        }
        await repo({
          cwd,
          subcommand,
          path: commandArgs[1],
          docsPath: typeof parsed["docs-path"] === "string" ? parsed["docs-path"] : undefined,
        });
        break;
      }

      case "ui": {
        if (parsed.help || parsed.h) {
          console.log(UI_HELP);
          process.exit(0);
        }
        const { ui } = await import("./commands/ui");
        const port = typeof parsed.port === "string" ? parseInt(parsed.port, 10) : 3000;
        await ui({ cwd, port });
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}

main();
