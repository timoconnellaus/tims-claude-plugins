#!/usr/bin/env bun

import { init } from "./commands/init";
import { sync } from "./commands/sync";
import { add } from "./commands/add";
import { list } from "./commands/list";
import { link } from "./commands/link";
import { unlink } from "./commands/unlink";
import { check } from "./commands/check";

const HELP = `
req - Track requirements with test coverage (local or Linear)

USAGE:
  req <command> [options]

COMMANDS:
  init                              Initialize (choose local or Linear mode)
  add <title>                       Add a requirement (local mode only)
  sync                              Sync issues from Linear (Linear mode only)
  list [options]                    List requirements/issues
  link <id> <file:identifier>       Link a test to a requirement
  unlink <id> <file:identifier>     Remove a test link
  check [options]                   Check test coverage

GLOBAL OPTIONS:
  --cwd <path>  Run in specified directory (default: current directory)
  --help, -h    Show this help message

EXAMPLES:
  req init                          # Set up (local or Linear)
  req add "User can log in"         # Create local requirement
  req sync                          # Fetch issues from Linear
  req list --coverage without       # Show requirements without tests
  req link REQ-001 src/auth.test.ts:validates login
  req check --orphans               # Find tests not linked to any requirement

Run 'req <command> --help' for more information on a command.
`.trim();

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];

      if (!next || next.startsWith("--")) {
        result[key] = true;
        i++;
      } else {
        result[key] = next;
        i += 2;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      result[key] = true;
      i++;
    } else {
      // Positional arguments
      if (!result._pos) {
        result._pos = arg;
      } else if (!result._pos2) {
        result._pos2 = arg;
      }
      i++;
    }
  }

  return result;
}

async function main() {
  const rawArgs = process.argv.slice(2);

  // Extract --cwd
  const cwdIndex = rawArgs.indexOf("--cwd");
  let cwd = process.cwd();
  let filteredArgs = rawArgs;

  if (cwdIndex !== -1 && rawArgs[cwdIndex + 1]) {
    cwd = rawArgs[cwdIndex + 1];
    filteredArgs = [...rawArgs.slice(0, cwdIndex), ...rawArgs.slice(cwdIndex + 2)];
  }

  const command = filteredArgs[0];
  const args = parseArgs(filteredArgs.slice(1));

  if (!command || command === "--help" || command === "-h") {
    console.log(HELP);
    process.exit(0);
  }

  try {
    switch (command) {
      case "init":
        await init({ cwd, force: !!args.force });
        break;

      case "sync":
        await sync({ cwd, quiet: !!args.quiet });
        break;

      case "add":
        if (args.help || args.h || !args._pos) {
          console.log(`
req add - Add a new requirement (local mode only)

USAGE:
  req add <title>

ARGUMENTS:
  <title>             Requirement title/description

OPTIONS:
  --description <text>  Longer description
  --priority <level>    Priority: 1=Urgent, 2=High, 3=Medium, 4=Low (default: 0=None)

EXAMPLES:
  req add "User can log in with email"
  req add "API returns proper errors" --priority 2
          `.trim());
          if (!args.help && !args.h) process.exit(1);
          break;
        }
        await add({
          cwd,
          title: args._pos as string,
          description: args.description as string,
          priority: args.priority ? parseInt(args.priority as string, 10) : 0,
        });
        break;

      case "list":
        if (args.help || args.h) {
          console.log(`
req list - List issues from local cache

OPTIONS:
  --priority <level>   Filter by priority (urgent, high, medium, low, none)
  --state <state>      Filter by state name
  --label <label>      Filter by label
  --coverage <type>    Filter: with, without, all (default: all)
  --search <text>      Search in title or identifier
  --json               Output as JSON
          `.trim());
          break;
        }
        await list({
          cwd,
          priority: args.priority as string,
          state: args.state as string,
          label: args.label as string,
          coverage: args.coverage as "with" | "without" | "all",
          search: args.search as string,
          json: !!args.json,
        });
        break;

      case "link":
        if (args.help || args.h || !args._pos || !args._pos2) {
          console.log(`
req link - Link a test to a requirement

USAGE:
  req link <id> <file:identifier>

ARGUMENTS:
  <id>                Requirement ID (e.g., REQ-001 or ENG-123)
  <file:identifier>   Test file and test name (e.g., src/auth.test.ts:login)

OPTIONS:
  --by <name>         Who is linking this test

EXAMPLES:
  req link REQ-001 src/auth.test.ts:validates login
  req link ENG-123 tests/api.test.ts:returns 404 --by "John"
          `.trim());
          if (!args.help && !args.h) process.exit(1);
          break;
        }
        await link({
          cwd,
          issueIdentifier: args._pos as string,
          testSpec: args._pos2 as string,
          by: args.by as string,
        });
        break;

      case "unlink":
        if (args.help || args.h || !args._pos || !args._pos2) {
          console.log(`
req unlink - Remove a test link from a requirement

USAGE:
  req unlink <id> <file:identifier>

ARGUMENTS:
  <id>                Requirement ID (e.g., REQ-001 or ENG-123)
  <file:identifier>   Test file and test name to unlink
          `.trim());
          if (!args.help && !args.h) process.exit(1);
          break;
        }
        await unlink({
          cwd,
          issueIdentifier: args._pos as string,
          testSpec: args._pos2 as string,
        });
        break;

      case "check":
        if (args.help || args.h) {
          console.log(`
req check - Check test coverage

OPTIONS:
  --coverage          Show only issues without tests
  --orphans           Show only orphan tests (not linked to any issue)
  --test-glob <glob>  Test file pattern (default: **/*.test.{ts,js,tsx,jsx})
  --json              Output as JSON

Without flags, shows both coverage and orphan reports.
          `.trim());
          break;
        }
        await check({
          cwd,
          coverage: !!args.coverage,
          orphans: !!args.orphans,
          json: !!args.json,
          testGlob: args["test-glob"] as string,
        });
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unexpected error occurred");
    }
    process.exit(1);
  }
}

main();
