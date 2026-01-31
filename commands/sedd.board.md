# /sedd.board — View Kanban Board

## Purpose
Display the kanban board for the current feature, showing task status across columns (Todo, In Progress, Done). Provides WIP limit warnings and suggests the next task to work on.

## When to Use
- To visualize the current state of tasks in a feature migration
- To check WIP limits and flow health
- To see suggestions for what to work on next
- To sync task status with GitHub Projects

## Pre-flight Checks
1. Must be in a SEDD project (`.sedd/` directory exists)
2. Must have at least one feature with tasks
3. For GitHub sync: `sedd.config.json` must have `github.engine` set to `github` or `both`

## Commands

### View current feature board
```bash
sedd board
```

### View all feature boards
```bash
sedd board --all
```

### JSON output (for programmatic use)
```bash
sedd board --json
```

### Move a task to a different column
```bash
sedd board --move T001-001 "In Progress"
sedd board --move T001-002 "Done"
```

### Sync board with GitHub
```bash
sedd board --sync
```

## Board Layout
```
Kanban: 001-my-feature (Migration 003)

Todo [2/5]           In Progress [1/3]    Done [4]
─────────────        ─────────────        ─────────
T003-004 Setup DB    T003-002 Auth API    T003-001 Init
T003-005 Tests                            T003-003 Schema

WIP: OK
Next: T003-004 "Setup DB" (Next in queue)
```

## Workflow
1. Run `/sedd.board` to see current status
2. When starting a task: `sedd board --move T001-001 "In Progress"`
3. When completing a task: `sedd complete T001-001` (auto-moves to Done)
4. If using GitHub: `sedd board --sync` to push changes to the project board

## Notes
- Works in local mode (no GitHub) by reading tasks.md directly
- WIP limits are optional, configured via `sedd github setup`
- Suggestions use a Lean algorithm: prioritize finishing in-progress work, then pick the next task in queue
