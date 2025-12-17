# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains Claude Code plugins using the `strict: false` pattern (no per-plugin plugin.json files). Plugins are defined in `.claude-plugin/marketplace.json` with explicit skill paths.

## Commands

**Type checking (from plugin directory):**
```bash
bun run typecheck
```

## Versioning

When bumping plugin versions, update **both** of these files:

1. `plugins/<plugin-name>/package.json` - NPM package version
2. `.claude-plugin/marketplace.json` - Marketplace `metadata.version` field

Both must be kept in sync.

## Architecture

### Plugin Structure

This repo uses Anthropic's plugin pattern with `strict: false`:
```
.claude-plugin/
└── marketplace.json     # Defines all plugins with strict: false and explicit skills

plugins/<plugin-name>/
├── package.json         # NPM dependencies and version
├── tsconfig.json        # TypeScript config
├── commands/            # Slash command definitions (.md files)
├── skills/              # Skill definitions (SKILL.md files)
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
