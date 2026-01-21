# Tasks - Migration {{MIGRATION_ID}}

> Migration: {{MIGRATION_ID}}
> Timestamp: {{TIMESTAMP}}
> Parent: {{PARENT_MIGRATION}}

## Summary

Total: {{TOTAL_TASKS}} | Completed: 0 | Pending: {{TOTAL_TASKS}}

---

## Tasks

### Foundation

- [ ] T{{MIGRATION_ID}}-001 [Foundation] [Task description] `path/to/file.ts`
- [ ] T{{MIGRATION_ID}}-002 [Foundation] [Task description] `path/to/file.ts`

### User Story 1

- [ ] T{{MIGRATION_ID}}-003 [US1] [Task description] `path/to/file.ts`
- [ ] T{{MIGRATION_ID}}-004 [US1] [Task description] `path/to/file.ts`

### User Story 2

- [ ] T{{MIGRATION_ID}}-005 [US2] [Task description] `path/to/file.ts`

---

## Dependencies

```
T{{MIGRATION_ID}}-001, T{{MIGRATION_ID}}-002 (Foundation)
        |
        v
T{{MIGRATION_ID}}-003 -> T{{MIGRATION_ID}}-004 (US1)
        |
        v
T{{MIGRATION_ID}}-005 (US2)
```

---

## Legend

- `[Foundation]` = Foundational task, must complete first
- `[USx]` = Belongs to User Story X
- `[P]` = Can run in parallel with other [P] tasks
- File paths in backticks indicate target file

---

## Related

- **Clarifications:** See `clarify.md` in this migration
- **Decisions:** See `decisions.md` in this migration
- **Progress:** See `progress.md` in feature root
