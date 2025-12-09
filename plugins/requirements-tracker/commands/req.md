# Requirements Tracker

Track feature requirements with test coverage.

## Usage

```bash
req $ARGUMENTS
```

## Commands

- `init [--test-runner <cmd>] [--test-glob <glob>]` - Create .requirements/ folder
- `link <feature> <req-id> <file:id>` - Link test to requirement
- `check` - Validate coverage, staleness, orphans
- `assess <feature> <req-id> --result '{...}'` - Update AI assessment

## Examples

```bash
# Setup
req init

# Link a test
req link user-auth 1 src/auth.test.ts:validates login

# Check coverage
req check
req check --json

# Update assessment
req assess user-auth 1 --result '{"sufficient": true, "notes": "Good"}'
```

Run any command with `--help` for options.
