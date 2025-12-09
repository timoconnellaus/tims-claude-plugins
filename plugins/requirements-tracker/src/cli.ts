#!/usr/bin/env bun

import { init } from "./commands/init";
import { link } from "./commands/link";
import { check } from "./commands/check";
import { assess } from "./commands/assess";

const HELP = `
req - Track requirements with test coverage

USAGE:
  req <command> [options]

COMMANDS:
  init [options]                          Create .requirements/ folder
  link <feature> <req-id> <file:id>       Link a test to a requirement
  check                                   Check test coverage and verification
  assess <feature> <req-id> --result '{}'  Update AI assessment

GLOBAL OPTIONS:
  --cwd <path>  Run in specified directory (default: current directory)
  --help, -h    Show this help message

EXAMPLES:
  req init
  req link user-auth 1 src/auth.test.ts:validates login
  req check
  req check --json
  req assess user-auth 1 --result '{"sufficient": true, "notes": "Good coverage"}'

Run 'req <command> --help' for more information on a command.
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
      positional.push(arg);
      i++;
    }
  }

  // Store positional args
  result._pos = positional;
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
  const positional = (args._pos as string[]) || [];

  if (!command || command === "--help" || command === "-h") {
    console.log(HELP);
    process.exit(0);
  }

  try {
    switch (command) {
      case "init":
        if (args.help || args.h) {
          console.log(`
req init - Create .requirements/ folder with config

OPTIONS:
  --test-runner <cmd>  Test runner command (default: bun test)
  --test-glob <glob>   Test file glob (default: **/*.test.{ts,js})
  --force              Overwrite existing config

EXAMPLES:
  req init
  req init --test-runner "npm test" --test-glob "**/*.spec.ts"
          `.trim());
          break;
        }
        await init({
          cwd,
          force: !!args.force,
          testRunner: args["test-runner"] as string | undefined,
          testGlob: args["test-glob"] as string | undefined,
        });
        break;

      case "link":
        if (args.help || args.h || positional.length < 3) {
          console.log(`
req link - Link a test to a requirement

USAGE:
  req link <feature> <req-id> <file:identifier>

ARGUMENTS:
  <feature>         Feature name (e.g., user-auth or FEAT_001_user-auth)
  <req-id>          Requirement ID (e.g., 1, 2.1)
  <file:identifier> Test file and test name

EXAMPLES:
  req link user-auth 1 src/auth.test.ts:validates login
  req link FEAT_001_user-auth 2.1 tests/login.test.ts:handles error
          `.trim());
          if (!args.help && !args.h) process.exit(1);
          break;
        }
        await link({
          cwd,
          featureName: positional[0],
          reqId: positional[1],
          testSpec: positional[2],
        });
        break;

      case "check":
        if (args.help || args.h) {
          console.log(`
req check - Check test coverage and verification status

OPTIONS:
  --json         Output as JSON

Checks all feature files and reports:
- Untested requirements (no tests linked)
- Unverified requirements (has tests, but no AI assessment)
- Stale requirements (tests changed since assessment)
- Verified requirements (AI assessed, tests unchanged)
- Orphaned tests (not linked to any requirement)
          `.trim());
          break;
        }
        await check({
          cwd,
          json: !!args.json,
        });
        break;

      case "assess":
        if (args.help || args.h || positional.length < 2 || !args.result) {
          console.log(`
req assess - Update AI assessment for a requirement

USAGE:
  req assess <feature> <req-id> --result '{"sufficient": bool, "notes": "..."}'

ARGUMENTS:
  <feature>   Feature name
  <req-id>    Requirement ID

OPTIONS:
  --result    JSON object with sufficient (bool) and notes (string)

EXAMPLES:
  req assess user-auth 1 --result '{"sufficient": true, "notes": "Tests cover happy path and error cases"}'
          `.trim());
          if (!args.help && !args.h) process.exit(1);
          break;
        }
        await assess({
          cwd,
          featureName: positional[0],
          reqId: positional[1],
          result: args.result as string,
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
