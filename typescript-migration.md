# TypeScript Post-Migration Reconciliation

## Summary

The source-layout migration is effectively complete. This file now tracks the repository's post-migration state, active blockers, and remaining hardening debt.

This is no longer a batch-based JavaScript-to-TypeScript migration plan. Remaining work should be framed as:
- post-migration reconciliation
- strict-typing hardening
- intentional scope exclusions
- optional cleanup and strictness tightening

## Migration Complete

- [x] Root, client, and server TypeScript configs and package scripts are in place.
- [x] `server/src` source-layout migration is complete.
  - `server/src` no longer contains `.js` or `.test.js` source files.
  - server source files and server tests now live on `.ts`
- [x] The server AI cluster, PDF / child-process runtime, and entrypoint are on `.ts`.
- [x] Shared modules previously in scope for migration are on `.ts`.
- [x] Build and test entrypoints no longer depend on `server/src/*.js` source files.
- [x] Client source-layout migration is complete for `client/src/**/*` except the intentional exclusion below.

Client source audit:
- `client/src/test/setup.js` remains intentionally deferred because renaming it requires updating excluded `client/vite.config.js` `test.setupFiles`.

## Active Validation Status

| Check | Status | Notes |
| --- | --- | --- |
| `npm run build` | green | Verified in the current repo state. |
| `npm run test:server` | green | Verified in the current repo state. |
| `npm run test:shared` | green | Verified in the current repo state. |
| `npm run typecheck` | green | Restored during Wave 1 by resolving the client-side typing blockers in `App.tsx` and `SettingsDialog.tsx`. |

## Remaining Intentional Exceptions

These are not unfinished migration items. They are explicit scope exclusions that can be revisited later if needed.

- `client/src/test/setup.js`
  - intentionally remains JS
  - renaming it requires touching excluded `client/vite.config.js`
- `client/vite.config.js`
  - remains intentionally out of scope for this reconciliation pass
- other excluded runtime / config files outside the source-layout migration boundary
  - should stay framed as deferred cleanup, not failed migration work

## Remaining Hardening Debt

### Active blockers

- No active Wave 1 blocker remains.
- Repo-wide `npm run typecheck` is green again.
- Remaining hardening work is now concentrated in later server-side strictness cleanup, not baseline typecheck health.

### Strict-typing debt

Heavy runtime files still using temporary `// @ts-nocheck`:
- `server/src/index.ts`
- `server/src/wardrobePdf.ts`
- `server/src/ai/ai.ts`
- `server/src/ai/regenerateSelected.ts`
- `server/src/ai/gemini.ts`
- `server/src/ai/openai.ts`
- `server/src/ai/deepinfra.ts`
- `server/src/ai/ollama.ts`
- `server/src/ai/claude.ts`
- `server/src/ai/swimwear.ts`

Additional strict-typing debt:
- local `any` surfaces in `server/src/ai/promptImages.ts`
- weak metadata assertions around image-processing boundaries
- weak IPC payload assertions / unsafe narrowing in prompt-image runtime code
- other local weak assertions that were acceptable during migration but should be reduced during hardening

### Intentional scope exclusions

- `client/src/test/setup.js`
- `client/vite.config.js`
- any related deferred config-only cleanup needed to convert that setup file safely

### Optional strictness tightening

These are follow-up improvements, not immediate blockers:
- raising compiler strictness once Wave 1 and Wave 2 debt are green
- reducing tolerated weak assertions after `@ts-nocheck` hotspots are removed
- tightening unstable or loosely modeled runtime boundaries only after baseline health is restored

### Optional test / config cleanup

These are lower priority than active blocker resolution and server runtime hardening:
- converting intentionally deferred config/test files once their owning config files are in scope
- normalizing any remaining TypeScript-related config inconsistencies
- removing stale migration-only notes if more cleanup accumulates elsewhere

## Hardening Roadmap

### Wave 1

Status: complete.

- restored a truthful green repo-wide `npm run typecheck` baseline
- reconciled `WardrobeItem` typing mismatches in `client/src/App.tsx`
- reconciled predicate typing in `client/src/components/SettingsDialog.tsx`
- kept runtime behavior unchanged while restoring repo-wide typecheck health

### Wave 2

Priority: reduce heavy-runtime TypeScript debt on the server.

- remove or reduce `// @ts-nocheck` in the server entrypoint, PDF runtime, and AI orchestration/provider files
- shrink `any` usage in `server/src/ai/promptImages.ts`
- replace weak assertions and unsafe narrowing where the runtime boundaries are now understood well enough to model more explicitly
- keep this wave focused on typing hardening, not feature work

### Wave 3

Priority: optional cleanup once the baseline is green.

- revisit intentionally deferred config/test files only if their owning config files are brought into scope
- consider converting `client/src/test/setup.js` only when `client/vite.config.js` is intentionally included
- tighten compiler settings incrementally after Waves 1 and 2 are complete

## Public Interfaces / Types

- No application API, deployment contract, or runtime behavior changes are planned as part of this reconciliation document.
- This file should describe current status and hardening priorities only.
- Remaining work should not be described as future migration batches.

## Validation Baseline For This Document

This document is aligned to the current verified repo state:
- `npm run build`: green
- `npm run test:server`: green
- `npm run test:shared`: green
- `npm run typecheck`: green after Wave 1 client typing reconciliation

## Assumptions

- Source-layout migration is complete enough that remaining work should not be framed as ongoing JS-to-TS migration.
- Validation status should stay aligned to the actual repo state as hardening work lands.
