# /sedd.validate - Validate Implementation Against Expectation

## Purpose

Validate that the implementation covers the original expectation, show git diff of changes, and create follow-up tasks if gaps are found.

## Trigger

- `/sedd.validate` - Validate current migration
- `/sedd.validate 001` - Validate specific migration
- `/sedd.validate --auto` - Auto-create tasks for gaps

## Pre-flight Checks

1. **Load Configuration**
   ```
   Read sedd.config.json (or use defaults)
   Default specsDir: .sedd
   ```

2. **Verify Feature Exists**
   - Must have spec.md with expectation
   - Must have at least one migration
   - Must have tasks.md in migration

3. **Check Git Status**
   - Ensure git is available
   - Get list of changed files since migration start

## Workflow

### Step 1: Load Expectation

Read from `_meta.json`:

```json
{
  "expectation": {
    "summary": "User can toggle dark mode and persist across sessions",
    "must": [
      "Criar toggle de dark mode em settings",
      "Persistir preferência no banco"
    ],
    "mustNot": [
      "Usar localStorage",
      "Criar endpoint em serviço X"
    ]
  }
}
```

### Step 2: Load Tasks Status

Read `tasks.md` and parse:

```
Completed: [x] T001-001, [x] T001-002
Pending:   [ ] T001-003, [ ] T001-004
```

### Step 3: Get Git Diff

Execute git commands:

```bash
# Get files changed in this migration
git diff --stat {{BASE_COMMIT}}..HEAD

# Get detailed diff
git diff {{BASE_COMMIT}}..HEAD
```

### Step 4: Analyze Coverage

For each expectation item in `must[]`:

```typescript
{
  expectationItem: "Criar toggle de dark mode",
  status: "covered",        // covered | partial | gap
  coveredByTasks: ["T001-002", "T001-003"],
  confidence: 90,
  notes: "Implemented in ToggleSwitch.tsx"
}
```

### Step 4.5: Validate Architecture Contract Compliance

Load `architectureContract` from `_meta.json` and verify ALL changed files respect it:

```typescript
// For each changed file, check:
// 1. Is it in the correct location per locationBindings?
// 2. Does it use the correct tech per techStack?
// 3. Are shared contracts used instead of duplicated types?

const contractViolations = [];

// Example checks:
// - Hook created inside components/ instead of src/hooks/ → VIOLATION
// - Zod schema duplicated in FE and BE instead of shared package → VIOLATION
// - Using Redux when contract says TanStack Query → VIOLATION
// - API types defined locally instead of packages/schemas/api/ → VIOLATION
```

Report contract violations alongside mustNot violations:

```
📜 Architecture Contract Compliance:
  ✅ Tech Stack: All bindings respected
  ❌ Location: Hook created in src/components/useTheme.ts (should be src/hooks/)
  ✅ Shared Contracts: Using packages/schemas/ correctly
```

Contract violations have severity `critical` — they block `complete` recommendation.

### Step 5: Check Violations

For each item in `mustNot[]`:

```typescript
// Scan changed files for violations
const violations = [];

for (const file of changedFiles) {
  if (file.includes('services/x/')) {
    violations.push({
      rule: "Não criar endpoint em serviço X",
      violatedBy: file,
      severity: "critical"
    });
  }
}
```

### Step 6: Identify Gaps

Compare expectation tokens with task descriptions:

```
Expectation: "User can toggle dark mode and persist across sessions"

Tokens: [toggle, dark, mode, persist, sessions]

Tasks coverage:
  ✅ toggle   → T001-002
  ✅ dark     → T001-002, T001-003
  ✅ mode     → T001-002, T001-003
  ✅ persist  → T001-003
  ❌ sessions → NOT FOUND

Gap identified: "sessions" not covered
```

### Step 6.5: Code Quality Review via Sub-Agents (MANDATORY)

Além de gaps de expectativa, validar a QUALIDADE do código implementado. Lançar **sub-agents em paralelo** para cada dimensão de qualidade relevante.

**Determinar quais agents lançar** baseado nos arquivos alterados:
- Se há arquivos `.tsx`, `.jsx`, `.css`, `.scss` → Launch Frontend Quality Agent
- Se há arquivos de API, services, controllers, utils → Launch Backend Quality Agent
- Se há arquivos de schema, migrations, models → Launch Database Quality Agent
- **SEMPRE** launch General Quality Agent

**Launch applicable agents in parallel (single message):**

#### Agent Q1: Frontend Quality Review (se aplicável)
```
Prompt: "Review the QUALITY of frontend code changes for feature '{FEATURE_NAME}'.

Changed files (frontend only):
{list of changed .tsx/.jsx/.css files with paths}

Review checklist:
1. **Component Structure**: Single responsibility, proper composition, no god components
2. **React Patterns**: Correct hook usage, no unnecessary re-renders, proper memo/callback
3. **Accessibility (a11y)**: ARIA labels, keyboard navigation, screen reader support, semantic HTML
4. **Performance**: No layout thrashing, lazy loading where needed, image optimization
5. **Responsive Design**: Mobile-first, breakpoints consistent, no hardcoded widths
6. **Error States**: Loading, error, empty states handled in UI
7. **TypeScript**: Proper typing, no `any`, discriminated unions where appropriate
8. **CSS/Styling**: No inline styles for static values, consistent spacing/tokens, dark mode support
9. **State Management**: Minimal state, derived state preferred, no prop drilling > 2 levels

For each file, read it and evaluate. Return:
- File path
- Issues found (severity: critical/warning/info)
- Specific line numbers and what's wrong
- Suggested fix (brief)
- Overall frontend quality score (A/B/C/D/F)"
```

#### Agent Q2: Backend Quality Review (se aplicável)
```
Prompt: "Review the QUALITY of backend code changes for feature '{FEATURE_NAME}'.

Changed files (backend only):
{list of changed API/service/controller files with paths}

Review checklist:
1. **Error Handling**: Proper try/catch, meaningful error messages, no swallowed errors
2. **Input Validation**: All external inputs validated/sanitized, Zod/Joi schemas
3. **Security**: No SQL injection, no XSS vectors, auth/authz checks, rate limiting
4. **API Design**: Consistent response shapes, proper HTTP status codes, pagination
5. **Business Logic**: No logic in controllers, proper service layer separation
6. **Logging**: Structured logging, appropriate log levels, no sensitive data in logs
7. **TypeScript**: Strict types, no `any`, proper error types, discriminated unions
8. **Performance**: No N+1 queries, proper caching, efficient algorithms
9. **Testability**: Injectable dependencies, no hard-coded externals, pure functions where possible
10. **SOLID Principles**: Single responsibility, interface segregation, dependency inversion

For each file, read it and evaluate. Return:
- File path
- Issues found (severity: critical/warning/info)
- Specific line numbers and what's wrong
- Suggested fix (brief)
- Overall backend quality score (A/B/C/D/F)"
```

#### Agent Q3: Database Quality Review (se aplicável)
```
Prompt: "Review the QUALITY of database/schema changes for feature '{FEATURE_NAME}'.

Changed files (DB-related):
{list of schema/migration/model files with paths}

Review checklist:
1. **Schema Design**: Proper normalization, no redundant columns, appropriate data types
2. **Indexes**: Queries have supporting indexes, no missing indexes for WHERE/JOIN columns
3. **Migrations**: Reversible, no data loss, proper up/down, idempotent
4. **Constraints**: Foreign keys, NOT NULL where needed, CHECK constraints, unique constraints
5. **Naming**: Consistent naming (snake_case), meaningful names, no abbreviations
6. **Relations**: Proper cardinality, cascade rules defined, no orphan records possible
7. **Performance**: No full table scans, proper partitioning if needed, query complexity
8. **Security**: Row-level security if multi-tenant, no sensitive data unencrypted
9. **Data Integrity**: Transactions where needed, optimistic locking, consistent state

For each file, read it and evaluate. Return:
- File path
- Issues found (severity: critical/warning/info)
- Specific details of what's wrong
- Suggested fix (brief)
- Overall DB quality score (A/B/C/D/F)"
```

#### Agent Q4: General Quality Review (SEMPRE)
```
Prompt: "Review the GENERAL code quality of ALL changes for feature '{FEATURE_NAME}'.

ALL changed files:
{list of ALL changed files with paths}

Review checklist:
1. **DRY**: No duplicated code blocks (>5 lines similar), extract shared logic
2. **Naming**: Clear, descriptive names, consistent conventions, no single-letter vars (except loops)
3. **Complexity**: No functions > 50 lines, no deeply nested conditionals (>3 levels), cyclomatic complexity
4. **Comments**: Complex logic documented, no obvious comments, no commented-out code
5. **Error Propagation**: Errors not silently swallowed, proper error boundaries
6. **Tests**: New code has tests, edge cases covered, no test gaps for critical paths
7. **Dependencies**: No unnecessary new dependencies, versions pinned, no deprecated packages
8. **Config**: No hardcoded values (URLs, secrets, magic numbers), proper env var usage
9. **Git Hygiene**: No debug code (console.log, debugger), no TODO without ticket
10. **Patterns**: Consistent with existing codebase patterns, no alien architectures

For each file, read it and evaluate. Return:
- File path
- Issues found (severity: critical/warning/info)
- Specific line numbers and what's wrong
- Suggested fix (brief)
- Overall quality score (A/B/C/D/F)
- Test coverage assessment (has tests / needs tests / tests insufficient)"
```

#### Consolidate Quality Results

After all quality agents complete, synthesize into a **Quality Report**:

```
📊 Code Quality Review

| Dimensão   | Score | Criticals | Warnings | Info |
|------------|-------|-----------|----------|------|
| Frontend   | B+    | 0         | 3        | 5    |
| Backend    | A-    | 0         | 1        | 2    |
| Database   | A     | 0         | 0        | 1    |
| General    | B     | 1         | 4        | 3    |

🔴 Critical Issues (must fix):
1. {file:line} - {description}

🟡 Warnings (should fix):
1. {file:line} - {description}
...

📈 Overall Quality: B+ (Good)
```

**Quality scores affect the final recommendation:**
- Any critical quality issue → recommendation becomes `needs-revision` (mesmo sem gaps de expectativa)
- More than 5 warnings → recommendation becomes `needs-followup`
- Quality score D or F em qualquer dimensão → recommendation becomes `needs-revision`

### Step 7: Generate validation.md

Create `.sedd/{FEATURE}/{MIGRATION}/validation.md`:

```markdown
# Validação: Migration {{MIGRATION_ID}}

> Feature: {{FEATURE_NAME}}
> Validado em: {{TIMESTAMP}}
> Status: {{STATUS}}

---

## Expectativa Original

> {{EXPECTATION_SUMMARY}}

### DEVE (Must)
{{#each must}}
- {{this}}
{{/each}}

### NÃO DEVE (Must Not)
{{#each mustNot}}
- {{this}}
{{/each}}

---

## Cobertura de Expectativa

| Critério | Status | Coberto por | Confiança |
|----------|--------|-------------|-----------|
| Toggle dark mode | ✅ Coberto | T001-002 | 95% |
| Persist preference | ✅ Coberto | T001-003 | 90% |
| Across sessions | ❌ Gap | - | - |

**Cobertura Total: {{COVERAGE}}%**

```
████████████░░░░ 75%
```

---

## Violações de Restrições

{{#if violations}}
⚠️ **VIOLAÇÕES ENCONTRADAS:**

| Regra | Arquivo | Severidade |
|-------|---------|------------|
{{#each violations}}
| {{rule}} | {{violatedBy}} | {{severity}} |
{{/each}}
{{else}}
✅ Nenhuma violação de restrições encontrada.
{{/if}}

---

## Arquivos Alterados

| Arquivo | Adições | Remoções | Tipo |
|---------|---------|----------|------|
{{#each filesChanged}}
| {{filePath}} | +{{linesAdded}} | -{{linesRemoved}} | {{type}} |
{{/each}}

**Total:** {{totalFiles}} arquivos, +{{totalAdded}} -{{totalRemoved}} linhas

---

## Git Diff Summary

```diff
{{GIT_DIFF_SUMMARY}}
```

<details>
<summary>Ver diff completo</summary>

```diff
{{FULL_DIFF}}
```

</details>

---

## Code Quality Review

| Dimensão | Score | Criticals | Warnings | Info |
|----------|-------|-----------|----------|------|
{{#each qualityDimensions}}
| {{name}} | {{score}} | {{criticals}} | {{warnings}} | {{infos}} |
{{/each}}

**Overall Quality: {{overallQuality}}**

{{#if qualityCriticals}}
### 🔴 Critical Quality Issues (must fix)

{{#each qualityCriticals}}
{{@index}}. `{{file}}:{{line}}` - **{{category}}**: {{description}}
   Fix: {{suggestedFix}}
{{/each}}
{{/if}}

{{#if qualityWarnings}}
### 🟡 Quality Warnings (should fix)

{{#each qualityWarnings}}
{{@index}}. `{{file}}:{{line}}` - **{{category}}**: {{description}}
{{/each}}
{{/if}}

---

## Gaps Identificados

{{#if gaps}}
Os seguintes gaps foram identificados entre expectativa e implementação:

{{#each gaps}}
### Gap {{@index}}: {{description}}

- **Expectativa:** {{expectationItem}}
- **Severidade:** {{severity}}
- **Task Sugerida:** {{suggestedTask.id}} - {{suggestedTask.description}}

{{/each}}

### Tasks Sugeridas para Gaps

{{#each gaps}}
- [ ] {{suggestedTask.id}} [Follow-up] {{suggestedTask.description}}
{{/each}}
{{else}}
✅ Nenhum gap identificado. Implementação cobre a expectativa.
{{/if}}

---

## Tasks Completadas

{{#each tasksCompleted}}
- [x] {{this}}
{{/each}}

## Tasks Pendentes

{{#each tasksPending}}
- [ ] {{this}}
{{/each}}

---

## Recomendação

{{#if (eq recommendation "complete")}}
✅ **FEATURE COMPLETA**

A implementação cobre todos os critérios da expectativa.
Próximo passo: Merge para branch principal.
{{/if}}

{{#if (eq recommendation "needs-followup")}}
⚠️ **REQUER FOLLOW-UP**

Gaps identificados requerem tasks adicionais.
Próximo passo: `/sedd.clarify` para criar nova migration com gaps.
{{/if}}

{{#if (eq recommendation "needs-revision")}}
❌ **REQUER REVISÃO**

Violações de restrições encontradas.
Próximo passo: Reverter alterações que violam restrições.
{{/if}}

---

## Próximos Passos

{{#each nextSteps}}
{{@index}}. {{this}}
{{/each}}
```

### Step 8: Auto-Create Migration for Gaps (if gaps or quality issues)

When gaps are found OR quality issues need follow-up, **automatically initiate the /sedd.clarify flow** to create a new migration:

#### 8.1 If recommendation is `needs-followup` or `needs-revision`:

```
⚠️ Gaps/issues encontrados. Criando nova migration automaticamente...

📝 Iniciando /sedd.clarify com os gaps identificados:

Gaps de expectativa:
{{#each gaps}}
- {{description}} (severity: {{severity}})
{{/each}}

Quality issues a resolver:
{{#each qualityCriticals}}
- [CRITICAL] {{file}}:{{line}} - {{description}}
{{/each}}
{{#each qualityWarnings}}
- [WARNING] {{file}}:{{line}} - {{description}}
{{/each}}
```

#### 8.2 Execute /sedd.clarify Flow Automatically:

1. **Create new migration folder** (next ID, e.g., 002)
2. **Pre-populate clarify.md** with:
   - Gaps found in validation as context
   - Quality issues as technical debt items
   - Original expectation items that weren't covered
3. **Pre-populate DEVE/NAO DEVE** from gaps:
   - Each gap → DEVE item
   - Each quality critical → DEVE fix
4. **Generate tasks.md** directly from gaps:
   - Each gap → follow-up task
   - Each critical quality issue → fix task
   - Each warning cluster → improvement task
5. **Generate acceptance.md** from gap criteria
6. **Update _meta.json** with new migration

#### 8.3 Present Results:

```
✅ Nova migration {NEW_ID} criada automaticamente a partir dos gaps:

📋 Tasks geradas:
- [ ] T{NEW_ID}-001 [Follow-up] {gap_1_description}
- [ ] T{NEW_ID}-002 [Follow-up] {gap_2_description}
- [ ] T{NEW_ID}-003 [Quality] {critical_issue_fix}

Deseja executar /sedd.implement agora? [Y/n]
```

#### 8.4 If recommendation is `complete`:

No migration needed. Proceed to Step 9.

### Step 9: Display Summary

```
🔍 VALIDAÇÃO COMPLETA

┌─────────────────────────────────────────────┐
│  Feature: Dark Mode Toggle                  │
│  Migration: 001                             │
├─────────────────────────────────────────────┤
│  Cobertura:     75% ████████████░░░░        │
│  Qualidade:     B+ (Frontend B+, Backend A-)│
│  Tasks:         3/4 completadas             │
│  Arquivos:      5 alterados (+180, -12)     │
│  Violações:     0                           │
│  Gaps:          1 encontrado                │
│  Quality Issues: 0 critical, 3 warnings     │
└─────────────────────────────────────────────┘

📄 Arquivo gerado: .sedd/024-dark-mode/001_.../validation.md

⚠️ Gap encontrado: "sessions" não coberto

Criar task de follow-up? [Y/n]
```

### Step 10: GitHub Sync (on FEATURE COMPLETA)

When recommendation is `"complete"` (100% coverage, 0 gaps, 0 violations):

1. **Read `_meta.json`** to get `sourceIssue` and check if all tasks are marked `[x]` in `tasks.md`

2. **If `sourceIssue` exists and issue is still OPEN:**

   a. **Check if `sedd complete` was already run** for the last task. If the source issue is already closed, skip — sync already happened.

   b. **If not yet synced**, run `sedd complete` for any remaining uncompleted tasks to trigger the built-in GitHub sync. The `sedd complete` command (tasks.ts) automatically:
      - Comments on the source issue with a completion summary
      - Closes the source issue via `gh issue close`
      - Moves the item to "Done" on the project board

   c. **If `sedd complete` cannot be used** (e.g., no pending tasks left but issue still open), sync manually:

   **Generate implementation summary** from `progress.md` + `git diff --stat`:

   ```bash
   # Build implementation summary from completed tasks and git diff
   # Read progress.md to list completed tasks with descriptions
   # Run: git diff --stat {BASE_COMMIT}..HEAD

   # Comment on source issue with FULL validation + implementation summary
   gh issue comment {SOURCE_ISSUE_NUMBER} --body "✅ Feature validated via /sedd.validate

   ## Resumo da Implementação
   - {task_1_description}
   - {task_2_description}
   - ...

   ## Métricas
   Cobertura: 100%
   Tasks: {COMPLETED}/{TOTAL} completadas
   Arquivos: {TOTAL_FILES} alterados (+{ADDED}, -{REMOVED} linhas)
   Violações: 0
   Gaps: 0

   Branch: {BRANCH}
   Validation report: .sedd/{FEATURE}/{MIGRATION}/validation.md"

   # Close the source issue
   gh issue close {SOURCE_ISSUE_NUMBER}
   ```

   d. **Ask which stage to move on board:**

   ```
   Para qual etapa mover a issue #{SOURCE_ISSUE_NUMBER} no board?

   {list status options from project, numbered with emojis}
   Exemplo:
   1. ✅ Done (Recomendado)
   2. 👀 In Review
   3. Pular

   Escolha (1-N):
   ```

   Use `getStatusOptions()` to list available columns dynamically.
   Move using `moveItem()` with the selected option ID.

3. **If no `sourceIssue` in `_meta.json`:**
   ```
   ℹ️ Nenhuma source issue vinculada.
      Para vincular: adicione "sourceIssue" ao _meta.json
      ou crie a feature via /sedd.story
   ```

4. **Display sync result:**
   ```
   🔄 GitHub Sync:
      Source Issue: #42 → Closed ✅
      Atribuida a: {assignee}
      Board: → {selected_column} ✅
      Resumo: Comentado na issue ✅
   ```

## Output

1. **validation.md** - Relatório completo de validação
2. **tasks.md** - Atualizado com novas tasks (se gaps)
3. **_meta.json** - Atualizado com `lastValidation` timestamp

## Rules

- **NUNCA fazer commit nem push** — o usuário controla quando commitar
- SEMPRE comparar contra expectativa original
- SEMPRE mostrar git diff
- SEMPRE executar code quality review via sub-agents em PARALELO
- NUNCA marcar como completo se há violações críticas OU quality issues críticos
- Quality score D/F em qualquer dimensão → `needs-revision`
- Mais de 5 quality warnings → `needs-followup`
- Quando há gaps → AUTOMATICAMENTE rodar fluxo de /sedd.clarify para criar nova migration
- Manter histórico de validações
- Sub-agents de qualidade são lançados TODOS em paralelo (single message)

## CLI Alternative

```bash
# Validate current migration
sedd validate

# Validate specific migration
sedd validate --migration 001

# Auto-create tasks for gaps
sedd validate --auto

# Show full diff
sedd validate --full-diff
```

## Integration with /sedd.clarify

After `/sedd.validate` finds gaps, it **automatically** creates a new migration via /sedd.clarify flow with the gaps pre-populated as tasks. The user does NOT need to manually run /sedd.clarify — validate handles the full cycle: review → identify gaps → create migration → generate tasks.

## Suggested at End of /sedd.implement

When `/sedd.implement` completes all tasks:

```
🏁 Todas as tasks concluídas!

📍 Próximo passo recomendado:
   /sedd.validate - Validar implementação contra expectativa

Executar validação agora? [Y/n]
```
