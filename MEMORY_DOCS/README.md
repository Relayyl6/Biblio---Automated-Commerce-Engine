# MEMORY_DOCS — Persistent Engineering Memory for Biblio / ACE

> **Future engineer / agent: read this folder before doing anything.** It exists so
> work continues seamlessly across sessions. Source of product truth is `../BIBLO.docx`;
> these files distill and reconcile it with the actual code.

## Read in this order

1. **project-overview.md** — what ACE is, the two codebases, where things stand.
2. **architecture.md** — as-built service map, domain model, invariants, intended direction.
3. **build-plan.md** — the prioritized roadmap (start at Phase A).
4. **progress-tracker.md** — current status, what's done/pending/blocked, "start here next."
5. **specific-function-assignment.md** — per-module ownership + what remains.
6. **code-standards.md** — conventions in force (match them).
7. **library-docs.md** — dependencies and why.
8. **ui-overview** — **ui-rules.md** (principles), **ui-tokens.md** (palette/spacing),
   **ui-registry.md** (screen/component inventory).

## The rule (directive #8)

After **every** completed unit of work: update `progress-tracker.md`,
`build-plan.md`, and `specific-function-assignment.md` (and `architecture.md` if the
design changed) in the **same** change. No major implementation without a doc update.

## One-paragraph orientation

ACE/Biblio is an autonomous WhatsApp commerce engine for informal merchants. The active
codebase is `../ace-whatsapp/` (TypeScript, compiles clean, core order loop works
end-to-end). `../ace-platform/` and `../data-intelligence/` are design-only roadmap.
The highest-value next work is hardening the core loop: tests + delivering merchant
escalations (the `escalate_to_merchant` tool currently dead-ends). See build-plan Phase A.