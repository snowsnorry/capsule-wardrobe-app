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
| `npm run build` | green | Re-verified during Wave 2 AI runtime hardening. |
| `npm run test:server` | green | Previously verified in the repo baseline; Wave 2 additionally passed the narrow AI/runtime server test slice. |
| `npm run test:shared` | green | Verified in the current repo state. |
| `npm run typecheck` | green | Re-verified during Wave 2 after removing the provider/swimwear `@ts-nocheck` files. |

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

Additional strict-typing debt:
- residual local weak typing remains in `server/src/ai/promptImages.ts`, but the major metadata and IPC hotspots were reduced in Wave 2
- remaining loosely modeled wardrobe/job payloads in `server/src/ai/ai.ts` and `server/src/ai/regenerateSelected.ts`
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

Status: partial cluster complete.

Fully removed `@ts-nocheck`:
- `server/src/ai/openai.ts`
- `server/src/ai/gemini.ts`
- `server/src/ai/deepinfra.ts`
- `server/src/ai/ollama.ts`
- `server/src/ai/claude.ts`
- `server/src/ai/swimwear.ts`

Partially reduced debt:
- `server/src/ai/promptImages.ts`
  - introduced shared AI/runtime helper types in `server/src/ai/types.ts`
  - replaced the highest-value `any` / metadata casts with narrower prompt-image asset, IPC payload, and result modeling
  - hardened serialized-buffer detection and child-process payload validation without changing runtime behavior
- `server/src/ai/ai.ts`
  - remained on `@ts-nocheck` in this pass
  - benefited from hardened provider and prompt-image boundaries, but still needs a dedicated orchestration-focused pass
- `server/src/ai/regenerateSelected.ts`
  - remained on `@ts-nocheck` in this pass
  - benefited from hardened provider and prompt-image boundaries, but still needs a dedicated partial-regeneration-focused pass

Remaining hard blockers:
- `server/src/ai/ai.ts`
  - large orchestration surface with loosely modeled DB/profile/capsule payloads and long async job flows
- `server/src/ai/regenerateSelected.ts`
  - mixed regeneration orchestration, payload normalization, and stored snapshot mutation in one file
- `server/src/index.ts`
  - intentionally deferred from this cluster
- `server/src/wardrobePdf.ts`
  - intentionally deferred from this cluster

Wave 2 stayed focused on typing hardening only. No request/response behavior, prompts, provider selection, DB logic, PDF logic, or job orchestration behavior changed.

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
- `npm run build`: green after Wave 2 AI runtime hardening
- narrow AI/runtime server tests: green
  - `npm --workspace server exec -- tsx --test src/openai.test.ts src/gemini.test.ts src/deepinfra.test.ts src/ollama.test.ts src/claude.test.ts src/swimwear.test.ts src/promptImages.test.ts src/promptImages.child.test.ts src/ai/llm.test.ts src/ai/ai.test.ts src/ai/regenerateSelected.test.ts`
- `npm run test:server`: baseline previously green; not rerun because the Wave 2 change set stayed inside the AI/runtime cluster and the targeted suite remained green
- `npm run test:shared`: green
- `npm run typecheck`: green after Wave 2 provider/swimwear hardening and prompt-image boundary typing

## Assumptions

- Source-layout migration is complete enough that remaining work should not be framed as ongoing JS-to-TS migration.
- Validation status should stay aligned to the actual repo state as hardening work lands.
