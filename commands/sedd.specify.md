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
   - If on master/main or outra branch nao-feature:
     1. Determinar proximo feature ID (buscar maior ###- nas branches + 1)
     2. Criar branch `{id}-{nome}` com `git checkout -b {id}-{nome}`
     3. Confirmar: "Criei a branch {id}-{nome} e ja estou nela"
     4. SO ENTAO prosseguir com criacao da estrutura

## Configuration

Default `sedd.config.json`:
```json
{
  "specsDir": ".sedd",
  "branchPattern": "{{id}}-{{name}}",
  "autoSplit": { "enabled": true, "maxLines": 400 },
  "git": { "autoCommit": false, "autoPush": false }
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

### Step 3: Deep Architecture Analysis via Sub-Agents (MANDATORY)

Before creating spec, MUST delegate architecture investigation to **parallel sub-agents** using the Agent tool. This is NOT a superficial search — it's a deep, multi-angle analysis.

**Launch ALL 3 agents in parallel (single message, multiple Agent tool calls):**

#### Agent 1: Architecture Scout
```
Prompt: "Analyze the current codebase architecture for implementing '{FEATURE_DESCRIPTION}'.

Tasks:
1. Map the project structure (frameworks, patterns, layers)
2. Identify existing modules/packages that relate to this feature
3. Find existing specs in {specsDir}/ that overlap or relate
4. Document the tech stack relevant to this feature (DB, API, UI, etc.)
5. List architectural patterns in use (MVC, DDD, repository, etc.)
6. Identify entry points where this feature would integrate

Return a structured report with:
- Project architecture overview (relevant layers only)
- Related existing modules with file paths
- Patterns and conventions already in use
- Integration points for the new feature"
```

#### Agent 2: Impact Analyzer
```
Prompt: "Perform impact analysis for adding '{FEATURE_DESCRIPTION}' to this codebase.

Tasks:
1. Search for files/modules that will need modification
2. Identify shared dependencies that could be affected
3. Map database schemas/models that relate to this feature
4. Find API endpoints/routes that might need changes
5. Check for configuration files that need updates
6. Identify test files that will need new tests or modifications
7. Look for CI/CD or build configs that might be impacted

Return a structured report with:
- Files that WILL be modified (with reasons)
- Files that MIGHT be affected (indirect impact)
- Database/schema changes needed
- API surface changes
- Config changes required
- Test coverage gaps"
```

#### Agent 3: Pattern & Reuse Discovery
```
Prompt: "Find reusable code, patterns, and similar implementations for '{FEATURE_DESCRIPTION}'.

Tasks:
1. Search for similar features already implemented in this codebase
2. Find reusable components, utilities, hooks, helpers
3. Identify shared services or libraries that can be leveraged
4. Look for existing TypeScript types/interfaces that can be extended
5. Check for design patterns that should be followed for consistency
6. Find any anti-patterns or tech debt in related areas

Return a structured report with:
- Similar implementations found (with file paths and descriptions)
- Reusable code inventory (components, utils, hooks, services)
- Types/interfaces that can be extended
- Patterns to follow (with examples from codebase)
- Anti-patterns or tech debt to be aware of
- Recommendations for implementation approach"
```

#### Consolidate Findings

After all 3 agents complete, **synthesize their reports** into the spec:

```markdown
## Architecture Analysis

### Current Architecture (Relevant)
{from Architecture Scout}

### Impact Assessment
**Files to modify:** {count}
**Files potentially affected:** {count}
**DB changes needed:** {yes/no + details}
**API changes needed:** {yes/no + details}

### Reusable Assets
{from Pattern Discovery - components, utils, types that can be leveraged}

### Patterns to Follow
{conventions and patterns already used in codebase}

### Risks & Tech Debt
{anti-patterns, known issues in related areas}

### Recommended Approach
{synthesized recommendation based on all 3 reports}
```

Document ALL findings in spec.md under `## Architecture Analysis` section.

### Step 3.5: Generate Architecture Contract (MANDATORY - IMMUTABLE)

After consolidating agent findings, extract and formalize the **Architecture Contract** — binding decisions about WHERE and HOW code must be created. This contract is IMMUTABLE throughout the feature lifecycle and MUST be respected by `/sedd.clarify`, `/sedd.implement`, and `/sedd.validate`.

**The contract captures:**

1. **Tech Stack Bindings** — Which tools/libs are used for what purpose
2. **Pattern Bindings** — Which patterns are used for which layer
3. **Location Bindings** — WHERE specific types of code must live
4. **Contract Bindings** — Shared schemas/types between frontend and backend

**Present to user for confirmation:**

```
📜 CONTRATO DE ARQUITETURA (imutável para esta feature)

━━━ Tech Stack ━━━
| Camada        | Tecnologia              | Exemplo no Código         |
|---------------|-------------------------|---------------------------|
| State Mgmt    | TanStack Query + hooks  | src/hooks/useXxx.ts       |
| Forms         | React Hook Form + Zod   | src/forms/xxxForm.ts      |
| Validation    | Zod (shared schemas)    | packages/schemas/xxx.ts   |
| API Client    | tRPC / fetch wrapper    | src/api/xxx.ts            |
| DB ORM        | Prisma / Drizzle        | prisma/schema.prisma      |
| Testing       | Vitest + Testing Library| __tests__/xxx.test.ts     |

━━━ Pattern Bindings ━━━
| Padrão          | Onde Usar                    | Referência             |
|-----------------|------------------------------|------------------------|
| Repository      | Data access layer            | src/repositories/*.ts  |
| Custom Hooks    | State + side effects         | src/hooks/use*.ts      |
| Zod Schemas     | Validation (FE + BE shared)  | packages/schemas/*.ts  |
| Server Actions  | Mutations                    | src/actions/*.ts       |

━━━ Location Bindings ━━━
| Tipo de Código   | DEVE ficar em                | NUNCA criar em          |
|------------------|------------------------------|-------------------------|
| Hooks            | src/hooks/                   | dentro de components/   |
| Schemas          | packages/schemas/            | duplicar em FE e BE     |
| Components       | src/components/{feature}/    | src/pages/              |
| API Routes       | src/app/api/{feature}/       | src/services/           |

━━━ Contract Bindings (Shared FE ↔ BE) ━━━
| Contrato         | Localização                  | Usado por               |
|------------------|------------------------------|-------------------------|
| Entity schemas   | packages/schemas/entities/   | FE forms + BE validation|
| API types        | packages/schemas/api/        | FE client + BE handlers |
| Enums/constants  | packages/schemas/enums/      | FE + BE                 |

Quer ajustar algo neste contrato? [Y/n/editar]
```

**Rules for the Contract:**
- MUST be derived from what the sub-agents ACTUALLY found in the codebase
- If the codebase already uses TanStack Query → contract says "use TanStack Query"
- If schemas are in `packages/schemas/` → contract says "always put schemas there"
- If there's a shared contract package → contract says "FE and BE use the same schemas"
- User MUST confirm before proceeding
- Contract is saved in `spec.md` under `## Architecture Contract` AND in `_meta.json`

Save the confirmed contract in:
- `spec.md` under `## Architecture Contract` section (after Architecture Analysis)
- `_meta.json` in `architectureContract` field

```json
{
  "architectureContract": {
    "confirmedAt": "2026-01-11T10:00:00Z",
    "techStack": {
      "stateManagement": { "tech": "TanStack Query", "location": "src/hooks/" },
      "forms": { "tech": "React Hook Form + Zod", "location": "src/forms/" },
      "validation": { "tech": "Zod", "location": "packages/schemas/" },
      "apiClient": { "tech": "tRPC", "location": "src/api/" },
      "orm": { "tech": "Prisma", "location": "prisma/" },
      "testing": { "tech": "Vitest", "location": "__tests__/" }
    },
    "patternBindings": [
      { "pattern": "Custom Hooks", "usage": "State + side effects", "location": "src/hooks/use*.ts" },
      { "pattern": "Zod Schemas", "usage": "Shared validation", "location": "packages/schemas/" }
    ],
    "locationBindings": [
      { "type": "hooks", "mustBeIn": "src/hooks/", "neverIn": "src/components/" },
      { "type": "schemas", "mustBeIn": "packages/schemas/", "neverIn": "duplicated per layer" }
    ],
    "sharedContracts": [
      { "name": "Entity schemas", "location": "packages/schemas/entities/", "usedBy": ["frontend", "backend"] },
      { "name": "API types", "location": "packages/schemas/api/", "usedBy": ["frontend", "backend"] }
    ]
  }
}
```

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

### Step 10: Offer Next Step

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

- **NUNCA fazer commit nem push** — o usuário controla quando commitar
- NEVER create spec without deep architecture analysis via sub-agents
- ALWAYS launch all 3 analysis agents in PARALLEL (single message)
- ALWAYS generate Architecture Contract after agent consolidation
- Architecture Contract MUST be confirmed by user before proceeding
- Architecture Contract is IMMUTABLE — all subsequent skills MUST respect it
- ALWAYS create interfaces.ts
- ALWAYS create ASCII mockups for UI features
- Mark unclear items as NEEDS_CLARIFICATION
- Auto-split files > 400 lines
- No migrations created yet (happens in /sedd.clarify)
- Sub-agent results must be SYNTHESIZED, not just concatenated

## CLI Alternative

For automated workflows, use the SEDD CLI:

```bash
# Create new feature structure
sedd specify 024 dark-mode-toggle -d "Add dark mode support"

# Create with expectation (recommended)
sedd specify 024 dark-mode-toggle -d "Add dark mode support" -e "User can toggle dark mode"

# Create from GitHub issue (reads title, body, labels)
sedd specify 042 from-issue --from-issue https://github.com/owner/repo/issues/42

# Check structure
sedd check

# View status
sedd status
```

**Options:**
- `-d, --description` - Feature description
- `-e, --expectation` - Expected outcome (used for alignment verification)
- `--from-issue <url>` - Create feature from a GitHub issue URL

### --from-issue Flow

When `--from-issue` is provided:

1. Fetches issue title, body, and labels from GitHub
2. Uses issue title as feature name (if feature-name is `from-issue` or `_`)
3. Extracts acceptance criteria from issue body (if present)
4. Creates branch, spec.md, interfaces.ts, _meta.json
5. Saves `sourceIssue` in `_meta.json` (permanent link)
6. Moves issue to "In Progress" on the GitHub project board
7. Comments on the issue: "SEDD feature created from this issue"

**Requires:** GitHub integration configured (`sedd github setup`)

Scripts also available in `.sedd/scripts/powershell/sedd-specify.ps1` and `.sedd/scripts/bash/sedd-specify.sh`.
