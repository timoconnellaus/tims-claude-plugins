# Todo App Example

A simple todo app demonstrating how to use the requirements-tracker plugin.

## Setup

```bash
cd examples/todo-app
bun install
```

## Running Tests

```bash
bun test
```

## Requirements Tracking

This project uses requirements-tracker to link requirements to tests.

### View Requirements (CLI)

```bash
# List all requirements
bun run req list

# Check coverage
bun run req check

# View specific requirement history
bun run req history REQ-001

# Check for orphan tests (tests not linked to requirements)
bun run req check --orphans

# Run tests and update verification status
bun run req check --run
```

### View Requirements (Web UI)

```bash
bun run req:serve
# Open http://localhost:3000
```

## Requirements Summary

| ID | Description | Status |
|----|-------------|--------|
| REQ-001 | User can add a new todo item | Verified |
| REQ-002 | Empty todo titles should be rejected | Verified |
| REQ-003 | User can mark a todo as completed | Verified |
| REQ-004 | User can unmark a completed todo | Tests linked |
| REQ-005 | User can delete a todo | Verified |
| REQ-006 | User can filter todos by status | Verified |
| REQ-007 | User can clear all completed todos | Verified |
| REQ-008 | User can view todo statistics | Verified |
| REQ-009 | User can edit a todo title | Verified |
| REQ-010 | Todo due dates and reminders | Untested (v2) |
| REQ-011 | Todo categories and tags | Untested (v2) |

## Project Structure

```
todo-app/
├── src/
│   └── todo.ts              # Todo module implementation
├── tests/
│   └── todo.test.ts         # Unit tests (26 tests)
├── requirements.json        # Requirements with test links
├── package.json
└── README.md
```
