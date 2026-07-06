---
name: repo-orientation
description: Use at the start of task-focused work in this capsule-wardrobe repository, after context compaction, or whenever ownership is unclear. Identifies the owning workspace or cross-workspace surface, nearest files and tests to inspect, related contracts to keep aligned, and the smallest safe validation path before implementation or review.
---

# repo-orientation

Use this skill to get oriented before changing or reviewing code in this repo.

## Core Workflow
1. Read root `AGENTS.md`.
2. Read `docs/repo_map.md` when the task is broad, cross-cutting, or ownership is not obvious.
3. If the task lands under `client/src/` or `server/src/`, read the nearest local `AGENTS.md`.
4. Identify the owner: `client`, `server`, `shared`, deployment/config, docs, or cross-workspace.
5. Inspect the smallest relevant entrypoint, the closest implementation module, and nearest tests before editing.
6. Check `git status --short` and avoid reverting or rewriting unrelated user changes.
7. Choose the smallest safe file set and validation path. Then implement unless the user asked only for orientation, planning, or review.

## Ownership Guide
- Frontend/UI: start with `client/src/App.tsx`, `client/src/app/`, `client/src/screens/`, `client/src/components/`, `client/src/api/`, `client/src/i18n/`, and `client/src/theme/`.
- Client API/auth helpers: inspect `client/src/api/` and `client/src/auth/`, then the matching server route before changing behavior.
- Server/API: start with `server/src/index.ts`; for app wiring or dependency changes inspect `server/src/appFactory.ts`, `server/src/appRoutes.ts`, `server/src/appDependencies.ts`, and `server/src/appRouteContext.ts`; then inspect the owning route in `server/src/routes/`, the closest domain/store module, and matching `*.test.ts` files.
- Queued jobs: inspect `client/src/api/jobs.ts`, `client/src/app/useActiveSidebarJobs.ts`, `server/src/routes/jobRoutes.ts`, `server/src/jobs/`, `server/src/db/job*.ts`, `server/src/db/jobs.ts`, `server/src/appDependencyJobs.ts`, `server/src/appConfig.ts`, and `server/src/serverStartup.ts`.
- Shared logic: inspect `shared/`, root shared tests, and any client/server imports before changing exported types or behavior.
- Deployment/config: inspect root `package.json`, `render.yaml`, `client/vite.config.ts`, `client/render-server.js`, `server/src/appConfig.ts`, `server/src/serverStartup.ts`, `server/src/maintenance/`, and `README.md`.
- Docs/process-only tasks: keep edits local to the requested docs or skill files unless a referenced command or path is stale.

## High-Risk Surfaces
- API contracts: inspect both the server route and `client/src/api/` caller; use `full-stack-contract-check` when changing request/response shapes or auth/profile flows.
- User-visible copy: update locale resources and preserve EN/RU parity; use `i18n-parity`.
- Passkeys/WebAuthn: inspect `server/src/routes/passkeyRoutes.ts`, `server/src/db.ts`, `server/src/db/passkeys.ts`, `client/src/api/passkeys.ts`, and `client/src/auth/passkeys.ts`. Preserve DB-backed single-use challenges, do not expose stored credential public keys, and keep `PASSKEY_RP_ID`/`PASSKEY_ORIGIN` aligned with the visible frontend origin.
- Auth/session/email/DB/env/startup: preserve auth-test mode and avoid incidental env var or startup rewrites.
- Queued jobs: preserve production `pg_boss` persistence, test/e2e in-memory jobs, profile ownership, active job caps/dedupe, `/jobs/*` SSE semantics, worker startup/shutdown, and expired-record cleanup.
- External library, SDK, CLI, framework, or cloud-service questions: follow the repo `AGENTS.md` Context7 rule before answering or coding against current docs.

## Validation Guide
- Documentation-only changes do not require validation commands when behavior and executable/config files are untouched.
- At the end of code or executable/config work, after the final file edits, run `npm run format`, then `npm run quality:unused`, then `npm run lint:strict`.
- If `npm run format` changes files, include those formatter changes in the diff.
- `npm run coverage*` commands run the corresponding Vitest suites with coverage instrumentation, so skip the matching `npm run test*` command unless debugging a coverage-specific issue, chasing a flaky failure, or doing a fast pre-coverage smoke run.
- UI-only client changes: `npm run coverage:client`.
- Client TypeScript or module-boundary changes: add `npm run typecheck:client`.
- Server-only changes: `npm run coverage:server`.
- Server TypeScript or contract-shape changes: add `npm run typecheck:server`.
- Shared logic changes: `npm run coverage:shared` and `npm run typecheck:shared`.
- Cross-workspace behavior: `npm run coverage`, relevant typecheck commands, `npm run format`, `npm run quality:unused`, and `npm run lint:strict`.
- Narrow fixes may start with the closest test first, but final handoff should state what broader validation did or did not run.

## Report Format
When reporting orientation or before a substantial edit, summarize:
- owning workspace or cross-workspace surface
- files inspected or next files to inspect
- smallest intended edit set
- validation command sequence
