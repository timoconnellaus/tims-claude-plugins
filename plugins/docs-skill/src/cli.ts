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
