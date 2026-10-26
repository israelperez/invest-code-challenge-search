# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

`docs/planning/PLAN.md` is the contract; GitHub issues track what is built. `README.md` and `docs/walkthrough.md` describe the finished app, so they name features that don't exist yet: check the issue before assuming code is there.

## Packages

`api/` (Koa, CommonJS, run via ts-node/nodemon) and `web/` (Vite + React 19, ESM, Chakra UI v3, TanStack Query) are independent npm packages with their own lockfiles. The root `package.json` only orchestrates; scripts there and in each package are the source of truth for commands.

## Tests

- One test file: `npm --prefix web test -- src/search/hydration-planner.test.ts` (add `-t "<name>"` for one case); same shape with `--prefix api`.
- The web suite's `globalSetup` always spawns the real API from `api/` on a spare port, even for a single unit test, so `api/` deps must be installed. Contract tests in `web/tests/contract/` read its URL via `inject('apiBaseUrl')`.
- Web tests default to the `node` environment. Component tests opt in with `// @vitest-environment jsdom` on line 1 and import `tests/component/jsdom-setup.ts` (stubs `matchMedia` for Chakra).
- `npm --prefix api run type-check` covers `tests/` too; `npm --prefix web run type-check` for web.

## API

- `createApp(deps)` in `api/src/app.ts` builds the Koa app without listening; tests drive it in-process with supertest and inject a repository. Wiring lives in `api/src/module.ts`.
- Legacy endpoints (`/search`, `/facets/*`, `/instruments/:id`) keep their original behaviour, quirks included, pinned by `tests/legacy-*.test.ts`. New endpoints (`/search/index`, `/instruments/batch`) are strict: schemas in `src/validation/`, unknown fields → 400, and a `symbol_openfigi` tie-break appended to ordering on the index path only.
- `indexed_at` is the snapshot token: continuation requests send it as `snapshot`, a mismatch → 409.

## Web data flow

`SearchState` → `buildSearchRequest` (canonical: sorted keys and values, so the same object is both request body and query key) → hooks in `search/queries.ts` → `SearchSource` (document store + per-state ID windows) → `planHydration` (pure: what the next batch needs).

- `indexed_at` sits in every search query key. A changed value (from any response or `GET /version`) resets the source and the search caches; a 409 becomes `SnapshotStaleError` and reloads the first batch in place (`useRestartSearch`).
- `SearchSource` bumps a generation counter on `reset()`, so responses that land after a reset are discarded.
- The API client and source are injected through `SearchBackendContext` (built in `main.tsx`); component tests provide a fake client.
- Every tunable lives in `web/src/config.ts` with a one-line description.
- Components use Chakra semantic tokens and props only, no hard-coded colours, fonts or radii: the M3 theme from `DESIGN.md` must land as theme config alone.

## Agent skills

### Issue tracker

GitHub Issues on the fork (israelperez/invest-code-challenge-search); external PRs not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

## Ponytail

Only for writing code: `/implement` runs and builder subagents invoke the `ponytail:ponytail` skill (level full) before their first code edit. Never in planning, design, review or orchestration. Sessions start with it off (`PONYTAIL_DEFAULT_MODE=off`); don't type `/ponytail` in the main session — it sets the mode globally.
