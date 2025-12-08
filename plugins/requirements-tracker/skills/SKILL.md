---
name: requirements-tracker
description: Track Linear issues with test coverage verification. Use when linking tests to Linear issues, finding issues without tests, checking test coverage, or syncing from Linear. Triggers on questions like "what issues need tests?", "sync from Linear", "link test to issue", or "check coverage".
---

# Requirements Tracker (Linear-backed)

CLI tool for tracking test coverage against Linear issues. Issues are synced from Linear; test links are stored as structured comments on the issues.

## Setup

```bash
# Set API key (or enter during init)
export LINEAR_API_KEY=lin_api_xxx

# Initialize - picks team/project
req init
```

## Commands

Run via: `req <command>` (or use `--cwd <path>` for a different directory)

| Command | Purpose |
|---------|---------|
| `init` | Connect to Linear, select team/project |
| `sync` | Fetch issues from Linear to local cache |
| `list [options]` | List issues with filtering |
| `link <ISSUE> <file:identifier>` | Link test to Linear issue |
| `unlink <ISSUE> <file:identifier>` | Remove test link |
| `check [--coverage] [--orphans]` | Check test coverage |

## Examples

```bash
# Sync issues from Linear
req sync

# List all issues without tests
req list --coverage without

# List urgent/high priority issues
req list --priority urgent
req list --priority high

# Search for issues
req list --search "authentication"

# Link a test to an issue
req link ENG-123 src/auth.test.ts:validates login credentials

# Check which issues lack tests
req check --coverage

# Find orphan tests (not linked to any issue)
req check --orphans
```

## How Test Links Work

When you link a test, a comment is added to the Linear issue:

```
**Test Coverage**
- `src/auth.test.ts:validates login credentials`
- `src/auth.test.ts:handles invalid password`

<!-- req-tests:[{"file":"src/auth.test.ts","identifier":"validates login credentials",...}] -->
```

The human-readable list is visible in Linear. The HTML comment stores machine-readable data for the CLI.

## Files

- `.requirements.json` - Config (team ID, project ID, optional API key)
- `.requirements-cache.json` - Local cache of Linear issues and test links

## Workflow

1. `req init` - One-time setup to connect to Linear
2. `req sync` - Fetch current issues (run periodically)
3. `req link` - Link tests as you write them
4. `req check` - Review coverage before releases
