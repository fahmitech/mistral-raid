# Plan: [Title]

**Spec Tasks:** Task N, Task M (from docs/specs.md)
**Beads ID:** `bd-xxxx` (from docs/progress/beads-ids.md — run `bd show <id>` for live status)
**Status:** DRAFT | APPROVED | IN_PROGRESS | COMPLETE
**Created:** YYYY-MM-DD
**Dependencies:** List tasks/plans that must be complete first (verify with `bd show <id>`)

---

## Objective

One paragraph describing what this plan achieves and why.

---

## Scope

**In scope:**
- Item 1
- Item 2

**Out of scope:**
- Item (reason)

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `path/to/file.ts` | CREATE | Brief description |
| `path/to/other.ts` | MODIFY | What changes |

---

## Implementation Steps

### Step 1: [Title]

**File:** `path/to/file.ts`

**What:** Description of what to implement.

**Key details:**
- Specific requirement 1
- Specific requirement 2
- Edge case to handle

**Acceptance criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

---

### Step 2: [Title]

_(repeat pattern)_

---

## Testing / Verification

How to verify this plan is correctly implemented:

1. Manual test: [description]
2. Console check: [what to look for]
3. Integration check: [what to verify end-to-end]

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| API latency exceeds budget | Medium | Fallback cache already in spec |
| TypeScript error in shared types | Low | Run `tsc --noEmit` before submitting |

---

## Notes

Any additional context, links to spec sections, or open questions.
