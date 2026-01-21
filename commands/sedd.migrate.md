# /sedd.migrate - Migrate Legacy Specs

## Purpose
Convert existing speckit/legacy structure to new SEDD migrations structure.

## Trigger
- `/sedd.migrate` - Migrate current feature
- `/sedd.migrate 023-agent-executor` - Migrate specific feature
- `/sedd.migrate --all` - Migrate all features

## Legacy Structure → New Structure

```
OLD:                                  NEW:
specs/023-feature/                    specs/023-feature/
├── spec.md                    →      ├── _meta.json
├── plan.md                    →      ├── CHANGELOG.md
├── tasks.md                   →      ├── spec.md
├── research.md                →      ├── interfaces.ts (extracted)
├── data-model.md              →      ├── progress.md
├── contracts/                 →      │
├── ui-specs/                  →      ├── 001_{{timestamp}}/
└── quickstart.md              →      │   ├── clarify.md (from plan)
                                      │   ├── tasks.md (moved)
                                      │   └── decisions.md (extracted)
                                      │
                                      └── archive/
                                          ├── plan.md
                                          ├── research.md
                                          ├── data-model.md
                                          ├── contracts/
                                          └── quickstart.md
```

## Workflow

### Step 1: Analyze Feature

Check existing files:
- spec.md → Keep in root
- plan.md → Extract decisions, archive
- tasks.md → Move to migration 001
- research.md → Archive
- data-model.md → Archive
- ui-specs/ → Move to ui-mockups/
- contracts/ → Archive
- quickstart.md → Archive

### Step 2: Dry Run (Default)

```
📦 Migration Plan: 023-agent-executor

Will create:
  ✓ _meta.json
  ✓ CHANGELOG.md
  ✓ interfaces.ts (extracted from spec)
  ✓ progress.md
  ✓ 001_2026-01-11_12-00-00/
  ✓ archive/

Will move:
  spec.md → (keep in place)
  tasks.md → 001_.../tasks.md
  ui-specs/ → ui-mockups/

Will extract:
  plan.md decisions → 001_.../decisions.md
  plan.md clarifications → 001_.../clarify.md
  spec.md entities → interfaces.ts

Will archive:
  plan.md → archive/plan.md
  research.md → archive/research.md
  data-model.md → archive/data-model.md
  contracts/ → archive/contracts/
  quickstart.md → archive/quickstart.md

Proceed? [y/N]
```

### Step 3: Extract Interfaces

Scan spec.md for entities and create interfaces.ts:

```typescript
/**
 * Interfaces extracted from spec.md
 * Migration timestamp: 2026-01-11_12-00-00
 */

export interface Agent {
  id: string;
  name: string;
  // ... extracted from spec
}

export interface Tool {
  id: string;
  agentId: string;
  // ... extracted from spec
}
```

### Step 4: Create Migration 001

Create first migration from existing files:

```
001_2026-01-11_12-00-00/
├── clarify.md      ← Extracted from plan.md
├── tasks.md        ← Moved from root
└── decisions.md    ← Extracted from plan.md
```

### Step 5: Update Task IDs

Rename tasks to new format:

```
OLD: - [ ] T001 Create component
NEW: - [ ] T001-001 Create component

OLD: - [ ] T015 Update schema
NEW: - [ ] T001-015 Update schema
```

### Step 6: Archive Old Files

Move to archive/:
```
archive/
├── plan.md           # Original plan
├── research.md       # Research notes
├── data-model.md     # Data model
├── contracts/        # API contracts
└── quickstart.md     # Quickstart guide
```

### Step 7: Generate _meta.json

```json
{
  "featureId": "023",
  "featureName": "agent-executor",
  "branch": "023-agent-executor",
  "createdAt": "2026-01-11T12:00:00Z",
  "specCreatedAt": "2026-01-11T12:00:00Z",
  "currentMigration": "001",
  "migrations": {
    "001": {
      "id": "001",
      "timestamp": "2026-01-11_12-00-00",
      "folder": "001_2026-01-11_12-00-00",
      "status": "in-progress",
      "tasksTotal": 15,
      "tasksCompleted": 8,
      "createdAt": "2026-01-11T12:00:00Z"
    }
  },
  "splits": [],
  "commits": []
}
```

### Step 8: Generate CHANGELOG.md

```markdown
# Changelog - 023: agent-executor

## [2026-01-11] - Migrated to SEDD

- Converted from legacy speckit structure
- Created migration 001 with 15 tasks
- 8 tasks already completed
- Archived legacy files
```

### Step 9: Generate progress.md

Based on task checkboxes in original tasks.md:

```markdown
# Implementation Progress

## Summary
| Migration | Total | Done | Progress |
|-----------|-------|------|----------|
| 001 | 15 | 8 | 53% |

## Task Log (Imported)

### Migration 001
- [x] T001-001 Setup project structure
- [x] T001-002 Configure dependencies
- [x] T001-003 Create base types
...
- [ ] T001-014 Add error handling
- [ ] T001-015 Update documentation
```

### Step 10: Verification

```
✅ Migration complete: 023-agent-executor

New structure:
specs/023-agent-executor/
├── _meta.json
├── CHANGELOG.md
├── spec.md
├── interfaces.ts
├── progress.md
├── ui-mockups/
├── 001_2026-01-11_12-00-00/
│   ├── clarify.md
│   ├── tasks.md
│   └── decisions.md
└── archive/
    ├── plan.md
    ├── research.md
    └── ...

Run `sedd status` to verify.
```

## Batch Migration

```
/sedd.migrate --all

Found 5 features to migrate:
  - 019-workflow-v2
  - 020-chat-improvements
  - 021-streaming-pipeline
  - 022-google-sheets
  - 023-agent-executor

Migrate all? [y/N]
```

## Rules

- NEVER delete files (archive instead)
- ALWAYS create _meta.json
- ALWAYS extract interfaces.ts
- Update task IDs to new format (TXXX-XXX)
- Preserve task completion status
- Archive preserves full history
