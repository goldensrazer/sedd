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
| `sedd clarify` | Criar migration com decisões |
| `sedd status` | Ver status atual |
| `sedd update` | Atualizar templates e migrar features existentes |

## Slash Commands (AI)

| Comando | Descrição |
|---------|-----------|
| `/sedd.specify` | Criar spec (pergunta expectativa primeiro) |
| `/sedd.clarify` | Clarificar e gerar tasks com score |
| `/sedd.implement` | Executar tasks com checkpoints |
| `/sedd.implement --all` | Executar tudo sem parar |
| `/sedd.dashboard` | Ver status atual de migrations e tasks |

---

## Estrutura de Pastas

```
.sedd/001-user-auth/
├── spec.md                       # Especificação + Expectativa
├── _meta.json                    # Metadados + expectation estruturada
│
├── 001_timestamp/                # Migration 1
│   ├── clarify.md               # Discussão + DEVE/NÃO DEVE
│   ├── decisions.md             # Decisões
│   ├── tasks.md                 # Tasks T001-XXX
│   └── acceptance.md            # Critérios positivos e negativos
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

## Configuração

`sedd.config.json`:

```json
{
  "specsDir": ".sedd",
  "branchPattern": "{{id}}-{{name}}",
  "scriptRunner": "auto"
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
