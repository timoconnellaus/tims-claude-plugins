---
name: requirements-tracker
description: Track feature requirements with test coverage verification. Use when creating features, linking tests, assessing coverage, or checking staleness. Triggers on "track requirements", "link test to requirement", "check coverage", "assess tests".
---

# Requirements Tracker

A local YAML-based system for tracking feature requirements with test coverage.

## Folder Structure

Requirements live in `.requirements/` at the project root:

```
.requirements/
├── config.yml              # Test runner configuration
├── FEAT_001_user-auth.yml  # Feature files
├── FEAT_002_payments.yml
└── ...
```

## Feature File Format

Feature files are YAML with this structure:

```yaml
name: User Authentication
description: Handles user login, logout, and session management

requirements:
  1:
    gherkin: |
      Given a registered user
      When they enter valid credentials
      Then they should be logged in
    source:
      type: doc
      description: "Authentication PRD v2.1, Section 3.1"
      url: "https://docs.example.com/auth-prd"
    tests:
      - file: src/auth.test.ts
        identifier: "validates login credentials"
        hash: abc123...
    aiAssessment:
      sufficient: true
      notes: "Tests cover happy path and error handling"
      assessedAt: 2024-01-15T10:30:00Z

  2:
    gherkin: |
      Given an invalid password
      When the user attempts to login
      Then they should see an error message
    source:
      type: slack
      description: "Thread with @sarah about error handling"
      url: "https://slack.com/archives/C123/p456"
      date: "2024-01-10"
    tests: []
    questions:
      - question: "How many failed attempts before lockout?"
        answer: "3 attempts within 15 minutes"
        answeredAt: 2024-01-15T11:00:00Z
      - question: "Should we show different messages for wrong email vs wrong password?"

  2.1:
    gherkin: |
      Given a locked account
      When the user attempts to login
      Then they should see a locked account message
    source:
      type: meeting
      description: "Security review meeting 2024-01-12"
    tests: []
```

### Creating Feature Files

Feature files are created **manually** (not via CLI). The naming convention is:

```
FEAT_NNN_descriptive-name.yml
```

Where NNN is a zero-padded number (001, 002, etc.).

### Requirement IDs

- Use integers for main requirements: 1, 2, 3
- Use decimals for sub-requirements or late additions: 1.1, 2.1, 2.2

### Sources (REQUIRED)

Every requirement MUST have a source indicating where it came from. **AI assistants must NEVER guess or fabricate sources.** If the source is unknown, ask the user.

Source types:
- `doc` - Documentation (PRD, spec, RFC, etc.)
- `slack` - Slack message or thread
- `email` - Email correspondence
- `meeting` - Meeting notes or discussion
- `ticket` - Issue tracker (Jira, Linear, GitHub, etc.)
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

### Questions

Requirements can have clarification questions that need answering:

```yaml
questions:
  - question: "How many failed attempts before lockout?"
    answer: "3 attempts within 15 minutes"
    answeredAt: 2024-01-15T11:00:00Z
  - question: "Should we rate limit by IP or by account?"
    # No answer yet - will be reported by `req check`
```

The `req check` command reports unanswered questions.

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

### Link Test to Requirement

```bash
req link <feature> <req-id> <file:identifier>
```

Example:
```bash
req link user-auth 1 src/auth.test.ts:validates login credentials
```

### Check Coverage

```bash
req check [--json]
```

Reports coverage and verification status:
- **Untested** - Requirements with no linked tests
- **Unverified** - Has tests, but no AI assessment yet
- **Stale** - Tests changed since last AI assessment
- **Verified** - AI assessed and tests unchanged
- **Orphaned tests** - Tests not linked to any requirement

### Update AI Assessment

```bash
req assess <feature> <req-id> --result '{"sufficient": true, "notes": "..."}'
```

Called by AI after analyzing test coverage.

## Verification Status

Requirements have a verification status based on tests and AI assessment:

| Status | Meaning | Action |
|--------|---------|--------|
| **n/a** | No tests linked | Link tests with `req link` |
| **unverified** | Has tests, no AI assessment | Run `req assess` |
| **verified** | AI assessed, tests unchanged | None needed |
| **stale** | Tests changed since assessment | Re-run `req assess` |

**Key insight:** A requirement with tests but no assessment is "unverified", not "stale". Stale means the AI assessed it but the tests have since changed.

## Workflow for AI Assistants

When asked to assess test coverage:

1. Run `req check --json` to get current status
2. For each **unverified** or **stale** requirement:
   a. Read the requirement's gherkin from the feature file
   b. Read the linked test file(s)
   c. Analyze if tests adequately cover the requirement
   d. Call `req assess` with your assessment

Example assessment workflow:

```bash
# Get status
req check --json

# Read the feature file to see full gherkin
cat .requirements/FEAT_001_user-auth.yml

# Read the test file
cat src/auth.test.ts

# After analysis, update assessment
req assess user-auth 1 --result '{"sufficient": true, "notes": "Test covers login validation including edge cases for empty fields and invalid format"}'
```

## Test Hashing

- The CLI extracts test function bodies and computes SHA-256 hashes
- When a test is modified, its hash changes
- Changed hashes mark the requirement as stale
- Running `req check` updates hashes and clears stale AI assessments

## Best Practices

1. Write gherkin requirements before writing tests
2. Link tests as you write them with `req link`
3. Run `req check` regularly to catch staleness
4. Use sub-requirements (1.1, 1.2) for edge cases
5. Keep feature files focused (one feature per file)
