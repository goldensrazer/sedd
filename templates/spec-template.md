# Feature Specification: {{FEATURE_NAME}}

> Feature ID: {{FEATURE_ID}}
> Created: {{TIMESTAMP}}
> Status: Draft

## Overview

Brief description of what this feature does and why it's needed.

---

## Expectation

> What do you expect as the final outcome of this feature?

[User's expectation here]

---

## User Stories

### US1: [Story Title] (P1 - Critical)

**As a** [user type]
**I want** [goal]
**So that** [benefit]

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

---

### US2: [Story Title] (P2 - Important)

**As a** [user type]
**I want** [goal]
**So that** [benefit]

**Acceptance Criteria:**
- [ ] Criterion 1

---

## Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-001 | Description | P1 | NEEDS_CLARIFICATION |
| FR-002 | Description | P2 | Draft |

---

## Non-Functional Requirements

| ID | Requirement | Metric |
|----|-------------|--------|
| NFR-001 | Performance | Response < 200ms |
| NFR-002 | Security | Authentication required |

---

## Key Entities

```
+--------------+     +--------------+
|   Entity1    |----▶|   Entity2    |
+--------------+     +--------------+
```

| Entity | Type | Description |
|--------|------|-------------|
| Entity1 | Aggregate | Main entity |
| Entity2 | Entity | Related entity |

> **Note:** Full TypeScript interfaces are in `interfaces.ts`

---

## Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC-001 | User adoption | > 80% of users |
| SC-002 | Error rate | < 1% |

---

## Out of Scope

- Item 1
- Item 2

---

## Open Questions

Items marked NEEDS_CLARIFICATION will be addressed in migrations.

- [ ] Question 1?
- [ ] Question 2?

---

## Migrations

Clarifications and tasks are organized in migration folders:

| Migration | Created | Status | Tasks |
|-----------|---------|--------|-------|
| - | - | - | - |

> Run `/sedd.clarify` to create a new migration with clarifications and tasks.
