# Requirements Tracker

Track project requirements with test coverage verification.

## Usage

```bash
req $ARGUMENTS
```

## Commands

- `init [--test-runner <cmd>] [--test-glob <glob>]` - Create .requirements/ folder with config
- `add <path> --gherkin "..." --source-type <type> --source-desc "..." [--source-url "..."]` - Create new requirement
- `link <path> <file:identifier>` - Link test to requirement
- `unlink <path> <file:identifier>` - Remove test link from requirement
- `check [path] [--json] [--no-cache]` - Validate coverage, staleness, orphans
- `assess <path> --result '{"sufficient": bool, "notes": "..."}'` - Update AI assessment
- `ignore-test <file:identifier> --reason "..."` - Mark test as intentionally unlinked
- `unignore-test <file:identifier>` - Remove test from ignored list

## Examples

```bash
# Setup
req init
req init --test-runner "npm test" --test-glob "**/*.spec.ts"

# Create a new requirement
req add auth/REQ_login.yml \
  --gherkin "Given a registered user\nWhen they enter valid credentials\nThen they should be logged in" \
  --source-type doc \
  --source-desc "Auth PRD v2.1" \
  --source-url "https://docs.example.com/auth"

# Link a test to a requirement
req link auth/REQ_login.yml src/auth.test.ts:validates login credentials
req link payments/REQ_checkout.yml tests/checkout.test.ts:processes payment

# Unlink a test from a requirement
req unlink auth/REQ_login.yml src/auth.test.ts:validates login credentials

# Check coverage
req check                           # Check all requirements
req check auth/                     # Check all in auth/ folder
req check auth/REQ_login.yml        # Check specific requirement
req check --json                    # JSON output for scripting
req check --no-cache                # Force refresh test hashes

# Update AI assessment
req assess auth/REQ_login.yml --result '{"sufficient": true, "notes": "Tests cover happy path and error cases"}'
req assess payments/REQ_checkout.yml --result '{"sufficient": false, "notes": "Missing timeout test"}'

# Ignore tests that don't need requirements
req ignore-test src/utils.test.ts:helper function tests --reason "Utility tests"
req ignore-test src/setup.test.ts:database init --reason "Infrastructure"

# Unignore a test
req unignore-test src/utils.test.ts:helper function tests
```

## Key Concepts

**Folder-based structure:** Requirements are organized in `.requirements/` with one requirement per file. Files must be named `REQ_*.yml`.

**Verification status:**
- **n/a** - No tests linked
- **unverified** - Has tests, no AI assessment yet
- **verified** - AI assessed, tests unchanged
- **stale** - Tests changed since assessment

**Paths:** All paths are relative to `.requirements/` directory (e.g., `auth/REQ_login.yml`, not `.requirements/auth/REQ_login.yml`).

**Test identifiers:** Use format `file:identifier` (e.g., `src/auth.test.ts:validates login credentials`).

Run any command with `--help` for detailed options.
