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
| `/sedd.report` | Generating HTML/PDF feature report |
| `/sedd.dashboard` | Status overview of clarifications |

## CRITICAL RULES

- **NUNCA fazer commit nem push** — o usuário controla o git, decide quando commitar e quando fazer push
- **NUNCA sugerir parar** por ter "muitas mudanças", "muitos arquivos", ou "sessão longa" — o usuário decide quando parar
- **NUNCA perguntar** "quer commitar?", "quer ver amanhã?", "já temos bastante coisa" — apenas continue trabalhando
- **Architecture Contract é IMUTÁVEL** — respeitar tech stack, patterns, locations e shared contracts definidos no `/sedd.specify`

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
- `.claude/commands/` - Skill templates (local, markdown)
- `.claude/hooks/` - Claude Code hooks (local, JS)
- `.sedd/templates/` - User-facing templates (local copy)
- `commands/` - Skill templates (distributable, npm package)
- `hooks/` - Claude Code hooks (distributable, npm package)
- `templates/` - User-facing templates (distributable, npm package)

**IMPORTANT:** When editing commands, hooks, or templates, always keep ALL copies in sync:
- Commands: `.claude/commands/` ↔ `commands/`
- Hooks: `.claude/hooks/` ↔ `hooks/`
- Templates: `.sedd/templates/` ↔ `templates/`
