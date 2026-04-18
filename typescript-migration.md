# TypeScript Migration Plan

## Goal

Migrate the repository from JavaScript to TypeScript incrementally while keeping the application buildable, testable, and behaviorally stable at every step.

This migration should **not** be attempted in one pass. The repository is a workspace-based full-stack app with:
- `client/` (React + Vite + Vitest)
- `server/` (Node.js + Express)
- `shared/` (cross-cutting logic used by root tests)
- `tests/` (additional test coverage outside package-local tests)

The server package is larger and riskier than the client package, so the migration should start with tooling and low-risk shared/client modules, then move into server utilities and stores, and only later into the main server entrypoints and AI/PDF/image pipeline modules.

---

## Migration Principles

- Keep the repo runnable after each completed batch.
- Prefer **type annotations first**, refactors second.
- Avoid behavior changes unless required to satisfy TypeScript/module-resolution constraints.
- Do not introduce broad `any` usage unless explicitly documented with a follow-up task.
- Each batch must end with:
  - passing typecheck for the migrated scope,
  - existing tests still passing,
  - updated checklist state in this file.
- Migrate leaf modules before high-fanout entrypoints.
- Treat `server/src/index.js` as a late-stage migration target.
- Treat AI/image/PDF modules as higher-risk due to external SDKs, child-process boundaries, and data-shape complexity.

---

## Definition of Done for the Full Migration

- [ ] Root, client, and server have TypeScript configured.
- [ ] `client/src/**/*` migrated from `.jsx/.js` to `.tsx/.ts` where appropriate.
- [ ] `server/src/**/*` migrated from `.js` to `.ts` where appropriate.
- [ ] `shared/**/*` migrated from `.js` to `.ts` where appropriate.
- [ ] Tests are migrated or TypeScript-compatible.
- [ ] Build, test, and runtime entrypoints work without JS source dependencies.
- [ ] Temporary compatibility flags are removed or intentionally retained with justification.
- [ ] Strictness is tightened to the agreed final level.
- [ ] No undocumented `@ts-ignore` / `@ts-expect-error` / broad `any` hotspots remain.

---

## Constraints and Known Repository-Specific Considerations

- Root uses npm workspaces for `client` and `server`.
- `shared/` is a real cross-workspace library used by both `client` and `server`, but it is **not** an npm workspace package.
- Root test orchestration runs:
  - package-local server tests,
  - package-local client tests,
  - direct Node tests in `shared/`.
- Client already uses ESM and Vite.
- Server already uses ESM and runs directly via `node src/index.js`.
- The server entrypoint is also the local Vite dev host in development and serves the built client in production.
- Client deployment/runtime entrypoints also exist outside `client/src/`:
  - `client/render-server.js`
  - `client/netlify/functions/bff.js`
- Client contains React app entry files plus organized directories:
  - `api/`
  - `components/`
  - `i18n/`
  - `screens/`
  - `search/`
  - `test/`
  - `utils/`
- Server contains many modules and tests in `server/src/`, including:
  - stores (`authStore`, `capsuleStore`, `profileStore`, `searchStore`)
  - DB access (`db`)
  - email/auth/server utilities
  - AI-related modules/tests
  - PDF generation modules
  - image/prompt pipeline modules
- Shared logic is important enough to have dedicated root-level tests and should be migrated early, because it is a good low-risk place to establish common types and utility conventions.
- Explicit `.js` and `.jsx` import specifiers are widespread, so early renames of shared or server files will create broad import churn.
- Current validation baseline is green:
  - `npm --workspace client run test`
  - `npm --workspace server run test`
  - `npm run test:shared`
- Client tests currently emit a non-fatal jsdom CSS parse warning from `client/src/index.css`; that warning should not be treated as a TypeScript regression unless it becomes test-fatal.

---

## Target TypeScript Strategy

### Phase strategy

1. Add TypeScript infrastructure without forcing strict migration.
2. Typecheck the client first in hybrid mode.
3. Migrate `shared/` and low-risk client utility/UI modules.
4. Migrate client app shell and screens.
5. Add server TypeScript in hybrid mode.
6. Migrate low-risk server stores/utilities.
7. Migrate DB- and request-shape-related modules.
8. Migrate server entrypoints and higher-risk integrations.
9. Tighten strictness and remove migration debt.

### Compiler posture

Start with a pragmatic configuration:
- `allowJs: true`
- `checkJs: false` initially
- `noEmit: true` for typecheck-only phases
- `strict: false` initially, then raise intentionally
- `jsx: react-jsx` in client config
- modern ESM-compatible module resolution

Later tighten toward:
- `strict: true`
- `noImplicitAny: true`
- `noUncheckedIndexedAccess: true` (optional but desirable)
- `exactOptionalPropertyTypes: true` (optional late-stage tightening)

---

## Execution Plan

### Phase 0 — Inventory and migration scaffolding
**Goal:** introduce TypeScript tooling with minimal runtime impact.

- [x] Add root TypeScript dependency and shared tooling (`typescript`, and package-local typings as needed).
- [ ] Add root documentation note describing the migration workflow.
- [ ] Decide whether to use:
  - one root base config + per-package extends, or
  - separate configs only.
- [x] Create:
  - `tsconfig.base.json`
  - `client/tsconfig.json`
- [x] Add typecheck scripts:
  - root `typecheck`
  - `client:typecheck`
- [ ] Defer `server/tsconfig.json`, `server:typecheck`, and optional `shared:typecheck` until after the client bootstrap is green.
- [x] Add React/node test typings where needed.
- [ ] Keep existing build/test scripts unchanged unless a script must be extended to include typecheck.

Recommended order inside this phase:
- [x] Add root TypeScript dependency and `tsconfig.base.json`
- [x] Add `client/tsconfig.json` first
- [x] Add root `typecheck` and `client:typecheck` first
- [ ] Defer any server TS runtime/build decision

Sequencing notes:
- [ ] `shared/` is not a workspace package, so the client TS config must tolerate imports of `../../shared/*.js` in hybrid mode.
- [ ] Avoid renaming any high-fanout shared file before the client bootstrap is stable.
- [ ] Avoid any server runtime or loader changes in this phase.

**Definition of done**
- [x] `npm run typecheck` exists.
- [ ] No runtime path has changed.
- [ ] Existing JS code still runs without conversion.

---

### Phase 1 — Client TypeScript bootstrap in hybrid mode
**Goal:** enable client-side TS/TSX without forcing full migration.

Recommended first changes:
- [x] Add client typings:
  - `typescript`
  - `@types/node`
  - `@types/react`
  - `@types/react-dom`
- [x] Add client TS config and make client-only typecheck pass in hybrid mode
- [ ] Convert `client/src/test/setup.js` only if required for client typecheck
- [x] Migrate `client/src/main.jsx` to `main.tsx`
- [x] Ensure Vitest environment remains green with TypeScript config present
- [ ] Add minimal ambient typing for environment variables if needed
- [ ] Defer `client/vite.config.js` to `client/vite.config.ts` until after `main.tsx` is green
- [ ] Defer `client/render-server.js`
- [ ] Do **not** touch `client/src/App.jsx`

Reason for this order:
- [ ] `client/src/main.jsx` is a runtime leaf with a tiny surface area
- [ ] `client/vite.config.js` is safe, but it is tooling glue rather than the first required runtime target
- [ ] `client/src/App.jsx` is a high-fanout client orchestration hub and should stay out of batch 1

**Definition of done**
- [x] Client can typecheck in hybrid mode.
- [ ] Vite dev/build still works.
- [ ] No user-visible behavior changes.

---

### Phase 2 — Shared low-risk module migration
**Goal:** establish common types and conventions in the least risky area.

Prioritize:
- [ ] Pure shared leaves with no internal shared dependencies:
  - `shared/accentColors.js`
  - `shared/profileSettings.js`
  - `shared/urlSecurity.js`
  - `shared/wardrobeOrder.js`
  - `shared/patternOptions.js`
  - `shared/stylePreferences.js`
  - `shared/productDetail.js`
  - `shared/colorSwatches.js`
- [ ] Then shared modules with internal shared dependencies:
  - `shared/wardrobeMerge.js`
  - `shared/i18n/helpers.js`
- [ ] Keep `shared/i18n/en.js` and `shared/i18n/ru.js` late within this phase unless tooling forces them earlier

During this phase:
- [ ] Replace loose object literals with named exported types where shapes repeat
- [ ] Introduce reusable string-literal unions for shared vocabularies where stable
- [ ] Prefer `as const` for lookup tables/constants
- [ ] Make helper/test fixtures typed where it improves clarity
- [ ] Keep `shared/i18n/helpers.js` intentionally loose at first; do not turn it into a strict key-safe translation system during migration

Sequencing notes:
- [ ] `shared/colorSwatches.js` is higher fanout than it looks because it feeds `shared/i18n/helpers.js`, client UI, and server PDF code
- [ ] `shared/i18n/helpers.js` should stay loose initially because it walks heterogeneous dictionaries dynamically

**Definition of done**
- [ ] Shared root tests still pass.
- [ ] At least one stable shared types module or pattern is established.
- [ ] These shared types are ready to be imported by client/server later if useful.

---

### Phase 3 — Client utilities, API layer, and presentational components
**Goal:** migrate client modules with relatively small runtime risk before moving into the app shell.

Recommended order:
- [ ] `client/src/api/config.js`
- [ ] `client/src/api/request.js`
- [ ] `client/src/api/auth.js`, `client/src/api/search.js`, `client/src/api/capsules.js`, `client/src/api/wardrobe.js`
- [ ] `client/src/i18n/index.js`
- [ ] `client/src/i18n/useI18n.js`
- [ ] `client/src/i18n/LocaleProvider.jsx`
- [ ] `client/src/utils/productLabel.js`
- [ ] low-risk presentational components in `client/src/components/**/*`
- [ ] `client/src/theme.js` to `theme.ts`

Focus areas:
- [ ] Type API request/response envelopes
- [ ] Type i18n dictionaries and locale keys
- [ ] Type MUI theme-related exports
- [ ] Type reusable component props
- [ ] Avoid over-generalizing prop types too early
- [ ] Add a small explicit response/error envelope type before migrating `client/src/api/request.js`

Sequencing notes:
- [ ] `client/src/api/request.js` mutates `Error` instances with `status` and `data`, so it should not be migrated without a small explicit envelope type
- [ ] `client/src/i18n/index.js` and `client/src/i18n/useI18n.js` are high-fanout client hubs and should follow the shared helper migration rather than precede it
- [ ] Keep `client/src/components/LocaleSwitcher.jsx` after `client/src/i18n/useI18n.js`
- [ ] Keep chart code and dynamic-key stats UI later in the client migration

**Definition of done**
- [ ] Low-risk client modules are migrated.
- [ ] Client tests still pass.
- [ ] Shared API/data contracts that obviously belong in `shared/` are identified.

---

### Phase 4 — Client screens and app shell
**Goal:** migrate stateful UI and top-level React flow.

Recommended order:
- [ ] `client/src/search/**/*`
- [ ] `client/src/screens/**/*`
- [ ] `client/src/App.jsx` to `App.tsx`
- [ ] remaining test files under `client/src/*.test.*`

Focus areas:
- [ ] State shape typing
- [ ] Form event typing
- [ ] Context/provider typing if present
- [ ] Router/navigation typing if applicable
- [ ] Search/filter model typing
- [ ] Narrow nullable async-loaded state carefully

**Definition of done**
- [ ] Client source is predominantly TS/TSX.
- [ ] Client app builds and tests pass.
- [ ] No remaining critical `.jsx/.js` files in `client/src/` except intentionally deferred edge cases.

---

### Phase 5 — Server TypeScript bootstrap in hybrid mode
**Goal:** add TS support to server without touching the riskiest modules yet.

Recommended first changes:
- [ ] Add server typings:
  - `typescript`
  - `@types/node`
  - `@types/express`
- [ ] Decide runtime strategy:
  - build server TS to JS before running, or
  - use a TS runtime only in dev
- [ ] Update server scripts accordingly
- [ ] Add server-compatible module resolution and output config
- [ ] Keep existing test command behavior stable or intentionally replace it with a TS-capable equivalent

**Decision note**
Prefer compiling server TypeScript for production rather than depending on a TS runtime in production.

**Definition of done**
- [ ] Server can typecheck in hybrid mode.
- [ ] Development startup path is still simple and reproducible.
- [ ] Production start path is defined for TS sources.

---

### Phase 6 — Server low-risk stores and pure logic
**Goal:** migrate server modules that are important but structurally manageable.

Recommended first candidates:
- [ ] `authStore`
- [ ] `capsuleStore`
- [ ] `profileStore`
- [ ] `searchStore`
- [ ] `serverUrlSecurity`
- [ ] other pure helper modules with strong local tests

Why these first:
- They appear to have dedicated tests.
- They are likely to expose reusable domain/data shapes.
- They are safer than top-level request handling and external integration modules.

Focus areas:
- [ ] Define input/output types for store methods
- [ ] Type persisted entity shapes
- [ ] Type query/filter/result structures
- [ ] Extract repeated domain models to `shared/` only when it genuinely reduces duplication

**Definition of done**
- [ ] Store tests pass after migration.
- [ ] Core entity shapes are explicit.
- [ ] Minimal `any` use in migrated server logic.

---

### Phase 7 — DB, auth/email, and request/response boundaries
**Goal:** type the boundary where server logic meets external systems.

Recommended candidates:
- [ ] `db.js`
- [ ] `email.js`
- [ ] auth-related request handling and security-sensitive modules
- [ ] modules that shape request payloads, DB rows, or response bodies

Focus areas:
- [ ] Database row/result typing
- [ ] request body/query/param typing
- [ ] auth/session/profile payload typing
- [ ] external service response typing
- [ ] nullability and optional fields at the boundary

Guardrails:
- [ ] Avoid fake precision for external SDK responses unless the shape is actually controlled/used
- [ ] Prefer narrow local interfaces over importing huge SDK types everywhere
- [ ] Add explicit conversion/mapping functions when DB rows differ from domain objects

**Definition of done**
- [ ] Boundary modules have explicit types.
- [ ] Security-sensitive flows remain test-covered.
- [ ] Request/response shapes are documented in code.

---

### Phase 8 — Server entrypoints and higher-risk integration modules
**Goal:** migrate the most interconnected and failure-prone code after the domain model is already typed.

Migrate late:
- [ ] `server/src/index.js`
- [ ] AI integration modules
- [ ] image pipeline modules
- [ ] prompt/image child-process modules
- [ ] PDF generation modules (`wardrobePdf*`)
- [ ] template-related modules if they rely on complex structured data

Why late:
- These modules likely combine many dependencies, environment variables, SDK response shapes, streaming, files, buffers, or child-process interfaces.
- They benefit from already-typed stores, DB helpers, and shared models.

Focus areas:
- [ ] explicit environment variable typing
- [ ] streaming/event typing
- [ ] file/buffer/path typing
- [ ] child-process message payload typing
- [ ] typed request lifecycle and error payloads
- [ ] typed prompt/image generation request/result objects

**Definition of done**
- [ ] Server runtime entrypoint is on TypeScript.
- [ ] High-risk integration tests remain green.
- [ ] No JS-only dependency remains in the main execution path unless intentionally isolated.

---

### Phase 9 — Test migration and cleanup
**Goal:** remove migration leftovers and make TS the normal development mode.

- [ ] Migrate remaining `.test.js/.test.jsx` files to `.test.ts/.test.tsx` where appropriate
- [ ] Remove stale JS interop shims no longer needed
- [ ] Remove broad suppression comments
- [ ] Tighten compiler settings incrementally
- [ ] Add CI typecheck enforcement if not already present
- [ ] Decide whether `allowJs` should remain enabled for any intentionally non-migrated files

**Definition of done**
- [ ] Test suite is TS-compatible.
- [ ] Typecheck is part of the normal quality gate.
- [ ] Remaining debt is explicit and small.

---

## Suggested Batch Order for Codex

Use **small, completion-oriented batches**, not “migrate everything in one run”.

Recommended execution sequence:

1. [x] TS configs + root typecheck scripts
2. [x] client bootstrap leaf (`main.tsx`, optional `test/setup.ts`) without touching `App.jsx`
3. [ ] shared pure leaves + tests
4. [ ] shared dependent helpers (`wardrobeMerge`, `i18n/helpers`)
5. [ ] client API base + i18n hubs
6. [ ] client presentational components + theme
7. [ ] client screens/search/App
8. [ ] server TS bootstrap/scripts
9. [ ] server stores (`authStore`, `capsuleStore`, `profileStore`, `searchStore`)
10. [ ] server DB/auth/email boundary modules
11. [ ] server entrypoint
12. [ ] AI/image/PDF modules
13. [ ] final strictness cleanup

---

## Post-Batch Log

### Batch 1 — Phase 0 / Phase 1 client TS bootstrap scaffold

- Batch name / phase: Batch 1 — Phase 0 / Phase 1 client TS bootstrap scaffold
- Exact files changed:
  - `package.json`
  - `package-lock.json`
  - `tsconfig.base.json`
  - `client/package.json`
  - `client/tsconfig.json`
  - `client/index.html`
  - `client/src/main.test.jsx`
  - `client/src/main.tsx`
  - `typescript-migration.md`
- Commands run:
  - `npm install -D typescript`
  - `npm --workspace client install -D @types/node @types/react @types/react-dom`
  - `npx tsc -p client/tsconfig.json --noEmit`
  - `npm --workspace client run test`
- Typecheck passed: yes
- Tests passed: yes
- `client/src/test/setup.js` had to be migrated: no
- Type errors worked around temporarily: none
- `any`, assertion, or suppression introduced: none
- Newly discovered blockers:
  - existing non-fatal jsdom CSS parse warning from `client/src/index.css` still appears during client tests
- Recommended next batch:
  - Phase 2 shared low-risk module migration, starting with pure shared leaf modules

---

## Subagent Guidance for Codex

For this repository, subagents should be used selectively.

### Use subagents for:
- cross-module dependency mapping before each batch
- identifying all imports/call sites of a target module
- checking for risky dynamic patterns
- reviewing post-migration casts / `any` usage
- checking whether test coverage still matches the changed module surface

### Do not use subagents for:
- tiny file renames
- single isolated utility migrations
- trivial annotation fixes after type errors are already localized

### Recommended subagent roles per non-trivial batch

Before implementation:
- [ ] Subagent A: map imports/exports and affected callers
- [ ] Subagent B: identify runtime-risky JS patterns (dynamic keys, mutation, ad-hoc object shapes, SDK result assumptions)
- [ ] Subagent C: identify test files and likely regression surfaces

After implementation:
- [ ] Subagent D: find unnecessary `any`, unsafe casts, and weak unions
- [ ] Subagent E: find likely missing tests or broken assumptions
- [ ] Subagent F: review maintainability and consistency with already migrated TS patterns

---

## Risk Register

### High risk
- [ ] `server/src/index.js`
- [ ] AI SDK integration modules
- [ ] image pipeline / child-process modules
- [ ] PDF generation modules
- [ ] modules that pass complex objects between server, templates, and external providers

### Medium risk
- [ ] DB layer and data mapping
- [ ] email/auth flow
- [ ] stateful client screens and search flows

### Low risk
- [ ] shared constants and helpers
- [ ] presentational client components
- [ ] theme/config files
- [ ] isolated stores with strong tests and limited IO

---

## Anti-Patterns to Avoid During Migration

- [ ] Converting large unrelated file sets in one pass
- [ ] Simultaneously changing logic and types unless necessary
- [ ] Using `any` to silence unknown shapes that should become explicit interfaces
- [ ] Exporting overly broad “mega-types”
- [ ] Moving too many types into `shared/` before their ownership is clear
- [ ] Making server runtime/build changes in the same batch as risky business logic changes
- [ ] Tightening `strict` too early

---

## Validation Checklist for Every Batch

- [ ] Only the intended scope was migrated
- [ ] Imports/exports still resolve
- [ ] Typecheck passes for the relevant package(s)
- [ ] Existing tests pass
- [ ] No visible behavior regression found in manual smoke testing
- [ ] New TODOs / debt are documented here
- [ ] Next safe batch is identified before stopping

---

## First Recommended Batch (Completed)

Batch 1 is complete.

- [x] Added TypeScript infrastructure for the root/client path:
  - root TS dependency
  - `tsconfig.base.json`
  - `client/tsconfig.json`
  - root `typecheck`
  - `client:typecheck`
- [x] Added client typings:
  - `@types/node`
  - `@types/react`
  - `@types/react-dom`
- [x] Migrated `client/src/main.jsx` → `client/src/main.tsx`
- [x] Evaluated `client/src/test/setup.js` and left it as JS because migration was not required for client typecheck to pass
- [x] Validated with:
  - `npx tsc -p client/tsconfig.json --noEmit`
  - `npm --workspace client run test`
- [x] Kept out of scope:
  - `client/src/App.jsx`
  - any `shared/*.js`
  - `client/vite.config.js`
  - `client/render-server.js`
  - `client/netlify/functions/bff.js`
  - any `server/src/*.js`

Recommended next batch:
- [ ] Phase 2 shared low-risk module migration, starting with pure shared leaf modules

---

## Notes / Migration Log

Use this section during execution.

### Completed
- [x] Batch 1 — Phase 0 / Phase 1 client TS bootstrap scaffold completed successfully
- [x] Root/client TypeScript bootstrap is in place and client hybrid typecheck passes
- [x] `client/src/test/setup.js` was reviewed and intentionally left as JS because migration was not required in Batch 1

### Newly discovered blockers
- [ ] `shared/` is not an npm workspace package. It is imported by path from both apps, so shared-module renames have cross-workspace impact immediately.
- [ ] Explicit `.js` and `.jsx` import specifiers are widespread. Early renames of shared or server modules will create broad import churn.
- [ ] `server/src/index.js` is both the API entrypoint and the Vite dev host in development. Treat it as a late-stage migration target.
- [ ] `client/render-server.js` and `client/netlify/functions/bff.js` are deployment/runtime entrypoints and should stay out of the first client batch.
- [ ] Server TS conversion is blocked on a runtime strategy decision:
  - `tsx` for dev/test, or
  - emitted JS build output for server execution
- [ ] `server/src/db.js` is a high-fanout backend infrastructure module and should be split into smaller migration slices later, not included in the first batch.
- [ ] `server/src/ai/*`, `server/src/wardrobePdf.js`, and child-process files remain late-stage targets.
- [ ] `client/src/index.css` currently triggers a non-fatal jsdom CSS parse warning during client tests; do not treat that warning as a TS migration regression unless it becomes test-fatal.

### What Not To Touch Yet
- [ ] `server/src/index.js`
- [ ] `server/src/db.js`
- [ ] `server/src/searchStore.js`
- [ ] `server/src/wardrobePdf.js`
- [ ] `server/src/wardrobePdf.child.js`
- [ ] `server/src/ai/*`
- [ ] `client/src/App.jsx`
- [ ] `client/src/screens/SearchScreen.jsx`
- [ ] `client/src/screens/StatisticsScreen.jsx`
- [ ] `client/src/search/searchState.js`
- [ ] `client/render-server.js`
- [ ] `client/netlify/functions/bff.js`

### Post-Batch Log Template
After every completed batch, append a short entry with:
- [ ] batch name / phase
- [ ] exact files changed
- [ ] commands run
- [ ] whether typecheck passed
- [ ] whether tests passed
- [ ] whether `client/src/test/setup.js` had to be migrated
- [ ] any type errors worked around temporarily
- [ ] any `any`, assertion, or suppression introduced
- [ ] newly discovered blockers
- [ ] recommended next batch

### Deferred decisions
- [ ] Whether server TS should use emitted build output only, or a TS runtime in dev
- [ ] Final strictness target and timeline
- [ ] Whether selected domain types should live in `shared/` or remain package-local
