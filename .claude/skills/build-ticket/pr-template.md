# PR body

The PR is a demo for a reviewer who hasn't seen the work: what changed, why, and how it was proved. The reviewer is assessing architecture, system design and senior engineering judgement, so the *why* carries the most weight: every PR shows where the change sits in the larger plan and the reasoning behind its design. Credit each decision to whoever actually made it. Draft it in plain technical language, then run `write-like-me` and `humanizer` so it reads in the user's voice.

Say each thing once. "What changed" is the overview; the detail for each item lives in its Why sub-section, and How it works only maps files. Don't restate a feature in a later section.

Links to repo files are pinned to a commit. Write `{{HEAD}}` where the commit SHA goes, and replace it with `git rev-parse HEAD` every time the body is published, so links always point at the PR's latest commit.

```markdown
## What this does

<1–2 sentences: the user-visible behaviour or API contract this delivers.>

What changed:
- <Always present: the overview a human scans first. One short line per feature, groundwork piece or bug fix, led by a link to its Why sub-section: "[Load more](#load-more): …". A bug fix is a defect that exists in `main`; problems caught before merge go in Review notes.>

<When the change touches existing code, add this second list so a reviewer can't misread its reach. Say outright if no endpoint or user-visible behaviour changed. Skip it for purely additive work.>

What stayed the same:
- <The existing behaviour, modules and tests this leaves untouched, and how that is proved.>

## Why

<Context first, in a short paragraph: the problem, what comes next in the plan that depends on this (name the tickets), and what would be harder without it. Link the PLAN.md section or ADR.>

### <Item name, matching its What-changed bullet>

<First line: where it came from (a PLAN step, an ADR, or "Scope creep"). Then the design reasoning: the approach, the alternatives it beat, the trade-off accepted, the constraint it protects. Mark calls made during the build with who made them.>

## Scope creep

<Only when something came in that the plan didn't have. For each item: who decided, how it was kept contained (size, how to turn it off or revert, follow-up ticket), and the dated note added to PLAN.md.>

## How it works

<The main files in reading order, each with a link and one line on its job.>

## How it was verified

<Tests added, grouped by seam; the `npm test` result; any manual check.>

## Review notes

<Codex adversarial findings with outcomes (fixed / declined and why); where to look first.>

## Not in this PR

<What was deferred, and to which ticket.>

Closes #<N>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
