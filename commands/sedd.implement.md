# /sedd.implement - Execute Tasks

## Purpose
Execute tasks from migrations, with optional migration ID filter.

## Trigger
- `/sedd.implement` - Execute ALL pending tasks (asks between migrations)
- `/sedd.implement --all` or `-a` - Execute ALL without stopping (no prompts)
- `/sedd.implement 001` - Execute only migration 001 tasks
- `/sedd.implement 002` - Execute migrations up to 002

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

4. **Verify migrations exist** in feature directory (run /sedd.clarify first)

5. **Load _meta.json** from feature directory to get migration list

6. **Check for pending tasks** in migration tasks.md files

## Workflow

### Step 1: Determine Scope

Based on argument:
- No argument → All pending tasks from all migrations
- `001` → Only tasks from migration 001
- `002` → Tasks from migrations 001 AND 002

### Step 2: Load Context

Read all relevant files:
- spec.md (reference)
- interfaces.ts (for Zod conversion)
- All relevant migration folders:
  - `XXX_timestamp/clarify.md`
  - `XXX_timestamp/tasks.md`
  - `XXX_timestamp/decisions.md`

### Step 3: Create/Update Progress File

Initialize `progress.md` if not exists:

```markdown
# Implementation Progress

## Current Status
- **Active Migration:** 001
- **Active Task:** T001-001
- **Overall Progress:** 0/5 (0%)

## Task Log

| Task | Migration | Status | Started | Completed |
|------|-----------|--------|---------|-----------|
| T001-001 | 001 | pending | - | - |
| T001-002 | 001 | pending | - | - |
```

### Step 4: Convert Interfaces to Zod (First Run)

On first implementation, convert interfaces.ts:

```typescript
// schemas/entities.ts
import { z } from 'zod';

export const ThemeSchema = z.enum(['light', 'dark', 'system']);

export const UserPreferencesSchema = z.object({
  theme: ThemeSchema,
  // ...
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
```

### Step 5: Task Execution Loop

For each task in order:

1. **Mark as in-progress** in progress.md
   ```
   | T001-001 | 001 | in-progress | 10:30 | - |
   ```

2. **Show task context with expectations**
   ```
   📌 Task T001-001 [Foundation]
   Create ThemeContext in src/contexts/ThemeContext.tsx

   From Decision D001-001: Theme persisted in user account

   ━━━ Expectations ━━━
   🎯 Feature: User can customize theme preferences
   📍 Migration 001: Toggle dark mode with persistence
   ```

   **Nota:** Se feature expectation e migration expectation forem iguais, mostrar apenas uma.

3. **Execute the task**

4. **Update ALL task files** (CRITICAL - keep them in sync):

   a. **Update tasks.md** in migration folder - change `[ ]` to `[x]`:
   ```markdown
   # Before
   - [ ] T001-001 [Foundation] Create ThemeContext

   # After
   - [x] T001-001 [Foundation] Create ThemeContext
   ```

   b. **Update progress.md** - mark completed with timestamp:
   ```markdown
   - [x] T001-001 [10:30 → 10:45] Create ThemeContext
   ```

   c. **Update _meta.json** - increment tasksCompleted:
   ```json
   "tasksCompleted": 1
   ```

5. **Verify sync** - All three files must show same completed count

### Step 5.6: Validate Against Expectations (CRITICAL - Before Marking Done)

**ANTES de marcar qualquer task como concluída**, validar contra as restrições `mustNot`.

#### 5.6.1 Carregar Restrições

Ler `_meta.json` e extrair `expectation.mustNot[]` da migration atual.

#### 5.6.2 Listar Arquivos Modificados

Identificar todos os arquivos criados ou modificados durante a task:
- Novos arquivos criados
- Arquivos editados
- Imports adicionados

#### 5.6.3 Validar Contra mustNot

Para cada item em `mustNot`, verificar se algum arquivo/código viola a restrição.

**Exemplo de validação:**

```
mustNot: ["Criar endpoint no serviço X"]
Arquivos modificados:
- services/x/endpoints/new.ts  ← POTENCIAL VIOLAÇÃO
- src/domains/novo/index.ts   ← OK
```

#### 5.6.4 Se Violação Detectada

```
⚠️ VALIDAÇÃO DE EXPECTATIVA - Task T001-003

Arquivos modificados nesta task:
- services/x/endpoints/new.ts  ← ⛔ VIOLA "NÃO criar endpoint em serviço X"
- src/domains/novo/index.ts   ← ✅ OK

❌ Task viola restrição da expectativa.

**Opções:**
1. Reverter alterações e refazer a task de forma diferente
2. Ajustar expectativa (remover esta restrição)
3. Continuar mesmo assim (será marcado como desvio)

O que deseja fazer? [1/2/3]
```

**Respostas:**

**Se "1" (Reverter):**
- Reverter as alterações feitas
- Voltar para início da task
- Sugerir abordagem alternativa

**Se "2" (Ajustar expectativa):**
```
Removendo restrição: "NÃO criar endpoint em serviço X"

⚠️ Isso será registrado em _meta.json como ajuste de expectativa.
Motivo do ajuste (opcional):
> [usuário fornece motivo]
```

Atualizar `_meta.json`:
```json
{
  "expectation": {
    "mustNot": ["Usar API externa"],
    "adjustments": [{
      "type": "removed_mustNot",
      "item": "Criar endpoint no serviço X",
      "reason": "Necessário por limitação técnica",
      "taskId": "T001-003",
      "timestamp": "2026-01-11T14:30:00Z"
    }]
  }
}
```

**Se "3" (Continuar como desvio):**
```
⚠️ Registrando desvio...

Task T001-003 marcada como "completed_with_deviation".
```

Atualizar `progress.md`:
```markdown
- [x] T001-003 [14:00 → 14:30] ⚠️ DESVIO: Criou endpoint em serviço X
  - Motivo: [registrar motivo se fornecido]
```

Atualizar `_meta.json`:
```json
{
  "migrations": {
    "001": {
      "deviations": [{
        "taskId": "T001-003",
        "violation": "Criar endpoint no serviço X",
        "reason": "...",
        "timestamp": "2026-01-11T14:30:00Z"
      }]
    }
  }
}
```

#### 5.6.5 Se Nenhuma Violação

```
✅ Validação OK - Nenhuma restrição violada
```

Prosseguir normalmente com a marcação da task.

#### 5.6.6 Validação Automática de Padrões Comuns

Para detectar violações automaticamente, verificar padrões:

| Restrição | Padrão de Detecção |
|-----------|-------------------|
| "NÃO criar em services/x/" | Arquivo criado em `services/x/**` |
| "NÃO usar API externa" | Import de `axios`, `fetch` para URLs externas |
| "NÃO usar localStorage" | Código contém `localStorage.` |
| "NÃO criar novo endpoint" | Arquivo em `**/endpoints/**` ou `**/routes/**` |
| "NÃO modificar schema" | Alteração em `**/schema.prisma` ou migrations |

### Step 5.5: Expectation Checkpoint (NEW)

A cada 3 tasks completadas, pausar e verificar alinhamento com expectativa.

#### 5.5.1 Trigger

Checkpoint dispara quando:
- `completed_in_session % 3 == 0` (a cada 3 tasks)
- AND `remaining_tasks > 0` (não está no final)
- AND NÃO está usando `--all` flag

#### 5.5.2 Prompt do Checkpoint

```
⏸️ Checkpoint - {completed}/{total} tasks completas

**Sua expectativa:**
> {expectation_from_meta}

**Completadas até agora:**
- [x] T001-001: Created ThemeContext
- [x] T001-002: Updated database schema
- [x] T001-003: Created toggle component

**Restantes:**
- [ ] T001-004: Add to settings page
- [ ] T001-005: API endpoint

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Isso ainda está alinhado com sua expectativa? [Y/n/ajustar]
```

#### 5.5.3 Respostas do Usuário

**Se "Y" ou Enter (default):**
```
✓ Continuando implementação...
```

**Se "n":**
```
⏹️ Implementação pausada.

**Opções:**
1. /sedd.clarify - Criar nova migration para ajustes
2. Continuar mesmo assim
3. Marcar tasks restantes como blocked

O que deseja fazer?
```

**Se "ajustar":**
```
O que mudou na sua expectativa?
(Isso será registrado mas não altera as tasks existentes)
```

Registrar em `progress.md`:
```markdown
## Expectation Notes

### Checkpoint em T001-003 (2026-01-11 14:30)
**Original:** User can toggle dark mode in settings
**Nota do usuário:** Também quero detecção de preferência do sistema
**Ação:** Continuar com tasks atuais, criar migration 002 depois
```

#### 5.5.4 Configuração

Intervalo pode ser ajustado:
- Default: A cada 3 tasks
- Override: `/sedd.implement --checkpoint=5` (a cada 5)
- Desabilitar: `/sedd.implement --no-checkpoint`

### Step 6: Migration Boundaries

When completing a migration's tasks:

```
✅ Migration 001 complete!

All 5 tasks finished:
- T001-001 ✓
- T001-002 ✓
- T001-003 ✓
- T001-004 ✓
- T001-005 ✓
```

### Step 7: Final Validation with Acceptance Criteria (ENHANCED)

Quando todas as tasks de uma migration forem completadas, validar usando acceptance criteria.

#### 7.1 Carregar Acceptance Criteria

Se `{migration}/acceptance.md` existe, carregar os critérios.
Também carregar `expectation.must[]` e `expectation.mustNot[]` de `_meta.json`.

#### 7.2 Prompt de Verificação

```
🏁 Migration 001 Completa!

**Todas {N} tasks finalizadas.**

**Sua expectativa era:**
> {expectation.summary}

━━━ CRITÉRIOS POSITIVOS (DEVE) ━━━
- [ ] AC-001: User can access dark mode toggle
- [ ] AC-002: Toggle changes theme immediately
- [ ] AC-003: Theme persists after refresh

━━━ CRITÉRIOS NEGATIVOS (NÃO DEVE) ━━━
- [ ] AC-N01: Nenhum arquivo criado em services/x/
- [ ] AC-N02: Nenhuma chamada a API externa
- [ ] AC-N03: Não usa localStorage

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Por favor verifique cada critério. Quais foram atendidos?

**Positivos (DEVE):** all, none, ou IDs como "1,2"
**Negativos (NÃO DEVE):** all, none, ou IDs como "N1,N2"
```

#### 7.3 Processar Resposta

**Se "all":**
```
✅ Todos os critérios atendidos!

Atualizando acceptance.md...
Migration 001 marcada como completa com sucesso total.
```

Atualizar `acceptance.md`:
```markdown
## Sign-off

| Critério | Status | Verificado Por | Data |
|----------|--------|----------------|------|
| AC-001 | passed | user | 2026-01-11 |
| AC-002 | passed | user | 2026-01-11 |
| AC-003 | passed | user | 2026-01-11 |
| AC-004 | passed | user | 2026-01-11 |
```

**Se parcial (ex: "1,2"):**
```
⚠️ Alguns critérios não atendidos

**Atendidos:**
- [x] AC-001: User can access dark mode toggle
- [x] AC-002: Toggle changes theme immediately

**Não Atendidos:**
- [ ] AC-003: Theme persists after refresh
- [ ] AC-004: Theme persists across sessions

**Opções:**
1. Criar migration de follow-up para critérios faltando
2. Marcar como completo com notas (entrega parcial)
3. Manter migration aberta para debug

O que deseja fazer?
```

#### 7.4 Follow-up Migration

Se usuário escolhe opção 1:
```
Criando migration de follow-up...

Expectativa sugerida para nova migration:
> "Theme should persist after page refresh and across browser sessions"

Deseja rodar /sedd.clarify agora? [Y/n]
```

#### 7.5 Atualizar _meta.json

Registrar resultado da validação:
```json
{
  "migrations": {
    "001": {
      "status": "completed",
      "expectationMet": "partial",
      "criteriaResults": {
        "passed": ["AC-001", "AC-002"],
        "failed": ["AC-003", "AC-004"],
        "deferredTo": "002"
      },
      "completedAt": "2026-01-11T15:30:00Z"
    }
  }
}
```

#### 7.6 Atualizar acceptance.md

```markdown
## Sign-off

| Critério | Status | Verificado Por | Data |
|----------|--------|----------------|------|
| AC-001 | passed | user | 2026-01-11 |
| AC-002 | passed | user | 2026-01-11 |
| AC-003 | deferred | - | - |
| AC-004 | deferred | - | - |

## Notas
AC-003, AC-004 diferidos para migration 002.
```

#### 7.7 Se Não Existir acceptance.md

Fazer verificação simplificada:
```
🏁 Migration 001 Completa!

**Sua expectativa era:**
> {expectation}

Sua expectativa foi atendida? [Y/n/parcial]
```

Se "parcial", perguntar o que faltou e sugerir nova migration.

### Step 8: Ask About Commit

```
Do you want to commit?
Message: "feat(024): implement migration 001"
```

### Step 9: Update Changelog

After completing a migration:

```markdown
## [2026-01-11] - Migration 001 Implemented

- Completed 5 tasks
- Created ThemeContext
- Updated database schema
- Added settings toggle
```

### Step 10: Continue or Stop

**If `--all` or `-a` flag:**
- Do NOT ask, continue automatically
- Only ask about commit at the very end (all migrations done)
- Show progress summary between migrations:
  ```
  ✅ Migration 001 complete (5/5 tasks)
  → Continuing to migration 002...
  ```

**If NO flag (default):**
After each migration:

```
Migration 001 complete!

Next pending migration: 002 (3 tasks)

Continue with migration 002? [Y/n]
```

If user specified a migration ID, stop after that migration.

## Task States

```
pending     → in-progress → completed
                         → blocked
```

Only ONE task can be `in-progress` at a time.

## Progress.md Structure

```markdown
# Implementation Progress

## Summary
| Migration | Total | Done | Progress |
|-----------|-------|------|----------|
| 001 | 5 | 5 | 100% |
| 002 | 3 | 1 | 33% |
| **Total** | **8** | **6** | **75%** |

## Current Task
T002-002 [US2] Add validation

## Task Log

### Migration 001 (Completed)
- [x] T001-001 [10:30 → 10:45] Create ThemeContext
- [x] T001-002 [10:45 → 11:00] Update schema
- [x] T001-003 [11:00 → 11:30] Create toggle
- [x] T001-004 [11:30 → 11:45] Add to settings
- [x] T001-005 [11:45 → 12:00] API endpoint

### Migration 002 (In Progress)
- [x] T002-001 [14:00 → 14:15] Add tests
- [ ] T002-002 [14:15 → ...] Add validation
- [ ] T002-003 Pending
```

## Filtering Examples

```
/sedd.implement
```
Executes: T001-001, T001-002... (asks between migrations)

```
/sedd.implement --all
```
Executes: ALL tasks from ALL migrations without stopping.
Only asks about commit at the very end.

```
/sedd.implement -a
```
Same as `--all` (shorthand).

```
/sedd.implement 001
```
Executes: T001-001, T001-002, T001-003, T001-004, T001-005
Stops after migration 001.

```
/sedd.implement 002
```
Executes: All tasks from 001 AND 002
Stops after migration 002.

## Rules

- **CRITICAL: Update ALL 3 files when completing a task:**
  1. `{migration}/tasks.md` - change `[ ]` to `[x]`
  2. `progress.md` - mark task with `[x]` and timestamps
  3. `_meta.json` - increment tasksCompleted count
- ONE task in-progress at a time
- **With `--all` flag:** NO prompts between migrations, commit only at end
- **Without flag:** Ask about commit after each migration completes
- Convert interfaces to Zod on first run
- Update CHANGELOG after each migration
- Auto-split files > 400 lines

## File Sync Checklist

After completing each task, verify:
```
✓ tasks.md      → - [x] T001-001 ...
✓ progress.md   → - [x] T001-001 [time] ...
✓ _meta.json    → "tasksCompleted": N
```

If files are out of sync, fix immediately before continuing.
