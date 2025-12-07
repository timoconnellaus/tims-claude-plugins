---
name: requirements-tracker
description: Track project requirements with test coverage verification, tags, priorities, and status. Use when working with requirements tracking, linking tests to requirements, finding untested requirements or orphan tests, filtering by priority/status/tags, or verifying test coverage. Triggers on questions like "what requirements need tests?", "show critical requirements", "filter by tag", "set priority", or "verify requirements".
---

# Requirements Tracker

CLI tool for tracking requirements with test coverage, tags, priorities, and lifecycle status. Data stored in `requirements.json` at project root.

## Commands

Run via: `bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts --cwd <project-root> <command>`

Always use `--cwd` to specify the target project directory for reliable operation.

| Command | Purpose |
|---------|---------|
| `init --runner "name:cmd:pattern"` | Initialize with test runner config |
| `add "description" [options]` | Add requirement with optional tags, priority, status |
| `list [options]` | List/filter requirements by tags, priority, status, search |
| `link <REQ-ID> <file:identifier>` | Link test to requirement |
| `check [--coverage] [--orphans] [--run]` | Check coverage, find orphans, run tests |
| `tag <REQ-ID> --add/--remove <tag>` | Manage tags |
| `set <REQ-ID> --priority/--status <value>` | Set priority or status |
| `archive <REQ-ID>` / `restore <REQ-ID>` | Archive/restore requirements |
| `history <REQ-ID>` | Show requirement history |

## Requirement Metadata

Each requirement can have:
- **Tags**: Flat labels like `auth`, `security`, `v2`, `api`
- **Priority**: `critical`, `high`, `medium` (default), `low`
- **Status**: `draft` (default), `approved`, `implemented`, `released`

## Filtering Examples

```bash
# Find all critical priority requirements
list --priority critical

# Find requirements with "auth" tag
list --tag auth

# Find requirements with both "auth" AND "security" tags
list --tag auth --tag security --all-tags

# Find approved requirements that are high priority
list --priority high --req-status approved

# Search for requirements mentioning "login"
list --search login
```

## Key Types

See `src/lib/types.ts`. Key fields:
- `Requirement.tags[]` - flat list of string labels
- `Requirement.priority` - critical/high/medium/low
- `Requirement.status` - draft/approved/implemented/released
- `Requirement.tests[]` - linked tests with runner, file, identifier
- `Requirement.source` - origin tracking (type + reference)
- `Requirement.history[]` - audit trail of changes

## Verification Workflow

When verifying test coverage for a requirement:

1. Read the requirement from `requirements.json` or via `list --json`
2. Read each linked test file to understand what it validates
3. Compare requirement description with actual test assertions
4. Report: missing cases, tests that don't validate the requirement, improvements needed
