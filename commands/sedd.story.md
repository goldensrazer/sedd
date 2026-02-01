# /sedd.story - Create User Story as GitHub Issue

## Purpose
Create a GitHub Issue in the **Como/Quero/Para** format with **ESPERA-SE** expectations.

## Trigger
User runs `/sedd.story`

## Pre-flight Checks

1. **Read sedd.config.json** to get `specsDir` and GitHub config
2. **Check gh CLI** is installed and authenticated
3. **Get current branch** from git
4. **Check if on feature branch** with existing spec (for --from-spec)

## Workflow

### Step 1: Detect Context

Check if the user is on a feature branch with a spec:

```
git rev-parse --abbrev-ref HEAD → "001-my-feature"
```

If `{specsDir}/{branch}/spec.md` and `{specsDir}/{branch}/_meta.json` exist:

```
Detectei que voce esta na feature branch "001-my-feature" com spec existente.

Deseja pre-popular a story a partir da spec? [Y/n]
```

If user says yes, read spec.md and _meta.json to extract:
- Feature name → title
- User stories (Como/Quero/Para)
- Expectation → ESPERA-SE items
- Acceptance criteria → Criterios de Aceite
- Technical requirements → Contexto Tecnico

### Step 2: Collect Como/Quero/Para

If not pre-populated, ask the user:

```
Vamos criar uma User Story como GitHub Issue.

**Como** (tipo de usuario):
> Ex: "administrador do sistema", "usuario final", "desenvolvedor"
```

Wait for user response, then:

```
**Quero** (acao desejada):
> Ex: "fazer check-in automatico", "visualizar relatorio"
```

Wait for user response, then:

```
**Para** (beneficio esperado):
> Ex: "reduzir acoes manuais", "tomar decisoes mais rapidas"
```

### Step 3: Collect ESPERA-SE (Expectations)

```
Agora, liste as expectativas (ESPERA-SE).
Digite uma por vez. Quando terminar, digite "pronto".

ESPERA-SE 1:
>
```

Collect multiple expectations. Each response adds one.
When user says "pronto", "done", or similar, move to next step.

### Step 4: Collect Criterios de Aceite (Optional)

```
Criterios de Aceite (opcional).
Cada criterio vira um checkbox na issue.
Digite um por vez. "pronto" para pular/finalizar.

Criterio 1:
>
```

### Step 5: Contexto Tecnico (Optional)

```
Contexto tecnico DDD (opcional):
> Ex: "Aggregate root: Booking, Repository pattern, Event sourcing"
> Digite "pular" para ignorar.
```

### Step 6: Labels

```
Labels (separadas por virgula, default: user-story):
>
```

If user just presses enter or says "default", use `user-story`.

### Step 7: Preview & Confirmation

Show the full issue preview:

```
━━━ PREVIEW DA ISSUE ━━━

Titulo: {title}
Labels: {labels}

## Estoria de Usuario

**Como:** {como}
**Quero:** {quero}
**Para:** {para}

## Expectativas

- **ESPERA-SE:** {exp1}
- **ESPERA-SE:** {exp2}

## Criterios de Aceite

- [ ] {crit1}
- [ ] {crit2}

## Contexto Tecnico

{contexto}

━━━━━━━━━━━━━━━━━━━━━━━

Criar issue? [Y/n/editar]
```

If user says "editar", ask which field to change.

### Step 8: Execute

Build and run the sedd CLI command:

```bash
sedd story --title "titulo" --como "tipo" --quero "acao" --para "beneficio" --expectativas "exp1;exp2" --criterios "crit1;crit2" --contexto "contexto" --labels "user-story"
```

Or, if from spec:

```bash
sedd story --from-spec --title "override title if needed"
```

### Step 9: Confirm Result

After execution, show:

```
Issue #42 criada com sucesso!
URL: https://github.com/owner/repo/issues/42

Adicionada ao projeto "My Kanban" na coluna "Todo"

Proximo passo:
1. /sedd.specify 042 from-issue --from-issue <url>  (criar feature a partir desta story)
2. /sedd.story  (criar outra story)
```

## Rules

- **NEVER modify code** - This command only creates GitHub issues
- **ALWAYS preview** before creating the issue
- **ALWAYS ask for confirmation** before executing
- Fields from --from-spec are suggestions, user can override any
- Multiple ESPERA-SE are encouraged (minimum 1)
- Criterios de Aceite are optional but recommended
- Contexto Tecnico is optional
- Default label is `user-story`

## CLI Alternative

For automated/scripted workflows:

```bash
# Standalone: all fields via flags
sedd story --title "Auto check-in" --como "usuario" --quero "check-in automatico" --para "reduzir acoes manuais" --expectativas "check-in ao chegar;check-out ao sair"

# From current feature spec
sedd story --from-spec

# From spec with overrides
sedd story --from-spec --title "Custom title" --labels "user-story,mvp"

# With acceptance criteria
sedd story --title "Dark mode" --como "usuario" --quero "alternar dark mode" --para "conforto visual" --expectativas "toggle funciona;persiste entre sessoes" --criterios "toggle visivel em settings;tema muda imediatamente"
```

**Options:**

| Flag | Descricao |
|------|-----------|
| `-t, --title <title>` | Titulo da issue |
| `--como <como>` | Tipo de usuario |
| `--quero <quero>` | Acao desejada |
| `--para <para>` | Beneficio esperado |
| `--expectativas <exp>` | ESPERA-SE separadas por `;` |
| `--criterios <crit>` | Criterios de aceite separados por `;` |
| `--contexto <ctx>` | Contexto tecnico DDD |
| `--labels <labels>` | Labels separadas por `,` (default: `user-story`) |
| `--from-spec` | Ler da spec da feature atual |
