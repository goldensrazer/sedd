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

### Step 8: Create Follow-up Tasks (if gaps)

If gaps found and `--auto` flag or user confirms, **use the CLI to add tasks**:

```bash
sedd tasks '[{"story":"Follow-up","description":"Implement session persistence for theme"},{"story":"Follow-up","description":"Add session storage fallback"}]'
```

This automatically creates GitHub issues for the follow-up tasks and updates _meta.json.
**Do NOT manually append to tasks.md** — use the CLI.

The CLI will add to tasks.md:
```markdown
- [ ] T001-NEW-001 [Follow-up] Implement session persistence for theme
- [ ] T001-NEW-002 [Follow-up] Add session storage fallback
```

### Step 9: Display Summary

```
🔍 VALIDAÇÃO COMPLETA

┌─────────────────────────────────────────────┐
│  Feature: Dark Mode Toggle                  │
│  Migration: 001                             │
├─────────────────────────────────────────────┤
│  Cobertura:     75% ████████████░░░░        │
│  Tasks:         3/4 completadas             │
│  Arquivos:      5 alterados (+180, -12)     │
│  Violações:     0                           │
│  Gaps:          1 encontrado                │
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

   ```bash
   # Comment on source issue with validation summary
   gh issue comment {SOURCE_ISSUE_NUMBER} --body "✅ Feature validated via /sedd.validate

   Cobertura: 100%
   Tasks: {COMPLETED}/{TOTAL} completadas
   Violações: 0
   Gaps: 0

   Validation report: .sedd/{FEATURE}/{MIGRATION}/validation.md"

   # Close the source issue
   gh issue close {SOURCE_ISSUE_NUMBER}
   ```

   d. **Move on project board** (if configured in `sedd.config.json`):
   ```bash
   # Read .github-source-sync.json for the itemId
   # Use gh api to move item to Done column
   ```

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
      Project Board: → Done ✅
   ```

## Output

1. **validation.md** - Relatório completo de validação
2. **tasks.md** - Atualizado com novas tasks (se gaps)
3. **_meta.json** - Atualizado com `lastValidation` timestamp

## Rules

- SEMPRE comparar contra expectativa original
- SEMPRE mostrar git diff
- NUNCA marcar como completo se há violações críticas
- Criar tasks automáticas só com confirmação do usuário
- Manter histórico de validações

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

After `/sedd.validate` finds gaps:

```
Gaps encontrados. Deseja:

1. /sedd.clarify - Criar nova migration para os gaps
2. Adicionar tasks na migration atual
3. Ignorar gaps (marcar como known limitations)
```

## Suggested at End of /sedd.implement

When `/sedd.implement` completes all tasks:

```
🏁 Todas as tasks concluídas!

📍 Próximo passo recomendado:
   /sedd.validate - Validar implementação contra expectativa

Executar validação agora? [Y/n]
```
