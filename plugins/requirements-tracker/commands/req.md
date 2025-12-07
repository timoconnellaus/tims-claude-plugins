# Requirements Tracker

Manage project requirements with test verification.

## Usage

Pass arguments directly to the CLI:

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts $ARGUMENTS
```

## Available Commands

- `init` - Initialize requirements.json
- `add <description>` - Add a new requirement
- `list` - List all requirements
- `link <id> <file:identifier>` - Link a test to a requirement
- `unlink <id> <file:identifier>` - Unlink a test
- `check` - Run verification checks
- `archive <id>` - Archive a requirement
- `restore <id>` - Restore an archived requirement
- `history <id>` - Show requirement history

Run any command with `--help` for more options.
