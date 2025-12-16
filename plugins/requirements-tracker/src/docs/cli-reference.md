# CLI Reference

Complete reference for all `req` commands.

## Global Options

Available for all commands:

| Option | Description |
|--------|-------------|
| `--cwd <path>` | Run in specified directory (default: current directory) |
| `--help`, `-h` | Show help message |

## Commands

### req init

Create `.requirements/` folder with configuration.

```bash
req init [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--test-runner <cmd>` | Test runner command (default: `bun test`) |
| `--test-glob <glob>` | Test file glob (default: `**/*.test.{ts,js}`) |
| `--force` | Overwrite existing config |

**Examples:**
```bash
req init
req init --test-runner "npm test" --test-glob "**/*.spec.ts"
req init --force
```

---

### req add

Create a new requirement.

```bash
req add <path> --gherkin "..." --source-type <type> --source-desc "..." [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `<path>` | Requirement path (e.g., `auth/REQ_login.yml`) |

**Required Options:**
| Option | Description |
|--------|-------------|
| `--gherkin` | Gherkin-format requirement (Given/When/Then) |
| `--source-type` | Source type: `doc`, `slack`, `email`, `meeting`, `ticket`, `manual` |
| `--source-desc` | Description of the source |

**Optional:**
| Option | Description |
|--------|-------------|
| `--source-url` | URL to source |
| `--source-date` | Date (ISO format) |
| `--force` | Overwrite if exists |

**Examples:**
```bash
req add auth/REQ_login.yml \
  --gherkin "Given a user with valid credentials When they submit Then they are logged in" \
  --source-type doc \
  --source-desc "PRD v2.1" \
  --source-url "https://docs.example.com/prd"
```

---

### req link

Link a test to a requirement.

```bash
req link <path> <file:identifier>
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `<path>` | Requirement path |
| `<file:identifier>` | Test file and test name |

**Examples:**
```bash
req link auth/REQ_login.yml src/auth.test.ts:validates login
req link payments/REQ_refund.yml tests/payments.test.ts:handles refund
```

---

### req unlink

Remove a test link from a requirement.

```bash
req unlink <path> <file:identifier>
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `<path>` | Requirement path |
| `<file:identifier>` | Test file and test name |

**Examples:**
```bash
req unlink auth/REQ_login.yml src/auth.test.ts:validates login
```

---

### req status

Get or set implementation status.

```bash
req status <path> [--done | --planned]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `<path>` | Requirement path |

**Options:**
| Option | Description |
|--------|-------------|
| `--done` | Mark as implemented |
| `--planned` | Mark as not implemented |

With no flags, shows current status.

**Examples:**
```bash
req status auth/REQ_login.yml              # Show current status
req status auth/REQ_login.yml --done       # Mark as implemented
req status auth/REQ_login.yml --planned    # Mark as not implemented
```

---

### req check

Check test coverage and verification status.

```bash
req check [path] [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `[path]` | Optional path filter (e.g., `auth/` or `auth/REQ_login.yml`) |

**Options:**
| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--no-cache` | Skip cache |

**Output includes:**
- Untested requirements (no tests linked)
- Unverified requirements (has tests, no AI assessment)
- Stale requirements (tests changed since assessment)
- Verified requirements (AI assessed, tests unchanged)
- Orphaned tests (not linked to any requirement)

**Examples:**
```bash
req check              # Check all requirements
req check auth/        # Check only auth/ folder
req check --json       # Output as JSON
```

---

### req assess

Update AI assessment for a requirement.

```bash
req assess <path> --result '{"sufficient": bool, "notes": "..."}'
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `<path>` | Requirement path |

**Options:**
| Option | Description |
|--------|-------------|
| `--result` | JSON object with `sufficient` (bool) and `notes` (string) |

**Full result format:**
```json
{
  "sufficient": true,
  "notes": "Tests cover happy path and error cases",
  "testComments": [
    {
      "file": "src/auth.test.ts",
      "identifier": "validates login",
      "comment": "Good coverage"
    }
  ],
  "suggestedTests": [
    {
      "description": "Rate limiting test",
      "rationale": "Security requirement"
    }
  ]
}
```

**Examples:**
```bash
req assess auth/REQ_login.yml --result '{"sufficient": true, "notes": "Good coverage"}'
```

---

### req ignore-test

Mark a test as intentionally not linked to any requirement.

```bash
req ignore-test <file:identifier> --reason "..."
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `<file:identifier>` | Test file and test name |

**Options:**
| Option | Description |
|--------|-------------|
| `--reason` | Explanation for why this test doesn't need a requirement |

**Examples:**
```bash
req ignore-test src/helpers.test.ts:utility function --reason "Helper function, no business requirement"
```

---

### req unignore-test

Remove a test from the ignored list.

```bash
req unignore-test <file:identifier>
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `<file:identifier>` | Test file and test name |

**Examples:**
```bash
req unignore-test src/helpers.test.ts:utility function
```

---

### req ui

Start web UI for viewing requirements.

```bash
req ui [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--port <number>` | Port to run server on (default: 3000) |

**Examples:**
```bash
req ui
req ui --port 8080
```

---

### req docs

Open documentation in browser.

```bash
req docs [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--port <number>` | Port to run server on (default: 3000) |

**Examples:**
```bash
req docs
req docs --port 8080
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (invalid args, file not found, etc.) |
