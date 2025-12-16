# Architecture

This document describes the system architecture, data structures, and file organization.

## Directory Structure

All requirements data lives in `.requirements/` at your project root:

```
your-project/
├── .requirements/
│   ├── config.yml              # Configuration
│   ├── cache.json              # Test extraction cache
│   ├── ignored-tests.yml       # Tests intentionally not linked
│   ├── auth/
│   │   ├── REQ_login.yml       # A requirement
│   │   └── REQ_signup.yml
│   └── payments/
│       └── REQ_refund.yml
├── src/
│   └── auth.test.ts            # Your test files
└── ...
```

## File Formats

### config.yml

```yaml
testRunner: "bun test"
testGlob: "**/*.test.{ts,js}"
```

| Field | Description |
|-------|-------------|
| `testRunner` | Command to run tests |
| `testGlob` | Pattern to find test files |

### Requirement File (REQ_*.yml)

```yaml
gherkin: |
  Given a user with valid credentials
  When they submit the login form
  Then they are authenticated

source:
  type: doc
  description: "PRD v2.1"
  url: "https://docs.example.com/prd"
  date: "2024-01-15"

status: done

tests:
  - file: "src/auth.test.ts"
    identifier: "validates login credentials"
    hash: "abc123..."

aiAssessment:
  sufficient: true
  notes: "Tests cover happy path and error cases"
  assessedAt: "2024-01-20T10:30:00Z"
  testComments:
    - file: "src/auth.test.ts"
      identifier: "validates login credentials"
      comment: "Good coverage of authentication flow"
  suggestedTests:
    - description: "Rate limiting after failed attempts"
      rationale: "Security requirement not yet tested"

questions:
  - question: "Should we support SSO?"
    answer: "Yes, in phase 2"
    answeredAt: "2024-01-18T14:00:00Z"
```

### ignored-tests.yml

```yaml
tests:
  - file: "src/helpers.test.ts"
    identifier: "utility function"
    reason: "Helper function, no business requirement"
    ignoredAt: "2024-01-15T09:00:00Z"
```

## Data Types

### Source Types

| Type | Use For |
|------|---------|
| `doc` | Documentation (PRD, spec) |
| `slack` | Slack conversations |
| `email` | Email threads |
| `meeting` | Meeting notes |
| `ticket` | Issue tracker (Jira, Linear) |
| `manual` | Manually identified requirements |

### Implementation Status

| Status | Meaning |
|--------|---------|
| `planned` | Requirement defined, not implemented |
| `done` | Requirement implemented |

### Verification Status

Computed at runtime based on test links and AI assessment:

| Status | Condition |
|--------|-----------|
| `n/a` | No tests linked |
| `unverified` | Has tests, no AI assessment |
| `verified` | Has AI assessment, test hashes match |
| `stale` | Has AI assessment, test hashes changed |

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Web UI                                │
│  ┌──────────────┬───────────────────┬──────────────────┐   │
│  │ Requirements │   Detail View      │  Chat Assistant  │   │
│  │    List      │                    │                  │   │
│  └──────────────┴───────────────────┴──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                                       │
         ▼                                       ▼
┌─────────────────┐                   ┌─────────────────────┐
│   Bun Server    │                   │  Claude Agent SDK   │
│  /api/requirements                  │   Chat Handler      │
│  /api/events (SSE)                  │                     │
│  /api/chat                          │                     │
│  /api/docs                          │                     │
└─────────────────┘                   └─────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                      File System                             │
│  .requirements/                                              │
│  ├── config.yml                                              │
│  ├── cache.json                                              │
│  ├── ignored-tests.yml                                       │
│  └── **/*.yml (requirements)                                 │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Loading Requirements

1. Server reads all `REQ_*.yml` files from `.requirements/`
2. Extracts tests from codebase using `testGlob`
3. Computes verification status by comparing hashes
4. Groups requirements by folder path
5. Identifies orphaned tests (not linked, not ignored)
6. Returns structured data to UI

### Live Updates

1. Server watches `.requirements/` and test directories
2. On file change, broadcasts "refresh" via SSE
3. UI receives event, re-fetches data
4. UI updates without page reload

### Chat Flow

1. User sends message to `/api/chat`
2. Server creates Claude conversation with context
3. Claude can use tools (read files, run CLI commands)
4. Responses stream back via SSE
5. Tool results appear in UI

## Test Hashing

Tests are identified by a SHA-256 hash of their body:

```typescript
// Extract test body from AST
const testBody = extractTestBody(file, identifier);

// Compute hash
const hash = createHash("sha256")
  .update(testBody)
  .digest("hex")
  .slice(0, 16);
```

This enables:
- Detecting when tests change
- Marking assessments as stale
- Tracking test evolution over time

## Plugin Structure

```
requirements-tracker/
├── plugin.json           # Plugin manifest
├── package.json          # Dependencies
├── commands/             # Slash command definitions
├── skills/               # Skill definitions
└── src/
    ├── cli.ts            # CLI entrypoint
    ├── commands/         # Command implementations
    ├── lib/              # Shared utilities
    │   ├── types.ts      # TypeScript types
    │   ├── store.ts      # File I/O
    │   └── test-parser.ts
    ├── docs/             # Documentation (this!)
    └── ui/               # Web UI
        ├── app.tsx       # Main React app
        ├── server.ts     # Bun server
        ├── components/   # UI components
        ├── chat/         # Chat integration
        └── shadcn/       # UI primitives
```
