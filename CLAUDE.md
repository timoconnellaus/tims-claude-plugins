# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains Claude Code plugins. Each plugin is a self-contained package in `plugins/` with its own `plugin.json` manifest.

## Commands

**Type checking (from plugin directory):**
```bash
bun run typecheck
```

## Architecture

### Plugin Structure

Each plugin follows this structure:
```
plugins/<plugin-name>/
├── plugin.json          # Plugin manifest (name, version, commands, skills)
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── commands/            # Slash command definitions (.md files)
├── skills/              # Skill definitions (.md files)
└── src/
    ├── cli.ts           # CLI entrypoint
    ├── commands/        # Command implementations
    └── lib/             # Shared utilities and types
```

### requirements-tracker Plugin

A CLI tool for tracking project requirements with test coverage verification.

**Data files (created in target project root):**
- `requirements.json` - Active requirements with test links and history
- `requirements.archive.json` - Archived requirements

**Key types** (`src/lib/types.ts`):
- `Requirement` - Core requirement with description, source, tests, and history
- `RequirementsFile` - Top-level file structure with config and requirements map
- `TestLink` - Links requirement to test file:identifier with runner
- `SourceType` - Origin tracking: `doc | ai | slack | jira | manual`

**CLI commands** (`src/commands/`): init, add, list, link, unlink, check, archive, restore, history

**Store** (`src/lib/store.ts`): Handles JSON file I/O, ID generation (REQ-XXX format), and history entries
