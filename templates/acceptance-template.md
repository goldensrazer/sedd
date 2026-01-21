# Acceptance Criteria - Migration {{MIGRATION_ID}}

> Generated from expectation
> Timestamp: {{TIMESTAMP}}
> Branch: {{BRANCH}}

## Expectativa

> {{EXPECTATION_SUMMARY}}

### DEVE fazer:
{{#each MUST}}
- {{this}}
{{/each}}

### NÃO DEVE fazer:
{{#each MUST_NOT}}
- ❌ {{this}}
{{/each}}

---

## Checklist de Aceite

### Critérios Funcionais (DEVE)

- [ ] **AC-001:** {{criterion_1}}
  - Verificar: {{verification_steps}}

- [ ] **AC-002:** {{criterion_2}}
  - Verificar: {{verification_steps}}

### Critérios de UX

- [ ] **AC-UX-001:** {{ux_criterion}}
  - Verificar: {{verification_steps}}

### Critérios Técnicos

- [ ] **AC-TECH-001:** {{technical_criterion}}
  - Verificar: {{verification_steps}}

---

## Critérios Negativos (NÃO DEVE)

> Estes critérios verificam que restrições foram respeitadas.
> Falha em qualquer um indica violação da expectativa.

{{#each MUST_NOT}}
- [ ] **AC-N{{@index}}:** Verificar que NÃO: {{this}}
  - Buscar: arquivos/código que violem esta restrição
  - Se encontrado: ❌ VIOLAÇÃO
{{/each}}

### Validação Automática Sugerida

```bash
# Comandos para verificar restrições (ajustar conforme mustNot)
# Exemplo: Verificar se criou arquivos em services/x/
find services/x -type f -newer .sedd/timestamp_marker

# Exemplo: Verificar uso de localStorage
grep -r "localStorage" src/

# Exemplo: Verificar chamadas a API externa
grep -rE "(axios|fetch)\s*\(" src/
```

---

## Comandos de Verificação

```bash
# Comandos sugeridos para testar
npm test
npm run build
```

---

## Sign-off

| Critério | Status | Verificado Por | Data |
|----------|--------|----------------|------|
| AC-001 | pending | - | - |
| AC-002 | pending | - | - |

---

## Notas

_Adicione notas de verificação aqui_

---

## Relacionados

- **Tasks:** Ver `tasks.md` nesta migration
- **Clarificações:** Ver `clarify.md` nesta migration
- **Fonte:** Expectativa capturada em /sedd.clarify
