# SEDD - Spec & Expectation Driven Development

> Desenvolvimento orientado por especificações **e expectativas** com sistema de migrations incrementais.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![npm](https://img.shields.io/npm/v/sedd.svg)](https://www.npmjs.com/package/sedd)

### Compatível com

<p>
  <img src="https://img.shields.io/badge/Claude_Code-blueviolet?style=for-the-badge&logo=anthropic" alt="Claude Code" />
  <img src="https://img.shields.io/badge/Cursor-000000?style=for-the-badge&logo=cursor" alt="Cursor" />
  <img src="https://img.shields.io/badge/GitHub_Copilot-000000?style=for-the-badge&logo=github" alt="GitHub Copilot" />
  <img src="https://img.shields.io/badge/Windsurf-0066FF?style=for-the-badge" alt="Windsurf" />
  <img src="https://img.shields.io/badge/Gemini_CLI-4285F4?style=for-the-badge&logo=google" alt="Gemini CLI" />
</p>

---

## Para que serve o SEDD?

SEDD é ideal para:

| Caso de Uso | Descrição |
|-------------|-----------|
| **Features** | Novas funcionalidades com requisitos claros |
| **Projetos** | Projetos completos com múltiplas entregas |
| **Investigação** | Análise de código existente com estimativas |
| **Melhorias** | Refatorações e otimizações planejadas |

---

## Quick Start

```bash
# Instalar
npm install -g sedd

# Inicializar no projeto
cd meu-projeto
sedd init

# Criar feature spec
sedd specify 001 user-auth

# Usar AI assistant
claude  # ou cursor, copilot, etc.

# Comandos no AI
/sedd.clarify    # Definir expectativa e gerar tasks
/sedd.implement  # Executar tasks
```

---

## O que é SEDD?

SEDD captura sua **expectativa** antes de qualquer código. A AI sempre sabe o que você espera.

```
🎯 EXPECTATIVA: "User can toggle dark mode and persist across sessions"

📊 Coverage: ~85% 🟢

Tasks:
- T001-001: Create ThemeContext
- T001-002: Add toggle component
- T001-003: Persist to localStorage
```

---

## Expectation-First Workflow

### 1. Captura Obrigatória (DEVE / NÃO DEVE)

Ao usar `/sedd.specify` ou `/sedd.clarify`, a AI pergunta:

```
🎯 Qual é sua EXPECTATIVA para esta feature?

O que você espera ver funcionando quando estiver pronto?
```

E depois detalha com regras claras:

```
**O que DEVE acontecer?** (requisitos obrigatórios)
> Criar domínio no monolito, usar padrão repository

**O que NÃO DEVE acontecer?** (restrições/proibições)
> NÃO criar endpoint em serviço X, NÃO usar API externa
```

### 2. Score de Alinhamento

Ao gerar tasks, SEDD calcula cobertura:

```
📊 Coverage: ~83% 🟢

Tokens encontrados:
  ✅ toggle (T001-003)
  ✅ dark mode (T001-003, T001-004)
  ✅ persist (T001-003)
  ❌ sessions - não encontrado

⚠️ Deseja adicionar tasks para cobrir os gaps? [Y/n]
```

### 3. Acceptance Criteria Automático

SEDD gera `acceptance.md` baseado na expectativa:

```markdown
## Checklist de Aceite

- [ ] AC-001: User can toggle dark mode
- [ ] AC-002: Toggle está em settings
- [ ] AC-003: Theme persists after refresh
- [ ] AC-004: Theme persists across sessions
```

### 4. Validação Por Task (NÃO DEVE)

Antes de marcar qualquer task como concluída, SEDD valida contra restrições:

```
⚠️ VALIDAÇÃO - Task T001-003

Arquivos modificados:
- services/x/endpoints/new.ts  ← ⛔ VIOLA "NÃO criar endpoint em serviço X"
- src/domains/novo/index.ts   ← ✅ OK

❌ Task viola restrição. Opções:
1. Reverter e refazer
2. Ajustar expectativa
3. Continuar (marcar como desvio)
```

### 5. Checkpoints Durante Implementação

A cada 3 tasks, SEDD verifica alinhamento:

```
⏸️ Checkpoint - 3/10 tasks completas

Sua expectativa:
> User can toggle dark mode and persist

Isso ainda está alinhado? [Y/n/ajustar]
```

### 6. Validação Final (DEVE + NÃO DEVE)

Ao completar migration, valida contra acceptance criteria:

```
🏁 Migration 001 Completa!

━━━ CRITÉRIOS POSITIVOS (DEVE) ━━━
- [x] AC-001: User can toggle ✓
- [x] AC-002: Toggle in settings ✓
- [ ] AC-003: Persist after refresh ✗

━━━ CRITÉRIOS NEGATIVOS (NÃO DEVE) ━━━
- [x] AC-N01: Nenhum arquivo em services/x/ ✓
- [x] AC-N02: Nenhuma API externa ✓

Criar migration de follow-up? [Y/n]
```

---

## Comandos CLI

| Comando | Descrição |
|---------|-----------|
| `sedd init` | Inicializar SEDD no projeto |
| `sedd specify <id> <name>` | Criar nova feature spec |
| `sedd specify <id> <name> --from-issue <url>` | Criar feature a partir de GitHub issue (baixa imagens) |
| `sedd clarify` | Criar migration com decisões |
| `sedd clarify --from-issue <url>` | Pre-popular migration com dados de GitHub issue (baixa imagens) |
| `sedd status` | Ver status atual |
| `sedd check` | Verificar estrutura e pre-requisitos |
| `sedd tasks <json>` | Adicionar tasks a migration atual |
| `sedd complete <task-id>` | Marcar task como concluida |
| `sedd estimate` | Estimar esforco da feature atual |
| `sedd validate` | Validar implementacao contra expectativa |
| `sedd board` | Kanban board no terminal |
| `sedd story` | Criar GitHub Issue como user story (Como/Quero/Para + ESPERA-SE) |
| `sedd story --from-spec` | Criar story a partir da spec da feature atual |
| `sedd update` | Atualizar templates e migrar features existentes |
| `sedd migrate` | Migrar specs legados para nova estrutura |
| `sedd github setup` | Configurar integracao com GitHub Projects |
| `sedd github status` | Ver status da integracao GitHub |
| `sedd github sync` | Forcar sync bidirecional com GitHub |
| `sedd github refresh` | Re-ler colunas do projeto GitHub |

## Slash Commands (AI)

| Comando | Descrição |
|---------|-----------|
| `/sedd.specify` | Criar spec (pergunta expectativa primeiro) |
| `/sedd.clarify` | Clarificar e gerar tasks com score |
| `/sedd.implement` | Executar tasks com checkpoints |
| `/sedd.implement --all` | Executar tudo sem parar |
| `/sedd.dashboard` | Ver status atual de migrations e tasks |
| `/sedd.estimate` | Estimar prazo e complexidade antes de começar |
| `/sedd.validate` | Validar implementação contra expectativa |
| `/sedd.story` | Criar user story interativa (Como/Quero/Para + ESPERA-SE) |
| `/sedd.board` | Ver kanban board da feature |
| `/sedd.tasks` | Gerar tasks para migration |
| `/sedd.migrate` | Migrar specs legados |

---

## Fluxo Completo de Uso

O SEDD funciona em um ciclo de 4 etapas principais:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  ESTIMATE   │────▶│   SPECIFY   │────▶│   CLARIFY   │────▶│  IMPLEMENT  │
│  (Opcional) │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                                       │                   │
       │                                       ▼                   ▼
       │                              ┌─────────────┐     ┌─────────────┐
       └──────────────────────────────│   CLARIFY   │◀────│  VALIDATE   │
                                      │  (repeat)   │     │  (ao final) │
                                      └─────────────┘     └─────────────┘
```

### 1. `/sedd.estimate` (Opcional - Antes de Começar)

Analisa o projeto e gera estimativa de prazo:

```
📊 ESTIMATIVA

Total:      16h
Humano:     4h (25%)  ← Decisões, revisão, edge cases
AI:         12h (75%) ← Boilerplate, implementação
Complexidade: M (Medium)
```

### 2. `/sedd.specify` - Criar Especificação

Cria a estrutura inicial da feature com:
- spec.md (especificação)
- interfaces.ts (tipos TypeScript)
- ui-mockups/ (se for UI)

### 3. `/sedd.clarify` - Clarificar e Gerar Tasks

Este é o comando mais importante. Ele usa um **modo de discussão flexível**:

```
📝 Clarification Session - Migration 001

Você pode explicar livremente o que precisa.
Eu vou anotar tudo e fazer perguntas quando necessário.

Comandos disponíveis:
  continue  → Continuar explicando
  pergunte  → AI faz próxima pergunta
  tasks     → Gerar tasks e finalizar
```

#### Comandos Inline do Clarify

| Comando | O que faz | Quando usar |
|---------|-----------|-------------|
| `continue` | Permite continuar explicando | Quando você tem mais contexto para adicionar |
| `pergunte` | AI faz uma pergunta de clarificação | Quando quer que a AI identifique gaps |
| `tasks` | Gera tasks.md e finaliza | Quando terminou de explicar tudo |

**Exemplo de sessão:**

```
Você: Preciso de um toggle de dark mode que persista

AI: ✓ Anotado. Comandos: continue | pergunte | tasks

Você: continue

AI: Ok, continue explicando...

Você: Deve ficar na página de settings, não no header

AI: ✓ Anotado: Toggle em settings, não no header

Você: pergunte

AI: Q1: Como deve ser a persistência?
    A) localStorage (mais simples)
    B) Banco de dados (sincroniza entre dispositivos)
    C) Cookie (SSR-friendly)

Você: B, banco de dados

AI: ✓ Decisão registrada: Persistência no banco

Você: tasks

AI: ✅ Gerando 5 tasks...
    📊 Coverage: 92% 🟢
```

### 4. `/sedd.implement` - Executar Tasks

Executa as tasks geradas, com validação contra expectativa.

### 5. `/sedd.validate` - Validar ao Final

Após implementar, valida se a expectativa foi atendida:

```
🔍 VALIDAÇÃO

Cobertura:    75% ████████████░░░░
Tasks:        3/4 completadas
Arquivos:     5 alterados (+180, -12)
Gaps:         1 encontrado

⚠️ Gap: "sessions" não coberto
   Criar task de follow-up? [Y/n]
```

---

## Estrutura de Pastas

```
.sedd/001-user-auth/
├── spec.md                       # Especificação + Expectativa
├── _meta.json                    # Metadados + expectation estruturada
├── assets/                       # Imagens baixadas de GitHub issues
│   ├── image-001.png
│   └── image-002.jpg
│
├── 001_timestamp/                # Migration 1
│   ├── clarify.md               # Discussão + DEVE/NÃO DEVE
│   ├── decisions.md             # Decisões
│   ├── tasks.md                 # Tasks T001-XXX
│   ├── acceptance.md            # Critérios positivos e negativos
│   └── assets/                  # Imagens de --from-issue no clarify
│
└── progress.md                   # Progresso + checkpoints + desvios
```

### Estrutura de Expectativa em _meta.json

```json
{
  "expectation": {
    "summary": "User can toggle dark mode",
    "must": ["Criar toggle", "Persistir no banco"],
    "mustNot": ["Criar endpoint em serviço X", "Usar localStorage"]
  }
}
```

---

## Hooks Inteligentes

O hook `check-roadmap.js` sempre mostra expectativas E restrições:

```xml
<sedd-context>
Branch: 024-feature | Migration: 001 | Progress: 3/10 🟢 ~85%

🎯 FEATURE: User can customize theme
📍 MIGRATION 001: Toggle dark mode with persistence

⛔ NÃO DEVE:
- ❌ Criar endpoint no serviço X
- ❌ Usar localStorage

Pending tasks:
- T001-004: Add to settings page
- T001-005: API endpoint
</sedd-context>
```

---

## GitHub Integration

SEDD integra com GitHub Projects V2 para sincronizar tasks como issues e gerenciar status via kanban board.

### Passo a passo

**1. Instalar GitHub CLI**

```bash
# Windows
winget install GitHub.cli

# Mac
brew install gh

# Linux
sudo apt install gh
```

**2. Autenticar**

```bash
gh auth login
```

Selecione as opcoes:
- `GitHub.com`
- `HTTPS`
- `Login with a web browser`

O terminal vai mostrar um codigo (ex: `XXXX-XXXX`). Copie o codigo no terminal e cole no navegador quando solicitado.

Verifique:
```bash
gh auth status
```

**3. Adicionar scope de projetos**

```bash
gh auth refresh -s project
```

O terminal vai mostrar outro codigo. Mesmo processo: copie no terminal e cole no navegador.

**4. Ter um GitHub Project**

Va em github.com > seu repo > Projects > New Project > Board.
Crie colunas como: Todo, In Progress, Done.

**5. Configurar SEDD**

```bash
sedd github setup
```

O setup interativo vai:
- Detectar seu repositorio
- Listar suas organizacoes e conta pessoal
- Permitir escolher o owner dos projetos
- Listar projetos disponiveis
- Mapear colunas do board

### Comandos GitHub

| Comando | Descricao |
|---------|-----------|
| `sedd github setup` | Configuracao interativa |
| `sedd github status` | Ver config e testar conexao |
| `sedd github sync` | Forcar sync bidirecional |
| `sedd github refresh` | Re-ler colunas se mudaram no GitHub |
| `sedd board` | Kanban board no terminal |

### Funcionalidades

- Use `--from-issue <url>` no `sedd specify` ou `sedd clarify` para criar features/migrations a partir de GitHub issues
- Imagens da issue sao baixadas automaticamente para `assets/` e os links reescritos para paths relativos, permitindo que a AI veja o conteudo visual
- Use `sedd board` para visualizar o kanban no terminal
- Multi-org: escolha entre suas organizacoes e conta pessoal durante o setup

### From Issue com Download de Imagens

Ao usar `--from-issue`, o SEDD automaticamente:

1. Busca titulo, body e labels da issue
2. Detecta imagens no body (`.png`, `.jpg`, `.gif`, `.webp`, `.svg` e `github.com/user-attachments`)
3. Baixa cada imagem para `assets/` dentro do diretorio da feature/migration
4. Reescreve os links markdown para paths relativos (`./assets/image-001.png`)

```bash
sedd specify 042 from-issue --from-issue https://github.com/org/repo/issues/42

  ✓ Issue #42: Add dark mode toggle
  ✓ Downloaded 3 images to assets/
```

Resultado no `spec.md`:
```markdown
![screenshot](./assets/image-001.png)
![mockup](./assets/image-002.png)
```

Isso permite que a AI veja o conteudo visual das imagens via Read tool, em vez de apenas a URL como texto.

Se o download de alguma imagem falhar, o link original e mantido.

### User Story como GitHub Issue

O comando `sedd story` cria issues no formato **Como/Quero/Para** com expectativas (**ESPERA-SE**) e criterios de aceite. A issue e adicionada automaticamente ao GitHub Project configurado na coluna "Todo".

**Standalone — todos os campos via flags:**

```bash
sedd story \
  --title "Auto check-in" \
  --como "usuario do sistema" \
  --quero "check-in automatico ao chegar no local" \
  --para "reduzir acoes manuais e ganhar tempo" \
  --expectativas "check-in ao chegar;check-out ao sair;notificacao de confirmacao" \
  --criterios "sistema detecta localizacao;registro com timestamp" \
  --contexto "Aggregate root: Booking, Event sourcing" \
  --labels "user-story,mvp"
```

**From spec — le da feature atual:**

```bash
# Na branch da feature (ex: 001-user-auth)
sedd story --from-spec

# Com override de titulo
sedd story --from-spec --title "Titulo customizado"
```

O `--from-spec` extrai automaticamente de `_meta.json` e `spec.md`:
- Nome da feature → titulo
- User stories (Como/Quero/Para)
- Expectation → ESPERA-SE
- Acceptance criteria → Criterios de aceite
- Technical requirements → Contexto tecnico

**Resultado na issue:**

```markdown
## Estoria de Usuario

**Como:** usuario do sistema
**Quero:** check-in automatico ao chegar no local
**Para:** reduzir acoes manuais e ganhar tempo

## Expectativas

- **ESPERA-SE:** check-in ao chegar
- **ESPERA-SE:** check-out ao sair
- **ESPERA-SE:** notificacao de confirmacao

## Criterios de Aceite

- [ ] sistema detecta localizacao
- [ ] registro com timestamp
```

**Opcoes:**

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

**Slash command:** Use `/sedd.story` no Claude para criar a story de forma interativa, com preview e confirmacao antes de criar a issue.

---

## Configuração

`sedd.config.json`:

```json
{
  "specsDir": ".sedd",
  "branchPattern": "{{id}}-{{name}}",
  "scriptRunner": "auto",
  "github": {
    "engine": "both",
    "owner": "user",
    "repo": "my-project",
    "project": {
      "projectNumber": 3,
      "projectId": "PVT_...",
      "title": "My Kanban"
    }
  }
}
```

---

## Licença

MIT

---

<p align="center">
  <b>Especificações dizem O QUE construir.<br>
  Expectativas dizem COMO você imagina que deve funcionar.<br>
  SEDD garante que as duas estejam sempre alinhadas.</b>
</p>
