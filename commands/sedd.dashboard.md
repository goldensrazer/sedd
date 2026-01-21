# /sedd.dashboard - Status das Clarificações

## Purpose
Mostrar o status atual de migrations, tasks e progresso da feature.

## Trigger
- `/sedd.dashboard` - Ver status completo

## Output

O comando exibe:

- Feature atual (branch/nome)
- Migration em progresso
- Lista de tasks com status (pending/completed)
- Progresso geral (X/Y tasks)

### Exemplo

```
📊 Dashboard - 024-user-auth

Migration: 001 (in-progress)
Expectation: User can login with email/password

Tasks:
  [x] T001-001 Create user model
  [x] T001-002 Add password hashing
  [ ] T001-003 Create login endpoint
  [ ] T001-004 Add session management

Progress: 2/4 (50%)
```

## Requirements

- Estar em branch de feature (###-feature-name)
- Feature deve ter _meta.json

## Rules

- Comando read-only, não modifica arquivos
- Mostra estado atual do filesystem
