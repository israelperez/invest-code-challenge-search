---
name: build-ticket
description: Build one ticket from the issue tracker end to end — agreed test seams, a sonnet builder, Codex adversarial review, commit, and a PR the user merges. Use when asked to build, implement or continue ticket #N, or to pick up the next ticket.
---

# Build ticket

This session is the **orchestrator**: it decides and verifies. A sonnet **builder** subagent writes the code. One ticket, one branch, one PR; the user merges.

## Approval rules

- **Without asking:** create ticket branches, commit on them, push them, open and update PRs, run the Codex review, comment on and close issues.
- **Ask first:** merging (the user merges after reading the PR), anything on `main`, force-push, deleting branches, any change outside the ticket. Approval is an explicit yes to that specific action; an answer to a different question approves nothing.
- **Public text carries nothing private.** PRs, commits, issues, code and docs carry no emails, local machine paths, machine details or sensitive personal information; links are repo-relative. The user's name is fine (their GitHub account shows it).

## Steps

1. **Pick.** Take `#N` if given. Otherwise take the frontier: the lowest-numbered open `ready-for-agent` issue whose blockers are all closed (`gh api repos/{owner}/{repo}/issues/<n>/dependencies/blocked_by`). Read the issue, the PLAN.md sections and ADRs it rests on, and every file it touches, in full. Done when you can name every file the change reaches.
2. **Seams.** Derive the test seams (the public boundaries tests sit at, per `tdd`) from the acceptance criteria and the existing tests, each mapped to the criteria it proves. List them for the user and carry on without waiting; ask first only when a seam needs new test infrastructure or a new dependency.
3. **Branch** off freshly pulled `main`: `<type>/<issue>-<slug>`, where type is the Conventional Commit type of the main change (e.g. `test/2-api-baseline`).
4. **Build.** Spawn one `general-purpose` agent with `model: sonnet` and the brief from [builder-brief.md](builder-brief.md), every slot filled. Independent frontier tickets may build in parallel, each with `isolation: "worktree"`. Done when the builder returns its diff summary and full test output.
5. **Verify.** Run `npm test` yourself. Walk every acceptance criterion and cite the test or code that meets it; spot-read only what is contested. An unmet criterion goes back to the same builder via `SendMessage`.
6. **Codex review** of the uncommitted work:
   ```bash
   node "$(ls -d ~/.claude/plugins/cache/openai-codex/codex/*/ | tail -1)scripts/codex-companion.mjs" \
     adversarial-review --wait --scope working-tree "<focus>"
   ```
   Focus text: "PLAN.md and the ADRs are locked and were approved by Codex in plan review; review the implementation, not the design. Check the change against issue #N's acceptance criteria below and hunt its failure modes." followed by the pasted criteria. Run a large diff with `run_in_background`.
7. **Triage.** Give every finding an outcome: **fix** (inside the ticket: same builder via `SendMessage`, then step 5 again), **decline** (state the reason), or **escalate** (touches locked design or reaches outside the ticket: ask the user). After material fixes, rerun step 6. Done when every finding has an outcome.
8. **Commit.** Conventional Commits with scope (`test(api):`, `feat(web):`), atomic, tests in the same commit as their code. The user is the git author; end each message with the short `Co-Authored-By: Claude …` trailer. Credit AI's role accurately.
9. **PR.** Push and open a PR into `main` with `Closes #N`, body per [pr-template.md](pr-template.md). The body reads in the user's voice: run `write-like-me`, then `humanizer`, before publishing. Send the user the link with a three-line summary.
10. **After merge.** When the user says it's merged, pull `main` and return to step 1.
