#!/usr/bin/env bun

import { init } from "./commands/init";
import { add } from "./commands/add";
import { link } from "./commands/link";
import { unlink } from "./commands/unlink";
import { status } from "./commands/status";
import { check } from "./commands/check";
import { assess } from "./commands/assess";
import { ignoreTest } from "./commands/ignore-test";
import { unignoreTest } from "./commands/unignore-test";
import { ui } from "./commands/ui";
import { docs } from "./commands/docs";

const HELP = `
req - Track requirements with test coverage

USAGE:
  req <command> [options]

COMMANDS:
  init [options]                                    Create .requirements/ folder
  add <path> --gherkin "..." --source-type <type>   Create a new requirement
  link <path> <file:id>                             Link a test to a requirement
  unlink <path> <file:id>                           Remove a test link
  status <path> [--done | --planned]                Get or set implementation status
  check [path] [--json] [--no-cache]                Check test coverage status
  assess <path> --result '{}'                       Update AI assessment
  ignore-test <file:id> --reason "..."              Mark test as intentionally unlinked
  unignore-test <file:id>                           Remove test from ignored list
  ui [--port <number>]                              Start web UI for viewing requirements
  docs [--port <number>]                            Open documentation in browser

GLOBAL OPTIONS:
  --cwd <path>  Run in specified directory (default: current directory)
  --help, -h    Show this help message

EXAMPLES:
  req init
  req add auth/REQ_login.yml --gherkin "Given user enters credentials When they submit Then they are logged in" --source-type doc --source-desc "PRD v2.1"
  req link auth/REQ_login.yml src/auth.test.ts:validates login
  req unlink auth/REQ_login.yml src/auth.test.ts:validates login
  req check
  req check auth/
  req check --json
  req assess auth/REQ_login.yml --result '{"sufficient": true, "notes": "Good coverage"}'
  req ignore-test src/helpers.test.ts:utility function --reason "Helper function, no requirements"
  req unignore-test src/helpers.test.ts:utility function

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

      case "add":
        if (args.help || args.h || positional.length < 1 || !args.gherkin || !args["source-type"] || !args["source-desc"]) {
          console.log(`
req add - Create a new requirement

USAGE:
  req add <path> --gherkin "..." --source-type <type> --source-desc "..." [options]

ARGUMENTS:
  <path>  Requirement path (e.g., auth/REQ_login.yml)

OPTIONS:
  --gherkin        Gherkin-format requirement (Given/When/Then)
  --source-type    Source type: doc, slack, email, meeting, ticket, manual
  --source-desc    Description of the source
  --source-url     Optional URL to source
  --source-date    Optional date (ISO format)
  --force          Overwrite if exists

EXAMPLES:
  req add auth/REQ_login.yml --gherkin "Given user enters valid credentials When they submit Then they are logged in" --source-type doc --source-desc "PRD v2.1" --source-url "https://docs.example.com/prd"
          `.trim());
          if (!args.help && !args.h) process.exit(1);
          break;
        }
        await add({
          cwd,
          path: positional[0],
          gherkin: args.gherkin as string,
          sourceType: args["source-type"] as string,
          sourceDesc: args["source-desc"] as string,
          sourceUrl: args["source-url"] as string | undefined,
          sourceDate: args["source-date"] as string | undefined,
          force: !!args.force,
        });
        break;

      case "link":
        if (args.help || args.h || positional.length < 2) {
          console.log(`
req link - Link a test to a requirement

USAGE:
  req link <path> <file:identifier>

ARGUMENTS:
  <path>            Requirement path (e.g., auth/REQ_login.yml)
  <file:identifier> Test file and test name

EXAMPLES:
  req link auth/REQ_login.yml src/auth.test.ts:validates login
  req link payments/REQ_refund.yml tests/payments.test.ts:handles refund
          `.trim());
          if (!args.help && !args.h) process.exit(1);
          break;
        }
        await link({
          cwd,
          path: positional[0],
          testSpec: positional[1],
        });
        break;

      case "unlink":
        if (args.help || args.h || positional.length < 2) {
          console.log(`
req unlink - Remove a test link from a requirement

USAGE:
  req unlink <path> <file:identifier>

ARGUMENTS:
  <path>            Requirement path (e.g., auth/REQ_login.yml)
  <file:identifier> Test file and test name

EXAMPLES:
  req unlink auth/REQ_login.yml src/auth.test.ts:validates login
          `.trim());
          if (!args.help && !args.h) process.exit(1);
          break;
        }
        await unlink({
          cwd,
          path: positional[0],
          testSpec: positional[1],
        });
        break;

      case "status":
        if (args.help || args.h || positional.length < 1) {
          console.log(`
req status - Get or set implementation status

USAGE:
  req status <path> [--done | --planned]

ARGUMENTS:
  <path>  Requirement path (e.g., auth/REQ_login.yml)

OPTIONS:
  --done     Mark requirement as implemented
  --planned  Mark requirement as not yet implemented (default)

EXAMPLES:
  req status auth/REQ_login.yml              # Show current status
  req status auth/REQ_login.yml --done       # Mark as implemented
  req status auth/REQ_login.yml --planned    # Mark as not implemented
          `.trim());
          if (!args.help && !args.h) process.exit(1);
          break;
        }
        await status({
          cwd,
          path: positional[0],
          done: !!args.done,
          planned: !!args.planned,
        });
        break;

      case "check":
        if (args.help || args.h) {
          console.log(`
req check - Check test coverage and verification status

USAGE:
  req check [path] [options]

ARGUMENTS:
  [path]  Optional path filter (e.g., "auth/" or "auth/REQ_login.yml")

OPTIONS:
  --json      Output as JSON
  --no-cache  Skip cache (future: force re-extraction)

Checks requirement files and reports:
- Untested requirements (no tests linked)
- Unverified requirements (has tests, but no AI assessment)
- Stale requirements (tests changed since assessment)
- Verified requirements (AI assessed, tests unchanged)
- Orphaned tests (not linked to any requirement, excluding ignored)

EXAMPLES:
  req check              # Check all requirements
  req check auth/        # Check only auth/ folder
  req check --json       # Output as JSON
          `.trim());
          break;
        }
        await check({
          cwd,
          path: positional[0],
          json: !!args.json,
          noCache: !!args["no-cache"],
        });
        break;

      case "assess":
        if (args.help || args.h || positional.length < 1 || !args.result) {
          console.log(`
req assess - Update AI assessment for a requirement

USAGE:
  req assess <path> --result '{"sufficient": bool, "notes": "..."}'

ARGUMENTS:
  <path>  Requirement path (e.g., auth/REQ_login.yml)

OPTIONS:
  --result  JSON object with sufficient (bool) and notes (string)

EXAMPLES:
  req assess auth/REQ_login.yml --result '{"sufficient": true, "notes": "Tests cover happy path and error cases"}'
          `.trim());
          if (!args.help && !args.h) process.exit(1);
          break;
        }
        await assess({
          cwd,
          path: positional[0],
          resultJson: args.result as string,
        });
        break;

      case "ignore-test":
        if (args.help || args.h || positional.length < 1 || !args.reason) {
          console.log(`
req ignore-test - Mark a test as intentionally not linked to any requirement

USAGE:
  req ignore-test <file:identifier> --reason "..."

ARGUMENTS:
  <file:identifier>  Test file and test name

OPTIONS:
  --reason  Explanation for why this test doesn't need a requirement

EXAMPLES:
  req ignore-test src/helpers.test.ts:utility function --reason "Helper function, no business requirement"
          `.trim());
          if (!args.help && !args.h) process.exit(1);
          break;
        }
        await ignoreTest({
          cwd,
          testSpec: positional[0],
          reason: args.reason as string,
        });
        break;

      case "unignore-test":
        if (args.help || args.h || positional.length < 1) {
          console.log(`
req unignore-test - Remove a test from the ignored list

USAGE:
  req unignore-test <file:identifier>

ARGUMENTS:
  <file:identifier>  Test file and test name

EXAMPLES:
  req unignore-test src/helpers.test.ts:utility function
          `.trim());
          if (!args.help && !args.h) process.exit(1);
          break;
        }
        await unignoreTest({
          cwd,
          testSpec: positional[0],
        });
        break;

      case "ui":
        if (args.help || args.h) {
          console.log(`
req ui - Start web UI for viewing requirements

USAGE:
  req ui [options]

OPTIONS:
  --port <number>  Port to run server on (default: 3000)

EXAMPLES:
  req ui
  req ui --port 8080
          `.trim());
          break;
        }
        await ui({
          cwd,
          port: args.port ? parseInt(args.port as string, 10) : 3000,
        });
        break;

      case "docs":
        if (args.help || args.h) {
          console.log(`
req docs - Open documentation in browser

USAGE:
  req docs [options]

OPTIONS:
  --port <number>  Port to run server on (default: 3000)

EXAMPLES:
  req docs
  req docs --port 8080
          `.trim());
          break;
        }
        await docs({
          cwd,
          port: args.port ? parseInt(args.port as string, 10) : 3000,
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
