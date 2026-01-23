# Validação: Migration {{MIGRATION_ID}}

> Feature: {{FEATURE_NAME}}
> Feature ID: {{FEATURE_ID}}
> Validado em: {{TIMESTAMP}}
> Status: {{VALIDATION_STATUS}}

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
{{#each coverage}}
| {{expectationItem}} | {{statusIcon}} {{status}} | {{coveredByTasks}} | {{confidence}}% |
{{/each}}

**Cobertura Total: {{COVERAGE_PERCENTAGE}}%**

```
{{COVERAGE_BAR}}
```

---

## Violações de Restrições

{{#if violations}}
⚠️ **VIOLAÇÕES ENCONTRADAS:**

| Regra | Arquivo | Severidade |
|-------|---------|------------|
{{#each violations}}
| {{rule}} | `{{violatedBy}}` | {{severity}} |
{{/each}}
{{else}}
✅ Nenhuma violação de restrições encontrada.
{{/if}}

---

## Arquivos Alterados

| Arquivo | Adições | Remoções | Tipo |
|---------|---------|----------|------|
{{#each filesChanged}}
| `{{filePath}}` | +{{linesAdded}} | -{{linesRemoved}} | {{fileType}} |
{{/each}}

**Total:** {{TOTAL_FILES}} arquivos, +{{TOTAL_ADDED}} -{{TOTAL_REMOVED}} linhas

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

## Tasks Completadas

{{#each tasksCompleted}}
- [x] {{this}}
{{/each}}

## Tasks Pendentes

{{#if tasksPending}}
{{#each tasksPending}}
- [ ] {{this}}
{{/each}}
{{else}}
Todas as tasks foram completadas.
{{/if}}

---

## Gaps Identificados

{{#if gaps}}
Os seguintes gaps foram identificados entre expectativa e implementação:

{{#each gaps}}
### Gap {{@index}}: {{description}}

- **Expectativa:** {{expectationItem}}
- **Severidade:** {{severity}}
- **Task Sugerida:** `{{suggestedTask.id}}` - {{suggestedTask.description}}

{{/each}}

### Tasks Sugeridas para Gaps

```markdown
{{#each gaps}}
- [ ] {{suggestedTask.id}} [Follow-up] {{suggestedTask.description}}
{{/each}}
```
{{else}}
✅ Nenhum gap identificado. Implementação cobre a expectativa.
{{/if}}

---

## Recomendação

{{#if (eq recommendation "complete")}}
### ✅ FEATURE COMPLETA

A implementação cobre todos os critérios da expectativa.

**Próximo passo:** Merge para branch principal.
{{/if}}

{{#if (eq recommendation "needs-followup")}}
### ⚠️ REQUER FOLLOW-UP

Gaps identificados requerem tasks adicionais.

**Próximo passo:** `/sedd.clarify` para criar nova migration com gaps.
{{/if}}

{{#if (eq recommendation "needs-revision")}}
### ❌ REQUER REVISÃO

Violações de restrições encontradas.

**Próximo passo:** Reverter alterações que violam restrições.
{{/if}}

---

## Próximos Passos

{{#each nextSteps}}
{{@index}}. {{this}}
{{/each}}

---

## Histórico de Validações

| Data | Migration | Cobertura | Status |
|------|-----------|-----------|--------|
| {{TIMESTAMP}} | {{MIGRATION_ID}} | {{COVERAGE_PERCENTAGE}}% | {{VALIDATION_STATUS}} |
