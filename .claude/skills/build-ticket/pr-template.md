# PR body

The PR is a demo for a reviewer who hasn't seen the work: what changed, why, and how it was proved. The reviewer is assessing architecture, system design and senior engineering judgement, so the *why* carries the most weight: every PR shows where the change sits in the larger plan and the reasoning behind its design. Credit each decision to whoever actually made it. Draft it in plain technical language, then run `write-like-me` and `humanizer` so it reads in the user's voice.

```markdown
## What this does

<2–4 sentences: the user-visible behaviour or API contract this delivers.>

## Why

<Context first: the problem, what comes next in the plan that depends on this (name the tickets), and what would break or be harder without it. Then the design reasoning: the approach chosen, the alternatives it beat, the trade-off accepted, and the constraint it protects. Link the PLAN.md section or ADR.>

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
