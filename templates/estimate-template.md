# Estimativa: {{FEATURE_NAME}}

> Feature ID: {{FEATURE_ID}}
> Gerado: {{TIMESTAMP}}
> Confiança Média: {{AVERAGE_CONFIDENCE}}%

---

## Resumo Executivo

| Métrica | Valor |
|---------|-------|
| **Total Estimado** | {{TOTAL_HOURS}}h |
| **Esforço Humano** | {{HUMAN_HOURS}}h |
| **Esforço AI** | {{AI_HOURS}}h |
| **Complexidade** | {{COMPLEXITY}} |

### Distribuição de Esforço

```
Humano: {{HUMAN_BAR}} {{HUMAN_PERCENT}}%
AI:     {{AI_BAR}} {{AI_PERCENT}}%
```

---

## Breakdown por Task

| Task | Descrição | Humano | AI | Total | Confiança |
|------|-----------|--------|-----|-------|-----------|
{{#each breakdown}}
| {{taskId}} | {{description}} | {{humanHours}}h | {{aiHours}}h | {{totalHours}}h | {{confidence}}% |
{{/each}}

---

## Análise de Contexto

### Arquivo Investigado

- **Path:** `{{CONTEXT_PATH}}`
- **Tipo:** {{CONTEXT_TYPE}}

### Arquivos Relacionados

{{#each relatedFiles}}
- `{{this}}`
{{/each}}

### Padrões Identificados

{{#each patterns}}
- {{this}}
{{/each}}

### Riscos Identificados

{{#if risks}}
{{#each risks}}
1. **{{@index}}.** {{this}}
{{/each}}
{{else}}
Nenhum risco significativo identificado.
{{/if}}

### Premissas

{{#each assumptions}}
- {{this}}
{{/each}}

---

## Complexidade por Categoria

| Categoria | Tasks | Horas | Complexidade |
|-----------|-------|-------|--------------|
| Foundation | {{FOUNDATION_TASKS}} | {{FOUNDATION_HOURS}}h | {{FOUNDATION_COMPLEXITY}} |
| Features | {{FEATURE_TASKS}} | {{FEATURE_HOURS}}h | {{FEATURE_COMPLEXITY}} |
| Tests | {{TEST_TASKS}} | {{TEST_HOURS}}h | {{TEST_COMPLEXITY}} |

---

## Notas sobre Estimativa

### Esforço Humano Inclui:
- Decisões de arquitetura
- Revisão de código
- Tratamento de edge cases
- Testes de integração
- Debugging de issues complexos

### Esforço AI Inclui:
- Geração de boilerplate
- Seguir padrões estabelecidos
- Geração de testes unitários
- Documentação
- Implementações padrão

---

## Legenda de Complexidade

| Tamanho | Horas | Descrição |
|---------|-------|-----------|
| XS | 1-2h | Mudança trivial, arquivo único |
| S | 2-4h | Feature simples, poucos arquivos |
| M | 4-8h | Feature média, múltiplos arquivos |
| L | 8-16h | Feature grande, mudanças arquiteturais |
| XL | 16h+ | Epic, múltiplos sistemas |

---

## Próximos Passos

1. `/sedd.specify` - Criar especificação formal (se não existir)
2. `/sedd.clarify` - Detalhar requisitos e gerar tasks
3. `/sedd.implement` - Executar implementação
