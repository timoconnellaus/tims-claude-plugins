# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run all tests
bun test

# Run a single test file
bun test tests/todo.test.ts

# Type checking
bun tsc --noEmit

# Requirements tracking (via parent plugin)
bun run req list           # List all requirements
bun run req check          # Check test coverage
bun run req check --orphans # Find tests not linked to requirements
bun run req:serve          # Start web UI at http://localhost:3000
```

## Architecture

This is a simple in-memory todo application used as an example project for the requirements-tracker plugin.

**Core module** (`src/todo.ts`): Exports functions for CRUD operations on todos using a `TodoStore` (Map-based storage). Key functions: `addTodo`, `completeTodo`, `uncompleteTodo`, `updateTodoTitle`, `deleteTodo`, `clearCompleted`, `getStats`, and filtering helpers (`listActiveTodos`, `listCompletedTodos`).

**Tests** (`tests/todo.test.ts`): Uses Bun's built-in test runner with `describe`/`test`/`expect` from `bun:test`.

## Requirements Tracking

This project demonstrates the requirements-tracker plugin. Requirements are stored in `.requirements/cache.json` and linked to specific test cases. Use `bun run req` commands to manage requirements-to-test mappings.
