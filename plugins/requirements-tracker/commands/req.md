# Requirements Tracker (Linear)

Track test coverage against Linear issues.

## Usage

```bash
req $ARGUMENTS
```

## Commands

- `init` - Connect to Linear, select team/project
- `sync` - Fetch issues from Linear
- `list` - List issues (supports filtering)
- `link <issue> <file:identifier>` - Link test to issue
- `unlink <issue> <file:identifier>` - Remove test link
- `check` - Check test coverage

## Examples

```bash
# Setup
req init

# Sync from Linear
req sync

# Show issues without tests
req list --coverage without

# Link a test
req link ENG-123 src/auth.test.ts:validates login

# Check coverage
req check --coverage
req check --orphans
```

Run any command with `--help` for options.
