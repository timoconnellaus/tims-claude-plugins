---
name: requirements-tracker
description: Track project requirements with test coverage verification. Use when creating requirements, linking tests, assessing coverage, or checking staleness. Triggers on "track requirements", "link test to requirement", "check coverage", "assess tests".
---

# Requirements Tracker

A local YAML-based system for tracking project requirements with test coverage verification.

## Folder Structure

Requirements live in `.requirements/` at the project root with a folder-based structure:

```
.requirements/
├── config.yml              # Test runner configuration
├── cache.json              # Test hash cache (auto-managed)
├── ignored-tests.yml       # Tests marked as not needing requirements
├── auth/                   # Folders can have any name
│   ├── REQ_login.yml      # One requirement per file
│   └── session/           # Nested folders allowed
│       └── REQ_timeout.yml
└── payments/
    └── REQ_checkout.yml
```

**Key principles:**
- **One requirement per file** - Each file contains exactly one requirement
- **REQ_ prefix required** - All requirement files must be named `REQ_*.yml`
- **Folder organization** - Use folders to group related requirements
- **Nested folders allowed** - Organize hierarchically as needed

## Requirement File Format

Each `REQ_*.yml` file follows this structure:

```yaml
gherkin: |
  Given a registered user
  When they enter valid credentials
  Then they should be logged in

source:
  type: doc
  description: "Auth PRD v2.1"
  url: "https://docs.example.com/auth"

status: done  # "planned" or "done"

# Optional extended fields
priority: critical  # critical | high | medium | low

dependencies:
  - path: auth/REQ_session.yml

nfrs:
  - category: performance
    description: "Login response time"
    threshold: "< 200ms p95"
    verified: true

scenarios:
  - name: invalid_password
    gherkin: |
      Given a registered user
      When they enter an invalid password
      Then they should see an error message

tests:
  - file: src/auth.test.ts
    identifier: "validates login credentials"
    hash: abc123...

aiAssessment:
  sufficient: true
  notes: "Coverage adequate"
  assessedAt: 2024-01-15T10:30:00Z

questions:
  - question: "Rate limit?"
    answer: "3 per minute"
    answeredAt: 2024-01-15T11:00:00Z
```

### Gherkin (REQUIRED - Primary Scenario)

Every requirement MUST have a `gherkin` field containing the primary scenario. This is NOT optional.

**CRITICAL:** The `gherkin` field is REQUIRED. The `scenarios` array is for ADDITIONAL scenarios only - it does NOT replace the primary `gherkin` field. You cannot omit `gherkin` and only use `scenarios`.

**IMPORTANT:** The gherkin field should contain exactly ONE scenario without the "Scenario:" prefix:

```yaml
# CORRECT - one scenario, no prefix
gherkin: |
  Given [precondition]
  When [action]
  Then [expected result]
```

```yaml
# WRONG - don't include "Scenario:" prefix
gherkin: |
  Scenario: Login
    Given a user
    When they login
    Then they are authenticated
```

```yaml
# WRONG - don't put multiple scenarios in one gherkin field
gherkin: |
  Given user A
  When action X
  Then result Y
  Given user B
  When action Z
  Then result W
```

For edge cases and alternative flows, use the `scenarios` field instead (see below).

### Source (REQUIRED)

Every requirement MUST have a source indicating where it came from. **AI assistants must NEVER guess or fabricate sources.** If the source is unknown, ask the user.

Source types:
- `doc` - Documentation (PRD, spec, RFC, etc.)
- `slack` - Slack message or thread
- `email` - Email correspondence
- `meeting` - Meeting notes or discussion
- `ticket` - Issue tracker (Jira, etc.)
- `manual` - Manually added by user (use when user directly specifies requirement)

```yaml
source:
  type: doc                                    # Required: one of the types above
  description: "Auth PRD v2.1, Section 3.1"   # Required: human-readable description
  url: "https://..."                           # Optional: link to source
  date: "2024-01-10"                           # Optional: when source was created
```

**IMPORTANT FOR AI ASSISTANTS:**
- Do NOT create requirements without a real source
- Do NOT guess or make up source descriptions
- If extracting requirements from a document, cite the specific document
- If user verbally describes a requirement, use `type: manual` with description like "User request via Claude Code session"
- When in doubt, ASK the user for the source

### Tests

Test links associate the requirement with test files:

```yaml
tests:
  - file: src/auth.test.ts
    identifier: "validates login credentials"
    hash: abc123...
  - file: src/auth-integration.test.ts
    identifier: "end-to-end login flow"
    hash: def456...
```

- `file` - Relative path to test file
- `identifier` - Test name or description (extracted from test code)
- `hash` - SHA-256 hash of test body (auto-managed, detects changes)

### AI Assessment

Optional field recording AI analysis of test coverage:

```yaml
aiAssessment:
  sufficient: true                              # Is coverage adequate?
  notes: "Tests cover happy path and errors"    # Overall assessment summary
  assessedAt: 2024-01-15T10:30:00Z             # When assessed
  testComments:                                 # Per-test analysis (optional)
    - file: src/auth.test.ts
      identifier: "validates login credentials"
      comment: "Good coverage of happy path and validation"
    - file: src/auth.test.ts
      identifier: "handles invalid password"
      comment: "Missing test for rate limiting after failures"
  suggestedTests:                               # Tests that should be written (optional)
    - description: "Given 3 failed login attempts When user tries again Then rate limit error"
      rationale: "No coverage for rate limiting behavior"
    - description: "Given expired session token When API called Then 401 returned"
      rationale: "Session expiry not tested"
```

The `testComments` field allows per-test feedback, while `suggestedTests` captures gaps in coverage.

### Questions

Optional clarification questions that need answering:

```yaml
questions:
  - question: "How many failed attempts before lockout?"
    answer: "3 attempts within 15 minutes"
    answeredAt: 2024-01-15T11:00:00Z
  - question: "Should we rate limit by IP or by account?"
    # No answer yet - will be reported by `req check`
```

The `req check` command reports unanswered questions.

### Priority (Optional)

Set requirement priority/criticality:

```yaml
priority: critical  # critical | high | medium | low
```

Use to prioritize implementation order and triage. The `req check` command shows a priority breakdown in the summary.

### Dependencies (Optional)

Link requirements that must be completed first:

```yaml
dependencies:
  - path: auth/REQ_login.yml           # Must be done before this
  - path: auth/REQ_session.yml
    blocking: false                     # Soft dependency (informational only)
```

- `path` - Path to the dependent requirement (relative to `.requirements/`)
- `blocking` - If `true` (default), `req check` warns when this req is "done" but deps are "planned"

The `req check` command reports dependency issues when a "done" requirement has blocking dependencies that aren't "done".

### Non-Functional Requirements (Optional)

Track performance, security, accessibility, and other quality constraints:

```yaml
nfrs:
  - category: performance
    description: "API response time under load"
    threshold: "< 200ms p95"
  - category: security
    description: "Passwords hashed with bcrypt"
    verified: true
  - category: accessibility
    description: "Login form screen-reader accessible"
    threshold: "WCAG 2.1 AA"
```

- `category` - One of: `performance`, `security`, `accessibility`, `reliability`, `scalability`, `other`
- `description` - What the NFR requires
- `threshold` - Measurable target (optional)
- `verified` - Set to `true` when NFR has been verified (optional)

The `req check` command reports unverified NFRs count.

### Additional Scenarios (Optional - NOT a replacement for gherkin)

The `scenarios` array is for ADDITIONAL edge cases beyond the primary `gherkin` field. You MUST still have a primary `gherkin` field - the `scenarios` array does NOT replace it.

Use this for edge cases, error handling, and alternative flows beyond the primary gherkin:

```yaml
scenarios:
  - name: invalid_password
    gherkin: |
      Given a registered user
      When they enter an invalid password
      Then they should see an error message

  - name: rate_limited
    gherkin: |
      Given a user has failed login 3 times
      When they attempt to login again within 15 minutes
      Then they should be rate limited
```

- `name` - Short identifier for the scenario (snake_case recommended)
- `gherkin` - Full Given/When/Then scenario (must include all three keywords, NO "Scenario:" prefix)

**Note:** Each scenario's gherkin should be ONE complete Given/When/Then flow, just like the main gherkin field.

## CLI Commands

### Initialize

```bash
req init [--test-runner <cmd>] [--test-glob <glob>]
```

Creates `.requirements/` folder with config. Defaults: `bun test` and `**/*.test.{ts,js}`.

```bash
req init
req init --test-runner "npm test" --test-glob "**/*.spec.ts"
```

### Add Requirement

```bash
req add <path> --gherkin "..." --source-type <type> --source-desc "..." [options]
```

Creates a new requirement file. Path must be relative to `.requirements/` and must start with `REQ_`.

**Options:**
- `--gherkin` - Gherkin-format requirement (Given/When/Then)
- `--source-type` - Source type: doc, slack, email, meeting, ticket, manual
- `--source-desc` - Description of the source
- `--source-url` - Optional URL to source
- `--source-date` - Optional date (ISO format)
- `--priority` - Priority level: critical, high, medium, low
- `--depends-on` - Dependency path (can be repeated for multiple deps)
- `--force` - Overwrite if exists

```bash
# Basic requirement
req add auth/REQ_login.yml \
  --gherkin "Given a registered user\nWhen they enter valid credentials\nThen they should be logged in" \
  --source-type doc \
  --source-desc "Auth PRD v2.1, Section 3.1" \
  --source-url "https://docs.example.com/auth-prd"

# With priority and dependencies
req add payments/REQ_checkout.yml \
  --gherkin "Given cart has items\nWhen user clicks checkout\nThen payment is processed" \
  --source-type doc \
  --source-desc "Payments PRD" \
  --priority critical \
  --depends-on auth/REQ_login.yml \
  --depends-on cart/REQ_add_item.yml

# Manual source from user request
req add payments/session/REQ_timeout.yml \
  --gherkin "Given an active session\nWhen 30 minutes pass with no activity\nThen the session should expire" \
  --source-type manual \
  --source-desc "User request via Claude Code"
```

### Link Test to Requirement

```bash
req link <path> <file:identifier>
```

Links a test to a requirement. Path is relative to `.requirements/`.

```bash
req link auth/REQ_login.yml src/auth.test.ts:validates login credentials
req link payments/REQ_checkout.yml tests/checkout.test.ts:processes payment
```

The CLI will:
1. Extract the test body from the test file
2. Compute a SHA-256 hash
3. Add the test link to the requirement file

### Unlink Test from Requirement

```bash
req unlink <path> <file:identifier>
```

Removes a test link from a requirement.

```bash
req unlink auth/REQ_login.yml src/auth.test.ts:validates login credentials
```

### Move Requirement

```bash
req move <source-path> <dest-path>
```

Moves a requirement file to a new location. Both paths must follow the `REQ_*.yml` naming pattern.

```bash
req move auth/REQ_login.yml auth/session/REQ_login.yml
req move REQ_old.yml features/REQ_old.yml
```

The command will:
1. Move the requirement file to the new location
2. Update any dependencies in other requirements that reference the moved file

### Rename Requirement

```bash
req rename <path> <new-name>
```

Renames a requirement file in the same directory. The `REQ_` prefix and `.yml` extension are automatically added if missing.

```bash
req rename auth/REQ_login.yml REQ_user_login.yml
req rename auth/REQ_login.yml user_login        # Becomes REQ_user_login.yml
```

The command will:
1. Rename the requirement file in place
2. Update any dependencies in other requirements that reference the renamed file

### Check Coverage

```bash
req check [path] [--json] [--no-cache]
```

Reports coverage and verification status for all requirements or a specific path.

```bash
req check                           # Check all requirements
req check auth/                     # Check all requirements in auth/
req check auth/REQ_login.yml        # Check specific requirement
req check --json                    # JSON output
req check --no-cache                # Force refresh test hashes
```

Reports:
- **Untested** - Requirements with no linked tests
- **Unverified** - Has tests, but no AI assessment yet
- **Stale** - Tests changed since last AI assessment
- **Verified** - AI assessed and tests unchanged
- **Orphaned tests** - Tests not linked to any requirement
- **Ignored tests** - Tests intentionally not linked
- **Unanswered questions** - Requirements with pending questions
- **Priority breakdown** - Count by priority level (if any priorities set)
- **Dependency issues** - "Done" requirements blocked by "planned" dependencies
- **Unverified NFRs** - Non-functional requirements not yet verified

### Assess Test Coverage

```bash
req assess <path> --result '{"sufficient": bool, "notes": "..."}'
```

Updates AI assessment for a requirement. Called by AI after analyzing test coverage. This command also **updates test hashes** to their current values, ensuring the assessment is tied to the actual test code that was evaluated.

```bash
req assess auth/REQ_login.yml --result '{"sufficient": true, "notes": "Tests cover happy path and error cases"}'
req assess payments/REQ_checkout.yml --result '{"sufficient": false, "notes": "Missing test for payment timeout scenario"}'
```

### Ignore Test

```bash
req ignore-test <file:identifier> --reason "..."
```

Marks a test as intentionally not linked to any requirement. Useful for utility tests, setup/teardown, or infrastructure tests that don't map to specific requirements.

```bash
req ignore-test src/utils.test.ts:helper function tests --reason "Utility tests don't map to requirements"
req ignore-test src/setup.test.ts:database initialization --reason "Infrastructure test"
```

Ignored tests are stored in `.requirements/ignored-tests.yml` and won't appear in orphaned test reports.

### Unignore Test

```bash
req unignore-test <file:identifier>
```

Removes a test from the ignored list.

```bash
req unignore-test src/utils.test.ts:helper function tests
```

## Verification Status

Requirements have a verification status based on tests and AI assessment:

| Status | Meaning | Action |
|--------|---------|--------|
| **n/a** | No tests linked | Link tests with `req link` |
| **unverified** | Has tests, no AI assessment | Run `req assess` |
| **verified** | AI assessed, tests unchanged | None needed |
| **stale** | Tests changed since assessment | Re-run `req assess` |

**Key insight:** A requirement with tests but no assessment is "unverified", not "stale". Stale means the AI assessed it but the tests have since changed.

## Test Hashing and Caching

- The CLI extracts test function bodies and computes SHA-256 hashes
- Hashes are cached in `.requirements/cache.json` for performance
- When a test is modified, its hash changes
- Changed hashes mark the requirement as stale
- Use `--no-cache` flag to force re-extraction and refresh hashes

## Workflow for AI Assistants

When asked to assess test coverage:

1. Run `req check --json` to get current status
2. For each **unverified** or **stale** requirement:
   a. Read the requirement's gherkin from the file
   b. Read the linked test file(s)
   c. Analyze if tests adequately cover the requirement
   d. Call `req assess` with your assessment

Example assessment workflow:

```bash
# Get status
req check --json

# Read the requirement file to see full gherkin
cat .requirements/auth/REQ_login.yml

# Read the test file
cat src/auth.test.ts

# After analysis, update assessment
req assess auth/REQ_login.yml --result '{"sufficient": true, "notes": "Test covers login validation including edge cases for empty fields and invalid format"}'
```

## Best Practices

1. **Write requirements before tests** - Define gherkin requirements first, then write tests to satisfy them
2. **Link tests as you write them** - Use `req link` immediately when creating tests
3. **Run `req check` regularly** - Catch staleness and missing coverage early
4. **Use folders for organization** - Group related requirements (auth/, payments/, etc.)
5. **Keep gherkin focused** - One scenario per requirement; create multiple files for edge cases
6. **Always provide sources** - Never create requirements without documenting origin
7. **Use ignored tests appropriately** - Mark utility/infrastructure tests that don't map to requirements
