#!/usr/bin/env bun

import { add } from "./commands/add";
import { list } from "./commands/list";
import { link, unlink } from "./commands/link";
import { confirm } from "./commands/confirm";
import { check } from "./commands/check";
import { archive, restore } from "./commands/archive";
import { history } from "./commands/history";
import { init } from "./commands/init";
import { tag } from "./commands/tag";
import { set } from "./commands/set";
import { github } from "./commands/github";
import { startServer } from "./server/index";

const HELP = `
requirements-tracker - Track project requirements with test verification

USAGE:
  bun req <command> [options]

COMMANDS:
  init                              Initialize requirements.json
  add <description> [options]       Add a new requirement
  list [options]                    List and filter requirements
  link <id> <file:identifier>       Link a test to a requirement
  unlink <id> <file:identifier>     Unlink a test from a requirement
  confirm <id> <file:identifier>    Confirm a test covers a requirement
  check [options]                   Run verification checks
  tag <id> [--add|--remove <tag>]   Manage tags on a requirement
  set <id> [--priority|--status]    Set priority or status
  archive <id> [--reason <reason>]  Archive a requirement
  restore <id>                      Restore an archived requirement
  history <id>                      Show requirement history
  github <subcommand>               Manage GitHub integration
  serve [--port <port>]             Start web UI server (default: 3000)

GLOBAL OPTIONS:
  --cwd <path>  Run in specified directory (default: current directory)
  --help, -h    Show this help message

Run 'bun req <command> --help' for more information on a command.
`.trim();

function extractCwd(args: string[]): { cwd: string | null; filteredArgs: string[] } {
  const cwdIndex = args.indexOf("--cwd");
  if (cwdIndex !== -1 && args[cwdIndex + 1]) {
    const cwd = args[cwdIndex + 1];
    const filteredArgs = [...args.slice(0, cwdIndex), ...args.slice(cwdIndex + 2)];
    return { cwd, filteredArgs };
  }
  return { cwd: null, filteredArgs: args };
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const { cwd, filteredArgs } = extractCwd(rawArgs);

  // Change to specified directory if --cwd provided
  if (cwd) {
    try {
      process.chdir(cwd);
    } catch {
      console.error(`Error: Cannot access directory: ${cwd}`);
      process.exit(1);
    }
  }

  const command = filteredArgs[0];
  const args = filteredArgs.slice(1);

  if (!command || command === "--help" || command === "-h") {
    console.log(HELP);
    process.exit(0);
  }

  try {
    switch (command) {
      case "init":
        await init(args);
        break;
      case "add":
        await add(args);
        break;
      case "list":
        await list(args);
        break;
      case "link":
        await link(args);
        break;
      case "unlink":
        await unlink(args);
        break;
      case "confirm":
        await confirm(args);
        break;
      case "check":
        await check(args);
        break;
      case "tag":
        await tag(args);
        break;
      case "set":
        await set(args);
        break;
      case "archive":
        await archive(args);
        break;
      case "restore":
        await restore(args);
        break;
      case "history":
        await history(args);
        break;
      case "github":
        await github(args);
        break;
      case "serve":
        startServer(args);
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
