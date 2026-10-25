# PR body

The PR is a demo for a reviewer who hasn't seen the work: what changed, why, and how it was proved. Draft it in plain technical language, then run `write-like-me` and `humanizer` so it reads in the user's voice.

```markdown
## What this does

<2–4 sentences: the user-visible behaviour or API contract this delivers.>

## Why

<The decision behind it, linking the PLAN.md section or ADR, and the trade-off accepted.>

## How it works

<The main pieces in reading order, each with a file link and one line on its job.>

## How it was verified

<Tests added, grouped by seam; the `npm test` result; any manual check.>

## Review notes

<Codex adversarial findings with outcomes (fixed / declined and why); where to look first.>

## Not in this PR

<What was deferred, and to which ticket.>

Closes #<N>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
