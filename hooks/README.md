# SEDD Hooks

Assertive hooks for SEDD (Spec & Expectation Driven Development).

## Configuration

Hooks read from `sedd.config.json` at project root:

```json
{
  "specsDir": "specs",
  "hooks": {
    "assertive": true,
    "skills": ["langchain-expert", "architecture-mapper", "defect-analyzer"],
    "checkOnlyCurrentMigration": true,
    "showSyncWarnings": true,
    "blockOnSyncError": false
  }
}
```

### Hook Options

| Option | Default | Description |
|--------|---------|-------------|
| `checkOnlyCurrentMigration` | `true` | Only check current migration, not historical |
| `showSyncWarnings` | `true` | Show warnings when files are out of sync |
| `blockOnSyncError` | `false` | Block Claude from stopping if files are out of sync |

---

## Hooks Overview

| Hook | Type | Purpose |
|------|------|---------|
| `check-roadmap.js` | UserPromptSubmit | Force skills, track tasks, suggest commands |
| `post-tool-use.js` | PostToolUse | Validate sync after editing SEDD files |
| `stop.js` | Stop | (Optional) Block stopping if files out of sync |

---

## check-roadmap.js

**Type:** `UserPromptSubmit`

**Purpose:**
1. **FORCE** skill activation (not just suggest)
2. Track migration tasks from SEDD structure (only current migration)
3. Suggest SEDD commands when relevant
4. Warn about file sync issues

### Skill Activation

The hook detects keywords and **FORCES** skills into context:

| Skill | Triggers |
|-------|----------|
| **langchain-expert** | langchain, langgraph, agent, tool, graph, checkpoint, stategraph |
| **architecture-mapper** | arquitetura, architecture, estrutura, flow, fluxo, diagram |
| **defect-analyzer** | bug, erro, error, não funciona, debug, crash, exception |

### Output Example

```xml
<sedd-context>
**Branch: 023-agent-executor** | Migration: 004 | Progress: 5/10 tasks

🎯 **EXPECTATIVA:** User can toggle dark mode and have it persist across sessions

⛔ **NÃO DEVE:**
- ❌ Criar endpoint no serviço X
- ❌ Usar localStorage (usar banco)

Pending tasks:
- T004-001: Create ThemeContext
- T004-002: Add toggle component
... and 3 more
</sedd-context>
```

### Expectation Reminder

O hook **sempre mostra a EXPECTATIVA** do `_meta.json` para lembrar a AI do objetivo final. Isso garante que todas as ações estejam alinhadas com o que o usuário espera.

### Structured Expectations

O hook suporta expectativas estruturadas com `must` e `mustNot`:

```json
{
  "expectation": {
    "summary": "User can toggle dark mode",
    "must": ["Criar toggle", "Persistir no banco"],
    "mustNot": ["Criar endpoint no serviço X", "Usar localStorage"]
  }
}
```

Quando `mustNot` está presente, o hook exibe as restrições em destaque para que a AI **nunca as viole**.

---

## post-tool-use.js

**Type:** `PostToolUse` (matcher: `Edit|Write`)

**Purpose:**
- Validates sync after Edit/Write operations on SEDD files
- Only checks current migration (not historical)
- Warns if `_meta.json` and `tasks.md` counts don't match

### When It Triggers

- After editing `_meta.json`, `tasks.md`, or `progress.md`
- Only if migration status is not `completed`

---

## stop.js (Optional)

**Type:** `Stop`

**Purpose:**
- Prevents Claude from stopping if files are out of sync
- **DISABLED by default** (`blockOnSyncError: false`)

### Enable Blocking

```json
{
  "hooks": {
    "blockOnSyncError": true
  }
}
```

### When It Blocks

- Current migration status is `in-progress`
- `tasks.md` has 0 pending tasks (all marked `[x]`)
- But `_meta.json` still shows `in-progress`

---

## Claude Settings Configuration

In `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/check-roadmap.js\"",
            "timeout": 10
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/post-tool-use.js\"",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/stop.js\"",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

---

## SEDD Structure Support

The hooks understand this structure:

```
specs/023-feature/
├── _meta.json          ← Hook reads migration status
├── spec.md
├── interfaces.ts
├── 001_timestamp/
│   └── tasks.md        ← Hook reads tasks (if migration 001)
├── 002_timestamp/
│   └── tasks.md        ← Hook reads tasks (if migration 002)
├── 003_timestamp/
│   └── tasks.md        ← Hook reads tasks (if current migration)
└── progress.md
```

### Key Behavior

- **Only checks current migration** (set in `_meta.json.currentMigration`)
- **Skips completed migrations** (no warnings for historical tasks)
- **Uses `_meta.json` as source of truth** for completion counts

---

## Prompts Ignored

The hook skips:
- Slash commands (`/commit`, `/help`, `/sedd.*`)
- Greetings (`oi`, `hello`, `hey`)
- Confirmations (`sim`, `ok`, `yes`, `no`)
- Answers (`Q1: A`, `B`, `C`)
- `continue`, `prossiga`

---

## Disable Hooks

```bash
# Temporarily disable all hooks
mv .claude/settings.json .claude/settings.json.disabled

# Or disable sync warnings only (in sedd.config.json)
{
  "hooks": {
    "showSyncWarnings": false
  }
}
```
