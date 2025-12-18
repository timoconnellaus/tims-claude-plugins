---
name: docs-skill
description: Manage AI-ready documentation for projects. Use when setting up docs in a project, searching for available documentation, configuring which docs to sync, or pulling docs into a .docs folder. Triggers on "add docs", "setup docs", "search docs", "pull docs", or documentation configuration tasks.
---

# docs-skill

A skill for managing AI-ready documentation. This skill helps you:

## Installation

If the `docs` command is not available, install it with:

```bash
curl -fsSL https://raw.githubusercontent.com/timoconnellaus/tims-claude-plugins/main/scripts/install.sh | bash
```

This installs the `docs` CLI to `~/.local/bin`. Make sure this directory is in your PATH.

To update to the latest version:

```bash
docs upgrade
```

## Overview

This skill helps you:

1. **Set up docs** in a project with `docs init`
2. **Search** available documentation with `docs search`
3. **Configure** which docs you want with `docs config`
4. **Pull** docs into your project with `docs pull`

## Quick Start

```bash
# Initialize .docs folder in your project
docs init

# Search for available documentation
docs search routing
docs search "data fetching"

# Add topic patterns (gitignore-style)
docs config --add "nextjs/**"           # Include all Next.js docs
docs config --add "!nextjs/legacy/*"    # Exclude legacy docs

# Verify your selection
docs check

# Pull docs to your project
docs pull
```

## Commands

### User Commands

| Command | Description |
|---------|-------------|
| `docs init` | Create .docs/ folder with config.yml |
| `docs search <query>` | Search available docs by topic, title, or tags |
| `docs config` | View current topic patterns |
| `docs config --add "<pattern>"` | Add a topic pattern |
| `docs config --remove "<pattern>"` | Remove a topic pattern |
| `docs check` | Validate patterns against available docs |
| `docs pull` | Sync matching docs to .docs/ folder |

### Maintainer Commands

| Command | Description |
|---------|-------------|
| `docs validate [source]` | Validate documentation files |
| `docs sync [source]` | Build docs from external sources |

## Topic Patterns

Patterns use gitignore-style syntax:

| Pattern | Meaning |
|---------|---------|
| `nextjs/**` | Include all topics under nextjs/ |
| `nextjs/*` | Include only direct children |
| `!nextjs/legacy/*` | Exclude topics matching pattern |
| `nextjs/routing` | Include exact topic |

**Important:** Order matters! Later patterns override earlier ones.

### Example Configuration

```yaml
# .docs/config.yml
version: 1
topics:
  - "nextjs/**"              # Include all Next.js
  - "!nextjs/legacy/*"       # But exclude legacy
  - "react/hooks/*"          # Include React hooks only
```

## Workflow

### For Users (Adding Docs to Your Project)

1. **Initialize**: `docs init` creates `.docs/config.yml`
2. **Search**: `docs search <term>` to find what's available
3. **Configure**: `docs config --add "pattern"` to select docs
4. **Check**: `docs check` to verify your selection
5. **Pull**: `docs pull` to sync docs to your project

### For Maintainers (Adding New Doc Sources)

1. Create a folder in `docs/` (e.g., `docs/nextjs/`)
2. Create `sync-docs.ts` implementing the sync contract
3. Run `docs sync nextjs` to build docs
4. Run `docs validate nextjs` to check validity

## Documentation Format

All documentation files must have YAML frontmatter:

```yaml
---
topic: nextjs/routing/dynamic-routes
title: Dynamic Routes
description: Learn how to create dynamic routes in Next.js
version: "15.0"
sourceUrl: "https://nextjs.org/docs/..."
tags:
  - routing
  - dynamic
---

# Content here...
```

### Validation Rules

- **Frontmatter required**: Every .md file must have YAML frontmatter
- **Topic required**: Must include `topic` field (lowercase, / separators)
- **Title required**: Must include `title` field
- **Line limit**: Max 1000 lines per file (excluding frontmatter)

## Best Practices

1. **Start specific**: Begin with patterns for exactly what you need
2. **Use exclusions**: Add `!` patterns to exclude irrelevant topics
3. **Check before pull**: Always run `docs check` to verify selection
4. **Update regularly**: Run `docs pull` to get updated docs

## File Structure

```
your-project/
  .docs/
    config.yml              # Your topic patterns
    nextjs/                 # Synced documentation
      routing.md
      data-fetching/
        server-components.md
        ...
```
