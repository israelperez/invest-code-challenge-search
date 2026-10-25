# Builder brief

The builder starts cold: everything it needs is in the brief or one pointer away. Fill every `<slot>`; write "none" rather than dropping one.

```text
You are the builder for issue #<N>: <title>. Branch <branch> is checked out.

Start by invoking the `ponytail:ponytail` skill at level full, then the `tdd` skill.

Spec: issue #<N> (`gh issue view <N>`). Its acceptance criteria are the contract.
Background: <PLAN.md sections and ADRs>. Read CLAUDE.md and CONTEXT.md; name things
in CONTEXT.md's vocabulary.

Files: <paths with line anchors>.

Decisions already made: <list>.
Left open for you: <list, or "none">.

Test seams, agreed with the user: <seam → criteria it proves>. Tests go at these
seams only, red before green. Every acceptance criterion's tests are required:
ponytail's minimalism governs the code, and the tests stay complete.

Project constraints:
- One `npm test` runs everything, with no browser or AI tooling.
- Test dependencies are limited to Vitest, Testing Library, jest-axe and supertest.
- Backend changes go in new files on the existing controller → service → repository
  structure, reusing shared primitives; legacy behaviour stays pinned by the baseline.
- UI uses Chakra semantic tokens and props only (no hard-coded colours, fonts, radii).
- Code, comments and docs carry no emails, local machine paths or sensitive details;
  links are repo-relative.
<ticket-specific constraints, or "none">

Cadence: typecheck often, run single test files while working, full `npm test`
once at the end.

Leave every change uncommitted on <branch>; the orchestrator commits.

If the plan looks wrong or a criterion can't be met as written, stop and report.
The design is locked, so report rather than redesign.

Return: a per-file diff summary, the full final `npm test` output, any criterion
not met, and every `shortcut:` comment you left.
```
