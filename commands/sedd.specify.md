# /sedd.specify - Create Feature Specification

## Purpose
Create a new feature with base specification (spec.md + interfaces.ts).

## Trigger
User runs `/sedd.specify "feature description"` or `/sedd.specify` (interactive)

## Pre-flight Checks

1. **Load Configuration**
   ```
   Read sedd.config.json (or use defaults)
   Default specsDir: .sedd
   ```

2. **Verify SEDD is initialized**
   - Check if specsDir exists
   - If not: suggest `npx sedd init`

3. **Check for existing feature branch**
   - If on feature branch (###-name): use existing feature
   - If not: create new feature

## Configuration

Default `sedd.config.json`:
```json
{
  "specsDir": ".sedd",
  "branchPattern": "{{id}}-{{name}}",
  "autoSplit": { "enabled": true, "maxLines": 400 },
  "commit": { "askBeforeCommit": true }
}
```

## Workflow

### Step 1: Parse Input

Extract feature description from user input or ask interactively.

### Step 2: Capture Expectation (FIRST - MANDATORY)

**ANTES DE QUALQUER COISA**, pergunte ao usuário:

```
🎯 Qual é sua EXPECTATIVA para esta feature?

O que você espera ver funcionando quando estiver pronto?
(Isso será usado para validar se as tasks cobrem seu objetivo)
```

Save expectation in:
- `spec.md` under `## Expectation` section (NO TOPO)
- `_meta.json` in `expectation` field

**NÃO PROSSIGA** sem a expectativa do usuário.

### Step 3: Architecture Analysis (MANDATORY)

Before creating spec, MUST search for related implementations:

```
Find similar:
- Existing specs in {{specsDir}}/
- Related code patterns
- Reusable components
```

Document findings in spec.md.

### Step 4: Create Feature Structure

```
{{specsDir}}/{{FEATURE_ID}}-{{SHORT_NAME}}/
├── _meta.json              # Metadata (with expectation)
├── CHANGELOG.md            # Changelog
├── spec.md                 # Base specification (with Expectation section NO TOPO)
├── interfaces.ts           # TypeScript interfaces
└── ui-mockups/             # If UI feature
    └── component-name.md
```

### Step 5: Generate spec.md

Use template with:
- **Expectation section NO TOPO** (capturada no Step 2)
- Feature name, ID, timestamp
- User stories based on description
- Mark requirements as NEEDS_CLARIFICATION where unclear

### Step 6: Generate interfaces.ts (MANDATORY)

Extract entities from description and create TypeScript interfaces:
- Identify nouns → Entities
- Identify verbs → Actions/Events
- Define DTOs for API

### Step 7: UI Mockups (MANDATORY if UI feature)

If feature involves UI components, CREATE ASCII mockups:

```
┌────────────────────────────────────────┐
│  Header                          [X]   │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────┐  ┌──────────┐           │
│  │  Card 1  │  │  Card 2  │           │
│  └──────────┘  └──────────┘           │
│                                        │
│  [Button Primary]  [Button Secondary]  │
│                                        │
└────────────────────────────────────────┘
```

Save to `ui-mockups/{{component}}.md`

### Step 8: Initialize _meta.json

```json
{
  "featureId": "024",
  "featureName": "dark-mode-toggle",
  "branch": "024-dark-mode-toggle",
  "createdAt": "2026-01-11T10:00:00Z",
  "specCreatedAt": "2026-01-11T10:00:00Z",
  "currentMigration": null,
  "migrations": {},
  "splits": [],
  "commits": [],
  "expectation": "User can toggle dark mode in settings and have it persist across sessions"
}
```

### Step 9: Update Changelog

```markdown
## [2026-01-11] - Feature Created

- Created initial specification
- Defined {{N}} user stories
- Identified {{M}} key entities
- Generated TypeScript interfaces
```

### Step 10: Ask About Commit

```
Do you want to commit?
Message: "feat(024): create spec for dark-mode-toggle"
```

### Step 11: Offer Next Step

```
Specification created! Next step:
/sedd.clarify - Refine requirements and generate tasks

Would you like to proceed with clarification?
```

## Output

1. **spec.md** - Complete specification
2. **interfaces.ts** - TypeScript interfaces
3. **ui-mockups/** - ASCII mockups (if UI)
4. **_meta.json** - Feature metadata
5. **CHANGELOG.md** - Initial entry

## Rules

- NEVER create spec without architecture analysis
- ALWAYS create interfaces.ts
- ALWAYS create ASCII mockups for UI features
- Mark unclear items as NEEDS_CLARIFICATION
- Auto-split files > 400 lines
- No migrations created yet (happens in /sedd.clarify)

## CLI Alternative

For automated workflows, use the SEDD CLI:

```bash
# Create new feature structure
sedd specify 024 dark-mode-toggle -d "Add dark mode support"

# Create with expectation (recommended)
sedd specify 024 dark-mode-toggle -d "Add dark mode support" -e "User can toggle dark mode"

# Check structure
sedd check

# View status
sedd status
```

**Options:**
- `-d, --description` - Feature description
- `-e, --expectation` - Expected outcome (used for alignment verification)

Scripts also available in `.sedd/scripts/powershell/sedd-specify.ps1` and `.sedd/scripts/bash/sedd-specify.sh`.
