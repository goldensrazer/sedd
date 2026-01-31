# /sedd.clarify - Clarify & Generate Tasks

## Purpose
Create a new migration with clarifications, decisions, AND tasks.

## Trigger
User runs `/sedd.clarify`

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

4. **Verify spec.md exists** in feature directory (run /sedd.specify first)

5. **Load _meta.json** from feature directory to get current state

## CRITICAL RULES

⚠️ **THIS COMMAND IS READ-ONLY FOR CODE**
- NEVER execute code
- NEVER create implementation files
- NEVER modify files outside specs/
- ONLY create migration folder with clarify/tasks/decisions

⚠️ **FLEXIBLE DISCUSSION MODE - INLINE COMMANDS**
- User can freely explain, discuss, and add notes at any time
- AI listens and records everything in clarify.md
- User controls the flow with inline commands:

| Comando | O que faz |
|---------|-----------|
| `continue` | Continuar explicando, AI anota |
| `pergunte` | AI faz próxima pergunta de clarificação |
| `tasks` | Gerar tasks.md e finalizar |

⚠️ **ALWAYS CREATES TASKS**
- Every clarify creates a NEW migration
- Every migration has tasks.md (generated at the end)
- Tasks reference this migration ID

⚠️ **ANNOTATE EVERYTHING - TUDO VIRA TASK**
- Cada ponto do usuario → anotar como fonte de task
- Cada sugestao da AI aceita → anotar como fonte de task
- Cada decisao tomada → anotar implicacoes como fontes de task
- Cada edge case levantado → anotar como fonte de task
- Formato: **[TASK_SOURCE:{tipo}]** antes de cada ponto anotado
- Tipos: user-req, ai-suggestion, decision, edge-case, constraint

## Workflow

### Step 1: Load Context PRIMEIRO

Read from feature root:
- spec.md (especialmente `## Expectation` e user stories)
- interfaces.ts (entidades)
- _meta.json (expectation do specify)
- Previous migrations (if any)

### Step 1.5: Suggest Expectations (PROACTIVE)

Com base no contexto carregado, AI DEVE:

1. Apresentar a expectativa original da spec:
   > "Expectativa original (da spec): {quote}"

2. SUGERIR expectativas adicionais para esta migration baseado em:
   - User stories nao cobertas por migrations anteriores
   - Edge cases identificados nas interfaces
   - Dependencias entre entidades
   - Potenciais problemas de performance/seguranca
   - Gaps entre a expectativa original e o que ja foi implementado

3. Apresentar assim:
   ```
   Com base na spec e no que ja temos, sugiro para esta migration:

   DEVE:
   - [sugestao 1 baseada na spec]
   - [sugestao 2 baseada em edge case]
   - [sugestao 3 baseada em dependencia]

   NAO DEVE:
   - [restricao identificada]

   Potenciais que identifiquei:
   - [concern 1]
   - [concern 2]

   Quer acrescentar algo? Quer que eu veja outro potencial?
   ```

4. Aguardar usuario confirmar, ajustar, ou adicionar
5. SO ENTAO consolidar expectativa final (summary + must + mustNot)

Save in `clarify.md` under `## Expected Outcome` section (NO TOPO).

**NÃO PROSSIGA** sem a expectativa do usuário confirmada.

### Step 2: Detail MUST and MUST NOT (STRUCTURED EXPECTATION)

Após consolidar as expectativas (originais + sugeridas + usuario), detalhar com regras claras:

```
Agora vamos detalhar sua expectativa:

**O que DEVE acontecer?** (requisitos obrigatórios)
Exemplo: "Criar domínio no monolito", "Usar padrão repository"
> [usuário lista]

**O que NÃO DEVE acontecer?** (restrições/proibições)
Exemplo: "NÃO criar endpoint em serviço X", "NÃO usar API externa"
> [usuário lista]
```

Se usuário não tiver restrições, aceitar resposta vazia para `mustNot`.

Save in `clarify.md` under `## Expectation Details`:

```markdown
## Expectation Details

### DEVE fazer:
- Criar novo domínio no monolito
- Usar padrão repository existente

### NÃO DEVE fazer:
- ❌ Criar endpoint no serviço X
- ❌ Usar API externa
```

**Estrutura para _meta.json** (será salvo no Step 8):
```json
{
  "expectation": {
    "summary": "texto livre do usuário",
    "must": ["item1", "item2"],
    "mustNot": ["item1", "item2"]
  }
}
```

### Step 3: Create New Migration Folder

Generate new migration folder:

```
Migration ID: 001 (or next: 002, 003...)
Timestamp: 2026-01-11_10-30-45
Folder: 001_2026-01-11_10-30-45/
```

Create initial structure:
```
specs/024-feature/
└── 001_2026-01-11_10-30-45/
    ├── clarify.md      # Will be updated incrementally
    ├── tasks.md        # Created at the end
    └── decisions.md    # Updated after each answer
```

Initialize clarify.md:
```markdown
# Clarification - Migration 001

**Timestamp:** 2026-01-11 10:30:45
**Branch:** 024-feature
**Parent:** (none)

## Expected Outcome

> User's expected outcome from this migration

[Captured from Step 2]

---

## Questions & Answers

```

### Step 4: Start Interactive Session

Present the clarification session with available commands:

```
📝 Clarification Session - Migration 001
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Spec loaded: spec.md
Interfaces: interfaces.ts

Você pode explicar livremente o que precisa.
Eu vou anotar tudo e fazer perguntas quando necessário.

Digite um comando para controlar o fluxo:

  continue  → Continuar explicando
  pergunte  → AI faz próxima pergunta
  tasks     → Gerar tasks e finalizar

Como você quer começar?
```

### Step 5: Flexible Discussion Loop

The AI responds based on user input:

#### 5.1 User Explains/Discusses (Default Mode)

When user provides information (not a command):

1. **Listen and understand** the user's explanation
2. **Update clarify.md immediately** with notes:

```markdown
## Notes & Discussions

### Note 001 - 10:30:45
**User said:**
"O sistema precisa suportar múltiplos tenants, cada um com suas próprias configurações..."

**Key Points Extracted:**
- **[TASK_SOURCE:user-req]** Multi-tenant architecture required
- **[TASK_SOURCE:user-req]** Per-tenant configuration
- **[TASK_SOURCE:ai-suggestion]** Isolation strategy needs definition
- **[TASK_SOURCE:edge-case]** Cross-tenant data leaks prevention

---
```

3. **Update decisions.md** if a decision is implied:

```markdown
## D001-001: Multi-tenant Architecture

**Source:** User explanation (Note 001)

**Decision:**
System will support multiple tenants with isolated configurations.

**Impact:**
- Database schema needs tenant_id
- API routes need tenant context
- Auth must include tenant info

---
```

4. **Acknowledge and prompt for more:**

```
✓ Anotado: Multi-tenant com configurações isoladas

Digite um comando:
  continue  → Continuar explicando
  pergunte  → AI faz próxima pergunta
  tasks     → Gerar tasks e finalizar
```

#### 5.2 User Says "continue"

Keep in discussion mode:

```
Ok, continue explicando...
```

#### 5.3 User Says "pergunte"

AI analyzes gaps and asks ONE clarification question:

```
---
Q1: Tenant Isolation Level
**Impact:** High | **Area:** Architecture

Como deve ser o isolamento entre tenants?

┌───────┬───────────────────────────────────────┐
│ Opção │          Descrição                    │
├───────┼───────────────────────────────────────┤
│ A     │ Logical (same DB, tenant_id filter)   │
│ B     │ Schema (separate schemas per tenant)  │
│ C     │ Physical (separate DBs per tenant)    │
└───────┴───────────────────────────────────────┘

Sua resposta (ou continue explicando):
---
```

After user answers, update clarify.md and decisions.md immediately.

#### 5.4 User Says "tasks"

Proceed to Step 6 (Generate Tasks).

### Step 6: Generate tasks.md (After All Q&A Complete)

Ao gerar tasks, VARRER clarify.md por TODOS os `[TASK_SOURCE:*]` tags:
- Cada tag com tipo `user-req` → task obrigatoria
- Cada tag com tipo `ai-suggestion` (aceita) → task obrigatoria
- Cada tag com tipo `decision` → task para implementar decisao
- Cada tag com tipo `edge-case` → task de validacao/protecao
- Cada tag com tipo `constraint` → task de teste negativo

Based on all decisions and TASK_SOURCE tags, create tasks:

```markdown
# Tasks - Migration 001

**Migration:** 001
**Timestamp:** 2026-01-11_10-30-45
**Parent:** (none)

## Summary
Total: 5 | Completed: 0 | Pending: 5

## Tasks

- [ ] T001-001 [Foundation] Create ThemeContext in `src/contexts/ThemeContext.tsx`
- [ ] T001-002 [Foundation] Add theme column to users table `prisma/schema.prisma`
- [ ] T001-003 [US1] Create ThemeToggle component `src/components/ThemeToggle.tsx`
- [ ] T001-004 [US1] Add toggle to settings page `src/pages/settings.tsx`
- [ ] T001-005 [US1] Implement theme API endpoint `src/api/user/theme.ts`

## Dependencies

T001-001, T001-002 → T001-003 → T001-004
                   → T001-005
```

### Step 6.5: Generate Acceptance Criteria (NEW)

Após gerar tasks, criar critérios de aceite baseados na expectativa:

#### 6.5.1 Transformar Expectativa em Critérios

Regras de geração:

| Padrão na Expectativa | Critério Gerado |
|----------------------|-----------------|
| "can {verb}" | User can perform {verb} |
| "persist" ou "save" | Data survives refresh/session |
| "{noun} in {location}" | {noun} appears in {location} |
| "across {context}" | Works in multiple {context} |
| "immediately" | Response time < 100ms |

**Exemplo:**

Expectativa: "User can toggle dark mode in settings and persist across sessions"

Critérios gerados:
```markdown
- [ ] **AC-001:** User can toggle dark mode
  - Verificar: Clicar no toggle, tema muda

- [ ] **AC-002:** Toggle está em settings
  - Verificar: Navegar para settings, toggle visível

- [ ] **AC-003:** Theme persists after refresh
  - Verificar: Setar dark mode, refresh, tema permanece

- [ ] **AC-004:** Theme persists across sessions
  - Verificar: Fechar browser, reabrir, tema permanece
```

#### 6.5.2 Criar acceptance.md

Escrever em `{migration_folder}/acceptance.md` usando template.

#### 6.5.3 Linkar em tasks.md

Adicionar ao final de tasks.md:
```markdown
---

## Acceptance Criteria

Ver `acceptance.md` para checklist de verificação.
```

### Step 7: Expectation Alignment Check + Score

Após gerar tasks E acceptance criteria, calcular score de alinhamento:

#### 7.1 Extrair Keywords da Expectativa

```
PASSO 1: Tokenizar expectativa
  - Dividir em palavras
  - Remover stop words (the, a, an, is, are, can, will, to, for, in, on, and, or, user, etc.)
  - Extrair termos significativos

PASSO 2: Pesar tokens
  - Verbos (ações): peso 3
  - Substantivos (entidades): peso 2
  - Modificadores: peso 1

Exemplo: "User can toggle dark mode in settings and persist across sessions"
Tokens: {toggle: 3, dark: 1, mode: 2, settings: 2, persist: 3, sessions: 1}
Total: 12
```

#### 7.2 Verificar Cobertura nas Tasks

Para cada token, buscar nas descrições das tasks geradas.

#### 7.3 Calcular Score

```
matched_weight = soma dos pesos dos tokens encontrados
score = (matched_weight / total_weight) * 100
```

#### 7.4 Exibir Resultado

**Se coverage >= 80%:**
```
📊 Coverage: ~{score}% 🟢

**Sua expectativa:**
> {expectation}

**Tokens encontrados nas tasks:**
  ✅ toggle (T001-003) - peso 3
  ✅ dark mode (T001-003, T001-004) - peso 3
  ✅ settings (T001-004) - peso 2
  ✅ persist (T001-003) - peso 3
  ❌ sessions - peso 1

Score: 11/12 = 92%

✅ Boa cobertura! Tasks prontas.
```

**Se coverage 60-79%:**
```
📊 Coverage: ~{score}% 🟡

**Sua expectativa:**
> {expectation}

**Cobertos:**
  ✅ toggle (T001-003)
  ✅ dark mode (T001-003)

**Faltando:**
  ❌ persist - nenhuma task menciona
  ❌ sessions - não encontrado

⚠️ Cobertura parcial. Deseja adicionar tasks para cobrir os gaps? [Y/n]
```

**Se coverage < 60%:**
```
📊 Coverage: ~{score}% 🔴

**Sua expectativa:**
> {expectation}

**Cobertos:**
  ✅ toggle (T001-003)

**Faltando:**
  ❌ dark mode
  ❌ settings
  ❌ persist
  ❌ sessions

⚠️ Cobertura baixa! Recomendo adicionar mais tasks.

**Opções:**
1. Adicionar tasks para conceitos faltando
2. Prosseguir assim mesmo
3. Refinar expectativa

O que deseja fazer?
```

#### 7.5 Se Usuário Escolhe Adicionar Tasks

Voltar ao modo discussão:
```
Vamos adicionar tasks para os conceitos faltando.

Faltando: "persist", "sessions"

Como você imagina a persistência funcionando?
```

### Step 8: Update _meta.json

```json
{
  "currentMigration": "001",
  "migrations": {
    "001": {
      "id": "001",
      "timestamp": "2026-01-11_10-30-45",
      "folder": "001_2026-01-11_10-30-45",
      "status": "in-progress",
      "tasksTotal": 5,
      "tasksCompleted": 0,
      "createdAt": "2026-01-11T10:30:45Z",
      "expectation": {
        "summary": "User can toggle dark mode and have it persist",
        "must": [
          "Criar toggle de dark mode",
          "Persistir preferência no banco"
        ],
        "mustNot": [
          "Criar endpoint no serviço X",
          "Usar localStorage (usar banco)"
        ]
      }
    }
  }
}
```

### Step 9: Update CHANGELOG.md

```markdown
## [2026-01-11] - Migration 001

- Clarified 5 requirements
- Created 5 decisions
- Generated 5 tasks
- Areas covered: Persistence, API, UI
```

### Step 10: Ask About Commit

```
Migration 001 completed with 5 tasks!

Do you want to commit?
Message: "docs(024): migration 001 - clarify requirements and generate tasks"
```

### Step 11: Offer Next Steps

```
What would you like to do?

1. /sedd.clarify - Create another migration (more clarifications)
2. /sedd.implement - Start implementing tasks
3. /sedd.implement 001 - Implement only this migration
```

## Task ID Format

Tasks are prefixed with migration ID:

```
T001-001  = Migration 001, Task 1
T001-002  = Migration 001, Task 2
T002-001  = Migration 002, Task 1
```

## Running Multiple Times

Each `/sedd.clarify` creates a NEW migration:

```
1st run: 001_2026-01-11_10-30-45/
2nd run: 002_2026-01-11_14-15-30/
3rd run: 003_2026-01-12_09-00-00/
```

Parent references allow tracking the evolution:
- 002.parent = 001
- 003.parent = 002

## Rules

- **NEVER EXECUTE CODE** - Design phase only
- **FLEXIBLE DISCUSSION** - User controls the flow with inline commands
- **UPDATE FILES IMMEDIATELY** - After each user input
- **RECOGNIZE INLINE COMMANDS:**
  - `continue` → Continuar explicando
  - `pergunte` → AI faz próxima pergunta
  - `tasks` → Gerar tasks e finalizar
- ALWAYS generate tasks.md when user says "tasks"
- Task IDs include migration ID (T001-XXX)
- Each clarify = new migration folder
- Auto-split files > 400 lines

## Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│  User runs /sedd.clarify                                    │
│  → AI creates migration folder                              │
│  → AI shows available commands                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  DISCUSSION LOOP                                            │
│                                                             │
│  User explains → AI records in clarify.md + decisions.md    │
│       ↓                                                     │
│  "continue" → AI: "Ok, continue..."                         │
│  "pergunte" → AI asks ONE question                          │
│  "tasks"    → Exit loop, generate tasks                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  User says "tasks"                                          │
│  → AI generates tasks.md from all notes + decisions         │
│  → AI updates _meta.json                                    │
│  → AI asks about commit                                     │
│  → AI offers next steps                                     │
└─────────────────────────────────────────────────────────────┘
```

## CLI Alternative

For automated workflows, use the SEDD CLI:

```bash
# Create new migration (creates clarify.md, tasks.md, decisions.md)
sedd clarify

# Create migration pre-populated from a GitHub issue
sedd clarify --from-issue https://github.com/owner/repo/issues/42

# Add tasks to current migration
sedd tasks '[{"story":"US1","description":"Task description"}]'

# Mark task complete
sedd complete T001-001

# Check status
sedd status
```

**Options:**
- `--from-issue <url>` - Pre-populate clarify.md with context from a GitHub issue

### --from-issue Flow

When `--from-issue` is provided:

1. Fetches issue title and body from GitHub
2. **Downloads images** from the issue body to `{migration}/assets/` and rewrites links to relative paths (e.g. `./assets/image-001.png`), so the AI can see the visual content via Read tool
3. Pre-populates `clarify.md` with:
   - `## Context (from GitHub Issue #N)` containing the issue body (with local image paths)
   - `## Expected Outcome` set to the issue title
4. Links migration to the issue in `.github-sync.json`
5. Comments on the issue: "SEDD migration {id} started from this issue"

Supported image formats: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, and any `github.com/user-attachments` URL.
If a download fails, the original URL link is kept.

**Requires:** `gh` CLI installed and authenticated. GitHub integration (`sedd github setup`) needed for board/comment features.

Scripts also available in `.sedd/scripts/powershell/` and `.sedd/scripts/bash/`.
