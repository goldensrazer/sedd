# SEDD - Spec & Expectation Driven Development

## Project Overview

SEDD is a CLI tool and Claude Code skill system for structured feature development. It enforces a workflow: **specify → clarify → tasks → implement → validate**.

## SEDD Skills

Always use the appropriate skill when the task matches:

| Skill | When to Use |
|-------|-------------|
| `/sedd.specify` | Creating a new feature specification |
| `/sedd.clarify` | Clarifying requirements & generating migration |
| `/sedd.tasks` | Generating tasks from a clarification |
| `/sedd.implement` | Executing implementation tasks |
| `/sedd.validate` | Validating implementation against expectation |
| `/sedd.estimate` | Estimating effort for tasks or features |
| `/sedd.story` | Creating a GitHub Issue as user story |
| `/sedd.board` | Viewing the Kanban board |
| `/sedd.dashboard` | Status overview of clarifications |

## Conventions

- **Branch naming**: `{NNN}-{feature-name}` (e.g., `001-auth-system`)
- **Specs directory**: `.sedd/` (configurable via `sedd.config.json`)
- **Task IDs**: `T{migration}-{sequence}` (e.g., `T001-005`)
- **Migration folders**: `{NNN}_{timestamp}/` inside feature dir
- **Tracking files**: `tasks.md`, `progress.md`, `_meta.json` per feature

## Tech Stack

- **Runtime**: Node.js / Bun
- **Language**: TypeScript
- **Build**: tsup (dual CJS/ESM)
- **Package manager**: npm
- **Tests**: vitest

## Key Directories

- `src/cli/` - CLI command handlers
- `src/core/` - Core logic (board-manager, etc.)
- `src/utils/` - Utilities (github.ts, etc.)
- `src/types/` - TypeScript type definitions
- `.claude/commands/` - Skill templates (markdown)
- `.claude/hooks/` - Claude Code hooks (JS)
- `.sedd/` - Feature specs and templates
