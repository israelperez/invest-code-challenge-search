# PR body

Write the body with the global `pr-body` skill: its structure, linked What-changed list, Why sub-sections with their source, Scope creep section, `{{HEAD}}` link pinning and voice passes all apply. This file adds what is specific to this project, and wins on conflict.

- **Audience.** A hiring panel who will clone and run the fork, assessing architecture, system design and senior engineering judgement. Every Why sub-section ties the change to its `docs/planning/PLAN.md` step or ADR in `docs/adr/`.
- **Voice.** The body reads in Israel's voice: run `write-like-me`, then `humanizer`, as real skill invocations, before publishing and after every edit.
- **Provided code.** Any edit to code that came with the challenge (mainly the original `api/` mock) goes in "What stayed the same" or its Why sub-section with: why it changed (cite the PLAN step), what it was before and that it may have been there for a reason we don't know, exactly what it affects, and how small the revert is. Purely additive files need no caveat.
- **Review notes.** List each Codex adversarial-review round and every finding with its outcome: fixed, or declined and why.
- **Credit.** Name who built what: Israel's decisions, Claude's calls during the build, the builder subagents, Codex's findings.
- **Closing.** End with `Closes #<N>` and the attribution line the session requires.
