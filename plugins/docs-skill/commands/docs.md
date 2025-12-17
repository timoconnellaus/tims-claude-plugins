# /docs

Manage AI-ready documentation for your project.

## Usage

```
/docs <command> [options]
```

## Commands

### User Commands

- `docs init` - Create .docs/ folder with config
- `docs search <query>` - Search available docs and topics
- `docs config` - View or modify topic patterns
- `docs check` - Validate config against available docs
- `docs pull` - Sync configured docs to .docs/ folder

### Maintainer Commands

- `docs validate [source]` - Validate docs in a source folder
- `docs sync [source]` - Build docs from sources

## Quick Start

```bash
docs init
docs search routing
docs config --add "nextjs/**"
docs check
docs pull
```

## Pattern Syntax

- `nextjs/**` - Include all topics under nextjs/
- `nextjs/*` - Include only direct children
- `!nextjs/legacy/*` - Exclude with ! prefix
- `nextjs/routing` - Exact match

Order matters: later patterns override earlier ones.
