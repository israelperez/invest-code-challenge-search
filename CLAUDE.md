## Agent skills

### Issue tracker

GitHub Issues on the fork (israelperez/invest-code-challenge-search); external PRs not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

## Ponytail

Only for writing code: `/implement` runs and builder subagents invoke the `ponytail:ponytail` skill (level full) before their first code edit. Never in planning, design, review or orchestration. Sessions start with it off (`PONYTAIL_DEFAULT_MODE=off`); don't type `/ponytail` in the main session — it sets the mode globally.
