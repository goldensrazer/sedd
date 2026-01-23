# /sedd.estimate - Estimate Task or Project Effort

## Purpose

Analyze a feature or project and generate a detailed effort estimation markdown, separating human vs AI effort with complexity ratings.

## Trigger

- `/sedd.estimate` - Estimate current feature
- `/sedd.estimate "feature description"` - Estimate new demand
- `/sedd.estimate --path src/components` - Investigate specific path

## Pre-flight Checks

1. **Load Configuration**
   ```
   Read sedd.config.json (or use defaults)
   Default specsDir: .sedd
   ```

2. **Check Feature Context**
   - If on feature branch: use that feature
   - If spec.md exists: use existing specification
   - If neither: ask for feature description

3. **Verify SEDD is initialized**
   - Check if specsDir exists
   - If not: suggest `npx sedd init`

## Workflow

### Step 1: Gather Context

**OBRIGATÓRIO:** Pergunte ao usuário:

```
📁 Para uma análise mais precisa, me envie o path do arquivo principal.

💡 Dica: No seu editor de código, clique com botão direito no arquivo
   e selecione "Copy Relative Path", depois cole aqui.

Exemplo: src/components/Dashboard.tsx
```

### Step 2: Analyze Project Structure

Investigate the codebase:
- Read spec.md if exists
- Read interfaces.ts if exists
- Analyze related files from provided path
- Identify patterns and dependencies
- Find similar implementations

### Step 3: Generate Task Breakdown

For each identified task:

```typescript
{
  taskId: "T001-001",
  description: "Create ThemeContext",
  humanHours: 1,      // Design decisions, reviews, edge cases
  aiHours: 3,         // Boilerplate, patterns, implementation
  confidence: 85,     // How confident in this estimate
  complexity: "M",    // XS, S, M, L, XL
  risks: ["May need refactoring if theme structure changes"]
}
```

### Step 4: Calculate Totals

```
Total Hours = Sum of all task hours
Human Hours = Sum of human-only effort
AI Hours = Sum of AI-assisted effort
Complexity = Weighted average of task complexities
```

**Complexity Mapping:**
| Size | Hours Range | Description |
|------|-------------|-------------|
| XS | 1-2h | Trivial change, single file |
| S | 2-4h | Simple feature, few files |
| M | 4-8h | Medium feature, multiple files |
| L | 8-16h | Large feature, architectural changes |
| XL | 16h+ | Epic, multiple systems |

### Step 5: Generate estimate.md

Create `.sedd/{FEATURE}/estimate.md`:

```markdown
# Estimativa: {{FEATURE_NAME}}

> Gerado: {{TIMESTAMP}}
> Confiança Média: {{CONFIDENCE}}%

## Resumo Executivo

| Métrica | Valor |
|---------|-------|
| **Total Estimado** | {{TOTAL}}h |
| **Esforço Humano** | {{HUMAN}}h |
| **Esforço AI** | {{AI}}h |
| **Complexidade** | {{COMPLEXITY}} |

### Distribuição de Esforço

```
Humano: ████████░░░░░░░░ 25%
AI:     ████████████░░░░ 75%
```

---

## Breakdown por Task

| Task | Descrição | Humano | AI | Total | Confiança |
|------|-----------|--------|-----|-------|-----------|
| T001-001 | Create ThemeContext | 1h | 3h | 4h | 85% |
| T001-002 | Add toggle component | 0.5h | 1.5h | 2h | 90% |
| T001-003 | Persist preference | 1h | 2h | 3h | 75% |

---

## Análise de Contexto

### Arquivos Analisados
- `{{PATH}}` - Arquivo principal investigado
- `src/related/file.ts` - Dependência identificada

### Padrões Identificados
- Usa Context API para estado global
- Segue padrão de Repository para persistência

### Riscos Identificados
1. **Risco 1:** Descrição do risco e mitigação
2. **Risco 2:** Descrição do risco e mitigação

### Premissas
- Assumes existing theme system can be extended
- Assumes localStorage is acceptable for persistence

---

## Notas

- Estimativas de AI assumem uso de ferramentas como Claude Code
- Esforço humano inclui: revisão, decisões de design, edge cases
- Esforço AI inclui: boilerplate, implementação de padrões, testes

---

## Próximos Passos

1. `/sedd.specify` - Criar especificação formal (se não existir)
2. `/sedd.clarify` - Detalhar requisitos e gerar tasks
3. `/sedd.implement` - Executar implementação
```

### Step 6: Display Summary

Show interactive summary:

```
📊 ESTIMATIVA GERADA

┌─────────────────────────────────────┐
│  Feature: Dark Mode Toggle          │
├─────────────────────────────────────┤
│  Total:      16h                    │
│  Humano:     4h (25%)               │
│  AI:         12h (75%)              │
│  Complexidade: M (Medium)           │
│  Confiança:  82%                    │
└─────────────────────────────────────┘

📁 Arquivo gerado: .sedd/024-dark-mode/estimate.md

Deseja prosseguir para /sedd.clarify? [Y/n]
```

## Output

1. **estimate.md** - Markdown com estimativa detalhada
2. **_meta.json** - Atualizado com `lastEstimate` timestamp

## Rules

- SEMPRE pedir path do arquivo para investigação
- SEMPRE separar esforço humano vs AI
- NUNCA estimar sem analisar código existente
- Confiança < 60% = destacar como incerto
- Atualizar estimativa se spec.md mudar

## CLI Alternative

```bash
# Estimate current feature
sedd estimate

# Estimate with specific path
sedd estimate --path src/components/Theme.tsx

# Estimate new demand
sedd estimate --desc "Add dark mode support"
```

## Estimation Guidelines

### Human Effort Includes:
- Architecture decisions
- Code review
- Edge case handling
- Integration testing
- Documentation review
- Debugging complex issues

### AI Effort Includes:
- Boilerplate code generation
- Following established patterns
- Unit test generation
- Documentation generation
- Refactoring similar code
- Standard implementations

### Confidence Levels:
- **90-100%:** Well-understood, done before
- **70-89%:** Familiar territory, some unknowns
- **50-69%:** New area, significant unknowns
- **Below 50%:** Highly uncertain, needs more investigation
