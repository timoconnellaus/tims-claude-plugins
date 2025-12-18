---
topic: tims-claude-skills/getting-started
title: Getting Started
description: How to use Tim's Claude Skills repository
---

# Getting Started

This repository contains Claude Code plugins using the `strict: false` pattern.

## Available Plugins

- **requirements-tracker**: A CLI tool for tracking project requirements with test coverage verification
- **docs-skill**: Documentation management for AI agents

## Installation

Plugins are installed via Claude Code's plugin system. See individual plugin READMEs for specific installation instructions.

## Development

Each plugin is located in `plugins/<plugin-name>/` with its own `package.json` and `tsconfig.json`.

To type-check a plugin:

```bash
cd plugins/<plugin-name>
bun run typecheck
```
