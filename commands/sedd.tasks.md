# /sedd.tasks - Generate Tasks

## Purpose
Add tasks to the current migration. Usually called after /sedd.clarify to populate tasks.md.

## Trigger
User runs `/sedd.tasks`

## Pre-flight Checks

1. **Read sedd.config.json** to get `specsDir` (default: `.sedd`, legacy: `specs`)
   ```
   Read sedd.config.json → specsDir = "specs" or ".sedd"
   ```

2. **Get current branch** from git
   ```
   git rev-parse --abbrev-ref HEAD → "023-agent-executor"
   ```

3. **Find feature directory**
   ```
   {specsDir}/{branch}/ → specs/023-agent-executor/
   ```

4. **Load _meta.json** to get current migration

5. **Verify current migration exists** (run /sedd.clarify first)

## CRITICAL RULE

⚠️ **NOTHING HAPPENS WITHOUT A TASK**
- Every action must be a task in tasks.md
- NEVER skip task registration
- ALWAYS update task status before/after work

## Workflow

### Step 1: Load Context

Read from feature directory:
- `spec.md` (requirements)
- `interfaces.ts` (entities)
- `{currentMigration}/clarify.md` (clarifications)
- `{currentMigration}/decisions.md` (decisions)

### Step 2: Extract Work Items

From spec.md:
- Each User Story → Task group
- Each Functional Requirement → Task
- Each Entity in interfaces.ts → CRUD tasks

From decisions.md:
- Each decision with implementation impact → Task

### Step 3: Generate Task IDs

Tasks are prefixed with migration ID:

```
T{migration}-{sequence}

T001-001 = Migration 001, Task 1
T001-002 = Migration 001, Task 2
T002-001 = Migration 002, Task 1
```

### Step 4: Create Task Categories

| Category | Description |
|----------|-------------|
| Foundation | Infrastructure, base setup |
| US{N} | User Story implementation |
| Integration | External services |
| Tests | Unit, integration tests |

### Step 5: Write tasks.md

Append to `{currentMigration}/tasks.md`:

```markdown
# Tasks - Migration 001

Migration: 001
Timestamp: 2026-01-11_10-30-45
Parent: (none)

## Summary
Total: 8 | Completed: 0 | Pending: 8

## Tasks

### Foundation
- [ ] T001-001 [Foundation] Create database migration for new tables
- [ ] T001-002 [Foundation] Set up API route structure

### US1: Dark Mode Toggle
- [ ] T001-003 [US1] Create ThemeContext with localStorage persistence
- [ ] T001-004 [US1] Build ThemeToggle component
- [ ] T001-005 [US1] Add toggle to settings page

### US2: Theme Sync
- [ ] T001-006 [US2] Create user preference API endpoint
- [ ] T001-007 [US2] Implement cross-device sync

### Tests
- [ ] T001-008 [Tests] Write unit tests for ThemeContext

## Dependencies

T001-001, T001-002 → T001-003 → T001-004 → T001-005
                    → T001-006 → T001-007
T001-003 → T001-008
```

### Step 6: Update _meta.json

```json
{
  "migrations": {
    "001": {
      "tasksTotal": 8,
      "tasksCompleted": 0,
      "status": "in-progress"
    }
  }
}
```

### Step 7: Ask About Commit

```
Tasks generated! 8 tasks in migration 001.

Do you want to commit?
Message: "docs(024): add tasks for migration 001"
```

## Task Format

```
- [ ] T{MIG}-{SEQ} [{CATEGORY}] {Description} `{file_path}` (optional)
```

Examples:
```
- [ ] T001-001 [Foundation] Create ThemeContext `src/contexts/ThemeContext.tsx`
- [ ] T001-002 [US1] Add dark mode toggle to header
- [x] T001-003 [Tests] Write unit tests for ThemeContext
```

## Rules

- Tasks MUST have migration prefix (T001-XXX)
- Tasks MUST have category in brackets
- File paths are optional but recommended
- Update task count in _meta.json
- Tasks can span multiple migrations

## CLI Alternative

For automated workflows, use the SEDD CLI:

```bash
# Add tasks to current migration
sedd tasks '[{"story":"US1","description":"Create component"},{"story":"US2","description":"Add API"}]'

# Mark task complete
sedd complete T001-001

# View status
sedd status
```

Scripts also available in `.sedd/scripts/powershell/sedd-tasks.ps1`.
